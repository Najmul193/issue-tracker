import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchUnreadCount, fetchNotifications, markAsRead, markAllAsRead } from '../api/notifications';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => fetchNotifications(1, 10),
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

  // Close on click outside
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

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifData && notifData.data.length > 0 ? (
              notifData.data.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
                    !notif.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className={`text-gray-900 ${!notif.isRead ? 'font-medium' : ''}`}>
                    {notif.message}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(notif.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </button>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                No notifications
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}