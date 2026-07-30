import { useState, useRef, type FormEvent, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trash2,
  MoreHorizontal,
  Eye,
  RotateCcw,
  MessageCircleQuestion,
  MessageSquare,
  CheckCircle2,
  ThumbsUp,
  XCircle,
  ArrowRight,
  UserPlus,
  Paperclip,
  Download,
  FileText,
  X,
  type LucideIcon,
} from 'lucide-react';
import { fetchIssue, assignIssue, updateIssueStatus, updateIssueFields, addComment, deleteIssue } from '../api/issues';
import { fetchAssignableUsers } from '../api/users';
import { fetchProjectOrganizations, fetchProjectDepartments } from '../api/projects';
import type { ProjectOrg, ProjectDept } from '../api/projects';
import type { IssueType, IssueStatus, IssueStatusOrResolve, UpdateIssueFieldsData } from '../api/issues';
import type { AssignableUser } from '../api/users';
import { useAuth } from '../context/AuthContext';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import ImagePreviewGrid from '../components/ImagePreviewGrid';
import { ApiError, getBaseUrl, getAuthToken } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import AlertBanner from '../components/ui/AlertBanner';
import { staggerContainer, staggerItem } from '../lib/motion';

/*
 * Transition map — must stay in sync with backend/src/modules/issues/state-machine.ts
 * The backend is the source of truth; this is for UI convenience only.
 *
 * Two flows:
 *   Flow A (Client→SI):      NEW→UNDER_REVIEW→ASSIGNED→IN_PROGRESS→PENDING_CLIENT_APPROVAL→CLOSED
 *   Flow B (Client→SI→OEM): NEW→UNDER_REVIEW→ASSIGNED→IN_PROGRESS→SI_REVIEW→PENDING_CLIENT_APPROVAL→CLOSED
 *
 * RESOLVED is a virtual action: the UI shows a "Resolve" button from IN_PROGRESS.
 * The backend auto-routes it to SI_REVIEW before persisting.
 */
const ALLOWED_TRANSITIONS: Record<IssueStatus, IssueStatusOrResolve[]> = {
  NEW:                      ['UNDER_REVIEW'],
  SI_APPROVAL:              ['ASSIGNED', 'CLARIFICATION_REQUESTED'],
  UNDER_REVIEW:             ['CLARIFICATION_REQUESTED', 'ASSIGNED'],
  CLARIFICATION_REQUESTED:  ['UNDER_REVIEW', 'IN_PROGRESS'],
  ASSIGNED:                 ['IN_PROGRESS'],
  IN_PROGRESS:              ['RESOLVED', 'CLARIFICATION_REQUESTED'],
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
  if (remaining < 0) return 'text-red-600 font-medium dark:text-red-400';
  if (remaining < 0.2 * (7 * 24 * 60 * 60 * 1000)) return 'text-amber-600 font-medium dark:text-amber-400';
  return 'text-neutral-700 dark:text-slate-300';
}

// Same (from, to) → (label, icon) mapping as before; only an icon lookup was added alongside the existing label logic.
function getTransitionMeta(s: IssueStatusOrResolve, currentStatus: IssueStatus): { label: string; icon: LucideIcon } {
  if (s === 'UNDER_REVIEW' && currentStatus === 'NEW') return { label: 'Acknowledge (Under Review)', icon: Eye };
  if (s === 'UNDER_REVIEW' && currentStatus === 'CLOSED') return { label: 'Reopen (Under Review)', icon: RotateCcw };
  if (s === 'UNDER_REVIEW') return { label: 'Provide Clarification (Under Review)', icon: MessageCircleQuestion };
  if (s === 'IN_PROGRESS' && currentStatus === 'CLARIFICATION_REQUESTED')
    return { label: 'Provide Clarification (In Progress)', icon: MessageSquare };
  if (s === 'CLARIFICATION_REQUESTED' && currentStatus === 'UNDER_REVIEW')
    return { label: 'Clarification Needed', icon: MessageCircleQuestion };
  if (s === 'CLARIFICATION_REQUESTED') return { label: 'Request Clarification', icon: MessageCircleQuestion };
  if (s === 'ASSIGNED' && currentStatus === 'UNDER_REVIEW') return { label: 'Valid', icon: CheckCircle2 };
  if (s === 'PENDING_CLIENT_APPROVAL' && currentStatus === 'SI_REVIEW') return { label: 'Approved', icon: ThumbsUp };
  if (s === 'ASSIGNED' && currentStatus === 'SI_REVIEW') return { label: 'Not Approved', icon: XCircle };
  if (s === 'CLOSED' && currentStatus === 'PENDING_CLIENT_APPROVAL') return { label: 'Approve', icon: ThumbsUp };
  if (s === 'ASSIGNED' && currentStatus === 'PENDING_CLIENT_APPROVAL') return { label: 'Not Approved', icon: XCircle };
  return { label: `Mark ${s.replace(/_/g, ' ')}`, icon: ArrowRight };
}

const typeOptions: { label: string; value: IssueType }[] = [
  { label: 'Bug', value: 'BUG' },
  { label: 'New Requirement', value: 'NEW_REQUIREMENT' },
  { label: 'Change Request', value: 'CHANGE_REQUEST' },
  { label: 'Query', value: 'QUERY' },
];

function toDatetimeLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function AssignTargetPill({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        checked
          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400'
          : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <input type="radio" name="assignTarget" checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
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

  const [isEditingFields, setIsEditingFields] = useState(false);
  const [editType, setEditType] = useState<IssueType>('BUG');
  const [editDeadline, setEditDeadline] = useState('');
  const [editClearDeadline, setEditClearDeadline] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const { data: issue, isLoading, error } = useQuery({
    queryKey: ['issue', id],
    queryFn: () => fetchIssue(id!),
    enabled: !!id,
    refetchInterval: 10_000,
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
      status, comment, resolutionNote,
    }: { status: IssueStatusOrResolve; comment?: string; resolutionNote?: string }) => {
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

  const fieldsMutation = useMutation({
    mutationFn: async () => {
      if (!id || !issue) return;
      const data: UpdateIssueFieldsData = {};
      if (editType !== issue.type) data.type = editType;
      if (editClearDeadline) {
        data.clearDeadline = true;
      } else if (editDeadline && editDeadline !== toDatetimeLocal(new Date(issue.deadline!))) {
        data.deadline = new Date(editDeadline).toISOString();
      }
      if (Object.keys(data).length === 0) {
        setIsEditingFields(false);
        return issue;
      }
      return updateIssueFields(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      setIsEditingFields(false);
      setFieldsError(null);
    },
    onError: (err) => {
      setFieldsError(err instanceof ApiError ? err.message : 'Failed to update fields');
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

  // Only SI org members can act on SI_REVIEW state
  const canActOnSiReview = currentUser?.organization.type === 'SI' || currentUser?.role === 'SUPER_ADMIN';

  // Only CLIENT org admin / issue creator / SUPER_ADMIN can close
  const canClose = (() => {
    if (!currentUser || !issue) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.id === issue.raisedById) return true;
    if (currentUser.organizationId === issue.raisedByOrg.id && currentUser.role === 'ORG_ADMIN') return true;
    return false;
  })();

  // SI or SUPER_ADMIN can edit type/deadline only in SI_APPROVAL or UNDER_REVIEW
  const canEditFields = (() => {
    if (!currentUser || !issue) return false;
    if (issue.status !== 'SI_APPROVAL' && issue.status !== 'UNDER_REVIEW') return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (currentUser.organization.type === 'SI') return true;
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
      if (status === 'SI_APPROVAL') return canActOnSiReview;
      if (status === 'SI_REVIEW') return canActOnSiReview;
      // 3. Issue Creator actions (providing clarification)
      if (status === 'CLARIFICATION_REQUESTED') {
        const isCreator = currentUser?.id === issue?.raisedById;
        const isClientOrgAdmin = currentUser?.organizationId === issue?.raisedByOrg.id && currentUser?.role === 'ORG_ADMIN';
        const canProvideClarification = isCreator || isClientOrgAdmin || currentUser?.role === 'SUPER_ADMIN';

        const lastStatusChange = issue?.activityLogs?.find(l => l.action === 'STATUS_CHANGED' && l.newValue === 'CLARIFICATION_REQUESTED');
        const cameFrom = lastStatusChange?.oldValue;
        // Clarification from UNDER_REVIEW or SI_APPROVAL → respond with UNDER_REVIEW
        // Clarification from IN_PROGRESS (OEM) → respond with IN_PROGRESS
        const respondWithUnderReview = cameFrom === 'UNDER_REVIEW' || cameFrom === 'SI_APPROVAL';

        if (canProvideClarification) {
          if (respondWithUnderReview && t === 'UNDER_REVIEW') return true;
          if (!respondWithUnderReview && t === 'IN_PROGRESS') return true;
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

      // 5. Client actions (approving or rejecting)
      if (status === 'PENDING_CLIENT_APPROVAL') {
        return canClose; // canClose exactly matches (isCreator || isCreatorOrgAdmin || SUPER_ADMIN)
      }

      return true;
    });
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-64 rounded bg-neutral-200 dark:bg-slate-700" />
        <div className="h-4 w-full rounded bg-neutral-200 dark:bg-slate-700" />
        <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-slate-700/60 dark:bg-slate-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">Issue Not Found</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400">
          The issue you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link to="/issues" className="mt-4 inline-block">
          <Button>Back to Issues</Button>
        </Link>
      </div>
    );
  }

  const allowedNext = getVisibleTransitions(issue.status);
  const canDelete =
    issue.raisedBy.id === currentUser?.id ||
    currentUser?.role === 'SUPER_ADMIN' ||
    (currentUser?.role === 'ORG_ADMIN' && issue.raisedByOrg?.id === currentUser.organization.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-2 flex flex-wrap items-start gap-2">
          <h2 className="min-w-0 flex-1 text-xl font-semibold text-neutral-900 dark:text-slate-100">{issue.title}</h2>
          {canDelete && (
            <>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this issue? This action cannot be undone.')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="hidden shrink-0 items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-500/10 sm:inline-flex"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this issue? This action cannot be undone.')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                aria-label="Delete issue"
                className="shrink-0 rounded-md border border-neutral-200 p-1.5 text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 sm:hidden"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
          {issue.project && (
            <Link
              to={`/projects/${issue.project.id}`}
              className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:hover:bg-indigo-500/25"
            >
              {issue.project.name}
            </Link>
          )}
          {issue.module && (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-slate-700 dark:text-slate-300">
              {issue.module}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400">
          #{issue.id.slice(0, 8)} &middot; Created {formatDate(issue.createdAt)}
        </p>
      </div>

      {/* Metadata grid */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-slate-400">Raised By</p>
            <p className="mt-0.5 text-sm font-medium text-neutral-900 dark:text-slate-100">{issue.raisedBy.name}</p>
            <p className="text-xs text-neutral-500 dark:text-slate-400">{issue.raisedByOrg.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-slate-400">Assigned To</p>
            {issue.assignedToUser ? (
              <>
                <p className="mt-0.5 text-sm font-medium text-neutral-900 dark:text-slate-100">{issue.assignedToUser.name}</p>
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  {issue.assignedToDepartment
                    ? `${issue.assignedToOrg?.name || 'Org'} (${issue.assignedToDepartment.name})`
                    : issue.assignedToOrg?.name}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-slate-400">
                {issue.assignedToDepartment
                  ? `${issue.assignedToOrg?.name || 'Org'} (${issue.assignedToDepartment.name})`
                  : issue.assignedToOrg
                    ? `${issue.assignedToOrg.name} Queue`
                    : 'Unassigned'}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-slate-400">Deadline</p>
            {isEditingFields ? (
              <div className="mt-0.5 space-y-1">
                <input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={(e) => { setEditDeadline(e.target.value); setEditClearDeadline(false); }}
                  className="block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={editClearDeadline}
                    onChange={(e) => setEditClearDeadline(e.target.checked)}
                    className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700"
                  />
                  Clear deadline
                </label>
              </div>
            ) : (
              <p className={`mt-0.5 text-sm font-medium ${getDeadlineClass(issue.deadline)}`}>
                {issue.deadline ? formatDate(issue.deadline) : '—'}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-slate-400">Type</p>
            {isEditingFields ? (
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as IssueType)}
                className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-neutral-900 dark:text-slate-100">
                {issue.type.replace('_', ' ')}
              </p>
            )}
          </div>
        </div>
      </Card>
      {canEditFields && (
        <div className="flex items-center gap-2">
          {isEditingFields ? (
            <>
              {fieldsError && <p className="text-xs text-red-600 dark:text-red-400">{fieldsError}</p>}
              <Button size="sm" onClick={() => fieldsMutation.mutate()} isLoading={fieldsMutation.isPending}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setIsEditingFields(false); setFieldsError(null); }}>
                Cancel
              </Button>
            </>
          ) : (
            <button
              onClick={() => {
                setEditType(issue.type);
                setEditDeadline(issue.deadline ? toDatetimeLocal(new Date(issue.deadline)) : toDatetimeLocal(new Date()));
                setEditClearDeadline(false);
                setFieldsError(null);
                setIsEditingFields(true);
              }}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Edit type / deadline
            </button>
          )}
        </div>
      )}

      {/* Description */}
      {issue.description && (
        <Card title="Description">
          <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-slate-300">{issue.description}</p>
        </Card>
      )}

      {/* Resolution Note — visible to all viewers if it exists */}
      {issue.resolutionNote && issue.resolvedBy && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-500/30 dark:bg-teal-500/10">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            Resolution Note
          </h3>
          <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-slate-200">{issue.resolutionNote}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
            <span className="font-medium text-teal-700 dark:text-teal-300">{issue.resolvedBy.name}</span>
            <span>{issue.resolvedBy.organization.name}</span>
            <span>&middot;</span>
            <span>{issue.resolvedAt ? formatDateTime(issue.resolvedAt) : ''}</span>
          </div>
        </div>
      )}

      {/* Status Change Control */}
      {canChangeStatus && allowedNext.length > 0 ? (
        <Card title="Update Status">
          <AnimatePresence>{statusError && <AlertBanner tone="error">{statusError}</AlertBanner>}</AnimatePresence>
          <div className="flex flex-wrap gap-2">
            {allowedNext.map((s) => {
              const meta = getTransitionMeta(s, issue.status);
              return (
                <Button
                  key={s}
                  variant="secondary"
                  size="sm"
                  icon={<meta.icon />}
                  onClick={() => setShowStatusConfirm(s)}
                  disabled={statusMutation.isPending}
                >
                  {meta.label}
                </Button>
              );
            })}
          </div>

          <AnimatePresence>
            {showStatusConfirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-sm text-neutral-700 dark:text-slate-300">
                    Change status to <strong>{showStatusConfirm.replace('_', ' ')}</strong>?
                  </p>
                  {showStatusConfirm === 'CLARIFICATION_REQUESTED' && (
                    <Textarea
                      label="Comment (required for requesting clarification)"
                      rows={2}
                      value={statusComment}
                      onChange={(e) => setStatusComment(e.target.value)}
                    />
                  )}
                  {showStatusConfirm === 'UNDER_REVIEW' && issue.status === 'CLARIFICATION_REQUESTED' && (
                    <Textarea
                      label="Comment (required to provide clarification)"
                      rows={2}
                      value={statusComment}
                      onChange={(e) => setStatusComment(e.target.value)}
                    />
                  )}
                  {showStatusConfirm === 'IN_PROGRESS' && issue.status === 'CLARIFICATION_REQUESTED' && (
                    <Textarea
                      label="Comment (required to provide clarification)"
                      rows={2}
                      value={statusComment}
                      onChange={(e) => setStatusComment(e.target.value)}
                    />
                  )}
                  {showStatusConfirm === 'RESOLVED' && (
                    <div className="space-y-1">
                      {issue.resolutionNote && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          This will replace the previous resolution note.
                        </p>
                      )}
                      <Textarea
                        label="Resolution Note (required)"
                        rows={3}
                        value={resolutionNoteInput}
                        onChange={(e) => setResolutionNoteInput(e.target.value)}
                        placeholder="Explain how the issue was resolved..."
                      />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => handleStatusSubmit(showStatusConfirm)} isLoading={statusMutation.isPending}>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setShowStatusConfirm(null); setStatusComment(''); setResolutionNoteInput(''); setStatusError(null); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ) : (
        <Card title="Status">
          <div className="flex items-center gap-2">
            <StatusBadge status={issue.status} />
            <span className="text-xs text-neutral-400 dark:text-slate-500">— Only the involved teams can update status.</span>
          </div>
        </Card>
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

        // SI_REVIEW and SI_APPROVAL are gatekeeping stages — only SI team can reassign
        const isSiLocked = (issue.status === 'SI_REVIEW' || issue.status === 'SI_APPROVAL') && currentUser.organization.type !== 'SI';

        if (isSiLocked) {
          canAssign = false;
        } else if (currentUser.organization.type === 'SI') {
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
          <Card title="Assign / Reassign">
            <AnimatePresence>{assignError && <AlertBanner tone="error">{assignError}</AlertBanner>}</AnimatePresence>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <AssignTargetPill checked={assignTarget === 'user'} onChange={() => setAssignTarget('user')}>
                  To user
                </AssignTargetPill>
                {issue && currentUser && (
                  (currentUser.role === 'ORG_ADMIN' && (issue.assignedToOrgId ?? issue.assignedToUser?.organizationId) === currentUser.organization.id) ? null :
                  (isCurrentAssignee && currentUser.role === 'USER') ? null :
                  <>
                    <AssignTargetPill checked={assignTarget === 'org'} onChange={() => setAssignTarget('org')}>
                      Route to org
                    </AssignTargetPill>
                    {issue.projectId && projectDepts && projectDepts.length > 0 && (
                      <AssignTargetPill checked={assignTarget === 'dept'} onChange={() => setAssignTarget('dept')}>
                        Route to dept
                      </AssignTargetPill>
                    )}
                  </>
                )}
              </div>

              {assignTarget === 'user' && (
                <Select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="sm:max-w-xs">
                  <option value="">Select user...</option>
                  {(users || [])
                    .filter((u: AssignableUser) => {
                      if (!currentUser || !issue) return true;
                      if (currentUser.organization.type === 'SI') {
                        const assignedOrgId = issue.assignedToOrgId ?? issue.assignedToUser?.organizationId;
                        if (assignedOrgId === currentUser.organization.id) {
                          return u.organizationId === currentUser.organization.id;
                        }
                        return u.organizationId !== issue.raisedByOrg.id;
                      }
                      return true;
                    })
                    .map((u: AssignableUser) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
              )}

              {assignTarget === 'org' && (
                <Select value={assignOrgId} onChange={(e) => setAssignOrgId(e.target.value)} className="sm:max-w-xs">
                  <option value="">Select org...</option>
                  {(projectOrgs || [])
                    .filter((po: ProjectOrg) => {
                      const o = po.organization;
                      if (o.type === 'SUPER_ADMIN') return false;
                      if (currentUser?.organization?.type === 'SI') {
                        const assignedOrgId = issue.assignedToOrgId ?? issue.assignedToUser?.organizationId;
                        if (assignedOrgId === currentUser.organization.id) {
                          return o.id === currentUser.organization.id;
                        }
                        return o.id !== issue.raisedByOrg?.id;
                      }
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
                </Select>
              )}

              {assignTarget === 'dept' && (
                <Select value={assignDeptId} onChange={(e) => setAssignDeptId(e.target.value)} className="sm:max-w-xs">
                  <option value="">Select department...</option>
                  {(projectDepts || [])
                    .filter((pd: ProjectDept) => {
                      if (!currentUser || !issue) return true;
                      if (currentUser.organization.type === 'SI') {
                        const assignedOrgId = issue.assignedToOrgId ?? issue.assignedToUser?.organizationId;
                        if (assignedOrgId === currentUser.organization.id) {
                          return pd.department.organizationId === currentUser.organization.id;
                        }
                      }
                      return pd.department.organizationId !== issue.raisedByOrg?.id;
                    })
                    .map((pd: ProjectDept) => (
                      <option key={pd.department.id} value={pd.department.id}>
                        {pd.department.organization?.name || 'Org'} ({pd.department.name})
                      </option>
                    ))}
                </Select>
              )}

              <Button
                icon={<UserPlus />}
                onClick={() => {
                  if (assignTarget === 'user' && !assignUserId) return;
                  if (assignTarget === 'org' && !assignOrgId) return;
                  if (assignTarget === 'dept' && !assignDeptId) return;
                  setShowAssignConfirm(true);
                }}
                disabled={(assignTarget === 'user' && !assignUserId) || (assignTarget === 'org' && !assignOrgId) || (assignTarget === 'dept' && !assignDeptId)}
              >
                Assign
              </Button>
            </div>

            <AnimatePresence>
              {showAssignConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
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
                      <Button
                        size="sm"
                        onClick={() => assignMutation.mutate()}
                        isLoading={assignMutation.isPending}
                        className="!bg-amber-600 hover:!bg-amber-700"
                      >
                        Confirm
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setShowAssignConfirm(false); setAssignError(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })()}

      {/* Attachments — always visible and downloadable */}
      {issue.attachments && issue.attachments.length > 0 && (
        <Card title={`Attachments (${issue.attachments.length})`}>
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
                      <li
                        key={att.id}
                        className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-slate-700"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-neutral-400 dark:text-slate-500" />
                          <span className="truncate text-sm font-medium text-neutral-700 dark:text-slate-200">{att.fileName}</span>
                          <span className="shrink-0 text-xs text-neutral-400 dark:text-slate-500">{formatFileSize(att.fileSize)}</span>
                        </div>
                        <button
                          onClick={() => {
                            const idx = issue.attachments.indexOf(att);
                            downloadMutation.mutate({ attachmentId: att.id, issueId: issue.id, index: idx + 1 });
                          }}
                          disabled={downloadMutation.isPending}
                          className="ml-2 flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            );
          })()}
        </Card>
      )}

      {/* Comments — always visible and open to any authenticated user */}
      <Card title={`Comments (${issue.comments?.length || 0})`}>
        {issue.comments && issue.comments.length > 0 && (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="mb-4 space-y-3">
            {issue.comments.map((c) => (
              <motion.div
                key={c.id}
                variants={staggerItem}
                className="flex gap-2.5 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/30"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
                  {c.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400">
                    <span className="font-medium text-neutral-700 dark:text-slate-200">{c.user.name}</span>
                    <span>{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-slate-300">{c.text}</p>
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {c.attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-xs">
                          <Paperclip className="h-3 w-3 text-neutral-400 dark:text-slate-500" />
                          <span className="text-neutral-600 dark:text-slate-300">{a.fileName}</span>
                          <span className="text-neutral-400 dark:text-slate-500">{formatFileSize(a.fileSize)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Comment input — always visible and usable by any authenticated user */}
        <form onSubmit={handleCommentSubmit} className="space-y-2">
          <AnimatePresence>{commentError && <AlertBanner tone="error">{commentError}</AlertBanner>}</AnimatePresence>
          <Textarea rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach files
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleCommentFileSelect(e.target.files)} />
            <div className="flex flex-wrap gap-1">
              {commentFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-slate-700 dark:text-slate-300"
                >
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setCommentFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-neutral-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Button type="submit" size="sm" disabled={!commentText.trim()} isLoading={commentMutation.isPending} className="ml-auto">
              Comment
            </Button>
          </div>
        </form>
      </Card>

      {/* Activity Log */}
      {issue.activityLogs && issue.activityLogs.length > 0 && (
        <Card title="Activity Log">
          <div className="relative space-y-4 pl-1">
            <div className="absolute bottom-1 left-[5px] top-1 w-px bg-neutral-200 dark:bg-slate-700" />
            {issue.activityLogs.map((log) => (
              <div key={log.id} className="relative flex items-start gap-3 pl-5 text-sm">
                <div className="absolute left-0 top-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-neutral-300 dark:border-slate-800 dark:bg-slate-600" />
                <div>
                  <p className="text-neutral-700 dark:text-slate-300">
                    <span className="font-medium text-neutral-900 dark:text-slate-100">{log.user.name}</span>{' '}
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
                    ) : log.action === 'FIELD_UPDATED' ? (
                      (() => {
                        try {
                          const ov = JSON.parse(log.oldValue || '{}');
                          const nv = JSON.parse(log.newValue || '{}');
                          const fieldName = ov.field;
                          const oldVal = fieldName === 'deadline' ? (ov.value ? formatDate(ov.value) : 'none') : ov.value?.replace(/_/g, ' ');
                          const newVal = fieldName === 'deadline' ? (nv.value ? formatDate(nv.value) : 'none') : nv.value?.replace(/_/g, ' ');
                          return <>changed {fieldName} from <strong>{oldVal}</strong> to <strong>{newVal}</strong></>;
                        } catch {
                          return <>updated issue fields</>;
                        }
                      })()
                    ) : (
                      <>{log.action.toLowerCase().replace(/_/g, ' ')}</>
                    )}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-slate-500">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
