import { apiGet, apiPost, apiPatch, apiDelete, getAuthToken, getBaseUrl } from './client';

export type IssueStatus =
  | 'NEW'
  | 'ACKNOWLEDGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'CLOSED'
  | 'REOPENED';

export type IssuePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IssueType = 'BUG' | 'NEW_REQUIREMENT' | 'CHANGE_REQUEST' | 'QUERY';

export interface IssueUser {
  id: string;
  name: string;
  email: string;
  organizationId?: string;
}

export interface IssueUserWithOrg extends IssueUser {
  organization: IssueOrg;
}

export interface IssueOrg {
  id: string;
  name: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  module: string | null;
  deadline: string | null;
  createdAt: string;
  raisedById: string;
  raisedBy: IssueUser;
  raisedByOrg: IssueOrg | null;
  assignedToUserId: string | null;
  assignedToUser: IssueUser | null;
  assignedToOrgId: string | null;
  assignedToOrg: IssueOrg | null;
  assignedById: string | null;
  assignedBy: IssueUser | null;
  resolutionNote: string | null;
  resolvedBy: IssueUserWithOrg | null;
  resolvedAt: string | null;
  comments: Comment[];
  attachments: Attachment[];
  activityLogs: ActivityLog[];
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
  uploadedById: string;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  user: IssueUser;
  attachments?: Attachment[];
}

export interface ActivityLog {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: IssueUser;
}

export interface IssuesResponse {
  data: Issue[];
  total: number;
  page: number;
  limit: number;
}

export interface IssuesQueryParams {
  status?: IssueStatus;
  priority?: IssuePriority;
  type?: IssueType;
  module?: string;
  overdue?: string;
  concern?: string;
  concernFilter?: string;
  page?: string;
  limit?: string;
  assignedOrg?: string;
}

export interface CreateIssueData {
  title: string;
  description?: string;
  type: IssueType;
  priority: IssuePriority;
  deadline: string;
  module?: string;
}

export interface AssignIssueData {
  targetUserId?: string;
  targetOrgId?: string;
}

export interface UpdateStatusData {
  status: IssueStatus;
  comment?: string;
  resolutionNote?: string;
}

export async function fetchIssues(
  params: IssuesQueryParams,
): Promise<IssuesResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, value);
    }
  }
  const qs = searchParams.toString();
  return apiGet<IssuesResponse>(`/issues${qs ? `?${qs}` : ''}`);
}

export async function fetchIssue(id: string): Promise<Issue> {
  return apiGet<Issue>(`/issues/${id}`);
}

export async function createIssue(data: CreateIssueData): Promise<Issue> {
  return apiPost<Issue>('/issues', data);
}

export async function uploadAttachments(
  issueId: string,
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.message || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open(
      'POST',
      `${getBaseUrl()}/issues/${issueId}/attachments`,
    );
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

export async function assignIssue(
  id: string,
  data: AssignIssueData,
): Promise<Issue> {
  return apiPatch<Issue>(`/issues/${id}/assign`, data);
}

export async function updateIssueStatus(
  id: string,
  data: UpdateStatusData,
): Promise<Issue> {
  return apiPatch<Issue>(`/issues/${id}/status`, data);
}

export async function addComment(
  issueId: string,
  text: string,
  files?: File[],
): Promise<Comment> {
  const formData = new FormData();
  formData.append('text', text);
  if (files) {
    for (const file of files) {
      formData.append('attachments', file);
    }
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(
    `${getBaseUrl()}/issues/${issueId}/comments`,
    {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function deleteIssue(id: string): Promise<void> {
  await apiDelete<void>(`/issues/${id}`);
}