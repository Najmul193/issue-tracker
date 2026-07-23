import { Injectable } from '@nestjs/common';
import { IssueStatus } from '@prisma/client';

interface TransitionResult {
  valid: boolean;
  error?: string;
  allowedTransitions?: IssueStatus[];
}

/**
 * Defines all valid status transitions for the branched issue workflow.
 *
 * Two flows are supported:
 *   Flow A (Client -> SI):       NEW -> UNDER_REVIEW -> ASSIGNED -> IN_PROGRESS -> [IN_QA ->] PENDING_CLIENT_APPROVAL -> CLOSED
 *   Flow B (Client -> SI -> OEM): NEW -> UNDER_REVIEW -> ASSIGNED -> IN_PROGRESS -> SI_REVIEW -> PENDING_CLIENT_APPROVAL -> CLOSED
 *
 * NOTE: When an actor submits status=RESOLVED, the service layer intercepts it and
 * auto-routes to SI_REVIEW (OEM assignee), IN_QA (SI assignee + requiresQA=true), or
 * PENDING_CLIENT_APPROVAL (SI assignee + requiresQA=false). RESOLVED is never stored in the DB.
 */
const TRANSITION_MAP: Record<string, IssueStatus[]> = {
  NEW:                      ['UNDER_REVIEW'],
  UNDER_REVIEW:             ['CLARIFICATION_REQUESTED', 'ASSIGNED'],
  CLARIFICATION_REQUESTED:  ['UNDER_REVIEW', 'IN_PROGRESS'],
  ASSIGNED:                 ['IN_PROGRESS'],
  IN_PROGRESS:              ['CLARIFICATION_REQUESTED'],
  // RESOLVED is a virtual input mapped in canTransition; service routes to SI_REVIEW unconditionally
  IN_QA:                    ['PENDING_CLIENT_APPROVAL', 'IN_PROGRESS'], // Keeping in schema but unused in UI
  SI_REVIEW:                ['PENDING_CLIENT_APPROVAL', 'ASSIGNED'], // Approve -> Client, Reject -> Assignee
  PENDING_CLIENT_APPROVAL:  ['CLOSED', 'ASSIGNED'], // Approve -> Closed, Reject -> Assignee
  CLOSED:                   ['UNDER_REVIEW'],
};

@Injectable()
export class StateMachine {
  getAllowedTransitions(current: IssueStatus): IssueStatus[] {
    return TRANSITION_MAP[current as string] ?? [];
  }

  canTransition(current: IssueStatus, target: IssueStatus | 'RESOLVED'): TransitionResult {
    // RESOLVED is a virtual action — always allowed from IN_PROGRESS; service handles routing
    if (target === 'RESOLVED' && current === 'IN_PROGRESS') {
      return { valid: true };
    }

    const allowed = this.getAllowedTransitions(current);
    if (allowed.includes(target as IssueStatus)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Cannot transition from ${current} to ${target}. Valid next states: ${allowed.join(', ') || 'none'}`,
      allowedTransitions: allowed,
    };
  }
}
