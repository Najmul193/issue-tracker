declare global {
  interface Window {
    __RUNTIME_CONFIG__?: { VITE_API_BASE_URL?: string };
  }
}

const BASE_URL =
  window.__RUNTIME_CONFIG__?.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string) {
    super(429, message);
    this.name = 'RateLimitError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 429) {
      throw new RateLimitError('Too many requests. Please try again later.');
    }
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.message || `Request failed with status ${response.status}`,
    );
  }
  return response.json();
}

export async function apiGet<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return handleResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    ...options,
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
  return handleResponse<T>(response);
}