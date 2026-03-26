'use client';

import Link from 'next/link';
import { Profile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Bookmark,
  Heart,
  Bell,
  MapPin,
  Trophy,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  profile: Profile | null;
  email: string;
  homeClubName: string | null;
  savedCount: number;
  savedClubCount: number;
  unreadCount: number;
}

export default function UserHub({
  profile,
  email,
  homeClubName,
  savedCount,
  savedClubCount,
  unreadCount,
}: Props) {
  const initials = (profile?.display_name || email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const clubDisplay = homeClubName
    ? homeClubName.replace(/\s*(e\.V\.|GmbH|GmbH & Co\. KG)\s*/g, '').trim()
    : null;

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-white text-lg font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold leading-tight truncate">
              {profile?.display_name || 'Kein Name'}
            </div>
            {profile?.username && (
              <div className="text-sm text-gray-400 truncate">@{profile.username}</div>
            )}
          </div>
          <Link
            href="/profil/einstellungen"
            className="shrink-0 p-2 text-gray-400 hover:text-accent hover:bg-accent-light rounded-lg transition-colors"
            title="Einstellungen"
          >
            <Settings size={20} />
          </Link>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 mt-4">
          {profile?.handicap != null && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Trophy size={14} className="text-accent shrink-0" />
              <span className="font-semibold">{profile.handicap}</span>
              <span className="text-gray-400">HCP</span>
            </div>
          )}
          {clubDisplay && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 min-w-0">
              <MapPin size={14} className="text-accent shrink-0" />
              <span className="truncate">{clubDisplay}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
        <MenuLink
          href="#saved-clubs"
          icon={Heart}
          label="Favoriten-Clubs"
          badge={savedClubCount > 0 ? savedClubCount : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('saved-clubs')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MenuLink
          href="#saved"
          icon={Bookmark}
          label="Gespeicherte Turniere"
          badge={savedCount > 0 ? savedCount : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('saved-tournaments')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <MenuLink
          href="/benachrichtigungen"
          icon={Bell}
          label="Benachrichtigungen"
          badge={unreadCount > 0 ? unreadCount : undefined}
          badgeColor="red"
        />
        <LogoutButton />
      </div>
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  badge,
  badgeColor = 'accent',
  onClick,
}: {
  href: string;
  icon: typeof Bookmark;
  label: string;
  badge?: number;
  badgeColor?: 'accent' | 'red';
  onClick?: (e: React.MouseEvent) => void;
}) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer">
      <Icon size={18} className="text-gray-400 shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {badge != null && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            badgeColor === 'red'
              ? 'bg-red-100 text-red-600'
              : 'bg-accent-light text-accent'
          }`}
        >
          {badge}
        </span>
      )}
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </div>
  );

  if (onClick) {
    return (
      <a href={href} onClick={onClick}>
        {content}
      </a>
    );
  }

  return <Link href={href}>{content}</Link>;
}

function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer text-left"
    >
      <LogOut size={18} className="text-gray-400 shrink-0" />
      <span className="flex-1 text-sm font-medium text-gray-500">Abmelden</span>
    </button>
  );
}
