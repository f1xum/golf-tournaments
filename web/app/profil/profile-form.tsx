'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, GolfClub } from '@/lib/types';

interface Props {
  profile: Profile | null;
  clubs: Pick<GolfClub, 'id' | 'name' | 'city'>[];
}

export default function ProfileForm({ profile, clubs }: Props) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [homeClubId, setHomeClubId] = useState(profile?.home_club_id ?? '');
  const [handicap, setHandicap] = useState(profile?.handicap?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates = {
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
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Heimatclub
          </label>
          <select
            value={homeClubId}
            onChange={(e) => setHomeClubId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="">Kein Heimatclub</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}{club.city ? ` (${club.city})` : ''}
              </option>
            ))}
          </select>
        </div>

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

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {saved && (
        <div className="text-sm text-accent bg-accent-light border border-accent/20 rounded-lg px-3 py-2">
          Profil gespeichert!
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
