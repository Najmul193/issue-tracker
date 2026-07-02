import { apiGet } from './client';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
}

export async function fetchUsers(): Promise<UserListItem[]> {
  return apiGet<UserListItem[]>('/users');
}

export async function fetchOrganizations(): Promise<{ id: string; name: string }[]> {
  return apiGet<{ id: string; name: string }[]>('/organizations');
}