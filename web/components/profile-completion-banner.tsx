'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, X } from 'lucide-react';

const HIDDEN_PREFIXES = ['/willkommen', '/login', '/registrieren', '/auth'];
const DISMISS_KEY = 'profile-banner-dismissed-at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24; // 24h snooze

export default function ProfileCompletionBanner() {
  const pathname = usePathname();
  const [missing, setMissing] = useState<string[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
      setMissing(null);
      return;
    }

    try {
      const ts = localStorage.getItem(DISMISS_KEY);
      if (ts && Date.now() - parseInt(ts) < DISMISS_TTL_MS) {
        setDismissed(true);
        return;
      }
    } catch {}

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setMissing(null); return; }
      supabase
        .from('profiles')
        .select('username,display_name,home_club_id')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) { setMissing(null); return; }
          const m: string[] = [];
          if (!data.display_name) m.push('Name');
          // Username is deliberately absent: it is mandatory, and
          // <UsernameGate /> blocks the app until it is set, so a dismissable
          // banner would only ever be redundant with a modal already on screen.
          if (!data.home_club_id) m.push('Heimatclub');
          setMissing(m.length > 0 ? m : null);
        });
    });
  }, [pathname]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
    setDismissed(true);
  }

  if (dismissed || !missing || missing.length === 0) return null;

  return (
    <div className="bg-accent/10 border-b border-accent/20 dark:bg-[#1a3329] dark:border-[#2d4a3a]">
      <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <Sparkles size={16} className="text-accent shrink-0" />
        <div className="flex-1 text-sm text-gray-700 dark:text-[#e5e5e5]">
          <span className="font-medium">Profil unvollständig.</span>{' '}
          <span className="text-gray-500 dark:text-[#a0a0a0]">
            Fehlt: {missing.join(', ')}.
          </span>{' '}
          <Link href="/willkommen" className="text-accent font-medium hover:underline">
            Jetzt vervollständigen
          </Link>
        </div>
        <button
          onClick={dismiss}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors shrink-0"
          aria-label="Hinweis schließen"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
