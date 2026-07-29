import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, UserPlus, RefreshCw, Clock, AlertOctagon, BellOff } from 'lucide-react';
import { fetchUnreadCount, fetchNotifications, markAsRead, markAllAsRead } from '../api/notifications';
import { useProjectFilter } from '../context/ProjectFilterContext';
import { dropdownVariants, sheetPanel, modalOverlay } from '../lib/motion';

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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectIdsParam } = useProjectFilter();

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count', projectIdsParam],
    queryFn: () => fetchUnreadCount(projectIdsParam ?? undefined),
    refetchInterval: 15_000,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'recent', projectIdsParam],
    queryFn: () => fetchNotifications(1, 10, undefined, projectIdsParam ?? undefined),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const unreadCount = unreadData?.count ?? 0;

  function handleNotifClick(notif: { id: string; issue: { id: string } }) {
    markReadMutation.mutate(notif.id);
    setOpen(false);
    navigate(`/issues/${notif.issue.id}`);
  }

  const panel = (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-slate-700">
        <span className="text-sm font-semibold text-neutral-900 dark:text-slate-100">Notifications</span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Mark all as read
          </button>
        )}
      </div>
      <div className="scrollbar-thin max-h-96 overflow-y-auto sm:max-h-80">
        {notifData && notifData.data.length > 0 ? (
          notifData.data.map((notif) => {
            const Icon = NOTIF_ICON[notif.type] ?? Bell;
            const tone = NOTIF_TONE[notif.type] ?? 'bg-neutral-100 text-neutral-500 dark:bg-slate-700 dark:text-slate-400';
            return (
              <button
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-slate-700/50 ${
                  !notif.isRead ? 'bg-brand-50/60 dark:bg-brand-500/5' : ''
                }`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <p className={`text-neutral-900 dark:text-slate-100 ${!notif.isRead ? 'font-medium' : ''}`}>
                    {notif.message}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">
                    {new Date(notif.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </span>
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="h-6 w-6 text-neutral-300 dark:text-slate-600" />
            <p className="text-sm text-neutral-500 dark:text-slate-400">No notifications</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ opacity: 0, scale: 1.35 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Desktop dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute right-0 z-50 mt-2 hidden w-80 rounded-xl border border-neutral-200 bg-white shadow-popover dark:border-slate-700 dark:bg-slate-800 sm:block"
          >
            {panel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {open && (
          <div className="sm:hidden">
            <motion.div
              variants={modalOverlay}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm dark:bg-black/60"
              onClick={() => setOpen(false)}
            />
            <motion.div
              variants={sheetPanel}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-hidden rounded-t-2xl bg-white shadow-modal dark:bg-slate-800"
            >
              {panel}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
