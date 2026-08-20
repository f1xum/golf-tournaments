'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AtSign, Loader2 } from 'lucide-react';
import {
  USERNAME_MAX,
  isValidUsername,
  normalizeUsername,
  usernameError,
} from '@/lib/username';

// Auth screens have no signed-in user to gate, and /willkommen already asks
// for a username as step 1 — blocking it would put a modal on top of the very
// form that satisfies the requirement.
const EXEMPT_PREFIXES = ['/login', '/registrieren', '/auth', '/willkommen'];

/**
 * Blocks the app for signed-in users who have no username.
 *
 * Usernames became mandatory after these accounts were created, so onboarding
 * alone cannot cover them: existing users never saw the step, and Google
 * sign-ups could leave /willkommen at any point. This is deliberately not
 * dismissable — no close button, no backdrop click, no Escape — because the
 * whole point is that the account cannot stay in the un-named state.
 */
export default function UsernameGate() {
  const pathname = usePathname();
  const router = useRouter();

  const [needed, setNeeded] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    // Exempt routes are handled at render time rather than by clearing state
    // here, so navigating onto one does not trigger an extra render pass.
    if (exempt) return;

    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setNeeded(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled) setNeeded(!data?.username);
    })();

    return () => { cancelled = true; };
  }, [pathname, exempt]);

  // Lock background scrolling while the gate is up, so the page behind cannot
  // be interacted with by scrolling past the overlay on mobile.
  useEffect(() => {
    if (!needed || exempt) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [needed, exempt]);

  const submit = useCallback(async () => {
    const username = value.trim();
    const formatError = usernameError(username);
    if (formatError) {
      setError(formatError);
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError('Deine Sitzung ist abgelaufen. Bitte melde dich neu an.');
      return;
    }

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle();
    if (taken) {
      setSaving(false);
      setError('Dieser Benutzername ist bereits vergeben.');
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    setSaving(false);
    if (updateError) {
      // The unique index is the real authority — a racing signup can take the
      // name between the check above and this write.
      setError(
        updateError.code === '23505'
          ? 'Dieser Benutzername ist bereits vergeben.'
          : 'Speichern fehlgeschlagen. Bitte versuche es erneut.',
      );
      return;
    }

    setNeeded(false);
    router.refresh();
  }, [value, router]);

  if (!needed || exempt) return null;

  const ready = isValidUsername(value.trim()) && !saving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      // Swallow Escape so the browser cannot close this like a normal dialog.
      onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#2a2a2a] p-6 shadow-xl">
        <div className="w-12 h-12 bg-accent/10 dark:bg-[#1a3329] rounded-xl flex items-center justify-center mb-4">
          <AtSign size={22} className="text-accent" />
        </div>

        <h2 id="username-gate-title" className="text-xl font-bold mb-1.5">
          Wähle deinen Benutzernamen
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#a0a0a0] mb-5">
          Jedes Konto bei The Pin braucht einen eindeutigen Benutzernamen. Wähle
          jetzt einen, um fortzufahren.
        </p>

        <div className="flex items-center mb-2">
          <span className="px-3 py-3 bg-gray-50 dark:bg-[#1f1f1f] border border-r-0 border-gray-200 dark:border-[#2a2a2a] rounded-l-xl text-sm text-gray-400">
            @
          </span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(normalizeUsername(e.target.value)); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && ready) submit(); }}
            maxLength={USERNAME_MAX}
            autoComplete="username"
            placeholder="benutzername"
            className="flex-1 min-w-0 px-4 py-3 border border-gray-200 dark:border-[#2a2a2a] dark:bg-[#1f1f1f] rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        {error ? (
          <p className="text-xs text-red-600 mb-4">{error}</p>
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            Kleinbuchstaben, Zahlen, Punkte und Unterstriche. Mind. 3 Zeichen.
          </p>
        )}

        <button
          onClick={submit}
          disabled={!ready}
          className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Wird gespeichert...' : 'Benutzernamen sichern'}
        </button>
      </div>
    </div>
  );
}
