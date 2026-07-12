import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export interface ProjectOrg {
  id: string;
  organizationId: string;
  organization: { id: string; name: string; type: string };
}

export interface ProjectUser {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    organization: { id: string; name: string; type: string };
  };
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  organizations: ProjectOrg[];
  users?: ProjectUser[];
  _count: { users: number; issues: number };
}

export interface CreateProjectData {
  name: string;
  description?: string;
  organizationIds: string[];
}

export async function fetchProjects(): Promise<Project[]> {
  return apiGet<Project[]>('/projects');
}

export async function fetchProject(id: string): Promise<Project> {
  return apiGet<Project>(`/projects/${id}`);
}

export async function createProject(data: CreateProjectData): Promise<Project> {
  return apiPost<Project>('/projects', data);
}

export async function updateProject(id: string, data: { name?: string; description?: string }): Promise<Project> {
  return apiPatch<Project>(`/projects/${id}`, data);
}

export async function deleteProject(id: string): Promise<void> {
  await apiDelete<void>(`/projects/${id}`);
}

export async function fetchProjectOrganizations(projectId: string): Promise<ProjectOrg[]> {
  return apiGet<ProjectOrg[]>(`/projects/${projectId}/organizations`);
}

export async function addOrganizationToProject(projectId: string, organizationId: string): Promise<ProjectOrg> {
  return apiPost<ProjectOrg>(`/projects/${projectId}/organizations`, { organizationId });
}

export async function removeOrganizationFromProject(projectId: string, orgId: string): Promise<void> {
  await apiDelete<void>(`/projects/${projectId}/organizations/${orgId}`);
}

export async function fetchProjectUsers(projectId: string): Promise<ProjectUser[]> {
  return apiGet<ProjectUser[]>(`/projects/${projectId}/users`);
}

export async function addUserToProject(projectId: string, userId: string): Promise<ProjectUser> {
  return apiPost<ProjectUser>(`/projects/${projectId}/users`, { userId });
}

export async function removeUserFromProject(projectId: string, userId: string): Promise<void> {
  await apiDelete<void>(`/projects/${projectId}/users/${userId}`);
}
