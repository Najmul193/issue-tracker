import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertOctagon, Clock, History, CheckCircle2, Sparkles, ArrowRight, type LucideIcon } from 'lucide-react';
import type { AssignedIssueSummary } from '../../api/dashboard';
import IssueQuickActions from '../IssueQuickActions';
import { useToast } from '../ui/Toast';
import EmptyState from '../ui/EmptyState';
import { staggerContainer, staggerItem } from '../../lib/motion';

interface Props {
  /** Issues where the current actor's role/org is the party responsible for moving the
   * issue to its next stage, given its CURRENT status — not just literal assignment.
   * e.g. an issue in SI_APPROVAL/UNDER_REVIEW/SI_REVIEW is the SI team's responsibility;
   * PENDING_CLIENT_APPROVAL and CLARIFICATION_REQUESTED are the client/raiser's responsibility;
   * ASSIGNED/IN_PROGRESS are the assignee's responsibility. See backend
   * `getDashboardMetrics` → `myActionableIssues` for the exact rule set. */
  issues: AssignedIssueSummary[];
  /** Bubbles up whether any suggestion card is mid-action, so the dashboard can pause its
   * 30s metrics poll — the same reason `Concern.tsx` pauses while a row is busy. */
  onBusyChange?: (busy: boolean) => void;
}

const STALE_DAYS = 3;
const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const PRIORITY_LABEL: Record<string, string> = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

/** What's actually blocking progress at this status, phrased as a clause following the issue title. */
const ACTION_HINT: Record<string, string> = {
  NEW: 'needs SI triage',
  SI_APPROVAL: 'is waiting on SI validation',
  UNDER_REVIEW: 'is waiting on SI review',
  CLARIFICATION_REQUESTED: 'is waiting on your clarification',
  ASSIGNED: "hasn't been started yet",
  IN_PROGRESS: 'is in progress',

  SI_REVIEW: 'is waiting on SI sign-off',
  PENDING_CLIENT_APPROVAL: 'is waiting on your approval',
};

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

interface Note {
  id: string;
  icon: LucideIcon;
  tone: string;
  message: string;
  to: string;
}

const TONE_CLASSES: Record<string, string> = {
  red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
};

/** Scores an issue for "what should I work on next" — priority first, then how soon it's due, then a nudge for work not yet started. */
function suggestionScore(issue: AssignedIssueSummary): number {
  const priorityWeight = PRIORITY_WEIGHT[issue.priority] ?? 1;
  const notYetStarted = issue.status === 'ASSIGNED' || issue.status === 'NEW' ? 6 : 0;
  const hoursLeft = issue.deadline ? hoursUntil(issue.deadline) : Infinity;
  const urgency = hoursLeft === Infinity ? 0 : Math.max(0, 100 - hoursLeft / 4);
  return priorityWeight * 20 + notYetStarted + urgency;
}

/** Turns a scored issue into a natural-language, status-aware recommendation. */
function buildSuggestionMessage(issue: AssignedIssueSummary): string {
  const priorityLabel = PRIORITY_LABEL[issue.priority] ?? issue.priority;
  const hint = ACTION_HINT[issue.status];
  const overdue = issue.deadline ? hoursUntil(issue.deadline) < 0 : false;
  const dueSoon = issue.deadline ? hoursUntil(issue.deadline) >= 0 && hoursUntil(issue.deadline) <= 24 : false;

  if (overdue) {
    return hint
      ? `"${issue.title}" ${hint} and is already overdue.`
      : `"${issue.title}" is already overdue.`;
  }
  if (dueSoon) {
    return hint
      ? `"${issue.title}" ${hint} and is due within 24 hours.`
      : `"${issue.title}" is due within 24 hours.`;
  }
  if (hint) {
    return `"${issue.title}" (${priorityLabel}) ${hint}.`;
  }
  return `"${issue.title}" (${priorityLabel}) — based on priority and deadline.`;
}

function buildSummaryLine(overdueCount: number, dueSoonCount: number, totalActive: number): string {
  if (overdueCount > 0) {
    return `You have ${overdueCount} overdue issue${overdueCount === 1 ? '' : 's'} needing attention.`;
  }
  if (dueSoonCount > 0) {
    return `${dueSoonCount} issue${dueSoonCount === 1 ? ' is' : 's are'} due within the next 24 hours.`;
  }
  return `No urgent deadlines right now — ${totalActive} active issue${totalActive === 1 ? '' : 's'} on your plate.`;
}

export default function NotesPanel({ issues, onBusyChange }: Props) {
  const showToast = useToast();
  // Keyed by issue id so several cards can be mid-action at once without one finishing
  // resuming the poll out from under the others — same reasoning as Concern.tsx.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const setRowBusy = (issueId: string, busy: boolean) => {
    setBusyIds((prev) => {
      if (prev.has(issueId) === busy) return prev;
      const next = new Set(prev);
      if (busy) next.add(issueId);
      else next.delete(issueId);
      return next;
    });
  };
  useEffect(() => {
    onBusyChange?.(busyIds.size > 0);
  }, [busyIds, onBusyChange]);

  // Closed issues are done — their deadlines/staleness are no longer actionable.
  const activeIssues = issues.filter((i) => i.status !== 'CLOSED');

  if (activeIssues.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 />}
        title="All caught up"
        description="No urgent deadlines or stale issues right now."
        className="py-6"
      />
    );
  }

  // Counts reflect the WHOLE actionable set, independent of how many make it into the ranked
  // cards below, so the summary line stays accurate regardless of how many are shown.
  let overdueCount = 0;
  let dueSoonCount = 0;
  for (const issue of activeIssues) {
    if (!issue.deadline) continue;
    const hrs = hoursUntil(issue.deadline);
    if (hrs < 0) overdueCount++;
    else if (hrs <= 24) dueSoonCount++;
  }
  const summaryLine = buildSummaryLine(overdueCount, dueSoonCount, activeIssues.length);

  // Ranked "what to work on next" — normally the top 3, but widens up to 5 when more than 3
  // issues are overdue or due within 24h, so nothing urgent gets crowded out of view.
  const ranked = [...activeIssues].sort((a, b) => suggestionScore(b) - suggestionScore(a));
  const urgentCount = overdueCount + dueSoonCount;
  const topN = Math.min(5, Math.max(3, urgentCount));
  const suggestions = ranked.slice(0, Math.min(topN, ranked.length));
  const suggestedIds = new Set(suggestions.map((s) => s.id));

  // Deadline & staleness alerts for everything NOT already surfaced as a ranked card above —
  // otherwise a busy panel would show the same issue twice.
  const notes: Note[] = [];
  for (const issue of activeIssues) {
    if (suggestedIds.has(issue.id)) continue;
    const hint = ACTION_HINT[issue.status];

    if (issue.deadline) {
      const hrs = hoursUntil(issue.deadline);
      if (hrs < 0) {
        notes.push({
          id: `overdue-${issue.id}`,
          icon: AlertOctagon,
          tone: 'red',
          message: hint ? `"${issue.title}" ${hint} and is overdue` : `"${issue.title}" is overdue`,
          to: `/issues/${issue.id}`,
        });
      } else if (hrs <= 24) {
        notes.push({
          id: `soon-${issue.id}`,
          icon: Clock,
          tone: 'amber',
          message: hint ? `"${issue.title}" ${hint} and is due within 24 hours` : `"${issue.title}" is due within 24 hours`,
          to: `/issues/${issue.id}`,
        });
      }
    }

    const idleDays = Math.floor(daysSince(issue.updatedAt));
    if (idleDays >= STALE_DAYS) {
      notes.push({
        id: `stale-${issue.id}`,
        icon: History,
        tone: 'violet',
        message: hint
          ? `"${issue.title}" ${hint} and hasn't moved in ${idleDays}+ days`
          : `"${issue.title}" hasn't moved in ${idleDays}+ days`,
        to: `/issues/${issue.id}`,
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500 dark:text-slate-400">{summaryLine}</p>

      {/* Ranked "what to work on next" — top pick highlighted, the rest numbered */}
      <motion.ul variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
        {suggestions.map((issue, index) => (
          <motion.li key={issue.id} variants={staggerItem}>
            <div
              className={
                index === 0
                  ? 'rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-3 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-slate-800'
                  : 'rounded-xl border border-neutral-200 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800'
              }
            >
              <div className="flex items-start justify-between gap-3">
                <Link to={`/issues/${issue.id}`} className="flex min-w-0 flex-1 items-start gap-2.5 group">
                  <span
                    className={
                      index === 0
                        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                        : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500 dark:bg-slate-700 dark:text-slate-400'
                    }
                  >
                    {index === 0 ? <Sparkles className="h-4 w-4" /> : index + 1}
                  </span>
                  <p className="min-w-0 pt-1 text-sm text-neutral-800 dark:text-slate-200">
                    {buildSuggestionMessage(issue)}
                  </p>
                </Link>
                <Link
                  to={`/issues/${issue.id}`}
                  className="mt-1.5 shrink-0 text-brand-500 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100"
                  aria-label="Open issue"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-2 pl-[42px]">
                <IssueQuickActions issue={issue} onResult={showToast} onBusyChange={setRowBusy} />
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ul>

      {/* Everything else that's overdue, due soon, or stale */}
      {notes.length > 0 && (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="scrollbar-thin max-h-56 space-y-1.5 overflow-y-auto"
        >
          {notes.map((note) => {
            const Icon = note.icon;
            return (
              <motion.li key={note.id} variants={staggerItem}>
                <Link
                  to={note.to}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-slate-700/40"
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[note.tone]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 text-neutral-700 dark:text-slate-300">{note.message}</span>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
