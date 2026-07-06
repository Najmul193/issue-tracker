import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchDashboardSummary } from '../api/dashboard';

const statusLabels: Record<string, string> = {
  NEW: 'New',
  ACKNOWLEDGED: 'Acknowledged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-20 rounded bg-gray-200" />
      <div className="mt-2 h-7 w-12 rounded bg-gray-200" />
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
  });

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-5 text-xl font-semibold text-gray-900">Dashboard</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h2 className="mb-5 text-xl font-semibold text-gray-900">Dashboard</h2>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load dashboard data. Please try again later.
        </div>
      </div>
    );
  }

  const { byStatus, byPriority, overdue } = data;

  const totalOpen =
    (byStatus.NEW || 0) +
    (byStatus.ACKNOWLEDGED || 0) +
    (byStatus.ASSIGNED || 0) +
    (byStatus.IN_PROGRESS || 0) +
    (byStatus.REOPENED || 0);

  const totalCritical = byPriority.CRITICAL || 0;

  const statusEntries = Object.entries(byStatus).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const priorityEntries = Object.entries(byPriority).sort(([a], [b]) => {
    const order: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    return (order[a] ?? 99) - (order[b] ?? 99);
  });

  return (
    <div>
      <h2 className="mb-5 text-xl font-semibold text-gray-900">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Link
          to="/issues"
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md"
        >
          <p className="text-sm font-medium text-gray-500">Total Open</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalOpen}</p>
        </Link>
        <Link
          to="/issues?overdue=true"
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-red-300 hover:shadow-md"
        >
          <p className="text-sm font-medium text-gray-500">Overdue</p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {overdue}
          </p>
        </Link>
        <Link
          to="/issues?priority=CRITICAL"
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-red-300 hover:shadow-md"
        >
          <p className="text-sm font-medium text-gray-500">Critical</p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {totalCritical}
          </p>
        </Link>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Resolved/Closed</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {(byStatus.RESOLVED || 0) + (byStatus.CLOSED || 0) + (byStatus.VERIFIED || 0)}
          </p>
        </div>
      </div>

      {/* By status breakdown */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">
          By Status
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {statusEntries.map(([status, count]) => (
            <Link
              key={status}
              to={`/issues?status=${status}`}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md"
            >
              <p className="text-xs font-medium text-gray-500">
                {statusLabels[status] || status}
              </p>
              <p className="mt-0.5 text-xl font-semibold text-gray-900">
                {count}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* By priority breakdown */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">
          By Priority
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {priorityEntries.map(([priority, count]) => (
            <Link
              key={priority}
              to={`/issues?priority=${priority}`}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md"
            >
              <p className="text-xs font-medium text-gray-500">{priority}</p>
              <p className="mt-0.5 text-xl font-semibold text-gray-900">
                {count}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}