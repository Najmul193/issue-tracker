import { apiGet, apiPost, apiDelete } from './client';

export interface Department {
  id: string;
  name: string;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentWithOrg extends Department {
  organization?: { id: string; name: string; type: string };
  managers?: { id: string; userId: string; user: { id: string; name: string; email: string; role: string } }[];
}

export interface DepartmentManager {
  id: string;
  departmentId: string;
  userId: string;
  user: { id: string; name: string; email: string; role: string };
  createdAt?: string;
}

export async function fetchDepartments(): Promise<DepartmentWithOrg[]> {
  return apiGet<DepartmentWithOrg[]>('/departments');
}

export async function fetchDepartmentsByOrg(organizationId: string): Promise<Department[]> {
  return apiGet<Department[]>(`/departments?organizationId=${organizationId}`);
}

export async function createDepartment(data: {
  name: string;
  organizationId: string;
}): Promise<Department> {
  return apiPost<Department>('/departments', data);
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiDelete<void>(`/departments/${id}`);
}

export async function fetchDepartmentManagers(departmentId: string): Promise<DepartmentManager[]> {
  return apiGet<DepartmentManager[]>(`/departments/${departmentId}/managers`);
}

export async function addDepartmentManager(
  departmentId: string,
  userId: string,
): Promise<DepartmentManager> {
  return apiPost<DepartmentManager>(`/departments/${departmentId}/managers`, { userId });
}

export async function removeDepartmentManager(
  departmentId: string,
  userId: string,
): Promise<void> {
  await apiDelete<void>(`/departments/${departmentId}/managers/${userId}`);
}
