'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Calendar, Clock, MapPin, Target, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Notification, NotificationType, Tournament } from '@/lib/types';

const typeConfig: Record<NotificationType, { icon: typeof Bell; label: string }> = {
  tournament_reminder: { icon: Calendar, label: 'Erinnerung' },
  registration_closing: { icon: Clock, label: 'Meldeschluss' },
  new_tournament_nearby: { icon: MapPin, label: 'In der Nähe' },
  hcp_match: { icon: Target, label: 'HCP passend' },
};

interface Props {
  notifications: Notification[];
  tournaments: Record<string, Tournament>;
}

export default function NotificationList({ notifications: initial, tournaments }: Props) {
  const [notifications, setNotifications] = useState(initial);

  async function markAsRead(id: string) {
    const supabase = createClient();
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const supabase = createClient();
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (notifications.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Bell size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Keine Benachrichtigungen.</p>
      </div>
    );
  }

  return (
    <div>
      {unreadCount > 0 && (
        <button
          onClick={markAllAsRead}
          className="flex items-center gap-1.5 text-sm text-accent hover:underline mb-4 ml-auto"
        >
          <Check size={14} />
          Alle als gelesen markieren
        </button>
      )}

      <div className="space-y-2">
        {notifications.map((n) => {
          const config = typeConfig[n.type];
          const Icon = config.icon;
          const tournament = n.tournament_id ? tournaments[n.tournament_id] : null;

          const content = (
            <div
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                n.read
                  ? 'bg-white border-gray-200'
                  : 'bg-accent-light/50 border-accent/20 dark:bg-[#1a2b22] dark:border-[#2d4a3a]'
              }`}
            >
              <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                n.read ? 'bg-gray-100 text-gray-400' : 'bg-accent/10 text-accent'
              }`}>
                <Icon size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    n.read
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-accent-light text-accent'
                  }`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(n.created_at)}
                  </span>
                </div>
                <div className={`text-sm font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>
                  {n.title}
                </div>
                {n.body && (
                  <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                )}
              </div>

              {!n.read && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markAsRead(n.id);
                  }}
                  className="shrink-0 text-gray-400 hover:text-accent p-1"
                  title="Als gelesen markieren"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          );

          const href = tournament
            ? `/turniere/${tournament.id}`
            : n.type === 'new_tournament_nearby' || n.type === 'hcp_match'
            ? '/fuer-dich'
            : null;

          if (href) {
            return (
              <Link key={n.id} href={href} onClick={() => !n.read && markAsRead(n.id)}>
                {content}
              </Link>
            );
          }

          return <div key={n.id}>{content}</div>;
        })}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHrs < 24) return `vor ${diffHrs} Std.`;
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}
