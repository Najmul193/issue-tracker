import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';
import { fetchIssues } from '../../api/issues';
import type { Issue } from '../../api/issues';
import { useProjectFilter } from '../../context/ProjectFilterContext';
import { PRIORITY_DOT } from '../PriorityBadge';
import StatusBadge from '../StatusBadge';
import EmptyState from '../ui/EmptyState';
import { staggerContainer, staggerItem } from '../../lib/motion';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DeadlineCalendar() {
  const { projectIdsParam } = useProjectFilter();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const commonParams = {
    concern: 'true',
    limit: '100',
    ...(projectIdsParam ? { projectIds: projectIdsParam } : {}),
  };

  const { data: assigned, isLoading: loadingAssigned } = useQuery({
    queryKey: ['calendar-assigned', projectIdsParam],
    queryFn: () => fetchIssues({ ...commonParams, concernFilter: 'assigned' }),
    refetchInterval: 60_000,
  });

  const { data: raised, isLoading: loadingRaised } = useQuery({
    queryKey: ['calendar-raised', projectIdsParam],
    queryFn: () => fetchIssues({ ...commonParams, concernFilter: 'raised' }),
    refetchInterval: 60_000,
  });

  const isLoading = loadingAssigned || loadingRaised;

  const issuesWithDeadlines = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of [...(assigned?.data ?? []), ...(raised?.data ?? [])]) {
      if (issue.deadline) map.set(issue.id, issue);
    }
    return [...map.values()];
  }, [assigned, raised]);

  const byDay = useMemo(() => {
    const m = new Map<number, Issue[]>();
    for (const issue of issuesWithDeadlines) {
      const d = new Date(issue.deadline!);
      if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
        const day = d.getDate();
        if (!m.has(day)) m.set(day, []);
        m.get(day)!.push(issue);
      }
    }
    for (const list of m.values()) {
      list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    }
    return m;
  }, [issuesWithDeadlines, cursor]);

  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const totalDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const selectedDayIssues =
    selectedDate.getFullYear() === cursor.getFullYear() && selectedDate.getMonth() === cursor.getMonth()
      ? byDay.get(selectedDate.getDate()) ?? []
      : [];

  function goToMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  function goToToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={goToToday}
            className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            Today
          </button>
          <button
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-slate-500">
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`blank-${idx}`} />;
          const cellDate = new Date(cursor.getFullYear(), cursor.getMonth(), day);
          const dayIssues = byDay.get(day) ?? [];
          const isToday = isSameDay(cellDate, today);
          const isSelected = isSameDay(cellDate, selectedDate);
          const topPriority = dayIssues[0]?.priority;
          return (
            <button
              key={day}
              onClick={() => setSelectedDate(cellDate)}
              className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-brand-600 text-white'
                  : isToday
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-300 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/40'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {day}
              {dayIssues.length > 0 && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    isSelected ? 'bg-white' : topPriority ? PRIORITY_DOT[topPriority] : 'bg-neutral-400'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-slate-700/60">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400">
          Due {isSameDay(selectedDate, today) ? 'Today' : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        {isLoading ? (
          <div className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" />
        ) : selectedDayIssues.length === 0 ? (
          <div className="py-2">
            <EmptyState icon={<CalendarCheck />} title="Nothing due this day" className="py-4" />
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.ul
              key={selectedDate.toDateString()}
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="scrollbar-thin max-h-40 space-y-1.5 overflow-y-auto"
            >
              {selectedDayIssues.map((issue) => (
                <motion.li key={issue.id} variants={staggerItem}>
                  <Link
                    to={`/issues/${issue.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-slate-700/40"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[issue.priority]}`} />
                    <span className="min-w-0 flex-1 truncate text-neutral-800 dark:text-slate-200">{issue.title}</span>
                    <StatusBadge status={issue.status} />
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
