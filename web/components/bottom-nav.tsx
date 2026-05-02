'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Building2, Map, UserCircle, Sparkles, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const tabs = [
  { href: '/', label: 'Home', icon: Home, exact: true, requiresAuth: false },
  { href: '/fuer-dich', label: 'Für dich', icon: Sparkles, requiresAuth: true },
  { href: '/turniere', label: 'Turniere', icon: Calendar, requiresAuth: false },
  { href: '/clubs', label: 'Clubs', icon: Building2, requiresAuth: false },
  { href: '/karte', label: 'Karte', icon: Map, requiresAuth: false },
  { href: '/profil', label: 'Profil', icon: UserCircle, requiresAuth: false },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-200 sm:hidden">
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, icon: Icon, exact, requiresAuth }) => {
          const active = exact
            ? pathname === href
            : pathname.startsWith(href);
          const locked = requiresAuth && !user;
          const linkHref = locked ? `/login?next=${encodeURIComponent(href)}` : href;

          return (
            <Link
              key={href}
              href={linkHref}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
            >
              <span
                className={`absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-200 ${
                  active ? 'w-8 bg-accent' : 'w-0 bg-transparent'
                }`}
              />
              <span className="relative inline-flex">
                <Icon
                  size={22}
                  className={`transition-colors duration-200 ${
                    active ? 'text-accent' : locked ? 'text-gray-300' : 'text-gray-400'
                  }`}
                />
                {locked && (
                  <Lock
                    size={11}
                    className="absolute -bottom-0.5 -right-1 text-gray-400 bg-white rounded-full p-[1px]"
                  />
                )}
              </span>
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  active ? 'text-accent' : locked ? 'text-gray-300' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
