import { Link } from 'react-router-dom';
import { CircleDot, MessageCircleQuestion, SearchCheck, Hourglass } from 'lucide-react';
import type { WorkflowBottlenecks } from '../../api/dashboard';

interface Props {
  data: WorkflowBottlenecks;
}

const CARDS = [
  {
    key: 'needsTriage' as const,
    label: 'Needs Triage',
    icon: CircleDot,
    border: 'border-l-status-new',
    bg: 'bg-status-new/5 dark:bg-status-new/10',
    text: 'text-status-new',
    link: '/issues?status=NEW',
  },
  {
    key: 'awaitingClarification' as const,
    label: 'Awaiting Clarification',
    icon: MessageCircleQuestion,
    border: 'border-l-status-clarification_requested',
    bg: 'bg-status-clarification_requested/5 dark:bg-status-clarification_requested/10',
    text: 'text-status-clarification_requested',
    link: '/issues?status=CLARIFICATION_REQUESTED',
  },
  {
    key: 'pendingSiReview' as const,
    label: 'Pending SI Review',
    icon: SearchCheck,
    border: 'border-l-status-si_review',
    bg: 'bg-status-si_review/5 dark:bg-status-si_review/10',
    text: 'text-status-si_review',
    link: '/issues?status=SI_REVIEW',
  },
  {
    key: 'pendingClientApproval' as const,
    label: 'Pending Approval',
    icon: Hourglass,
    border: 'border-l-status-pending_client_approval',
    bg: 'bg-status-pending_client_approval/5 dark:bg-status-pending_client_approval/10',
    text: 'text-status-pending_client_approval',
    link: '/issues?status=PENDING_CLIENT_APPROVAL',
  },
];

export default function WorkflowBottlenecks({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.key}
            to={card.link}
            className={`rounded-lg border-l-4 ${card.border} ${card.bg} p-3 transition-shadow hover:shadow-card`}
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${card.text}`} />
              <p className={`text-xs font-medium ${card.text}`}>{card.label}</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-slate-100">{data[card.key]}</p>
          </Link>
        );
      })}
    </div>
  );
}
