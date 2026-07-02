import { apiGet } from './client';

export interface DashboardSummary {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>('/dashboard/summary');
}