import { Link } from 'react-router-dom';
import type { MyRaisedIssues } from '../../api/dashboard';

interface Props {
  data: MyRaisedIssues;
}

export default function MyRaisedSummary({ data }: Props) {
  const cards = [
    {
      label: 'Total Raised',
      value: data.total,
      color: 'text-gray-900',
      bg: 'bg-gray-50',
      link: '/issues?concern=true&concernFilter=raised',
    },
    {
      label: 'Open',
      value: data.open,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      link: '/issues?concern=true&concernFilter=raised',
    },
    {
      label: 'Overdue',
      value: data.overdue,
      color: 'text-red-700',
      bg: 'bg-red-50',
      link: '/issues?concern=true&concernFilter=raised&overdue=true',
    },
    {
      label: 'Pending Approval',
      value: data.pendingApproval,
      color: 'text-teal-700',
      bg: 'bg-teal-50',
      link: '/issues?status=PENDING_CLIENT_APPROVAL',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          to={card.link}
          className={`${card.bg} rounded-lg p-3 transition-colors hover:shadow-sm`}
        >
          <p className="text-xs font-medium text-gray-500">{card.label}</p>
          <p className={`mt-0.5 text-2xl font-bold ${card.color}`}>{card.value}</p>
        </Link>
      ))}
    </div>
  );
}
