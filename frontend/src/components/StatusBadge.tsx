import {
  CircleDot,
  ShieldCheck,
  Eye,
  MessageCircleQuestion,
  UserCheck,
  Activity,
  SearchCheck,
  Hourglass,
  CheckCircle2,
} from 'lucide-react';
import type { IssueStatus } from '../api/issues';
import Badge from './ui/Badge';

const STATUS_LABELS: Record<IssueStatus, string> = {
  NEW: 'New',
  SI_APPROVAL: 'SI Approval',
  UNDER_REVIEW: 'Under Review',
  CLARIFICATION_REQUESTED: 'Clarification Requested',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',

  SI_REVIEW: 'SI Review',
  PENDING_CLIENT_APPROVAL: 'Pending Approval',
  CLOSED: 'Closed',
};

const STATUS_TONE: Record<IssueStatus, string> = {
  NEW: 'bg-status-new/10 text-status-new ring-status-new/25 dark:bg-status-new/15 dark:text-sky-400 dark:ring-status-new/30',
  SI_APPROVAL:
    'bg-status-si_approval/10 text-status-si_approval ring-status-si_approval/25 dark:bg-status-si_approval/15 dark:text-indigo-400 dark:ring-status-si_approval/30',
  UNDER_REVIEW:
    'bg-status-under_review/10 text-status-under_review ring-status-under_review/25 dark:bg-status-under_review/15 dark:text-blue-400 dark:ring-status-under_review/30',
  CLARIFICATION_REQUESTED:
    'bg-status-clarification_requested/10 text-status-clarification_requested ring-status-clarification_requested/25 dark:bg-status-clarification_requested/15 dark:text-orange-400 dark:ring-status-clarification_requested/30',
  ASSIGNED:
    'bg-status-assigned/10 text-status-assigned ring-status-assigned/25 dark:bg-status-assigned/15 dark:text-violet-400 dark:ring-status-assigned/30',
  IN_PROGRESS:
    'bg-status-in_progress/10 text-status-in_progress ring-status-in_progress/25 dark:bg-status-in_progress/15 dark:text-purple-400 dark:ring-status-in_progress/30',

  SI_REVIEW:
    'bg-status-si_review/10 text-status-si_review ring-status-si_review/25 dark:bg-status-si_review/15 dark:text-yellow-400 dark:ring-status-si_review/30',
  PENDING_CLIENT_APPROVAL:
    'bg-status-pending_client_approval/10 text-status-pending_client_approval ring-status-pending_client_approval/25 dark:bg-status-pending_client_approval/15 dark:text-teal-400 dark:ring-status-pending_client_approval/30',
  CLOSED:
    'bg-status-closed/10 text-status-closed ring-status-closed/20 dark:bg-status-closed/15 dark:text-slate-400 dark:ring-status-closed/25',
};

const STATUS_ICON: Record<IssueStatus, typeof CircleDot> = {
  NEW: CircleDot,
  SI_APPROVAL: ShieldCheck,
  UNDER_REVIEW: Eye,
  CLARIFICATION_REQUESTED: MessageCircleQuestion,
  ASSIGNED: UserCheck,
  IN_PROGRESS: Activity,

  SI_REVIEW: SearchCheck,
  PENDING_CLIENT_APPROVAL: Hourglass,
  CLOSED: CheckCircle2,
};

export default function StatusBadge({ status }: { status: IssueStatus }) {
  const Icon = STATUS_ICON[status] ?? CircleDot;
  return (
    <Badge tone={STATUS_TONE[status]} icon={<Icon />}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export { STATUS_LABELS, STATUS_TONE, STATUS_ICON };
