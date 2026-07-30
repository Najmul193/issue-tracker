import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertOctagon, Clock, History, CheckCircle2, Sparkles, ArrowRight, type LucideIcon } from 'lucide-react';
import type { AssignedIssueSummary } from '../../api/dashboard';
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

/** Turns the top-scored issue into a natural-language, status-aware recommendation. */
function buildSuggestionMessage(issue: AssignedIssueSummary): string {
  const priorityLabel = PRIORITY_LABEL[issue.priority] ?? issue.priority;
  const hint = ACTION_HINT[issue.status];
  const overdue = issue.deadline ? hoursUntil(issue.deadline) < 0 : false;
  const dueSoon = issue.deadline ? hoursUntil(issue.deadline) >= 0 && hoursUntil(issue.deadline) <= 24 : false;

  if (overdue) {
    return hint
      ? `"${issue.title}" ${hint} and is already overdue — this should be your next move.`
      : `"${issue.title}" is already overdue — this should be your next move.`;
  }
  if (dueSoon) {
    return hint
      ? `"${issue.title}" ${hint} and is due within 24 hours — worth tackling next.`
      : `"${issue.title}" is due within 24 hours — worth tackling next.`;
  }
  if (hint) {
    return `"${issue.title}" (${priorityLabel}) ${hint} — looks like the best place to focus next.`;
  }
  return `Based on priority and deadline, "${issue.title}" (${priorityLabel}) looks like the best place to focus next.`;
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

export default function NotesPanel({ issues }: Props) {
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

  const notes: Note[] = [];
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const issue of activeIssues) {
    const hint = ACTION_HINT[issue.status];

    if (issue.deadline) {
      const hrs = hoursUntil(issue.deadline);
      if (hrs < 0) {
        overdueCount++;
        notes.push({
          id: `overdue-${issue.id}`,
          icon: AlertOctagon,
          tone: 'red',
          message: hint ? `"${issue.title}" ${hint} and is overdue` : `"${issue.title}" is overdue`,
          to: `/issues/${issue.id}`,
        });
      } else if (hrs <= 24) {
        dueSoonCount++;
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

  const suggested = [...activeIssues].sort((a, b) => suggestionScore(b) - suggestionScore(a))[0];
  const summaryLine = buildSummaryLine(overdueCount, dueSoonCount, activeIssues.length);

  return (
    <div className="space-y-4">
      {/* Smart "what should I work on next" suggestion */}
      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <p className="mb-2 text-xs text-neutral-500 dark:text-slate-400">{summaryLine}</p>
        <Link
          to={`/issues/${suggested.id}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-3 transition-shadow hover:shadow-card dark:border-brand-500/20 dark:from-brand-500/10 dark:to-slate-800"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="min-w-0 text-sm text-neutral-800 dark:text-slate-200">{buildSuggestionMessage(suggested)}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-brand-500" />
        </Link>
      </motion.div>

      {/* Deadline & staleness alerts */}
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
