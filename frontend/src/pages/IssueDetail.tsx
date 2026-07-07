import { useState, useRef, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIssue, assignIssue, updateIssueStatus, addComment, deleteIssue } from '../api/issues';
import { fetchAssignableUsers, fetchOrganizations } from '../api/users';
import type { IssueStatus } from '../api/issues';
import type { AssignableUser, UserOrg } from '../api/users';
import { useAuth } from '../context/AuthContext';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { ApiError, getBaseUrl, getAuthToken } from '../api/client';

/*
 * Transition map — must stay in sync with backend/src/modules/issues/state-machine.ts
 * The backend is the source of truth; this is for UI convenience only.
 */
const ALLOWED_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  NEW: ['ACKNOWLEDGED', 'ASSIGNED'],
  ACKNOWLEDGED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['VERIFIED', 'REOPENED'],
  VERIFIED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS'],
};

const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
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
  const [assignTarget, setAssignTarget] = useState<'user' | 'org'>('user');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignOrgId, setAssignOrgId] = useState('');
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState<IssueStatus | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');

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

  const { data: orgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, comment, resolutionNote }: { status: IssueStatus; comment?: string; resolutionNote?: string }) => {
      if (!id) return;
      return updateIssueStatus(id, { status, comment, resolutionNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      setShowStatusConfirm(null);
      setStatusComment('');
      setResolutionNoteInput('');
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

  function handleStatusSubmit(target: IssueStatus) {
    if (target === 'REOPENED' && !statusComment.trim()) {
      setStatusError('A comment is required when reopening an issue.');
      return;
    }
    if (target === 'RESOLVED' && !resolutionNoteInput.trim()) {
      setStatusError('A resolution note is required when resolving an issue.');
      return;
    }
    statusMutation.mutate({
      status: target,
      comment: statusComment.trim() || undefined,
      resolutionNote: target === 'RESOLVED' ? resolutionNoteInput.trim() : undefined,
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

  const isAdmin = currentUser?.role === 'ORG_ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  // Determine if the current user is authorized to change status
  // Mirrors backend's canActOnIssue: SUPER_ADMIN always, or org matches raisedByOrg/assignedToOrg, or is the assigned user
  const canChangeStatus = (() => {
    if (!currentUser || !issue) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    const effectiveAssignedOrgId = issue.assignedToOrgId ?? issue.assignedToUser?.organizationId;
    if (currentUser.role === 'ORG_ADMIN' && effectiveAssignedOrgId === currentUser.organizationId) return true;
    if (issue.assignedToUserId && currentUser.id === issue.assignedToUserId) return true;
    return false;
  })();

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

  const allowedNext = ALLOWED_TRANSITIONS[issue.status] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="text-xl font-semibold text-gray-900">{issue.title}</h2>
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
          {issue.module && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {issue.module}
            </span>
          )}
          {isAdmin && (
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
              <p className="text-xs text-gray-500">{issue.assignedToOrg?.name}</p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500">
              {issue.assignedToOrg ? `${issue.assignedToOrg.name} Queue` : 'Unassigned'}
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
                {s === 'REOPENED' ? 'Reopen' : `Mark ${s.replace('_', ' ')}`}
              </button>
            ))}
          </div>

          {showStatusConfirm && (
            <div className="mt-3 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm text-gray-700">
                Change status to <strong>{showStatusConfirm.replace('_', ' ')}</strong>?
              </p>
              {showStatusConfirm === 'REOPENED' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Comment (required for reopening)
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

      {/* Assign/Reassign Control — only for raiser or current assignee */}
      {issue.status !== 'CLOSED' && currentUser && (
        (issue.raisedBy.id === currentUser.id || issue.assignedToUserId === currentUser.id)
      ) && (
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
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="assignTarget"
                checked={assignTarget === 'org'}
                onChange={() => setAssignTarget('org')}
              />
              Route to org
            </label>
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
              {(orgs || [])
                .filter((o: UserOrg) => {
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
                .map((o: UserOrg) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              if (assignTarget === 'user' && !assignUserId) return;
              if (assignTarget === 'org' && !assignOrgId) return;
              setShowAssignConfirm(true);
            }}
            disabled={(assignTarget === 'user' && !assignUserId) || (assignTarget === 'org' && !assignOrgId)}
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
                <> Route to organization queue: {(orgs || []).find((o) => o.id === assignOrgId)?.name}</>
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
      )}

      {/* Attachments — always visible and downloadable */}
      {issue.attachments && issue.attachments.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Attachments ({issue.attachments.length})
          </h3>
          <ul className="space-y-2">
            {issue.attachments.map((att, idx) => (
              <li key={att.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-400">
                    {att.fileType.startsWith('image/') ? '🖼' : '📎'}
                  </span>
                  <span className="truncate text-sm font-medium text-gray-700">{att.fileName}</span>
                  <span className="shrink-0 text-xs text-gray-400">{formatFileSize(att.fileSize)}</span>
                </div>
                <button
                  onClick={() => downloadMutation.mutate({ attachmentId: att.id, issueId: issue.id, index: idx + 1 })}
                  disabled={downloadMutation.isPending}
                  className="shrink-0 ml-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
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