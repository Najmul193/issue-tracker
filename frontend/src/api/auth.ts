import { apiPost, apiGet, setAuthToken, clearAuthToken } from './client';

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
  token: string;
}

interface MeResponse extends User {}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await apiPost<LoginResponse>('/auth/login', { email, password });
  if (res.token) {
    setAuthToken(res.token);
  }
  return res;
}

export async function logout(): Promise<void> {
  try {
    await apiPost<{ message: string }>('/auth/logout');
  } finally {
    clearAuthToken();
  }
}

export async function getMe(): Promise<User> {
  return apiGet<MeResponse>('/auth/me');
}