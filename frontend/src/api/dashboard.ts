import { apiGet } from './client';

export interface DashboardSummary {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>('/dashboard/summary');
}

export interface TrendPoint {
  date: string;
  created: number;
  resolved: number;
}

export interface AssignedIssueSummary {
  id: string;
  title: string;
  priority: string;
  status: string;
  deadline: string | null;
}

export interface ActivityEntry {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { name: string };
  issue: { id: string; title: string };
}

export interface OrgComparison {
  orgName: string;
  open: number;
  overdue: number;
}

export interface SlaAging {
  onTrack: number;
  warning: number;
  critical: number;
  overdue: number;
}

export interface WorkflowBottlenecks {
  needsTriage: number;
  awaitingClarification: number;
  pendingSiReview: number;
  pendingClientApproval: number;
}

export interface RoutingDistributionEntry {
  orgName: string;
  orgType: string;
  assignedCount: number;
  raisedCount: number;
}

export interface TeamMemberSummary {
  userId: string;
  userName: string;
  assignedCount: number;
  resolvedCount: number;
}

export interface OrgSummary {
  orgName: string;
  totalOpen: number;
  totalOverdue: number;
  byStatus: Record<string, number>;
  teamMembers: TeamMemberSummary[];
}

export interface TeamWorkloadEntry {
  userName: string;
  assignedCount: number;
  inProgressCount: number;
}

export interface MyRaisedIssues {
  total: number;
  open: number;
  overdue: number;
  pendingApproval: number;
}

export interface DashboardMetrics {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  overdue: number;
  resolvedThisMonth: number;
  avgResolutionDays: number | null;
  trendLast30Days: TrendPoint[];
  myAssignedIssues: AssignedIssueSummary[];
  recentActivity: ActivityEntry[];
  orgComparison: OrgComparison[];
  slaAging: SlaAging;
  workflowBottlenecks: WorkflowBottlenecks;
  routingDistribution: RoutingDistributionEntry[];
  orgSummary: OrgSummary | null;
  teamWorkload: TeamWorkloadEntry[];
  myRaisedIssues: MyRaisedIssues;
}

export async function fetchDashboardMetrics(projectIds?: string): Promise<DashboardMetrics> {
  const params = new URLSearchParams();
  if (projectIds) params.set('projectIds', projectIds);
  const qs = params.toString();
  return apiGet<DashboardMetrics>(`/dashboard/metrics${qs ? `?${qs}` : ''}`);
}