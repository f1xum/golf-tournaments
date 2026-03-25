'use client';

import { CalendarPlus } from 'lucide-react';
import { Tournament, GolfClub } from '@/lib/types';

interface Props {
  tournament: Tournament;
  club?: GolfClub | null;
  size?: 'sm' | 'lg';
}

function formatICSDate(dateStr: string): string {
  // Convert YYYY-MM-DD to YYYYMMDD (all-day event)
  return dateStr.replace(/-/g, '');
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function generateICS(t: Tournament, club?: GolfClub | null): string {
  const start = formatICSDate(t.date_start);
  const end = t.date_end ? nextDay(t.date_end) : nextDay(t.date_start);

  const locationParts = [];
  if (club?.name) locationParts.push(club.name);
  if (club?.address) locationParts.push(club.address);
  if (club?.postal_code || club?.city) {
    locationParts.push([club.postal_code, club.city].filter(Boolean).join(' '));
  }
  const location = locationParts.join(', ');

  const descParts = [];
  if (t.format) descParts.push(`Format: ${t.format}`);
  if (t.entry_fee != null) descParts.push(`Nenngeld: ${t.entry_fee} €`);
  if (t.max_handicap != null) descParts.push(`Max HCP: ${t.max_handicap}`);
  if (club?.name) descParts.push(`Club: ${club.name}`);
  if (t.source_url) descParts.push(`Details: ${t.source_url}`);
  const description = descParts.join('\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Pin//Golf Tournaments//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeICS(t.name)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    description ? `DESCRIPTION:${description}` : '',
    `UID:${t.id}@thepin.app`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export default function AddToCalendarButton({ tournament, club, size = 'lg' }: Props) {
  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const ics = generateICS(tournament, club);

    // Use data URI — on iOS/Android this opens the calendar app directly
    const uri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    window.open(uri, '_blank');
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
