import { IssueStatus } from '@prisma/client';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { TRANSITION_MAP } from './state-machine';

/**
 * Which status changes may THIS actor perform on THIS issue.
 *
 * This is the single source of truth for status-change authorization as seen by clients:
 * `findAll` / `findOne` annotate every issue with the result, and the frontend renders
 * exactly those buttons. It holds no rules of its own.
 *
 * Every rule below is transcribed from the guard chain in `IssuesService.updateStatus()`
 * and cites the line it mirrors. The two must agree — `__tests__/transition-rules.spec.ts`
 * proves it exhaustively by attempting every transition against the real endpoint.
 *
 * IF YOU CHANGE A GUARD IN updateStatus(), CHANGE IT HERE TOO.
 *
 * Pure by design: no DI, no Prisma access. Every field it reads is already present on a
 * list row, so annotating a page of issues costs no extra queries.
 */

/** `RESOLVED` is a virtual action, never stored — the service rewrites it to SI_REVIEW. */
export type TransitionTarget = IssueStatus | 'RESOLVED';

/** The minimum shape needed to decide. Satisfied by both list rows and `findOne` results. */
export interface TransitionSubject {
  status: IssueStatus;
  raisedById: string;
  raisedByOrgId: string;
  assignedToUserId: string | null;
  assignedToOrgId: string | null;
  assignedToUser?: { organizationId: string } | null;
  /**
   * For an issue sitting in CLARIFICATION_REQUESTED: the status it was in when the
   * clarification was requested, read from the most recent STATUS_CHANGED activity log.
   *
   * This decides where answering sends it back to, and the distinction is the whole
   * point of the stage:
   *   - asked from SI_APPROVAL / UNDER_REVIEW (SI <-> creator, before assignment)
   *     -> answer returns to UNDER_REVIEW for SI to continue triage
   *   - asked from IN_PROGRESS (assignee <-> creator, after assignment)
   *     -> answer returns to IN_PROGRESS so the assignee carries on
   * Offering both would let a pre-assignment clarification jump straight into IN_PROGRESS,
   * skipping the assignment gate entirely.
   *
   * `null`/absent falls back to IN_PROGRESS, matching the historical UI behaviour for
   * issues with no matching log entry.
   */
  clarificationOrigin?: string | null;
}

/** Where answering a clarification request sends the issue back to. */
export function clarificationReturnTarget(origin: string | null | undefined): IssueStatus {
  return origin === 'UNDER_REVIEW' || origin === 'SI_APPROVAL' ? 'UNDER_REVIEW' : 'IN_PROGRESS';
}

/**
 * Reads the clarification origin off an issue whose activity logs are already loaded
 * (as `findOne` loads them, newest first). Returns null when nothing matches.
 */
export function clarificationOriginOf(issue: {
  activityLogs?: { action: string; oldValue: string | null; newValue: string | null }[];
}): string | null {
  const log = issue.activityLogs?.find(
    (l) => l.action === 'STATUS_CHANGED' && l.newValue === 'CLARIFICATION_REQUESTED',
  );
  return log?.oldValue ?? null;
}

/**
 * Mirrors `AuthService.canActOnIssue()` (auth.service.ts:221-239), the gate `updateStatus`
 * applies before any per-transition guard.
 *
 * Deliberately checks the RAW `assignedToOrgId` and does NOT fall back to
 * `assignedToUser.organizationId` — that asymmetry is real in the original and load-bearing:
 * a colleague of the assignee cannot act when the issue was assigned to a user rather than
 * to an org queue.
 */
function canActOnIssue(issue: TransitionSubject, actor: JwtPayload): boolean {
  if (actor.role === 'SUPER_ADMIN') return true;
  // SI (Data Edge) is the central team — always involved in both workflows
  if (actor.organizationType === 'SI') return true;
  if (actor.organizationId === issue.raisedByOrgId) return true;
  if (issue.assignedToOrgId && actor.organizationId === issue.assignedToOrgId) return true;
  if (issue.assignedToUserId && actor.userId === issue.assignedToUserId) return true;
  return false;
}

/**
 * The per-transition guards use this fallback everywhere
 * (e.g. issues.service.ts:709-710) even though `canActOnIssue` above does not.
 */
function effectiveAssignedOrgId(issue: TransitionSubject): string | null {
  return issue.assignedToOrgId ?? issue.assignedToUser?.organizationId ?? null;
}

interface ActorFacts {
  isSuperAdmin: boolean;
  isSi: boolean;
  isSiOrgAdmin: boolean;
  isCreator: boolean;
  isCreatorOrgAdmin: boolean;
  isAssignee: boolean;
  isAssigneeOrg: boolean;
}

function describeActor(issue: TransitionSubject, actor: JwtPayload): ActorFacts {
  const assignedOrgId = effectiveAssignedOrgId(issue);
  return {
    isSuperAdmin: actor.role === 'SUPER_ADMIN',
    isSi: actor.organizationType === 'SI',
    isSiOrgAdmin: actor.organizationType === 'SI' && actor.role === 'ORG_ADMIN',
    isCreator: issue.raisedById === actor.userId,
    isCreatorOrgAdmin:
      actor.organizationId === issue.raisedByOrgId && actor.role === 'ORG_ADMIN',
    isAssignee: !!issue.assignedToUserId && actor.userId === issue.assignedToUserId,
    isAssigneeOrg: !!assignedOrgId && actor.organizationId === assignedOrgId,
  };
}

/**
 * One (from -> to) pair. Returns whether the per-transition guards permit it.
 * Assumes `canActOnIssue` has already passed.
 */
function isTransitionPermitted(
  issue: TransitionSubject,
  to: TransitionTarget,
  a: ActorFacts,
): boolean {
  const from = issue.status;

  // RESOLVED is only reachable from IN_PROGRESS (state-machine.ts:45-48).
  // Guard: issues.service.ts:717-728 — assigned team or SI.
  if (to === 'RESOLVED') {
    return from === 'IN_PROGRESS' && (a.isAssignee || a.isAssigneeOrg || a.isSuperAdmin || a.isSi);
  }

  switch (from) {
    // issues.service.ts:584-590 — only SI (or SUPER_ADMIN) acknowledges a new issue.
    case 'NEW':
      return to === 'UNDER_REVIEW' && (a.isSuperAdmin || a.isSi);

    case 'SI_APPROVAL':
      // SI_APPROVAL is a hold state: the creator's assignment does not take effect
      // until SI validates it. Guard added alongside this module (see updateStatus).
      if (to === 'ASSIGNED') return a.isSuperAdmin || a.isSi;
      // issues.service.ts:669-686 — assigned team or SI may bounce it back for clarification.
      if (to === 'CLARIFICATION_REQUESTED') {
        return a.isAssignee || a.isAssigneeOrg || a.isSuperAdmin || a.isSi;
      }
      return false;

    // issues.service.ts:593-602 governs both targets. For CLARIFICATION_REQUESTED the
    // :669 guard also applies, but SI/SUPER_ADMIN satisfy it, so the result is the same.
    case 'UNDER_REVIEW':
      if (to === 'ASSIGNED' || to === 'CLARIFICATION_REQUESTED') {
        return a.isSuperAdmin || a.isSi;
      }
      return false;

    // issues.service.ts:689-704 — only the creator's side may answer a clarification request.
    // Note SI is NOT permitted here unless it happens to be the creator's org admin.
    // The answer must return to the stage the request came from — see clarificationOrigin.
    case 'CLARIFICATION_REQUESTED':
      if (to !== 'UNDER_REVIEW' && to !== 'IN_PROGRESS') return false;
      if (!(a.isCreator || a.isCreatorOrgAdmin || a.isSuperAdmin)) return false;
      return to === clarificationReturnTarget(issue.clarificationOrigin);

    // issues.service.ts:707-714 — the assigned team starts work.
    // Plain SI membership is deliberately NOT enough here.
    case 'ASSIGNED':
      return to === 'IN_PROGRESS' && (a.isAssignee || a.isAssigneeOrg || a.isSuperAdmin);

    // issues.service.ts:669-686 — assigned team or SI.
    case 'IN_PROGRESS':
      return (
        to === 'CLARIFICATION_REQUESTED' &&
        (a.isAssignee || a.isAssigneeOrg || a.isSuperAdmin || a.isSi)
      );

    // issues.service.ts:633-639 (reject) and :653-659 (the whole stage) — SI only.
    case 'SI_REVIEW':
      if (to === 'PENDING_CLIENT_APPROVAL' || to === 'ASSIGNED') {
        return a.isSuperAdmin || a.isSi;
      }
      return false;

    // issues.service.ts:605-616 (close) and :619-630 (reject) — the client side only.
    case 'PENDING_CLIENT_APPROVAL':
      if (to === 'CLOSED' || to === 'ASSIGNED') {
        return a.isSuperAdmin || a.isCreator || a.isCreatorOrgAdmin;
      }
      return false;

    // issues.service.ts:642-650 — the ONLY guard requiring SI *ORG_ADMIN* specifically.
    // A plain SI user may not reopen.
    case 'CLOSED':
      return to === 'UNDER_REVIEW' && (a.isSuperAdmin || a.isSiOrgAdmin);

    // Defensive: every member of IssueStatus is handled above. This catches a status
    // added to the Prisma enum without a rule here — fail closed rather than allow.
    default:
      return false;
  }
}

/**
 * The status changes `actor` may currently perform on `issue`.
 * Returns `[]` when the actor may not touch the issue at all.
 */
export function getPermittedTransitions(
  issue: TransitionSubject,
  actor: JwtPayload,
): TransitionTarget[] {
  if (!canActOnIssue(issue, actor)) return [];

  const candidates: TransitionTarget[] = [...(TRANSITION_MAP[issue.status] ?? [])];
  // The virtual RESOLVED action is not in TRANSITION_MAP; the state machine special-cases it.
  if (issue.status === 'IN_PROGRESS') candidates.push('RESOLVED');

  const facts = describeActor(issue, actor);
  return candidates.filter((target) => isTransitionPermitted(issue, target, facts));
}
