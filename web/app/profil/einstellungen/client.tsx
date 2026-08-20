'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, GolfClub } from '@/lib/types';
import { ArrowLeft, Search, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { USERNAME_MAX, normalizeUsername, usernameError } from '@/lib/username';

interface Props {
  profile: Profile | null;
  clubs: Pick<GolfClub, 'id' | 'name' | 'city'>[];
  email: string;
}

export default function SettingsClient({ profile, clubs, email }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [homeClubId, setHomeClubId] = useState(profile?.home_club_id ?? '');
  const [handicap, setHandicap] = useState(profile?.handicap?.toString() ?? '');

  // Notification preferences
  const [notifyReminder, setNotifyReminder] = useState(profile?.notify_tournament_reminder ?? true);
  const [notifyClosing, setNotifyClosing] = useState(profile?.notify_registration_closing ?? true);
  const [notifyNearby, setNotifyNearby] = useState(profile?.notify_new_nearby ?? true);
  const [notifyHcp, setNotifyHcp] = useState(profile?.notify_hcp_match ?? true);
  const [reminderDays, setReminderDays] = useState(profile?.reminder_days_before?.toString() ?? '3');

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Load theme from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (stored) setTheme(stored);
  }, []);

  function applyTheme(newTheme: 'light' | 'dark' | 'system') {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    const isDark = newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Usernames are mandatory, so this form can change one but never clear it.
    const trimmedUsername = username.trim();
    const usernameProblem = usernameError(trimmedUsername);
    if (usernameProblem) {
      setError(usernameProblem);
      setSaving(false);
      return;
    }

    if (trimmedUsername !== profile?.username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (existing) {
        setError('Dieser Benutzername ist bereits vergeben.');
        setSaving(false);
        return;
      }
    }

    const updates = {
      username: trimmedUsername,
      display_name: displayName || null,
      home_club_id: homeClubId || null,
      handicap: handicap ? parseFloat(handicap) : null,
      notify_tournament_reminder: notifyReminder,
      notify_registration_closing: notifyClosing,
      notify_new_nearby: notifyNearby,
      notify_hcp_match: notifyHcp,
      reminder_days_before: parseInt(reminderDays) || 3,
      updated_at: new Date().toISOString(),
    };

    const { error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (err) {
      setError('Speichern fehlgeschlagen. Bitte versuche es erneut.');
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <>
      {/* Back link */}
      <Link
        href="/profil"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent mb-5"
      >
        <ArrowLeft size={16} />
        Zurück
      </Link>

      <h1 className="text-2xl font-bold mb-6">Einstellungen</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile section */}
        <Section title="Profil">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-Mail
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                {email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Benutzername <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-400">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder="benutzername"
                  maxLength={USERNAME_MAX}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anzeigename
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="Dein Name"
              />
            </div>

            <ClubSearch
              clubs={clubs}
              value={homeClubId}
              onChange={setHomeClubId}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Handicap
              </label>
              <input
                type="number"
                step="0.1"
                min="-10"
                max="54"
                value={handicap}
                onChange={(e) => setHandicap(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="z.B. 18.4"
              />
            </div>
          </div>
        </Section>

        {/* Notifications section */}
        <Section title="Benachrichtigungen">
          <div className="space-y-3">
            <Toggle
              label="Turnier-Erinnerungen"
              description="Erinnerung vor gespeicherten Turnieren"
              checked={notifyReminder}
              onChange={setNotifyReminder}
            />
            {notifyReminder && (
              <div className="ml-11">
                <select
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="1">1 Tag vorher</option>
                  <option value="2">2 Tage vorher</option>
                  <option value="3">3 Tage vorher</option>
                  <option value="5">5 Tage vorher</option>
                  <option value="7">1 Woche vorher</option>
                </select>
              </div>
            )}
            <Toggle
              label="Meldeschluss"
              description="Warnung wenn Anmeldung bald endet"
              checked={notifyClosing}
              onChange={setNotifyClosing}
            />
            <Toggle
              label="Neue Turniere in der Nähe"
              description="Neue Turniere bei deinem Heimatclub"
              checked={notifyNearby}
              onChange={setNotifyNearby}
            />
            <Toggle
              label="HCP-passende Turniere"
              description="Turniere die zu deinem Handicap passen"
              checked={notifyHcp}
              onChange={setNotifyHcp}
            />
          </div>
        </Section>

        {/* Appearance */}
        <Section title="Erscheinungsbild">
          <div className="flex gap-2">
            {([
              { value: 'light' as const, label: 'Hell', icon: Sun },
              { value: 'dark' as const, label: 'Dunkel', icon: Moon },
              { value: 'system' as const, label: 'System', icon: Monitor },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => applyTheme(value)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  theme === value
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </Section>

        {/* Save */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className={`w-full py-2.5 font-medium rounded-lg transition-colors disabled:opacity-50 ${
            success
              ? 'bg-green-500 text-white'
              : 'bg-accent text-white hover:bg-accent/90'
          }`}
        >
          {saving ? 'Wird gespeichert...' : success ? 'Gespeichert!' : 'Speichern'}
        </button>
      </form>

      {/* Logout */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          Abmelden
        </button>
      </div>

      <div className="text-xs text-gray-400 text-center mt-6">
        Mitglied seit {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' }) : '–'}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            checked ? 'bg-accent' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              checked ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-400">{description}</div>
      </div>
    </label>
  );
}

function ClubSearch({
  clubs,
  value,
  onChange,
}: {
  clubs: Pick<GolfClub, 'id' | 'name' | 'city'>[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = clubs.find((c) => c.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
  const q = normalize(query);

  const filtered = q
    ? clubs.filter((c) => {
        const haystack = normalize(c.name + ' ' + (c.city ?? ''));
        return haystack.includes(q);
      }).slice(0, 8)
    : clubs.slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Heimatclub
      </label>

      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(''); }}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        >
          <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
            {selected ? `${selected.name}${selected.city ? ` (${selected.city})` : ''}` : 'Club suchen...'}
          </span>
          <Search size={14} className="text-gray-400 shrink-0" />
        </button>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Club suchen..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
          >
            Kein Heimatclub
          </button>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent-light transition-colors ${
                c.id === value ? 'bg-accent-light text-accent font-medium' : 'text-gray-900'
              }`}
            >
              {c.name}
              {c.city && <span className="text-gray-400 ml-1">({c.city})</span>}
            </button>
          ))}
          {q && filtered.length === 0 && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">
              Kein Club gefunden
            </div>
          )}
        </div>
      )}
    </div>
  );
}
