import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { updateIssueStatus } from '../api/issues';
import type { IssueStatus, IssueStatusOrResolve } from '../api/issues';
import { ApiError } from '../api/client';
import { getTransitionMeta, getTransitionInput } from '../lib/issueTransitions';
import { STATUS_LABELS } from './StatusBadge';
import Button from './ui/Button';
import Modal from './ui/Modal';
import Textarea from './ui/Textarea';

/**
 * Status-change buttons for a single issue row, so a reviewer can clear their queue without
 * opening each issue.
 *
 * Which buttons appear is decided entirely by `issue.permittedTransitions`, computed by the
 * backend. This component contains no permission logic — that is what stops the buttons from
 * offering an action the API will reject.
 */

/**
 * The only fields this component actually touches. Deliberately narrower than the full `Issue`
 * type from `api/issues.ts` — the full `Issue` satisfies this structurally, so the Concern page's
 * existing usage needs no change, but it also lets lighter objects (e.g. the dashboard's
 * `AssignedIssueSummary`) be passed directly without fetching a full issue first.
 */
export interface QuickActionIssue {
  id: string;
  title: string;
  status: IssueStatus;
  permittedTransitions?: IssueStatusOrResolve[];
}

interface IssueQuickActionsProps {
  issue: QuickActionIssue;
  /** Reported upward so the page can show one banner instead of one per row. */
  onResult?: (result: { tone: 'success' | 'error'; message: string }) => void;
  /**
   * Reports whether THIS row is mid-action (modal open or request in flight) so the page can
   * pause polling. Keyed by issue id because several rows can be busy at once — a plain
   * boolean would let the first one to finish resume polling under the others.
   */
  onBusyChange?: (issueId: string, busy: boolean) => void;
}

/** Approve-ish actions lead; rejections are destructive; the rest stay quiet. */
function variantFor(
  target: IssueStatusOrResolve,
  from: IssueStatus,
): 'primary' | 'secondary' | 'danger' | 'subtle' {
  if (target === 'CLOSED') return 'primary';
  if (target === 'PENDING_CLIENT_APPROVAL') return 'primary';
  if (target === 'ASSIGNED' && from === 'UNDER_REVIEW') return 'primary';
  if (target === 'ASSIGNED' && (from === 'SI_REVIEW' || from === 'PENDING_CLIENT_APPROVAL'))
    return 'danger';
  if (target === 'CLARIFICATION_REQUESTED') return 'secondary';
  return 'subtle';
}

export default function IssueQuickActions({
  issue,
  onResult,
  onBusyChange,
}: IssueQuickActionsProps) {
  const queryClient = useQueryClient();
  const [pendingTarget, setPendingTarget] = useState<IssueStatusOrResolve | null>(null);
  const [text, setText] = useState('');

  const targets = issue.permittedTransitions ?? [];

  const mutation = useMutation({
    mutationFn: async (vars: {
      target: IssueStatusOrResolve;
      comment?: string;
      resolutionNote?: string;
    }) =>
      updateIssueStatus(issue.id, {
        status: vars.target,
        comment: vars.comment,
        resolutionNote: vars.resolutionNote,
      }),
    onSuccess: (_data, vars) => {
      closeModal();
      const label =
        vars.target === 'RESOLVED' ? 'Resolved' : (STATUS_LABELS[vars.target] ?? vars.target);
      onResult?.({ tone: 'success', message: `${issue.title} → ${label}` });
      invalidate();
    },
    onError: (err) => {
      onResult?.({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to update status',
      });
      // Refresh even on failure: a 403 here usually means someone else moved the issue
      // first, so the stale row needs to correct itself rather than sit there.
      invalidate();
    },
  });

  // A status change fans out to notifications, dashboards and deadline views.
  function invalidate() {
    for (const key of [
      ['concern'],
      ['issues'],
      ['issue', issue.id],
      ['dashboard-metrics'],
      ['dashboard-summary'],
      ['notifications'],
      ['unread-count'],
      ['calendar-assigned'],
      ['calendar-raised'],
    ]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }

  function closeModal() {
    setPendingTarget(null);
    setText('');
  }

  const busy = mutation.isPending || pendingTarget !== null;
  const issueId = issue.id;
  useEffect(() => {
    onBusyChange?.(issueId, busy);
    // Release the pause if this row unmounts mid-action.
    return () => onBusyChange?.(issueId, false);
  }, [busy, issueId, onBusyChange]);

  function handleClick(target: IssueStatusOrResolve) {
    if (getTransitionInput(target, issue.status) === 'none') {
      mutation.mutate({ target });
      return;
    }
    setPendingTarget(target);
  }

  function handleConfirm() {
    if (!pendingTarget) return;
    const kind = getTransitionInput(pendingTarget, issue.status);
    mutation.mutate({
      target: pendingTarget,
      comment: kind === 'comment' ? text.trim() : undefined,
      resolutionNote: kind === 'resolutionNote' ? text.trim() : undefined,
    });
  }

  /*
   * Clarification requests are handled correctly here: the backend resolves which stage the
   * request came from and returns only the matching answer target, so the row shows one
   * button rather than making the user pick.
   */
  if (targets.length === 0) {
    return (
      <a
        href={`/issues/${issue.id}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        Open <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  const modalKind = pendingTarget ? getTransitionInput(pendingTarget, issue.status) : 'none';
  const modalMeta = pendingTarget ? getTransitionMeta(pendingTarget, issue.status) : null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {targets.map((target) => {
          const meta = getTransitionMeta(target, issue.status);
          return (
            <Button
              key={target}
              size="sm"
              variant={variantFor(target, issue.status)}
              icon={<meta.icon />}
              disabled={busy}
              isLoading={mutation.isPending && mutation.variables?.target === target}
              onClick={() => handleClick(target)}
            >
              {meta.label}
            </Button>
          );
        })}
      </div>

      <Modal
        isOpen={pendingTarget !== null}
        onClose={closeModal}
        title={modalMeta?.label ?? 'Update status'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              isLoading={mutation.isPending}
              disabled={!text.trim()}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-neutral-600 dark:text-slate-300">{issue.title}</p>
        {/* Surfaced here as well as on the page banner — while the modal is open the
            banner behind it is not visible. */}
        {mutation.isError && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Failed to update status'}
          </p>
        )}
        <Textarea
          label={
            modalKind === 'resolutionNote'
              ? 'Resolution note (required)'
              : 'Comment (required)'
          }
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            modalKind === 'resolutionNote'
              ? 'Explain how the issue was resolved...'
              : 'Explain what needs clarifying...'
          }
        />
      </Modal>
    </>
  );
}
