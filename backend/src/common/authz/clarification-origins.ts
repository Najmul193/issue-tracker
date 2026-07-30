import { PrismaService } from '../../modules/prisma/prisma.service';

/**
 * For each given issue currently in CLARIFICATION_REQUESTED, the status it was in when the
 * request was raised — read from the most recent STATUS_CHANGED activity log.
 *
 * This is the input `getPermittedTransitions()` (modules/issues/transition-rules.ts) needs to
 * decide which single status answering a clarification should return to. It is extracted into
 * its own function — rather than left as a private method on one service — specifically because
 * a second caller (the dashboard's `myActionableIssues`, see notifications.service.ts) also
 * calls `getPermittedTransitions()` on CLARIFICATION_REQUESTED rows and needs the same input.
 * Two separate copies of this lookup is exactly how the origin got silently dropped once already
 * (a CLARIFICATION_REQUESTED row rendered both answer targets instead of one) — one shared
 * function makes that mistake impossible to make twice.
 *
 * One query for the whole batch; ordered newest-first so the first row seen per issue is current.
 * Returns an empty map without querying when `issueIds` is empty.
 */
export async function getClarificationOrigins(
  prisma: PrismaService,
  issueIds: string[],
): Promise<Map<string, string | null>> {
  const origins = new Map<string, string | null>();
  if (issueIds.length === 0) return origins;

  const logs = await prisma.activityLog.findMany({
    where: {
      issueId: { in: issueIds },
      action: 'STATUS_CHANGED',
      newValue: 'CLARIFICATION_REQUESTED',
    },
    orderBy: { createdAt: 'desc' },
    select: { issueId: true, oldValue: true },
  });

  for (const log of logs) {
    if (!origins.has(log.issueId)) origins.set(log.issueId, log.oldValue);
  }
  return origins;
}
