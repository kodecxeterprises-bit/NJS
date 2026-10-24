import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Notification } from '../types';

interface NotificationsPageProps {
  onNavigate: (path: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { apiFetch } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifs = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/notifications');
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/mark-read', { method: 'POST' });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-1 block">
            System Activity
          </span>
          <h1 className="text-3xl font-bold text-on-surface">Notifications</h1>
        </div>

        {notifications.some(n => !n.isRead) && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center border border-outline-variant/30 flex flex-col items-center justify-center my-8">
          <div className="w-16 h-16 rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">notifications_none</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">No notifications yet.</h3>
          <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
            Real alerts regarding connection requests, partnership inquiries, and active bids will appear here as they occur.
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden divide-y divide-outline-variant/20 shadow-xs">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.link) onNavigate(n.link.replace('/', ''));
              }}
              className={`p-5 transition-colors cursor-pointer flex items-start gap-4 ${
                !n.isRead ? 'bg-surface-container-low/40' : 'hover:bg-surface-container-low/20'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">
                  {n.type === 'connection_request' || n.type === 'connection_accepted'
                    ? 'handshake'
                    : n.type === 'new_message'
                    ? 'chat'
                    : 'auto_awesome'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-sm text-on-surface">{n.title}</h4>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {n.message}
                </p>
              </div>
              {!n.isRead && (
                <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
