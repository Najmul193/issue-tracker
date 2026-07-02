import type { IssuePriority } from '../api/issues';

const colorMap: Record<IssuePriority, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
};

export default function PriorityBadge({
  priority,
}: {
  priority: IssuePriority;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[priority]}`}
    >
      {priority}
    </span>
  );
}