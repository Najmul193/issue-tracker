import { Injectable } from '@nestjs/common';
import { IssueStatus } from '@prisma/client';

interface TransitionResult {
  valid: boolean;
  error?: string;
  allowedTransitions?: IssueStatus[];
}

const TRANSITION_MAP: Record<IssueStatus, IssueStatus[]> = {
  NEW: ['ACKNOWLEDGED', 'ASSIGNED'],
  ACKNOWLEDGED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['VERIFIED', 'REOPENED'],
  VERIFIED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS'],
};

@Injectable()
export class StateMachine {
  getAllowedTransitions(current: IssueStatus): IssueStatus[] {
    return TRANSITION_MAP[current] ?? [];
  }

  canTransition(current: IssueStatus, target: IssueStatus): TransitionResult {
    const allowed = this.getAllowedTransitions(current);
    if (allowed.includes(target)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Cannot transition from ${current} to ${target}. Valid next states: ${allowed.join(', ') || 'none'}`,
      allowedTransitions: allowed,
    };
  }
}
