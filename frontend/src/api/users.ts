import { apiGet, apiPost, apiPatch } from './client';

export interface UserOrg {
  id: string;
  name: string;
  type: string;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organization: UserOrg;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
  organizationId?: string;
  newOrganizationName?: string;
  newOrganizationType?: string;
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  status?: string;
}

export async function fetchUsers(): Promise<UserListItem[]> {
  return apiGet<UserListItem[]>('/users');
}

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: string;
}

export async function fetchAssignableUsers(issueId?: string): Promise<AssignableUser[]> {
  const params = issueId ? `?issueId=${encodeURIComponent(issueId)}` : '';
  return apiGet<AssignableUser[]>(`/users/assignable${params}`);
}

export async function fetchOrganizations(): Promise<UserOrg[]> {
  return apiGet<UserOrg[]>('/organizations');
}

export async function createUser(data: CreateUserData): Promise<UserListItem> {
  return apiPost<UserListItem>('/users', data);
}

export async function updateUser(id: string, data: UpdateUserData): Promise<UserListItem> {
  return apiPatch<UserListItem>(`/users/${id}`, data);
}
