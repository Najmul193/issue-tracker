import { Link } from 'react-router-dom';
import type { WorkflowBottlenecks } from '../../api/dashboard';

interface Props {
  data: WorkflowBottlenecks;
}

const CARDS = [
  {
    key: 'needsTriage' as const,
    label: 'Needs Triage',
    sublabel: 'NEW',
    color: 'border-sky-400 bg-sky-50',
    textColor: 'text-sky-700',
    countColor: 'text-sky-900',
    link: '/issues?status=NEW',
  },
  {
    key: 'awaitingClarification' as const,
    label: 'Awaiting Clarification',
    sublabel: 'CLARIFICATION_REQUESTED',
    color: 'border-orange-400 bg-orange-50',
    textColor: 'text-orange-700',
    countColor: 'text-orange-900',
    link: '/issues?status=CLARIFICATION_REQUESTED',
  },
  {
    key: 'pendingSiReview' as const,
    label: 'Pending SI Review',
    sublabel: 'SI_REVIEW',
    color: 'border-yellow-400 bg-yellow-50',
    textColor: 'text-yellow-700',
    countColor: 'text-yellow-900',
    link: '/issues?status=SI_REVIEW',
  },
  {
    key: 'pendingClientApproval' as const,
    label: 'Pending Approval',
    sublabel: 'PENDING_CLIENT_APPROVAL',
    color: 'border-teal-400 bg-teal-50',
    textColor: 'text-teal-700',
    countColor: 'text-teal-900',
    link: '/issues?status=PENDING_CLIENT_APPROVAL',
  },
];

export default function WorkflowBottlenecks({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map((card) => (
        <Link
          key={card.key}
          to={card.link}
          className={`rounded-lg border-l-4 ${card.color} p-3 transition-colors hover:shadow-sm`}
        >
          <p className={`text-xs font-medium ${card.textColor}`}>{card.label}</p>
          <p className={`mt-1 text-2xl font-bold ${card.countColor}`}>
            {data[card.key]}
          </p>
        </Link>
      ))}
    </div>
  );
}
