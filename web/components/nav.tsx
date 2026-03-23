'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Building2, Map, LogIn, LogOut, UserCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const links = [
  { href: '/turniere', label: 'Turniere', icon: Calendar },
  { href: '/clubs', label: 'Clubs', icon: Building2 },
  { href: '/karte', label: 'Karte', icon: Map },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="font-bold text-lg text-accent hover:opacity-80">
          Golf Bayern
        </Link>

        <div className="flex gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
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
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/profil"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/profil'
                    ? 'bg-accent-light text-accent'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <UserCircle size={16} />
                <span className="hidden sm:inline">Profil</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Abmelden"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/login'
                  ? 'bg-accent-light text-accent'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Anmelden</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
