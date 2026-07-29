import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertOctagon, Clock, History, CheckCircle2, type LucideIcon } from 'lucide-react';
import type { AssignedIssueSummary } from '../../api/dashboard';
import EmptyState from '../ui/EmptyState';
import { staggerContainer, staggerItem } from '../../lib/motion';

interface Props {
  issues: AssignedIssueSummary[];
}

const STALE_DAYS = 3;

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

export default function NotesPanel({ issues }: Props) {
  const notes: Note[] = [];

  for (const issue of issues) {
    if (issue.deadline) {
      const hrs = hoursUntil(issue.deadline);
      if (hrs < 0) {
        notes.push({
          id: `overdue-${issue.id}`,
          icon: AlertOctagon,
          tone: 'red',
          message: `"${issue.title}" is overdue`,
          to: `/issues/${issue.id}`,
        });
      } else if (hrs <= 24) {
        notes.push({
          id: `soon-${issue.id}`,
          icon: Clock,
          tone: 'amber',
          message: `"${issue.title}" is due within 24 hours`,
          to: `/issues/${issue.id}`,
        });
      }
    }

    if (issue.status !== 'CLOSED') {
      const idleDays = Math.floor(daysSince(issue.updatedAt));
      if (idleDays >= STALE_DAYS) {
        notes.push({
          id: `stale-${issue.id}`,
          icon: History,
          tone: 'violet',
          message: `"${issue.title}" hasn't moved in ${idleDays}+ days`,
          to: `/issues/${issue.id}`,
        });
      }
    }
  }

  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 />}
        title="All caught up"
        description="No urgent deadlines or stale issues right now."
        className="py-6"
      />
    );
  }

  return (
    <motion.ul
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="scrollbar-thin max-h-72 space-y-1.5 overflow-y-auto"
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
  );
}
