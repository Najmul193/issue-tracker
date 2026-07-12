import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchDashboardMetrics } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';
import { useProjectFilter } from '../context/ProjectFilterContext';
import SkeletonSection from '../components/dashboard/SkeletonSection';
import StatusDonut from '../components/dashboard/StatusDonut';
import PriorityBar from '../components/dashboard/PriorityBar';
import TypeBar from '../components/dashboard/TypeBar';
import TrendLine from '../components/dashboard/TrendLine';
import OrgComparisonBar from '../components/dashboard/OrgComparisonBar';

/* ─── helpers ──────────────────────────────────────────────────────────────── */

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function humanReadableAction(action: string, oldValue: string | null, newValue: string | null): string {
  if (action === 'CREATED') return 'created this issue';
  if (action === 'STATUS_CHANGED') {
    return `changed status from ${oldValue ?? '?'} → ${newValue ?? '?'}`;
  }
  if (action === 'ASSIGNED') {
    try { const nv = JSON.parse(newValue || '{}'); return `assigned to ${nv.assignedToUserName || nv.assignedToOrgName || 'someone'}`; }
    catch { return 'assigned issue'; }
  }
  if (action === 'REASSIGNED') {
    try {
      const ov = JSON.parse(oldValue || '{}');
      const nv = JSON.parse(newValue || '{}');
      return `reassigned from ${ov.assignedToUserName || ov.assignedToOrgName || '?'} to ${nv.assignedToUserName || nv.assignedToOrgName || '?'}`;
    } catch { return 'reassigned issue'; }
  }
  return action.toLowerCase().replace(/_/g, ' ');
}

/* ─── sub-components ────────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-20 rounded bg-gray-200" />
      <div className="mt-2 h-7 w-12 rounded bg-gray-200" />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
      {title}
    </h3>
  );
}

/* ─── main ─────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { user: currentUser } = useAuth();
  const { projectIdsParam } = useProjectFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', projectIdsParam],
    queryFn: () => fetchDashboardMetrics(projectIdsParam || undefined),
  });

  /* summary cards — show skeletons while loading */
  const totalOpen = data
    ? (data.byStatus.NEW || 0) + (data.byStatus.ACKNOWLEDGED || 0) +
      (data.byStatus.ASSIGNED || 0) + (data.byStatus.IN_PROGRESS || 0) +
      (data.byStatus.REOPENED || 0)
    : null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>

      {/* Partial error banner — shown but page keeps rendering */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not fully load dashboard data. Some sections may be unavailable.
        </div>
      )}

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <Link
              to="/issues"
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md"
            >
              <p className="text-sm font-medium text-gray-500">Total Open</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{totalOpen ?? '—'}</p>
            </Link>

            <Link
              to="/issues?overdue=true"
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-red-300 hover:shadow-md"
            >
              <p className="text-sm font-medium text-gray-500">Overdue</p>
              <p className="mt-1 text-3xl font-bold text-red-600">{data?.overdue ?? '—'}</p>
            </Link>

            <Link
              to="/issues?priority=CRITICAL"
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-red-300 hover:shadow-md"
            >
              <p className="text-sm font-medium text-gray-500">Critical</p>
              <p className="mt-1 text-3xl font-bold text-red-600">{data?.byPriority.CRITICAL ?? '—'}</p>
            </Link>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Resolved This Month</p>
              <p className="mt-1 text-3xl font-bold text-green-600">{data?.resolvedThisMonth ?? '—'}</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Avg Resolution</p>
              <p className="mt-1 text-3xl font-bold text-blue-600">
                {data?.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '—'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Charts Row: Status Donut + Priority Bar ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <SectionHeader title="By Status" />
          {isLoading ? (
            <div className="animate-pulse h-48 rounded bg-gray-100" />
          ) : data ? (
            <StatusDonut byStatus={data.byStatus} />
          ) : null}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <SectionHeader title="By Priority" />
          {isLoading ? (
            <div className="animate-pulse h-48 rounded bg-gray-100" />
          ) : data ? (
            <PriorityBar byPriority={data.byPriority} />
          ) : null}
        </div>
      </div>

      {/* ── Type Bar ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <SectionHeader title="By Type" />
        {isLoading ? (
          <div className="animate-pulse h-40 rounded bg-gray-100" />
        ) : data ? (
          <TypeBar byType={data.byType} />
        ) : null}
      </div>

      {/* ── Trend Line ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <SectionHeader title="Trend — Last 30 Days" />
        {isLoading ? (
          <div className="animate-pulse h-48 rounded bg-gray-100" />
        ) : data ? (
          <TrendLine data={data.trendLast30Days} />
        ) : null}
      </div>

      {/* ── Bottom Panels: My Assigned + Recent Activity ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* My Assigned Issues */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <SectionHeader title="My Assigned Issues" />
          {isLoading ? (
            <SkeletonSection height={200} />
          ) : data && data.myAssignedIssues.length > 0 ? (
            <ul className="space-y-2">
              {data.myAssignedIssues.map((issue) => {
                const overdue = isOverdue(issue.deadline);
                return (
                  <li key={issue.id}>
                    <Link
                      to={`/issues/${issue.id}`}
                      className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-medium ${overdue ? 'text-red-700' : 'text-gray-900'}`}>
                          {overdue && <span className="mr-1 text-red-500">⚠</span>}
                          {issue.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{issue.status.replace('_', ' ')}</p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {formatDeadline(issue.deadline)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No issues currently assigned to you.</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <SectionHeader title="Recent Activity" />
          {isLoading ? (
            <SkeletonSection height={200} />
          ) : data && data.recentActivity.length > 0 ? (
            <ul className="space-y-3">
              {data.recentActivity.map((log) => (
                <li key={log.id} className="flex items-start gap-2 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                  <div className="min-w-0">
                    <p className="text-gray-700 leading-snug">
                      <span className="font-medium text-gray-900">{log.user.name}</span>{' '}
                      {humanReadableAction(log.action, log.oldValue, log.newValue)} on{' '}
                      <Link
                        to={`/issues/${log.issue.id}`}
                        className="text-blue-600 hover:underline font-medium truncate"
                      >
                        {log.issue.title}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-400">{formatRelativeTime(log.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No recent activity.</p>
          )}
        </div>
      </div>

      {/* ── Org Comparison — SUPER_ADMIN only ───────────────────────────── */}
      {currentUser?.role === 'SUPER_ADMIN' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <SectionHeader title="Organization Comparison" />
          {isLoading ? (
            <div className="animate-pulse h-48 rounded bg-gray-100" />
          ) : data && data.orgComparison.length > 0 ? (
            <OrgComparisonBar data={data.orgComparison} />
          ) : (
            <p className="text-sm text-gray-400">No organization data.</p>
          )}
        </div>
      )}
    </div>
  );
}