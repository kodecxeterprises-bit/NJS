import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';

interface NotificationsPageProps {
  onNavigate: (path: string) => void;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const mapNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  link: row.link || undefined,
  isRead: row.is_read,
  createdAt: row.created_at,
});

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');

  const fetchNotifications = useCallback(async (showLoader = false) => {
    if (!user?.id) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    if (showLoader) setIsLoading(true);
    setLoadError('');

    const { data, error } = await supabase
      .from('notifications')
      .select('id,user_id,type,title,message,link,is_read,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Unable to load notifications:', error);
      setLoadError('Notifications could not be loaded. Please try again.');
    } else {
      setNotifications((data || []).map((row) =>
        mapNotification(row as NotificationRow)
      ));
    }

    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchNotifications(true);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  const markAsRead = async (notification: Notification) => {
    if (
      notification.isRead ||
      updatingIds.includes(notification.id) ||
      !user?.id
    ) return;

    setUpdatingIds((current) => [...current, notification.id]);

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Unable to mark notification as read:', error);
    } else {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true }
            : item
        )
      );
    }

    setUpdatingIds((current) =>
      current.filter((id) => id !== notification.id)
    );
  };

  const handleMarkAllRead = async () => {
    if (!user?.id || isMarkingAll) return;

    setIsMarkingAll(true);

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Unable to mark all notifications as read:', error);
    } else {
      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true }))
      );
    }

    setIsMarkingAll(false);
  };

  const handleOpenNotification = async (notification: Notification) => {
    await markAsRead(notification);

    if (notification.link) {
      onNavigate(notification.link.replace(/^\//, ''));
    }
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            System Activity
          </span>
          <h1 className="text-3xl font-bold text-on-surface">
            Notifications
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Updates about your connections and conversations.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
          >
            {isMarkingAll ? 'Updating…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-error/30 bg-error-container/30 p-4 text-sm text-on-surface">
          <p>{loadError}</p>
          <button
            onClick={() => void fetchNotifications(true)}
            className="mt-2 font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-12 text-center text-sm text-on-surface-variant">
          Loading your notifications…
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center my-8">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">
              notifications_none
            </span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">
            You're all caught up.
          </h3>
          <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
            New connection requests and messages will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden divide-y divide-outline-variant/20 shadow-xs">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void handleOpenNotification(notification)}
              className={`w-full text-left p-5 transition-colors flex items-start gap-4 ${
                !notification.isRead
                  ? 'bg-surface-container-low/40 hover:bg-surface-container-low/70'
                  : 'hover:bg-surface-container-low/20'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">
                  {notification.type === 'connection_request' ||
                  notification.type === 'connection_accepted'
                    ? 'handshake'
                    : notification.type === 'new_message'
                    ? 'chat'
                    : 'auto_awesome'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-3">
                  <h4 className="font-bold text-sm text-on-surface">
                    {notification.title}
                  </h4>
                  <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                    {new Date(notification.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {notification.message}
                </p>
              </div>

              {!notification.isRead && (
                <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
              )}

              {updatingIds.includes(notification.id) && (
                <span className="text-[10px] text-on-surface-variant">
                  Saving…
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};