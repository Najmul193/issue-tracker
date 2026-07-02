import { apiPost, apiGet } from './client';

export interface UserOrganization {
  id: string;
  name: string;
  type: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  organizationId: string;
  organization: UserOrganization;
}

interface LoginResponse {
  message: string;
}

interface MeResponse extends User {}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { email, password });
}

export async function logout(): Promise<void> {
  await apiPost<{ message: string }>('/auth/logout');
}

export async function getMe(): Promise<User> {
  return apiGet<MeResponse>('/auth/me');
}