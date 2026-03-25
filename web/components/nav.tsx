'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Building2, Map, LogIn, UserCircle, Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const links = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/turniere', label: 'Turniere', icon: Calendar },
  { href: '/clubs', label: 'Clubs', icon: Building2 },
  { href: '/karte', label: 'Karte', icon: Map },
];

export default function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false)
          .then(({ count }) => setUnreadCount(count ?? 0));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80">
          <Image src="/logo.png" alt="The Pin" width={28} height={28} className="rounded" />
          <span className="font-bold text-lg text-accent">The Pin</span>
        </Link>

        <div className="hidden sm:flex gap-1">
          {links.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-light text-accent'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/benachrichtigungen"
                className={`relative flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/benachrichtigungen'
                    ? 'bg-accent-light text-accent'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Benachrichtigungen"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/profil"
                className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/profil')
                    ? 'bg-accent-light text-accent'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <UserCircle size={16} />
                <span>Profil</span>
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/login'
                  ? 'bg-accent-light text-accent'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <LogIn size={16} />
              <span>Anmelden</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
