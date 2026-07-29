import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ListChecks,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Timer,
  CircleDot,
  SearchCheck,
  Hourglass,
  FileText,
  UserCheck,
  Gauge,
  Workflow,
  BarChart3,
  Route,
  TrendingUp,
  History,
  type LucideIcon,
} from 'lucide-react';
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
import SpotlightBanner from '../components/dashboard/SpotlightBanner';
import Card from '../components/ui/Card';
import { SkeletonCard } from '../components/ui/Skeleton';
import { staggerContainer, staggerItem } from '../lib/motion';

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ─── sub-components ────────────────────────────────────────────────────────── */

const TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400',
};

function StatCard({
  to,
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  to: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <motion.div variants={staggerItem}>
      <Link
        to={to}
        className="group flex h-full flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-700/60 dark:bg-slate-800"
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-slate-400">{label}</p>
          <p className="mt-0.5 text-3xl font-bold text-neutral-900 dark:text-slate-100">{value}</p>
        </div>
      </Link>
    </motion.div>
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
    return <p className="text-sm text-neutral-400 dark:text-slate-500">No issues currently assigned to you.</p>;
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue) => {
        const overdue = isOverdue(issue.deadline);
        return (
          <li key={issue.id}>
            <Link
              to={`/issues/${issue.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 transition-colors hover:bg-neutral-50 dark:border-slate-700/60 dark:hover:bg-slate-700/40"
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${overdue ? 'text-red-700 dark:text-red-400' : 'text-neutral-900 dark:text-slate-100'}`}>
                  {overdue && <span className="mr-1 text-red-500">!</span>}
                  {issue.title}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-slate-500">{issue.status.replace(/_/g, ' ')}</p>
              </div>
              <div className="ml-3 shrink-0 text-right">
                <span className={`text-xs font-medium ${overdue ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-slate-400'}`}>
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
    return <p className="text-sm text-neutral-400 dark:text-slate-500">No recent activity.</p>;
  }
  return (
    <ul className="space-y-3">
      {activities.map((log) => (
        <li key={log.id} className="flex items-start gap-2 text-sm">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-slate-600" />
          <div className="min-w-0">
            <p className="leading-snug text-neutral-700 dark:text-slate-300">
              <span className="font-medium text-neutral-900 dark:text-slate-100">{log.user.name}</span>{' '}
              {humanReadableAction(log.action, log.oldValue, log.newValue)} on{' '}
              <Link
                to={`/issues/${log.issue.id}`}
                className="truncate font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {log.issue.title}
              </Link>
            </p>
            <p className="text-xs text-neutral-400 dark:text-slate-500">{formatRelativeTime(log.createdAt)}</p>
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
    refetchInterval: 30_000,
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

  /* ── Priority Spotlight: derived entirely from data already fetched above ── */
  let spotlight: { icon: LucideIcon; message: string; to: string } | null = null;
  if (data) {
    if (isSiAdmin) {
      if (data.workflowBottlenecks.needsTriage > 0) {
        spotlight = {
          icon: CircleDot,
          message: `${data.workflowBottlenecks.needsTriage} issue${data.workflowBottlenecks.needsTriage === 1 ? '' : 's'} waiting for triage`,
          to: '/issues?status=NEW',
        };
      } else if (data.workflowBottlenecks.pendingSiReview > 0) {
        spotlight = {
          icon: SearchCheck,
          message: `${data.workflowBottlenecks.pendingSiReview} resolution${data.workflowBottlenecks.pendingSiReview === 1 ? '' : 's'} waiting on your review`,
          to: '/issues?status=SI_REVIEW',
        };
      }
    } else if (isClientOrOemAdmin && data.workflowBottlenecks.pendingClientApproval > 0) {
      spotlight = {
        icon: Hourglass,
        message: `${data.workflowBottlenecks.pendingClientApproval} issue${data.workflowBottlenecks.pendingClientApproval === 1 ? '' : 's'} awaiting your approval`,
        to: '/issues?status=PENDING_CLIENT_APPROVAL',
      };
    } else if (isUser) {
      const overdueAssigned = data.myAssignedIssues.filter((i) => isOverdue(i.deadline)).length;
      if (overdueAssigned > 0) {
        spotlight = {
          icon: AlertTriangle,
          message: `${overdueAssigned} of your assigned issue${overdueAssigned === 1 ? ' is' : 's are'} overdue`,
          to: '/concern?concernFilter=assigned',
        };
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
            {getGreeting()}, {userName}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-slate-400">
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

      {spotlight && <SpotlightBanner icon={spotlight.icon} message={spotlight.message} to={spotlight.to} />}

      {/* Partial error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          Could not fully load dashboard data. Some sections may be unavailable.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SUPER_ADMIN Layout
         ══════════════════════════════════════════════════════════════════════ */}
      {currentUser?.role === 'SUPER_ADMIN' && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          >
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard to="/issues" label="Total Open" value={totalOpen ?? '—'} icon={ListChecks} tone="brand" />
                <StatCard to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '—'} icon={AlertTriangle} tone="red" />
                <StatCard to="/issues?priority=CRITICAL" label="Critical" value={data?.byPriority.CRITICAL ?? '—'} icon={AlertOctagon} tone="red" />
                <StatCard to="/issues?status=CLOSED" label="Resolved This Month" value={data?.resolvedThisMonth ?? '—'} icon={CheckCircle2} tone="green" />
                <StatCard to="/issues" label="Avg Resolution" value={data?.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '—'} icon={Timer} tone="sky" />
              </>
            )}
          </motion.div>

          <Card title="Deadline Health (SLA Aging)" icon={<Gauge />}>
            {isLoading ? <div className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <SlaAgingBar data={data.slaAging} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Workflow Bottlenecks" icon={<Workflow />} className="lg:col-span-2">
              {isLoading ? <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <WorkflowBottlenecks data={data.workflowBottlenecks} /> : null}
            </Card>
            <Card title="My Raised Issues" icon={<FileText />}>
              {isLoading ? <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <MyRaisedSummary data={data.myRaisedIssues} /> : null}
            </Card>
          </div>

          <Card title="Organization Comparison" icon={<BarChart3 />}>
            {isLoading ? (
              <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" />
            ) : data && data.orgComparison.length > 0 ? (
              <OrgComparisonBar data={data.orgComparison} />
            ) : (
              <p className="text-sm text-neutral-400 dark:text-slate-500">No organization data.</p>
            )}
          </Card>

          <Card title="Routing Distribution" icon={<Route />}>
            {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <RoutingDistribution data={data.routingDistribution} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card title="By Status">
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <StatusDonut byStatus={data.byStatus} /> : null}
            </Card>
            <Card title="By Priority">
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <PriorityBar byPriority={data.byPriority} /> : null}
            </Card>
          </div>

          <Card title="By Type">
            {isLoading ? <div className="h-40 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <TypeBar byType={data.byType} /> : null}
          </Card>
          <Card title="Trend — Last 30 Days" icon={<TrendingUp />}>
            {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <TrendLine data={data.trendLast30Days} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="My Assigned Issues" icon={<UserCheck />}>
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </Card>
            <Card title="Recent Activity" icon={<History />}>
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </Card>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SI ORG_ADMIN Layout — bottlenecks/routing promoted first
         ══════════════════════════════════════════════════════════════════════ */}
      {isSiAdmin && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          >
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard to="/issues" label="Total Open" value={totalOpen ?? '—'} icon={ListChecks} tone="brand" />
                <StatCard to="/issues?status=NEW" label="Needs Triage" value={data?.workflowBottlenecks.needsTriage ?? '—'} icon={CircleDot} tone="sky" />
                <StatCard to="/issues?status=SI_REVIEW" label="Pending SI Review" value={data?.workflowBottlenecks.pendingSiReview ?? '—'} icon={SearchCheck} tone="yellow" />
                <StatCard to="/issues?status=PENDING_CLIENT_APPROVAL" label="Pending Approval" value={data?.workflowBottlenecks.pendingClientApproval ?? '—'} icon={Hourglass} tone="teal" />
                <StatCard to="/issues?status=CLOSED" label="Resolved This Month" value={data?.resolvedThisMonth ?? '—'} icon={CheckCircle2} tone="green" />
              </>
            )}
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Workflow Bottlenecks" icon={<Workflow />}>
              {isLoading ? <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <WorkflowBottlenecks data={data.workflowBottlenecks} /> : null}
            </Card>
            <Card title="Routing Distribution" icon={<Route />}>
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <RoutingDistribution data={data.routingDistribution} /> : null}
            </Card>
          </div>

          <Card title="Deadline Health (SLA Aging)" icon={<Gauge />}>
            {isLoading ? <div className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <SlaAgingBar data={data.slaAging} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Team Overview" icon={<BarChart3 />} className="lg:col-span-2">
              {isLoading ? <SkeletonSection height={200} /> : data && data.orgSummary ? <OrgSummaryPanel data={data.orgSummary} /> : null}
            </Card>
            <Card title="My Raised Issues" icon={<FileText />}>
              {isLoading ? <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <MyRaisedSummary data={data.myRaisedIssues} /> : null}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card title="By Status">
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <StatusDonut byStatus={data.byStatus} /> : null}
            </Card>
            <Card title="By Priority">
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <PriorityBar byPriority={data.byPriority} /> : null}
            </Card>
          </div>

          <Card title="Trend — Last 30 Days" icon={<TrendingUp />}>
            {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <TrendLine data={data.trendLast30Days} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="My Assigned Issues" icon={<UserCheck />}>
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </Card>
            <Card title="Recent Activity" icon={<History />}>
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </Card>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CLIENT / OEM ORG_ADMIN Layout — approval + team overview promoted first
         ══════════════════════════════════════════════════════════════════════ */}
      {isClientOrOemAdmin && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          >
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard to="/issues" label="Total Open" value={totalOpen ?? '—'} icon={ListChecks} tone="brand" />
                <StatCard to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '—'} icon={AlertTriangle} tone="red" />
                <StatCard to="/issues?status=PENDING_CLIENT_APPROVAL" label="Pending Approval" value={data?.workflowBottlenecks.pendingClientApproval ?? '—'} icon={Hourglass} tone="teal" />
                <StatCard to="/issues?concern=true&concernFilter=raised" label="My Raised" value={data?.myRaisedIssues.open ?? '—'} icon={FileText} tone="brand" />
                <StatCard to="/issues?status=CLOSED" label="Resolved This Month" value={data?.resolvedThisMonth ?? '—'} icon={CheckCircle2} tone="green" />
              </>
            )}
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Team Overview" icon={<BarChart3 />} className="lg:col-span-2">
              {isLoading ? <SkeletonSection height={200} /> : data && data.orgSummary ? <OrgSummaryPanel data={data.orgSummary} /> : null}
            </Card>
            <Card title="My Raised Issues" icon={<FileText />}>
              {isLoading ? <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <MyRaisedSummary data={data.myRaisedIssues} /> : null}
            </Card>
          </div>

          <Card title="Deadline Health (SLA Aging)" icon={<Gauge />}>
            {isLoading ? <div className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <SlaAgingBar data={data.slaAging} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card title="By Status">
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <StatusDonut byStatus={data.byStatus} /> : null}
            </Card>
            <Card title="By Priority">
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <PriorityBar byPriority={data.byPriority} /> : null}
            </Card>
          </div>

          <Card title="Trend — Last 30 Days" icon={<TrendingUp />}>
            {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <TrendLine data={data.trendLast30Days} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="My Assigned Issues" icon={<UserCheck />}>
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </Card>
            <Card title="Recent Activity" icon={<History />}>
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </Card>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SI USER Layout
         ══════════════════════════════════════════════════════════════════════ */}
      {isUser && currentUser?.organization?.type === 'SI' && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard to="/concern?concernFilter=assigned" label="My Assigned" value={data?.myAssignedIssues.length ?? '—'} icon={UserCheck} tone="brand" />
                <StatCard to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '—'} icon={AlertTriangle} tone="red" />
                <StatCard to="/concern?concernFilter=raised" label="My Raised" value={data?.myRaisedIssues.open ?? '—'} icon={FileText} tone="brand" />
                <StatCard to="/issues?status=CLOSED" label="Resolved This Month" value={data?.resolvedThisMonth ?? '—'} icon={CheckCircle2} tone="green" />
              </>
            )}
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="My Assigned Issues" icon={<UserCheck />}>
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </Card>
            <Card title="Recent Activity" icon={<History />}>
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </Card>
          </div>

          <Card title="Deadline Health (SLA Aging)" icon={<Gauge />}>
            {isLoading ? <div className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <SlaAgingBar data={data.slaAging} /> : null}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Team Workload" icon={<BarChart3 />}>
              {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <TeamWorkloadBar data={data.teamWorkload} /> : null}
            </Card>
            <Card title="My Raised Issues" icon={<FileText />}>
              {isLoading ? <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <MyRaisedSummary data={data.myRaisedIssues} /> : null}
            </Card>
          </div>

          <Card title="Trend — Last 30 Days" icon={<TrendingUp />}>
            {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <TrendLine data={data.trendLast30Days} /> : null}
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CLIENT / OEM USER Layout — assigned/raised lists promoted first
         ══════════════════════════════════════════════════════════════════════ */}
      {isUser && currentUser?.organization?.type !== 'SI' && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard to="/concern?concernFilter=assigned" label="My Assigned" value={data?.myAssignedIssues.length ?? '—'} icon={UserCheck} tone="brand" />
                <StatCard to="/issues?overdue=true" label="Overdue" value={data?.overdue ?? '—'} icon={AlertTriangle} tone="red" />
                <StatCard to="/concern?concernFilter=raised" label="My Raised" value={data?.myRaisedIssues.open ?? '—'} icon={FileText} tone="brand" />
                <StatCard to="/issues?status=CLOSED" label="Resolved This Month" value={data?.resolvedThisMonth ?? '—'} icon={CheckCircle2} tone="green" />
              </>
            )}
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="My Assigned Issues" icon={<UserCheck />}>
              <AssignedIssuesList issues={data?.myAssignedIssues ?? []} isLoading={isLoading} />
            </Card>
            <Card title="Recent Activity" icon={<History />}>
              <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
            </Card>
          </div>

          <Card title="Deadline Health (SLA Aging)" icon={<Gauge />}>
            {isLoading ? <div className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <SlaAgingBar data={data.slaAging} /> : null}
          </Card>

          <Card title="My Raised Issues" icon={<FileText />}>
            {isLoading ? <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <MyRaisedSummary data={data.myRaisedIssues} /> : null}
          </Card>

          <Card title="Trend — Last 30 Days" icon={<TrendingUp />}>
            {isLoading ? <div className="h-48 animate-pulse rounded bg-neutral-100 dark:bg-slate-700" /> : data ? <TrendLine data={data.trendLast30Days} /> : null}
          </Card>
        </>
      )}
    </div>
  );
}
