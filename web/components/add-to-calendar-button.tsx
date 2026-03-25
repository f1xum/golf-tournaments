'use client';

import { CalendarPlus } from 'lucide-react';

interface Props {
  tournamentId: string;
  size?: 'sm' | 'lg';
}

export default function AddToCalendarButton({ tournamentId, size = 'lg' }: Props) {
  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Open the API route — serves .ics inline so the OS opens the calendar app
    window.location.href = `/api/calendar/${tournamentId}`;
  }

  if (size === 'lg') {
    return (
      <button
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 font-medium rounded-lg border-2 border-accent text-accent hover:bg-accent-light transition-colors"
      >
        <CalendarPlus size={18} />
        Zum Kalender hinzufügen
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className="shrink-0 p-1 text-gray-300 hover:text-accent transition-colors"
      title="Zum Kalender hinzufügen"
    >
      <CalendarPlus size={14} />
    </button>
  );
}
