'use client';

import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  tournamentId: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SaveTournamentButton({ tournamentId, size = 'md' }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      supabase
        .from('saved_tournaments')
        .select('tournament_id')
        .eq('user_id', user.id)
        .eq('tournament_id', tournamentId)
        .maybeSingle()
        .then(({ data }) => {
          setSaved(!!data);
          setLoading(false);
        });
    });
  }, [tournamentId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId || loading) return;

    const supabase = createClient();
    setLoading(true);

    if (saved) {
      await supabase
        .from('saved_tournaments')
        .delete()
        .eq('user_id', userId)
        .eq('tournament_id', tournamentId);
      setSaved(false);
    } else {
      await supabase
        .from('saved_tournaments')
        .insert({ user_id: userId, tournament_id: tournamentId });
      setSaved(true);
    }
    setLoading(false);
  }

  // Don't show button if not logged in
  if (!userId && !loading) return null;

  // Large variant — full-width CTA button
  if (size === 'lg') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 font-medium rounded-lg transition-colors disabled:opacity-30 ${
          saved
            ? 'bg-accent text-white'
            : 'bg-accent text-white hover:bg-accent/90'
        }`}
      >
        <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'Turnier gespeichert' : 'Turnier speichern'}
      </button>
    );
  }

  // Small / medium icon-only variants
  const iconSize = size === 'sm' ? 14 : 18;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`shrink-0 transition-colors disabled:opacity-30 ${
        saved
          ? 'text-accent'
          : 'text-gray-300 hover:text-accent'
      } ${size === 'sm' ? 'p-1' : 'p-1.5'}`}
      title={saved ? 'Gespeichert' : 'Speichern'}
    >
      <Bookmark size={iconSize} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
