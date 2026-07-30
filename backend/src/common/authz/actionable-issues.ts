import { Prisma, IssueStatus } from '@prisma/client';
import { JwtPayload } from '../../modules/auth/decorators/current-user.decorator';

/**
 * Coarse SQL prefilter for "issues this actor can currently act on".
 *
 * Used by the Concern page's Approval tab and by the dashboard's deadline-alert widget.
 *
 * This is NOT the authority on who may do what — `getPermittedTransitions()`
 * (modules/issues/transition-rules.ts) is. Prisma cannot run that function inside a WHERE
 * clause, so this predicate approximates it in SQL. Its only contract is to stay a
 * **superset** of what the rules permit: a row it lets through may turn out to have no
 * available action (the UI then shows an "Open" link), but a row it filters out is
 * invisible in the queue even though the actor could act on it.
 *
 * `transition-rules.spec.ts` asserts that every row this returns for the Approval tab has
 * at least one permitted transition, so the two cannot silently diverge.
 *
 * Deliberate omissions:
 * - CLOSED — SI org admins can reopen, but including it would put the entire closed
 *   archive in the queue. Reopening stays a detail-page action.
 * - IN_QA — removed from the IssueStatus enum entirely by the
 *   20260730120000_remove_in_qa_state migration.
 */
export function buildActionableIssuesFilter(actor: JwtPayload): Prisma.IssueWhereInput {
  const isSiResponsible = actor.role === 'SUPER_ADMIN' || actor.organizationType === 'SI';

  // Stages where the SI team is the party that must act.
  const siStatuses: IssueStatus[] = ['NEW', 'SI_APPROVAL', 'UNDER_REVIEW', 'SI_REVIEW'];
  // Stages where the raising (client) side must act.
  const clientStatuses: IssueStatus[] = ['CLARIFICATION_REQUESTED', 'PENDING_CLIENT_APPROVAL'];
  // Stages where the assigned team must act.
  const assigneeStatuses: IssueStatus[] = ['ASSIGNED', 'IN_PROGRESS'];

  const or: Prisma.IssueWhereInput[] = [
    { status: { in: assigneeStatuses }, assignedToUserId: actor.userId },
    { status: { in: assigneeStatuses }, assignedToOrgId: actor.organizationId },
    // Mirrors the `assignedToOrgId ?? assignedToUser.organizationId` fallback the guards
    // use throughout updateStatus — without it, issues assigned to a user with no org
    // queue set are missing from their colleagues' queues.
    { status: { in: assigneeStatuses }, assignedToUser: { organizationId: actor.organizationId } },
  ];

  if (isSiResponsible) {
    or.push({ status: { in: siStatuses } });
  }

  if (actor.role === 'SUPER_ADMIN') {
    or.push({ status: { in: clientStatuses } });
  } else if (actor.role === 'ORG_ADMIN') {
    or.push({ status: { in: clientStatuses }, raisedByOrgId: actor.organizationId });
  } else {
    or.push({ status: { in: clientStatuses }, raisedById: actor.userId });
  }

  return { OR: or };
}
