import { createClient } from '@/lib/supabase/server';
import { Tournament, GolfClub } from '@/lib/types';

function formatICSDate(dateStr: string): string {
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

function generateICS(t: Tournament, club: GolfClub | null): string {
  const start = formatICSDate(t.date_start);
  const end = t.date_end ? nextDay(t.date_end) : nextDay(t.date_start);

  const locationParts: string[] = [];
  if (club?.name) locationParts.push(club.name);
  if (club?.address) locationParts.push(club.address);
  if (club?.postal_code || club?.city) {
    locationParts.push([club.postal_code, club.city].filter(Boolean).join(' '));
  }
  const location = locationParts.join(', ');

  const descParts: string[] = [];
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
    'METHOD:PUBLISH',
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (!tournament) {
    return new Response('Not found', { status: 404 });
  }

  let club: GolfClub | null = null;
  if (tournament.club_id) {
    const { data } = await supabase
      .from('golf_clubs')
      .select('*')
      .eq('id', tournament.club_id)
      .single();
    club = data as GolfClub | null;
  }

  const ics = generateICS(tournament as Tournament, club);

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${tournament.name}.ics"`,
    },
  });
}
