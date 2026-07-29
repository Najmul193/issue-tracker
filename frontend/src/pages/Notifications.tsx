import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, UserPlus, RefreshCw, Clock, AlertOctagon, Bell, BellOff } from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../api/notifications';
import type { NotificationItem } from '../api/notifications';
import { useProjectFilter } from '../context/ProjectFilterContext';
import { ApiError } from '../api/client';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { staggerContainer, staggerItem } from '../lib/motion';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const NOTIF_ICON: Record<string, typeof UserPlus> = {
  ASSIGNMENT: UserPlus,
  STATUS_CHANGE: RefreshCw,
  DEADLINE_WARNING: Clock,
  OVERDUE: AlertOctagon,
};

const NOTIF_TONE: Record<string, string> = {
  ASSIGNMENT: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  STATUS_CHANGE: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  DEADLINE_WARNING: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  OVERDUE: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
};

const LIMIT = 20;

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { projectIdsParam } = useProjectFilter();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, filter, projectIdsParam],
    queryFn: () => fetchNotifications(page, LIMIT, filter === 'unread', projectIdsParam ?? undefined),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count', projectIdsParam],
    queryFn: () => fetchUnreadCount(projectIdsParam ?? undefined),
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (err) => {
      console.error(err instanceof ApiError ? err.message : 'Failed to mark all as read');
    },
  });

  function handleNotifClick(notif: NotificationItem) {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    navigate(`/issues/${notif.issue.id}`);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const unreadCount = unreadData?.count ?? 0;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-48 rounded bg-neutral-200 dark:bg-slate-700" />
        <div className="h-10 w-full rounded bg-neutral-200 dark:bg-slate-700" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 w-full rounded bg-neutral-200 dark:bg-slate-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-neutral-900 dark:text-slate-100">
          Notifications
          {unreadCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">
              {unreadCount} unread
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <Button onClick={() => markAllMutation.mutate()} isLoading={markAllMutation.isPending}>
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {data && data.data.length > 0 ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
          {data.data.map((notif) => {
            const Icon = NOTIF_ICON[notif.type] ?? Bell;
            const tone = NOTIF_TONE[notif.type] ?? 'bg-neutral-100 text-neutral-500 dark:bg-slate-700 dark:text-slate-400';
            return (
              <motion.button
                key={notif.id}
                layout
                variants={staggerItem}
                onClick={() => handleNotifClick(notif)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-slate-700/40 ${
                  notif.isRead
                    ? 'border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800'
                    : 'border-l-4 border-l-brand-500 border-y-neutral-200 border-r-neutral-200 bg-brand-50/50 dark:border-y-slate-700/60 dark:border-r-slate-700/60 dark:bg-brand-500/5'
                }`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${notif.isRead ? 'text-neutral-700 dark:text-slate-300' : 'font-medium text-neutral-900 dark:text-slate-100'}`}>
                        {notif.message}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500 dark:text-slate-400">{notif.issue.title}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-neutral-400 dark:text-slate-500">{formatDateTime(notif.createdAt)}</span>
                      {!notif.isRead && (
                        <span
                          onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(notif.id); }}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          Mark read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-slate-700/60 dark:bg-slate-800">
          <EmptyState
            icon={<BellOff />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          />
        </div>
      )}

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm text-neutral-500 dark:text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
