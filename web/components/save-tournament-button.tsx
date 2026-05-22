'use client';

import { useState, useEffect, useRef } from 'react';
import { Bookmark } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Props {
  tournamentId: string;
  userId: string | null;
  initialSaved: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function SaveTournamentButton({ tournamentId, userId, initialSaved, size = 'md' }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

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
      setShowToast(false);
    } else {
      await supabase
        .from('saved_tournaments')
        .insert({ user_id: userId, tournament_id: tournamentId });
      setSaved(true);
      setShowToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 4000);
    }
    setLoading(false);
  }

  // Don't show button if not logged in
  if (!userId) return null;

  const toast = showToast && (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[10001] animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3 whitespace-nowrap">
        <span>Turnier gespeichert</span>
        <Link
          href="/profil"
          className="text-accent-light font-medium hover:underline"
          onClick={() => setShowToast(false)}
        >
          Zum Profil →
        </Link>
      </div>
    </div>
  );

  // Large variant — full-width CTA button
  if (size === 'lg') {
    return (
      <>
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
        {toast}
      </>
    );
  }

  // Small / medium icon-only variants
  const iconSize = size === 'sm' ? 14 : 18;

  return (
    <>
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
      {toast}
    </>
  );
}
