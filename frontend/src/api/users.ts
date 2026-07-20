import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export interface UserOrg {
  id: string;
  name: string;
  type: string;
}

export interface UserDepartment {
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
  departmentId: string | null;
  department: UserDepartment | null;
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
  departmentId?: string;
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  status?: string;
  departmentId?: string;
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

export async function deleteUser(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/users/${id}`);
}

export async function deleteOrganization(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/organizations/${id}`);
}

export interface DeletedUser extends UserListItem {}

export async function fetchDeletedUsers(): Promise<DeletedUser[]> {
  return apiGet<DeletedUser[]>('/users/deleted');
}

export interface DeletedOrg {
  id: string;
  name: string;
  type: string;
  _count: { users: number };
}

export async function fetchDeletedOrganizations(): Promise<DeletedOrg[]> {
  return apiGet<DeletedOrg[]>('/organizations/deleted');
}

export async function permanentDeleteUser(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/users/${id}/permanent`);
}

export async function permanentDeleteOrganization(id: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/organizations/${id}/permanent`);
}
