import type { IssueStatus } from '../api/issues';

const STATUS_LABELS: Record<IssueStatus, string> = {
  NEW: 'New',
  UNDER_REVIEW: 'Under Review',
  CLARIFICATION_REQUESTED: 'Clarification Requested',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  IN_QA: 'In QA',
  SI_REVIEW: 'SI Review',
  PENDING_CLIENT_APPROVAL: 'Pending Approval',
  CLOSED: 'Closed',
};

const COLOR_MAP: Record<IssueStatus, string> = {
  NEW:                      'bg-sky-100 text-sky-800',
  UNDER_REVIEW:             'bg-blue-100 text-blue-800',
  CLARIFICATION_REQUESTED:  'bg-orange-100 text-orange-800',
  ASSIGNED:                 'bg-violet-100 text-violet-800',
  IN_PROGRESS:              'bg-purple-100 text-purple-800',
  IN_QA:                    'bg-amber-100 text-amber-800',
  SI_REVIEW:                'bg-yellow-100 text-yellow-800',
  PENDING_CLIENT_APPROVAL:  'bg-teal-100 text-teal-800',
  CLOSED:                   'bg-gray-100 text-gray-600',
};

export default function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_MAP[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}