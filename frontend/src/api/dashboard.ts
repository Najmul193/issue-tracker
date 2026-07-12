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
}

export async function fetchDashboardMetrics(projectIds?: string): Promise<DashboardMetrics> {
  const params = new URLSearchParams();
  if (projectIds) params.set('projectIds', projectIds);
  const qs = params.toString();
  return apiGet<DashboardMetrics>(`/dashboard/metrics${qs ? `?${qs}` : ''}`);
}