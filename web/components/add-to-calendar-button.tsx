'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  tournamentId: string;
  size?: 'sm' | 'lg';
}

export default function AddToCalendarButton({ tournamentId, size = 'lg' }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      setShowToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 4000);
      return;
    }

    window.location.href = `/api/calendar/${tournamentId}`;
  }

  const toast = showToast && (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[10001] animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3 whitespace-nowrap">
        <span>Melde dich an, um Turniere zu speichern</span>
        <Link
          href="/login"
          className="text-accent-light font-medium hover:underline"
          onClick={() => setShowToast(false)}
        >
          Anmelden →
        </Link>
      </div>
    </div>
  );

  if (size === 'lg') {
    return (
      <>
        <button
          onClick={handleAdd}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 font-medium rounded-lg border-2 border-accent text-accent hover:bg-accent-light transition-colors"
        >
          <CalendarPlus size={18} />
          Zum Kalender hinzufügen
        </button>
        {toast}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleAdd}
        className="shrink-0 p-1 text-gray-300 hover:text-accent transition-colors"
        title="Zum Kalender hinzufügen"
      >
        <CalendarPlus size={14} />
      </button>
      {toast}
    </>
  );
}
