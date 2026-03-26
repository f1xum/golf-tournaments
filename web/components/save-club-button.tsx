'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Props {
  clubId: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SaveClubButton({ clubId, size = 'md' }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      supabase
        .from('saved_clubs')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('club_id', clubId)
        .maybeSingle()
        .then(({ data }) => {
          setSaved(!!data);
          setLoading(false);
        });
    });
  }, [clubId]);

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
      const { error } = await supabase
        .from('saved_clubs')
        .delete()
        .eq('user_id', userId)
        .eq('club_id', clubId);
      if (!error) {
        setSaved(false);
        setShowToast(false);
      }
    } else {
      const { error } = await supabase
        .from('saved_clubs')
        .insert({ user_id: userId, club_id: clubId });
      if (!error) {
        setSaved(true);
        setShowToast(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setShowToast(false), 4000);
      }
    }
    setLoading(false);
  }

  if (!userId && !loading) return null;

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
