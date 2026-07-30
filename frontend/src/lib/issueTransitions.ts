import {
  ArrowRight,
  CheckCircle2,
  Eye,
  MessageCircleQuestion,
  MessageSquare,
  RotateCcw,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IssueStatus, IssueStatusOrResolve } from '../api/issues';

/**
 * Presentation helpers for status transitions.
 *
 * Deliberately contains NO permission logic. Which transitions a user may perform is
 * decided by the backend and delivered as `issue.permittedTransitions`; this module only
 * decides how to *label* one and whether it needs typed input first.
 */

/**
 * How a given (from -> to) transition is presented. The wording is workflow-specific:
 * the same target status reads differently depending on where it came from.
 */
export function getTransitionMeta(
  s: IssueStatusOrResolve,
  currentStatus: IssueStatus,
): { label: string; icon: LucideIcon } {
  if (s === 'UNDER_REVIEW' && currentStatus === 'NEW')
    return { label: 'Acknowledge (Under Review)', icon: Eye };
  if (s === 'UNDER_REVIEW' && currentStatus === 'CLOSED')
    return { label: 'Reopen (Under Review)', icon: RotateCcw };
  if (s === 'UNDER_REVIEW')
    return { label: 'Provide Clarification (Under Review)', icon: MessageCircleQuestion };
  if (s === 'IN_PROGRESS' && currentStatus === 'CLARIFICATION_REQUESTED')
    return { label: 'Provide Clarification (In Progress)', icon: MessageSquare };
  if (s === 'CLARIFICATION_REQUESTED' && currentStatus === 'UNDER_REVIEW')
    return { label: 'Clarification Needed', icon: MessageCircleQuestion };
  if (s === 'CLARIFICATION_REQUESTED')
    return { label: 'Request Clarification', icon: MessageCircleQuestion };
  if (s === 'ASSIGNED' && currentStatus === 'UNDER_REVIEW')
    return { label: 'Valid', icon: CheckCircle2 };
  if (s === 'ASSIGNED' && currentStatus === 'SI_APPROVAL')
    return { label: 'Validate Assignment', icon: CheckCircle2 };
  if (s === 'PENDING_CLIENT_APPROVAL' && currentStatus === 'SI_REVIEW')
    return { label: 'Approved', icon: ThumbsUp };
  if (s === 'ASSIGNED' && currentStatus === 'SI_REVIEW')
    return { label: 'Not Approved', icon: XCircle };
  if (s === 'CLOSED' && currentStatus === 'PENDING_CLIENT_APPROVAL')
    return { label: 'Approve', icon: ThumbsUp };
  if (s === 'ASSIGNED' && currentStatus === 'PENDING_CLIENT_APPROVAL')
    return { label: 'Not Approved', icon: XCircle };
  if (s === 'RESOLVED') return { label: 'Resolve', icon: CheckCircle2 };
  return { label: `Mark ${s.replace(/_/g, ' ')}`, icon: ArrowRight };
}

export type TransitionInput = 'none' | 'comment' | 'resolutionNote';

/**
 * What the backend requires in the request body before it will accept this transition.
 * Mirrors the validation in `IssuesService.updateStatus()`:
 *   - a comment when asking for clarification, and when answering a clarification request
 *   - a resolution note when resolving
 * Everything else is a bare status change, which is what makes one-click actions possible.
 */
export function getTransitionInput(
  target: IssueStatusOrResolve,
  from: IssueStatus,
): TransitionInput {
  if (target === 'RESOLVED') return 'resolutionNote';
  if (target === 'CLARIFICATION_REQUESTED' && from !== 'CLARIFICATION_REQUESTED') return 'comment';
  if (from === 'CLARIFICATION_REQUESTED' && (target === 'UNDER_REVIEW' || target === 'IN_PROGRESS'))
    return 'comment';
  return 'none';
}
