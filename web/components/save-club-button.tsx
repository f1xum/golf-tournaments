'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useViewer, useSetClubSaved } from '@/lib/use-viewer';

interface Props {
  clubId: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SaveClubButton({ clubId, size = 'md' }: Props) {
  // One shared viewer query for the whole page — this used to be a `getUser()`
  // plus a `saved_clubs` lookup per button, which on /clubs meant hundreds of
  // requests from a single page load.
  const { userId, savedClubIds } = useViewer();
  const setClubSaved = useSetClubSaved();
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saved = savedClubIds.includes(clubId);

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId || loading) return;

    const supabase = createClient();
    setLoading(true);
    setClubSaved(clubId, !saved);

    if (saved) {
      const { error } = await supabase
        .from('saved_clubs')
        .delete()
        .eq('user_id', userId)
        .eq('club_id', clubId);
      if (error) setClubSaved(clubId, true);
      else setShowToast(false);
    } else {
      const { error } = await supabase
        .from('saved_clubs')
        .insert({ user_id: userId, club_id: clubId });
      if (error) {
        setClubSaved(clubId, false);
      } else {
        setShowToast(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setShowToast(false), 4000);
      }
    }
    setLoading(false);
  }

  // Nothing to toggle while the viewer is still loading, or when signed out.
  if (!userId) return null;

  const toast = showToast && (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[10001] animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3 whitespace-nowrap">
        <span>Club als Favorit gespeichert</span>
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

  if (size === 'lg') {
    return (
      <>
        <button
          onClick={toggle}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 font-medium rounded-lg transition-colors disabled:opacity-30 ${
            saved
              ? 'bg-accent text-white'
              : 'border border-accent text-accent hover:bg-accent-light'
          }`}
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Favorit gespeichert' : 'Als Favorit speichern'}
        </button>
        {toast}
      </>
    );
  }

  const iconSize = size === 'sm' ? 14 : 18;

  return (
    <>
      <button
        onClick={toggle}
        disabled={loading}
        className={`shrink-0 transition-colors disabled:opacity-30 ${
          saved
            ? 'text-red-500'
            : 'text-gray-300 hover:text-red-400'
        } ${size === 'sm' ? 'p-1' : 'p-1.5'}`}
        title={saved ? 'Favorit entfernen' : 'Als Favorit speichern'}
      >
        <Heart size={iconSize} fill={saved ? 'currentColor' : 'none'} />
      </button>
      {toast}
    </>
  );
}
