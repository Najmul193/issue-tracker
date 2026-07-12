import { apiGet, apiPatch } from './client';

export interface NotificationItem {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  issue: { id: string; title: string };
}

export interface NotificationsResponse {
  data: NotificationItem[];
  total: number;
  page: number;
  limit: number;
}

export interface UnreadCountResponse {
  count: number;
}

export async function fetchNotifications(
  page = 1,
  limit = 10,
  unread?: boolean,
  projectIds?: string,
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (unread) params.set('unread', 'true');
  if (projectIds) params.set('projectIds', projectIds);
  return apiGet<NotificationsResponse>(`/notifications?${params.toString()}`);
}

export async function fetchUnreadCount(projectIds?: string): Promise<UnreadCountResponse> {
  const params = new URLSearchParams();
  if (projectIds) params.set('projectIds', projectIds);
  const qs = params.toString();
  return apiGet<UnreadCountResponse>(`/notifications/unread-count${qs ? `?${qs}` : ''}`);
}

export async function markAsRead(id: string) {
  return apiPatch<{ isRead: boolean }>(`/notifications/${id}/read`);
}

export async function markAllAsRead() {
  return apiPatch<{ success: boolean }>('/notifications/read-all');
}