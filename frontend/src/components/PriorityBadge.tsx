import type { IssuePriority } from '../api/issues';
import Badge from './ui/Badge';

const PRIORITY_TONE: Record<IssuePriority, string> = {
  CRITICAL: 'bg-priority-critical/10 text-priority-critical ring-priority-critical/25 dark:bg-priority-critical/15 dark:text-red-400 dark:ring-priority-critical/30',
  HIGH: 'bg-priority-high/10 text-priority-high ring-priority-high/25 dark:bg-priority-high/15 dark:text-orange-400 dark:ring-priority-high/30',
  MEDIUM: 'bg-priority-medium/10 text-priority-medium ring-priority-medium/25 dark:bg-priority-medium/15 dark:text-yellow-400 dark:ring-priority-medium/30',
  LOW: 'bg-priority-low/10 text-priority-low ring-priority-low/25 dark:bg-priority-low/15 dark:text-green-400 dark:ring-priority-low/30',
};

const PRIORITY_DOT: Record<IssuePriority, string> = {
  CRITICAL: 'bg-priority-critical',
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-medium',
  LOW: 'bg-priority-low',
};

export default function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return (
    <Badge
      tone={PRIORITY_TONE[priority]}
      icon={<span className={`block h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </Badge>
  );
}

export { PRIORITY_TONE, PRIORITY_DOT };
