import { apiGet, apiPost, apiPatch } from './client';

export interface UserOrg {
  id: string;
  name: string;
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
  organizationId: string;
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
  organizationId: string;
}

export async function fetchAssignableUsers(): Promise<AssignableUser[]> {
  return apiGet<AssignableUser[]>('/users/assignable');
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
