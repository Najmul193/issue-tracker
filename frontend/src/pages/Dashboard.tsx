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
import SlaAgingBar from '../components/dashboard/SlaAgingBar';
import WorkflowBottlenecks from '../components/dashboard/WorkflowBottlenecks';
import RoutingDistribution from '../components/dashboard/RoutingDistribution';
import OrgSummaryPanel from '../components/dashboard/OrgSummaryPanel';
import TeamWorkloadBar from '../components/dashboard/TeamWorkloadBar';
import MyRaisedSummary from '../components/dashboard/MyRaisedSummary';
import QuickActions from '../components/dashboard/QuickActions';

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
    return `changed status from ${oldValue ?? '?'} \u2192 ${newValue ?? '?'}`;
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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

function CardLink({
  to,
  label,
  value,
  valueColor = 'text-gray-900',
}: {
  to: string;
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:shadow-md"
    >
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueColor}`}>{value}</p>
    </Link>
  );
}

/* ─── Assigned Issues List (shared) ───────────────────────────────────────── */

function AssignedIssuesList({
  issues,
  isLoading,
}: {
  issues: { id: string; title: string; priority: string; status: string; deadline: string | null }[];
  isLoading: boolean;
}) {
  if (isLoading) return <SkeletonSection height={200} />;
  if (issues.length === 0) {
    return <p className="text-sm text-gray-400">No issues currently assigned to you.</p>;
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue) => {
        const overdue = isOverdue(issue.deadline);
        return (
          <li key={issue.id}>
            <Link
              to={`/issues/${issue.id}`}
              className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${overdue ? 'text-red-700' : 'text-gray-900'}`}>
                  {overdue && <span className="mr-1 text-red-500">!</span>}
                  {issue.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{issue.status.replace(/_/g, ' ')}</p>
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
  );
}

/* ─── Recent Activity List (shared) ───────────────────────────────────────── */

function RecentActivityList({
  activities,
  isLoading,
}: {
  activities: {
    id: string;
    action: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    user: { name: string };
    issue: { id: string; title: string };
  }[];
  isLoading: boolean;
}) {
  if (isLoading) return <SkeletonSection height={200} />;
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400">No recent activity.</p>;
  }
  return (
    <ul className="space-y-3">
      {activities.map((log) => (
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
  );
}

/* ─── main ─────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { user: currentUser } = useAuth();
  const { projectIdsParam } = useProjectFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', projectIdsParam],
    queryFn: () => fetchDashboardMetrics(projectIdsParam ?? undefined),
  });

  const isOrgAdmin = currentUser?.role === 'ORG_ADMIN';
  const isSiAdmin = isOrgAdmin && currentUser?.organization?.type === 'SI';
  const isClientOrOemAdmin = isOrgAdmin && currentUser?.organization?.type !== 'SI';
  const isUser = currentUser?.role === 'USER';

  /* total open — uses current 9-state statuses */
  const totalOpen = data
    ? (data.byStatus.NEW || 0) + (data.byStatus.UNDER_REVIEW || 0) +
      (data.byStatus.CLARIFICATION_REQUESTED || 0) +
      (data.byStatus.ASSIGNED || 0) + (data.byStatus.IN_PROGRESS || 0)
    : null;

  const userName = currentUser?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {getGreeting()}, {userName}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {currentUser?.organization?.name} &middot;{' '}
            {currentUser?.role === 'SUPER_ADMIN'
              ? 'Super Admin'
              : currentUser?.role === 'ORG_ADMIN'
                ? 'Organization Admin'
                : 'Team Member'}
          </p>
        </div>
        <QuickActions />
      </div>

      {/* Partial error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not fully load dashboard data. Some sections may be unavailable.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SUPER_ADMIN Layout
         ══════════════════════════════════════════════════════════════════════ */}
      {currentUser?.role === 'SUPER_ADMIN' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <CardLink to="/issues" label="Total Open" value={totalOpen ?? '\u2014'} />
                <CardLink to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '\u2014'} valueColor="text-red-600" />
                <CardLink to="/issues?priority=CRITICAL" label="Critical" value={data?.byPriority.CRITICAL ?? '\u2014'} valueColor="text-red-600" />
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Resolved This Month</p>
                  <p className="mt-1 text-3xl font-bold text-green-600">{data?.resolvedThisMonth ?? '\u2014'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Avg Resolution</p>
                  <p className="mt-1 text-3xl font-bold text-blue-600">
                    {data?.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '\u2014'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* SLA Aging */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Deadline Health (SLA Aging)" />
            {isLoading ? (
              <div className="animate-pulse h-12 rounded bg-gray-100" />
            ) : data ? (
              <SlaAgingBar data={data.slaAging} />
            ) : null}
          </div>

          {/* Workflow Bottlenecks + My Raised */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
              <SectionHeader title="Workflow Bottlenecks" />
              {isLoading ? (
                <div className="animate-pulse h-20 rounded bg-gray-100" />
              ) : data ? (
                <WorkflowBottlenecks data={data.workflowBottlenecks} />
              ) : null}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Raised Issues" />
              {isLoading ? (
                <div className="animate-pulse h-20 rounded bg-gray-100" />
              ) : data ? (
                <MyRaisedSummary data={data.myRaisedIssues} />
              ) : null}
            </div>
          </div>

          {/* Org Comparison (prominent) */}
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

          {/* Routing Distribution */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Routing Distribution" />
            {isLoading ? (
              <div className="animate-pulse h-48 rounded bg-gray-100" />
            ) : data ? (
              <RoutingDistribution data={data.routingDistribution} />
            ) : null}
          </div>

          {/* Charts Row */}
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

          {/* Type + Trend */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="By Type" />
            {isLoading ? (
              <div className="animate-pulse h-40 rounded bg-gray-100" />
            ) : data ? (
              <TypeBar byType={data.byType} />
            ) : null}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Trend \u2014 Last 30 Days" />
            {isLoading ? (
              <div className="animate-pulse h-48 rounded bg-gray-100" />
            ) : data ? (
              <TrendLine data={data.trendLast30Days} />
            ) : null}
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Assigned Issues" />
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Recent Activity" />
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SI ORG_ADMIN Layout
         ══════════════════════════════════════════════════════════════════════ */}
      {isSiAdmin && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <CardLink to="/issues" label="Total Open" value={totalOpen ?? '\u2014'} />
                <CardLink to="/issues?status=NEW" label="Needs Triage" value={data?.workflowBottlenecks.needsTriage ?? '\u2014'} valueColor="text-sky-600" />
                <CardLink to="/issues?status=SI_REVIEW" label="Pending SI Review" value={data?.workflowBottlenecks.pendingSiReview ?? '\u2014'} valueColor="text-yellow-600" />
                <CardLink to="/issues?status=PENDING_CLIENT_APPROVAL" label="Pending Approval" value={data?.workflowBottlenecks.pendingClientApproval ?? '\u2014'} valueColor="text-teal-600" />
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Resolved This Month</p>
                  <p className="mt-1 text-3xl font-bold text-green-600">{data?.resolvedThisMonth ?? '\u2014'}</p>
                </div>
              </>
            )}
          </div>

          {/* SLA Aging */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Deadline Health (SLA Aging)" />
            {isLoading ? (
              <div className="animate-pulse h-12 rounded bg-gray-100" />
            ) : data ? (
              <SlaAgingBar data={data.slaAging} />
            ) : null}
          </div>

          {/* Workflow Bottlenecks + Routing Distribution */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Workflow Bottlenecks" />
              {isLoading ? (
                <div className="animate-pulse h-20 rounded bg-gray-100" />
              ) : data ? (
                <WorkflowBottlenecks data={data.workflowBottlenecks} />
              ) : null}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Routing Distribution" />
              {isLoading ? (
                <div className="animate-pulse h-48 rounded bg-gray-100" />
              ) : data ? (
                <RoutingDistribution data={data.routingDistribution} />
              ) : null}
            </div>
          </div>

          {/* Org Summary + My Raised */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
              <SectionHeader title="Team Overview" />
              {isLoading ? (
                <SkeletonSection height={200} />
              ) : data && data.orgSummary ? (
                <OrgSummaryPanel data={data.orgSummary} />
              ) : null}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Raised Issues" />
              {isLoading ? (
                <div className="animate-pulse h-20 rounded bg-gray-100" />
              ) : data ? (
                <MyRaisedSummary data={data.myRaisedIssues} />
              ) : null}
            </div>
          </div>

          {/* Charts */}
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

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Trend \u2014 Last 30 Days" />
            {isLoading ? (
              <div className="animate-pulse h-48 rounded bg-gray-100" />
            ) : data ? (
              <TrendLine data={data.trendLast30Days} />
            ) : null}
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Assigned Issues" />
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Recent Activity" />
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CLIENT / OEM ORG_ADMIN Layout
         ══════════════════════════════════════════════════════════════════════ */}
      {isClientOrOemAdmin && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <CardLink to="/issues" label="Total Open" value={totalOpen ?? '\u2014'} />
                <CardLink to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '\u2014'} valueColor="text-red-600" />
                <CardLink to="/issues?status=PENDING_CLIENT_APPROVAL" label="Pending Approval" value={data?.workflowBottlenecks.pendingClientApproval ?? '\u2014'} valueColor="text-teal-600" />
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">My Raised</p>
                  <p className="mt-1 text-3xl font-bold text-blue-600">{data?.myRaisedIssues.open ?? '\u2014'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Resolved This Month</p>
                  <p className="mt-1 text-3xl font-bold text-green-600">{data?.resolvedThisMonth ?? '\u2014'}</p>
                </div>
              </>
            )}
          </div>

          {/* SLA Aging */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Deadline Health (SLA Aging)" />
            {isLoading ? (
              <div className="animate-pulse h-12 rounded bg-gray-100" />
            ) : data ? (
              <SlaAgingBar data={data.slaAging} />
            ) : null}
          </div>

          {/* Org Summary + My Raised */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
              <SectionHeader title="Team Overview" />
              {isLoading ? (
                <SkeletonSection height={200} />
              ) : data && data.orgSummary ? (
                <OrgSummaryPanel data={data.orgSummary} />
              ) : null}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Raised Issues" />
              {isLoading ? (
                <div className="animate-pulse h-20 rounded bg-gray-100" />
              ) : data ? (
                <MyRaisedSummary data={data.myRaisedIssues} />
              ) : null}
            </div>
          </div>

          {/* Charts */}
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

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Trend \u2014 Last 30 Days" />
            {isLoading ? (
              <div className="animate-pulse h-48 rounded bg-gray-100" />
            ) : data ? (
              <TrendLine data={data.trendLast30Days} />
            ) : null}
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Assigned Issues" />
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Recent Activity" />
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SI USER Layout
         ══════════════════════════════════════════════════════════════════════ */}
      {isUser && currentUser?.organization?.type === 'SI' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <CardLink to="/concern?concernFilter=assigned" label="My Assigned" value={data?.myAssignedIssues.length ?? '\u2014'} />
                <CardLink to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '\u2014'} valueColor="text-red-600" />
                <CardLink to="/concern?concernFilter=raised" label="My Raised" value={data?.myRaisedIssues.open ?? '\u2014'} valueColor="text-blue-600" />
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Resolved This Month</p>
                  <p className="mt-1 text-3xl font-bold text-green-600">{data?.resolvedThisMonth ?? '\u2014'}</p>
                </div>
              </>
            )}
          </div>

          {/* SLA Aging */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Deadline Health (SLA Aging)" />
            {isLoading ? (
              <div className="animate-pulse h-12 rounded bg-gray-100" />
            ) : data ? (
              <SlaAgingBar data={data.slaAging} />
            ) : null}
          </div>

          {/* Team Workload + My Raised */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Team Workload" />
              {isLoading ? (
                <div className="animate-pulse h-48 rounded bg-gray-100" />
              ) : data ? (
                <TeamWorkloadBar data={data.teamWorkload} />
              ) : null}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Raised Issues" />
              {isLoading ? (
                <div className="animate-pulse h-20 rounded bg-gray-100" />
              ) : data ? (
                <MyRaisedSummary data={data.myRaisedIssues} />
              ) : null}
            </div>
          </div>

          {/* Charts */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Trend \u2014 Last 30 Days" />
            {isLoading ? (
              <div className="animate-pulse h-48 rounded bg-gray-100" />
            ) : data ? (
              <TrendLine data={data.trendLast30Days} />
            ) : null}
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Assigned Issues" />
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Recent Activity" />
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CLIENT / OEM USER Layout
         ══════════════════════════════════════════════════════════════════════ */}
      {isUser && currentUser?.organization?.type !== 'SI' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <CardLink to="/concern?concernFilter=assigned" label="My Assigned" value={data?.myAssignedIssues.length ?? '\u2014'} />
                <CardLink to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '\u2014'} valueColor="text-red-600" />
                <CardLink to="/concern?concernFilter=raised" label="My Raised" value={data?.myRaisedIssues.open ?? '\u2014'} valueColor="text-blue-600" />
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Resolved This Month</p>
                  <p className="mt-1 text-3xl font-bold text-green-600">{data?.resolvedThisMonth ?? '\u2014'}</p>
                </div>
              </>
            )}
          </div>

          {/* SLA Aging */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Deadline Health (SLA Aging)" />
            {isLoading ? (
              <div className="animate-pulse h-12 rounded bg-gray-100" />
            ) : data ? (
              <SlaAgingBar data={data.slaAging} />
            ) : null}
          </div>

          {/* My Raised Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="My Raised Issues" />
            {isLoading ? (
              <div className="animate-pulse h-20 rounded bg-gray-100" />
            ) : data ? (
              <MyRaisedSummary data={data.myRaisedIssues} />
            ) : null}
          </div>

          {/* Trend */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <SectionHeader title="Trend \u2014 Last 30 Days" />
            {isLoading ? (
              <div className="animate-pulse h-48 rounded bg-gray-100" />
            ) : data ? (
              <TrendLine data={data.trendLast30Days} />
            ) : null}
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="My Assigned Issues" />
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <SectionHeader title="Recent Activity" />
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
