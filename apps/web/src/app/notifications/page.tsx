'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import MobileNav from '@/components/navigation/MobileNav';
import api from '@/lib/api';
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const iconMap: Record<string, React.ReactNode> = {
  like: <Heart className="w-4 h-4 text-red-500" />,
  comment: <MessageCircle className="w-4 h-4 text-brand-500" />,
  follow: <UserPlus className="w-4 h-4 text-green-500" />,
  mention: <AtSign className="w-4 h-4 text-purple-500" />,
  message: <MessageCircle className="w-4 h-4 text-brand-500" />,
};

interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/api/notifications')
      .then(({ data }) => setNotifications(data.data || []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    await api.patch('/api/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {notifications.some((n) => !n.isRead) && (
            <button onClick={markAllRead} className="text-sm text-brand-600 font-medium hover:underline">
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-4 rounded-2xl transition-colors ${
                  notif.isRead
                    ? 'bg-white dark:bg-gray-900'
                    : 'bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  {iconMap[notif.type] || <Bell className="w-4 h-4 text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notif.isRead && (
                  <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
