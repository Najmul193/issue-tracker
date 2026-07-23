import { useState, useRef, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIssue, assignIssue, updateIssueStatus, addComment, deleteIssue } from '../api/issues';
import { fetchAssignableUsers } from '../api/users';
import { fetchProjectOrganizations, fetchProjectDepartments } from '../api/projects';
import type { ProjectOrg, ProjectDept } from '../api/projects';
import type { IssueStatus, IssueStatusOrResolve } from '../api/issues';
import type { AssignableUser } from '../api/users';
import { useAuth } from '../context/AuthContext';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import ImagePreviewGrid from '../components/ImagePreviewGrid';
import { ApiError, getBaseUrl, getAuthToken } from '../api/client';

/*
 * Transition map — must stay in sync with backend/src/modules/issues/state-machine.ts
 * The backend is the source of truth; this is for UI convenience only.
 *
 * Two flows:
 *   Flow A (Client→SI):      NEW→UNDER_REVIEW→ASSIGNED→IN_PROGRESS→[IN_QA→]PENDING_CLIENT_APPROVAL→CLOSED
 *   Flow B (Client→SI→OEM): NEW→UNDER_REVIEW→ASSIGNED→IN_PROGRESS→SI_REVIEW→PENDING_CLIENT_APPROVAL→CLOSED
 *
 * RESOLVED is a virtual action: the UI shows a "Resolve" button from IN_PROGRESS.
 * The backend auto-routes it to SI_REVIEW / IN_QA / PENDING_CLIENT_APPROVAL.
 */
const ALLOWED_TRANSITIONS: Record<IssueStatus, IssueStatusOrResolve[]> = {
  NEW:                      ['UNDER_REVIEW'],
  UNDER_REVIEW:             ['CLARIFICATION_REQUESTED', 'ASSIGNED'],
  CLARIFICATION_REQUESTED:  ['UNDER_REVIEW', 'IN_PROGRESS'],
  ASSIGNED:                 ['IN_PROGRESS'],
  IN_PROGRESS:              ['RESOLVED', 'CLARIFICATION_REQUESTED'],
  IN_QA:                    ['PENDING_CLIENT_APPROVAL', 'IN_PROGRESS'], // Kept for legacy issues
  SI_REVIEW:                ['PENDING_CLIENT_APPROVAL', 'ASSIGNED'],
  PENDING_CLIENT_APPROVAL:  ['CLOSED', 'ASSIGNED'],
  CLOSED:                   ['UNDER_REVIEW'],
};

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 5;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDeadlineClass(deadline: string | null): string {
  if (!deadline) return '';
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining < 0) return 'text-red-600 font-medium';
  if (remaining < 0.2 * (7 * 24 * 60 * 60 * 1000)) return 'text-amber-600 font-medium';
  return 'text-gray-700';
}

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [statusError, setStatusError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<'user' | 'org' | 'dept'>('user');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignOrgId, setAssignOrgId] = useState('');
  const [assignDeptId, setAssignDeptId] = useState('');
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState<IssueStatusOrResolve | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');
  const [requiresQA, setRequiresQA] = useState(false);

  const { data: issue, isLoading, error } = useQuery({
    queryKey: ['issue', id],
    queryFn: () => fetchIssue(id!),
    enabled: !!id,
  });

  const isCurrentAssignee = !!(issue && currentUser && issue.assignedToUserId === currentUser.id);

  const { data: users } = useQuery({
    queryKey: ['assignable-users', id],
    queryFn: () => fetchAssignableUsers(id),
    enabled: !!id,
  });

  const { data: projectOrgs } = useQuery({
    queryKey: ['project-orgs', issue?.projectId],
    queryFn: () => fetchProjectOrganizations(issue!.projectId!),
    enabled: !!issue?.projectId,
  });

  const { data: projectDepts } = useQuery({
    queryKey: ['project-depts', issue?.projectId],
    queryFn: () => fetchProjectDepartments(issue!.projectId!),
    enabled: !!issue?.projectId,
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      status, comment, resolutionNote, requiresQA,
    }: { status: IssueStatusOrResolve; comment?: string; resolutionNote?: string; requiresQA?: boolean }) => {
      if (!id) return;
      return updateIssueStatus(id, { status, comment, resolutionNote, requiresQA });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      setShowStatusConfirm(null);
      setStatusComment('');
      setResolutionNoteInput('');
      setRequiresQA(false);
      setStatusError(null);
    },
    onError: (err) => {
      setStatusError(err instanceof ApiError ? err.message : 'Failed to update status');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      if (assignTarget === 'user' && assignUserId) {
        return assignIssue(id, { targetUserId: assignUserId });
      }
      if (assignTarget === 'org' && assignOrgId) {
        return assignIssue(id, { targetOrgId: assignOrgId });
      }
      if (assignTarget === 'dept' && assignDeptId) {
        return assignIssue(id, { targetDepartmentId: assignDeptId });
      }
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      setShowAssignConfirm(false);
      setAssignError(null);
    },
    onError: (err) => {
      setAssignError(err instanceof ApiError ? err.message : 'Failed to assign');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      await deleteIssue(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      navigate('/issues');
    },
    onError: (err) => {
      alert(err instanceof ApiError ? err.message : 'Failed to delete issue');
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      return addComment(id, commentText, commentFiles.length > 0 ? commentFiles : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      setCommentText('');
      setCommentFiles([]);
      setCommentError(null);
    },
    onError: (err) => {
      setCommentError(err instanceof ApiError ? err.message : 'Failed to add comment');
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async ({
      attachmentId,
      issueId,
      index,
    }: {
      attachmentId: string;
      issueId: string;
      index: number;
    }) => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(
        `${getBaseUrl()}/attachments/${attachmentId}/download`,
        { credentials: 'include', headers },
      );
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?(.+?)"?$/);
      const originalName = match?.[1] || '';
      const ext = originalName.includes('.') ? originalName.split('.').pop()! : '';
      const baseId = issueId.replace(/-/g, '_');
      const filename = ext ? `${baseId}_attachment${index}.${ext}` : `${baseId}_attachment${index}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  function handleStatusSubmit(target: IssueStatusOrResolve) {
    // Clarification needs a comment
    if (target === 'CLARIFICATION_REQUESTED' && !statusComment.trim()) {
      setStatusError('A comment is required when requesting clarification.');
      return;
    }
    // Responding to clarification needs a comment
    if (target === 'UNDER_REVIEW' && issue?.status === 'CLARIFICATION_REQUESTED' && !statusComment.trim()) {
      setStatusError('A comment is required when providing clarification.');
      return;
    }
    // Resolve requires a resolution note
    if (target === 'RESOLVED' && !resolutionNoteInput.trim()) {
      setStatusError('A resolution note is required when resolving an issue.');
      return;
    }
    statusMutation.mutate({
      status: target,
      comment: statusComment.trim() || undefined,
      resolutionNote: target === 'RESOLVED' ? resolutionNoteInput.trim() : undefined,
      requiresQA: target === 'RESOLVED' ? requiresQA : undefined,
    });
  }

  function handleCommentSubmit(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate();
  }

  function handleCommentFileSelect(files: FileList | null) {
    if (!files) return;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!ALLOWED_FILE_TYPES.includes(f.type)) {
        setCommentError(`File type "${f.type}" not allowed`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setCommentError(`File "${f.name}" exceeds 15MB`);
        continue;
      }
      newFiles.push(f);
    }
    setCommentFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
  }

  // Mirrors backend canActOnIssue: SUPER_ADMIN always, SI org always (central team), raisedByOrg, assignedToOrg, assigned user
  const canChangeStatus = (() => {
    if (!currentUser || !issue) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    // SI (Data Edge) is always involved
    if (currentUser.organization.type === 'SI') return true;
    const effectiveAssignedOrgId = issue.assignedToOrgId ?? issue.assignedToUser?.organizationId;
    if (currentUser.organizationId === issue.raisedByOrg.id) return true;
    if (effectiveAssignedOrgId && currentUser.organizationId === effectiveAssignedOrgId) return true;
    if (issue.assignedToUserId && currentUser.id === issue.assignedToUserId) return true;
    return false;
  })();

  // Only SI org members can move to UNDER_REVIEW from NEW
  const canMoveToUnderReview = currentUser?.organization.type === 'SI' || currentUser?.role === 'SUPER_ADMIN';

  // Only SI org members can act on SI_REVIEW and IN_QA states
  const canActOnSiReview = currentUser?.organization.type === 'SI' || currentUser?.role === 'SUPER_ADMIN';

  // Only CLIENT org admin / issue creator / SUPER_ADMIN can close
  const canClose = (() => {
    if (!currentUser || !issue) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.id === issue.raisedById) return true;
    if (currentUser.organizationId === issue.raisedByOrg.id && currentUser.role === 'ORG_ADMIN') return true;
    return false;
  })();

  // Filter the visible transitions for the current user
  function getVisibleTransitions(status: IssueStatus): IssueStatusOrResolve[] {
    const all = ALLOWED_TRANSITIONS[status] ?? [];
    return all.filter((t) => {
      if (t === 'UNDER_REVIEW' && status === 'NEW') return canMoveToUnderReview;
      if (t === 'UNDER_REVIEW' && status === 'CLOSED') return canActOnSiReview;
      if (t === 'CLOSED') return canClose;
      if (status === 'UNDER_REVIEW') return canActOnSiReview;
      if (status === 'SI_REVIEW') return canActOnSiReview;
      // 3. Issue Creator actions (providing clarification)
      if (status === 'CLARIFICATION_REQUESTED') {
        const isCreator = currentUser?.id === issue?.raisedById;
        const isClientOrgAdmin = currentUser?.organizationId === issue?.raisedByOrg.id && currentUser?.role === 'ORG_ADMIN';
        const canProvideClarification = isCreator || isClientOrgAdmin || currentUser?.role === 'SUPER_ADMIN';
        
        const lastStatusChange = issue?.activityLogs?.find(l => l.action === 'STATUS_CHANGED' && l.newValue === 'CLARIFICATION_REQUESTED');
        const cameFromUnderReview = lastStatusChange?.oldValue === 'UNDER_REVIEW';

        if (canProvideClarification) {
          if (cameFromUnderReview && t === 'UNDER_REVIEW') return true;
          if (!cameFromUnderReview && t === 'IN_PROGRESS') return true;
        }
        return false;
      }

      // 4. Assignee actions (working on the issue)
      if (status === 'ASSIGNED' || status === 'IN_PROGRESS') {
        const isAssignee = currentUser?.id === issue?.assignedToUserId;
        const isAssigneeOrg = currentUser?.organizationId === (issue?.assignedToOrgId ?? issue?.assignedToUser?.organizationId);
        const canWorkOnIssue = isAssignee || isAssigneeOrg || currentUser?.role === 'SUPER_ADMIN';
        if (t === 'RESOLVED' || t === 'CLARIFICATION_REQUESTED' || t === 'IN_PROGRESS') return canWorkOnIssue;
        return false;
      }

      return true;
    });
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-64 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-3/4 rounded bg-gray-200" />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Issue Not Found</h2>
        <p className="mt-2 text-sm text-gray-500">
          The issue you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link
          to="/issues"
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Issues
        </Link>
      </div>
    );
  }

  const allowedNext = getVisibleTransitions(issue.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="text-xl font-semibold text-gray-900">{issue.title}</h2>
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
          {issue.project && (
            <Link
              to={`/projects/${issue.project.id}`}
              className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 transition-colors"
            >
              {issue.project.name}
            </Link>
          )}
          {issue.module && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {issue.module}
            </span>
          )}
          {(issue.raisedBy.id === currentUser?.id || currentUser?.role === 'SUPER_ADMIN' || (currentUser?.role === 'ORG_ADMIN' && issue.raisedByOrg?.id === currentUser.organization.id)) && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this issue? This action cannot be undone.')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="ml-auto rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          #{issue.id.slice(0, 8)} · Created {formatDate(issue.createdAt)}
        </p>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Raised By</p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{issue.raisedBy.name}</p>
          <p className="text-xs text-gray-500">{issue.raisedByOrg.name}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Assigned To</p>
          {issue.assignedToUser ? (
            <>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{issue.assignedToUser.name}</p>
              <p className="text-xs text-gray-500">
                {issue.assignedToDepartment
                  ? `${issue.assignedToOrg?.name || 'Org'} (${issue.assignedToDepartment.name})`
                  : issue.assignedToOrg?.name}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500">
              {issue.assignedToDepartment
                ? `${issue.assignedToOrg?.name || 'Org'} (${issue.assignedToDepartment.name})`
                : issue.assignedToOrg
                  ? `${issue.assignedToOrg.name} Queue`
                  : 'Unassigned'}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Deadline</p>
          <p className={`mt-0.5 text-sm font-medium ${getDeadlineClass(issue.deadline)}`}>
            {issue.deadline ? formatDate(issue.deadline) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Type</p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">
            {issue.type.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Description */}
      {issue.description && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Description</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{issue.description}</p>
        </div>
      )}

      {/* Resolution Note — visible to all viewers if it exists */}
      {issue.resolutionNote && issue.resolvedBy && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Resolution Note
            </h3>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{issue.resolutionNote}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-teal-600">
            <span className="font-medium text-teal-700">{issue.resolvedBy.name}</span>
            <span>{issue.resolvedBy.organization.name}</span>
            <span>·</span>
            <span>{issue.resolvedAt ? formatDateTime(issue.resolvedAt) : ''}</span>
          </div>
        </div>
      )}

      {/* Status Change Control */}
      {canChangeStatus && allowedNext.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Update Status
          </h3>
          {statusError && (
            <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {statusError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {allowedNext.map((s) => (
              <button
                key={s}
                onClick={() => setShowStatusConfirm(s)}
                disabled={statusMutation.isPending}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {s === 'UNDER_REVIEW' && issue.status === 'NEW' ? 'Acknowledge (Under Review)' : s === 'UNDER_REVIEW' ? 'Provide Clarification (Under Review)' : s === 'IN_PROGRESS' && issue.status === 'CLARIFICATION_REQUESTED' ? 'Provide Clarification (In Progress)' : s === 'CLARIFICATION_REQUESTED' && issue.status === 'UNDER_REVIEW' ? 'Clarification Needed' : s === 'CLARIFICATION_REQUESTED' ? 'Request Clarification' : s === 'ASSIGNED' && issue.status === 'UNDER_REVIEW' ? 'Valid' : s === 'PENDING_CLIENT_APPROVAL' && issue.status === 'SI_REVIEW' ? 'Approved' : s === 'ASSIGNED' && issue.status === 'SI_REVIEW' ? 'Not Approved' : s === 'CLOSED' && issue.status === 'PENDING_CLIENT_APPROVAL' ? 'Approve' : s === 'ASSIGNED' && issue.status === 'PENDING_CLIENT_APPROVAL' ? 'Not Approved' : `Mark ${s.replace(/_/g, ' ')}`}
              </button>
            ))}
          </div>

          {showStatusConfirm && (
            <div className="mt-3 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm text-gray-700">
                Change status to <strong>{showStatusConfirm.replace('_', ' ')}</strong>?
              </p>
              {showStatusConfirm === 'CLARIFICATION_REQUESTED' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Comment (required for requesting clarification)
                  </label>
                  <textarea
                    rows={2}
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
              {showStatusConfirm === 'UNDER_REVIEW' && issue.status === 'CLARIFICATION_REQUESTED' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Comment (required to provide clarification)
                  </label>
                  <textarea
                    rows={2}
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
              {showStatusConfirm === 'IN_PROGRESS' && issue.status === 'CLARIFICATION_REQUESTED' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Comment (required to provide clarification)
                  </label>
                  <textarea
                    rows={2}
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
              {showStatusConfirm === 'RESOLVED' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Resolution Note (required)
                    </label>
                    {issue.resolutionNote && (
                      <p className="mb-1 text-xs text-amber-600">
                        This will replace the previous resolution note.
                      </p>
                    )}
                    <textarea
                      rows={3}
                      value={resolutionNoteInput}
                      onChange={(e) => setResolutionNoteInput(e.target.value)}
                      placeholder="Explain how the issue was resolved..."
                      className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusSubmit(showStatusConfirm)}
                  disabled={statusMutation.isPending}
                  className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {statusMutation.isPending ? 'Updating...' : 'Confirm'}
                </button>
                <button
                  onClick={() => { setShowStatusConfirm(null); setStatusComment(''); setResolutionNoteInput(''); setStatusError(null); }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={issue.status} />
            <span className="text-xs text-gray-400">
              — Only the involved teams can update status.
            </span>
          </div>
        </div>
      )}

      {/* Assign/Reassign Control */}
      {(() => {
        if (issue.status === 'CLOSED' || !currentUser) return null;
        if (currentUser.role === 'SUPER_ADMIN') return null;
        
        const isAssigned = !!(issue.assignedToUserId || issue.assignedToOrgId || issue.assignedToDepartmentId);
        const isRaiserOrg = issue.raisedByOrg.id === currentUser.organizationId;
        const isRaiserAdmin = isRaiserOrg && currentUser.role === 'ORG_ADMIN';
        const isRaiserNormal = isRaiserOrg && currentUser.role === 'USER';
        
        let canAssign = false;
        
        if (currentUser.organization.type === 'SI') {
          canAssign = true;
        } else if (isRaiserAdmin) {
          canAssign = true;
        } else if (isRaiserNormal && !isAssigned) {
          canAssign = true;
        } else if (issue.assignedToUserId === currentUser.id) {
          canAssign = true;
        } else if (currentUser.role === 'ORG_ADMIN' && (issue.assignedToOrgId ?? issue.assignedToUser?.organizationId) === currentUser.organizationId) {
          canAssign = true;
        }

        if (!canAssign) return null;

        return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Assign / Reassign
        </h3>
        {assignError && (
          <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {assignError}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="assignTarget"
              checked={assignTarget === 'user'}
              onChange={() => setAssignTarget('user')}
            />
            To user
          </label>
          {issue && currentUser && (
            (currentUser.role === 'ORG_ADMIN' && (issue.assignedToOrgId ?? issue.assignedToUser?.organizationId) === currentUser.organization.id) ? null :
            (isCurrentAssignee && currentUser.role === 'USER') ? null :
            <>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="assignTarget"
                  checked={assignTarget === 'org'}
                  onChange={() => setAssignTarget('org')}
                />
                Route to org
              </label>
              {issue.projectId && projectDepts && projectDepts.length > 0 && (
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="assignTarget"
                    checked={assignTarget === 'dept'}
                    onChange={() => setAssignTarget('dept')}
                  />
                  Route to dept
                </label>
              )}
            </>
          )}

          {assignTarget === 'user' && (
            <select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select user...</option>
              {(users || []).map((u: AssignableUser) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          )}

          {assignTarget === 'org' && (
            <select
              value={assignOrgId}
              onChange={(e) => setAssignOrgId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select org...</option>
              {(projectOrgs || [])
                .filter((po: ProjectOrg) => {
                  const o = po.organization;
                  if (o.type === 'SUPER_ADMIN') return false;
                  if (currentUser?.role === 'USER') return o.type !== currentUser?.organization?.type;
                  if (currentUser?.role === 'ORG_ADMIN' && issue) {
                    const isRaiser = issue.raisedByOrg?.id === currentUser.organization.id;
                    const assignedOrgId = issue.assignedToOrgId ?? issue.assignedToUser?.organizationId;
                    const isAssignedToActorOrg = assignedOrgId === currentUser.organization.id;
                    if (isRaiser && !isAssignedToActorOrg) return o.type !== currentUser?.organization?.type;
                    if (isAssignedToActorOrg) return o.id === currentUser.organization.id;
                  }
                  return true;
                })
                .map((po: ProjectOrg) => (
                <option key={po.organization.id} value={po.organization.id}>
                  {po.organization.name}
                </option>
              ))}
            </select>
          )}

          {assignTarget === 'dept' && (
            <select
              value={assignDeptId}
              onChange={(e) => setAssignDeptId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select department...</option>
              {(projectDepts || [])
                .filter((pd: ProjectDept) => {
                  if (!currentUser || !issue) return true;
                  return pd.department.organizationId !== issue.raisedByOrg?.id;
                })
                .map((pd: ProjectDept) => (
                  <option key={pd.department.id} value={pd.department.id}>
                    {pd.department.organization?.name || 'Org'} ({pd.department.name})
                  </option>
                ))}
            </select>
          )}

          <button
            onClick={() => {
              if (assignTarget === 'user' && !assignUserId) return;
              if (assignTarget === 'org' && !assignOrgId) return;
              if (assignTarget === 'dept' && !assignDeptId) return;
              setShowAssignConfirm(true);
            }}
            disabled={(assignTarget === 'user' && !assignUserId) || (assignTarget === 'org' && !assignOrgId) || (assignTarget === 'dept' && !assignDeptId)}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Assign
          </button>
        </div>

        {showAssignConfirm && (
          <div className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            <p className="font-medium">Confirm assignment</p>
            <p className="mt-1 text-xs">
              This will notify the assignee and create an activity log entry.
              {assignTarget === 'user' && assignUserId && (
                <> Selected user: {(users || []).find((u) => u.id === assignUserId)?.name}</>
              )}
              {assignTarget === 'org' && assignOrgId && (
                <> Route to organization queue: {(projectOrgs || []).find((po) => po.organization.id === assignOrgId)?.organization.name}</>
              )}
              {assignTarget === 'dept' && assignDeptId && (
                <> Route to department: {(projectDepts || []).find((pd) => pd.department.id === assignDeptId)?.department.name}</>
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
                className="rounded-md bg-yellow-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                {assignMutation.isPending ? 'Assigning...' : 'Confirm'}
              </button>
              <button
                onClick={() => { setShowAssignConfirm(false); setAssignError(null); }}
                className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        </div>
        );
      })()}

      {/* Attachments — always visible and downloadable */}
      {issue.attachments && issue.attachments.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Attachments ({issue.attachments.length})
          </h3>

          {(() => {
            const imageAtts = issue.attachments.filter((a) => a.fileType === 'image/jpeg' || a.fileType === 'image/png');
            const otherAtts = issue.attachments.filter((a) => a.fileType !== 'image/jpeg' && a.fileType !== 'image/png');

            return (
              <>
                {imageAtts.length > 0 && (
                  <div className="mb-3">
                    <ImagePreviewGrid attachments={imageAtts} />
                  </div>
                )}
                {otherAtts.length > 0 && (
                  <ul className="space-y-2">
                    {otherAtts.map((att) => (
                      <li key={att.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-gray-400">📎</span>
                          <span className="truncate text-sm font-medium text-gray-700">{att.fileName}</span>
                          <span className="shrink-0 text-xs text-gray-400">{formatFileSize(att.fileSize)}</span>
                        </div>
                        <button
                          onClick={() => {
                            const idx = issue.attachments.indexOf(att);
                            downloadMutation.mutate({ attachmentId: att.id, issueId: issue.id, index: idx + 1 });
                          }}
                          disabled={downloadMutation.isPending}
                          className="shrink-0 ml-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Comments — always visible and open to any authenticated user */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Comments ({issue.comments?.length || 0})
        </h3>

        {issue.comments && issue.comments.length > 0 && (
          <div className="mb-4 space-y-3">
            {issue.comments.map((c) => (
              <div key={c.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{c.user.name}</span>
                  <span>{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{c.text}</p>
                {c.attachments && c.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {c.attachments.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">📎</span>
                        <span className="text-gray-600">{a.fileName}</span>
                        <span className="text-gray-400">{formatFileSize(a.fileSize)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Comment input — always visible and usable by any authenticated user */}
        <form onSubmit={handleCommentSubmit} className="space-y-2">
          {commentError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {commentError}
            </div>
          )}
          <textarea
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Attach files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleCommentFileSelect(e.target.files)}
            />
            <div className="flex flex-wrap gap-1">
              {commentFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setCommentFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <button
              type="submit"
              disabled={!commentText.trim() || commentMutation.isPending}
              className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {commentMutation.isPending ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </form>
      </div>

      {/* Activity Log */}
      {issue.activityLogs && issue.activityLogs.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Activity Log
          </h3>
          <div className="space-y-2">
            {issue.activityLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                <div>
                  <p className="text-gray-700">
                    <span className="font-medium text-gray-900">{log.user.name}</span>{' '}
                    {log.action === 'STATUS_CHANGED' ? (
                      <>changed status from <strong>{log.oldValue}</strong> to <strong>{log.newValue}</strong></>
                    ) : log.action === 'CREATED' ? (
                      <>created issue</>
                    ) : log.action === 'ASSIGNED' ? (
                      (() => {
                        try {
                          const nv = JSON.parse(log.newValue || '{}');
                          return <>assigned issue to <strong>{nv.assignedToUserName || nv.assignedToOrgName || 'unknown'}</strong></>;
                        } catch {
                          return <>assigned issue</>;
                        }
                      })()
                    ) : log.action === 'REASSIGNED' ? (
                      (() => {
                        try {
                          const ov = JSON.parse(log.oldValue || '{}');
                          const nv = JSON.parse(log.newValue || '{}');
                          return <>reassigned from <strong>{ov.assignedToUserName || ov.assignedToOrgName || 'none'}</strong> to <strong>{nv.assignedToUserName || nv.assignedToOrgName || 'unknown'}</strong></>;
                        } catch {
                          return <>reassigned issue</>;
                        }
                      })()
                    ) : (
                      <>{log.action.toLowerCase().replace(/_/g, ' ')}</>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}