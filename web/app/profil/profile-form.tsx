'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, GolfClub } from '@/lib/types';
import { Pencil, X, MapPin, Trophy, Search } from 'lucide-react';
import { USERNAME_MAX, normalizeUsername, usernameError } from '@/lib/username';

interface Props {
  profile: Profile | null;
  clubs: Pick<GolfClub, 'id' | 'name' | 'city'>[];
  email: string;
}

export default function ProfileForm({ profile, clubs, email }: Props) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [homeClubId, setHomeClubId] = useState(profile?.home_club_id ?? '');
  const [handicap, setHandicap] = useState(profile?.handicap?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const homeClub = clubs.find((c) => c.id === (editing ? homeClubId : profile?.home_club_id));
  const initials = (profile?.display_name || email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleCancel() {
    setUsername(profile?.username ?? '');
    setDisplayName(profile?.display_name ?? '');
    setHomeClubId(profile?.home_club_id ?? '');
    setHandicap(profile?.handicap?.toString() ?? '');
    setError(null);
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

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
      updated_at: new Date().toISOString(),
    };

    const { error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (err) {
      setError('Speichern fehlgeschlagen. Bitte versuche es erneut.');
    } else {
      setEditing(false);
      router.refresh();
    }
    setSaving(false);
  }

  // View mode
  if (!editing) {
    return (
      <div className="space-y-6">
        {/* Profile header */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-xl font-bold shrink-0">
                {initials}
              </div>
              <div>
                <div className="text-xl font-bold leading-tight">
                  {profile?.display_name || 'Kein Name'}
                </div>
                {profile?.username && (
                  <div className="text-sm text-gray-400 mt-0.5">@{profile.username}</div>
                )}
                <div className="text-sm text-gray-400 mt-0.5">{email}</div>
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent border border-accent/30 rounded-lg hover:bg-accent-light transition-colors"
            >
              <Pencil size={14} />
              Bearbeiten
            </button>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Trophy size={18} className="mx-auto text-gray-400 mb-1.5" />
              <div className="text-2xl font-bold text-gray-900">
                {profile?.handicap != null ? profile.handicap : '–'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Handicap</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <MapPin size={18} className="mx-auto text-gray-400 mb-1.5" />
              <div className="text-sm font-semibold text-gray-900 leading-tight">
                {homeClub ? homeClub.name.replace(/\s*(e\.V\.|GmbH|GmbH & Co\. KG)\s*/g, '').trim() : '–'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Heimatclub</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 text-center">
          Mitglied seit {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' }) : '–'}
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Profil bearbeiten
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X size={14} />
            Abbrechen
          </button>
        </div>

        <div className="space-y-4">
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
            <p className="text-xs text-gray-400 mt-1">Kleinbuchstaben, Zahlen, Punkte und Unterstriche</p>
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
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Wird gespeichert...' : 'Speichern'}
      </button>
    </form>
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

      {/* Selected display / trigger */}
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

      {/* Dropdown */}
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
