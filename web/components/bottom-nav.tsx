'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Building2, Map, UserCircle } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/turniere', label: 'Turniere', icon: Calendar },
  { href: '/clubs', label: 'Clubs', icon: Building2 },
  { href: '/karte', label: 'Karte', icon: Map },
  { href: '/profil', label: 'Profil', icon: UserCircle },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-200 sm:hidden">
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
            >
              {/* Active indicator bar */}
              <span
                className={`absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-200 ${
                  active ? 'w-8 bg-accent' : 'w-0 bg-transparent'
                }`}
              />
              <Icon
                size={22}
                className={`transition-colors duration-200 ${
                  active ? 'text-accent' : 'text-gray-400'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  active ? 'text-accent' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Safe area for iPhones with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
