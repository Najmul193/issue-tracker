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
      color: 'text-neutral-900 dark:text-slate-100',
      bg: 'bg-neutral-50 dark:bg-slate-700/40',
      link: '/issues?concern=true&concernFilter=raised',
    },
    {
      label: 'Open',
      value: data.open,
      color: 'text-brand-700 dark:text-brand-400',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
      link: '/issues?concern=true&concernFilter=raised',
    },
    {
      label: 'Overdue',
      value: data.overdue,
      color: 'text-red-700 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10',
      link: '/issues?concern=true&concernFilter=raised&overdue=true',
    },
    {
      label: 'Pending Approval',
      value: data.pendingApproval,
      color: 'text-teal-700 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-500/10',
      link: '/issues?status=PENDING_CLIENT_APPROVAL',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          to={card.link}
          className={`${card.bg} rounded-lg p-3 transition-shadow hover:shadow-card`}
        >
          <p className="text-xs font-medium text-neutral-500 dark:text-slate-400">{card.label}</p>
          <p className={`mt-0.5 text-2xl font-bold ${card.color}`}>{card.value}</p>
        </Link>
      ))}
    </div>
  );
}
