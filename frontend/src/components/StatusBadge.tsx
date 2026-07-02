import type { IssueStatus } from '../api/issues';

const colorMap: Record<IssueStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-blue-100 text-blue-800',
  ASSIGNED: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-teal-100 text-teal-800',
  VERIFIED: 'bg-teal-100 text-teal-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  REOPENED: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}