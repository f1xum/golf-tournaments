'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Building2, Map } from 'lucide-react';

const links = [
  { href: '/turniere', label: 'Turniere', icon: Calendar },
  { href: '/clubs', label: 'Clubs', icon: Building2 },
  { href: '/karte', label: 'Karte', icon: Map },
];

export default function Nav() {
  const pathname = usePathname();

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
      </div>
    </nav>
  );
}
