'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Calendar, Clock, Users, Euro, Trophy, MapPin, ExternalLink,
  Flag, Globe, Phone, Mail, ChevronRight, CircleAlert,
} from 'lucide-react';
import { Tournament, GolfClub } from '@/lib/types';
import { formatDateFull, formatToLabel } from '@/lib/utils';
import { extractHoles, formatMeldeschluss } from '@/lib/tournament-utils';
import SaveTournamentButton from '@/components/save-tournament-button';
import AddToCalendarButton from '@/components/add-to-calendar-button';

const ClubMapMini = dynamic(() => import('@/components/club-map-mini'), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
      Karte wird geladen...
    </div>
  ),
});

interface Props {
  tournament: Tournament;
  club: GolfClub | null;
  isLoggedIn: boolean;
}

export default function TurnierDetailClient({ tournament: t, club, isLoggedIn }: Props) {
  const raw = t.raw_data || {};
  const formatLabel = formatToLabel(t.format);
  const [showLoginToast, setShowLoginToast] = useState(false);
  const loginToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (loginToastTimer.current) clearTimeout(loginToastTimer.current); };
  }, []);
  const holes = extractHoles(t.raw_data, t.description);
  const meldeschluss = formatMeldeschluss(t.raw_data);

  const dateStr = formatDateFull(t.date_start);
  const endStr =
    t.date_end && t.date_end !== t.date_start
      ? ` – ${formatDateFull(t.date_end)}`
      : '';

  const isPast = new Date(t.date_start + 'T00:00:00') < new Date(new Date().toDateString());

  const freeSlots = raw.free_slots;
  const maxParticipants = raw.max_participants;
  const slotsLow = typeof freeSlots === 'number' && freeSlots > 0 && freeSlots <= 10;

  const sourceLabel =
    t.source === 'club_website' ? 'PC CADDIE' :
    t.source === 'bgv' ? 'BGV' :
    t.source === 'dgv' ? 'DGV' : 'Quelle';

  // Registration URL: prefer explicit, fallback to source_url for club_website source
  const registrationUrl = t.registration_url || (t.source === 'club_website' ? t.source_url : null);

  return (
    <>
      {/* Back link */}
      <Link
        href="/turniere"
        className="inline-flex items-center text-sm text-gray-500 hover:text-accent mb-4"
      >
        ← Zurück zur Übersicht
      </Link>

      {/* Hero header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{t.name}</h1>
          <SaveTournamentButton tournamentId={t.id} size="md" />
        </div>

        {/* Club name link */}
        {club && (
          <Link
            href={`/clubs/${club.id}`}
            className="text-sm text-gray-500 hover:text-accent transition-colors mt-1 inline-flex items-center gap-1"
          >
            {club.logo_url ? (
              <img src={club.logo_url} alt="" className="w-4 h-4 rounded object-contain" />
            ) : (
              <Flag size={12} className="text-gray-400" />
            )}
            {club.name}{club.city ? ` · ${club.city}` : ''}
          </Link>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
            <Calendar size={14} />
            {dateStr}{endStr}
          </span>
          {formatLabel && (
            <span className="text-xs px-2 py-0.5 bg-accent-light text-accent rounded-full font-medium">
              {formatLabel}
            </span>
          )}
          {holes && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
              {holes} Löcher
            </span>
          )}
          {raw.hcp_relevant && (
            <span className="text-xs px-2 py-0.5 bg-accent-light text-accent rounded-full font-medium">
              HCP-relevant
            </span>
          )}
          {raw.guests_allowed && (
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
              Gäste willkommen
            </span>
          )}
          {isPast && (
            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full font-medium">
              Beendet
            </span>
          )}
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {t.entry_fee != null && (
          <QuickStat icon={<Euro size={16} />} label="Nenngeld" value={`${t.entry_fee} €`} />
        )}
        {maxParticipants && (
          <QuickStat
            icon={<Users size={16} />}
            label="Plätze"
            value={
              freeSlots !== null && freeSlots !== undefined
                ? `${freeSlots} / ${maxParticipants} frei`
                : `${maxParticipants}`
            }
            highlight={slotsLow}
          />
        )}
        {meldeschluss && (
          <QuickStat icon={<Clock size={16} />} label="Meldeschluss" value={meldeschluss} />
        )}
        {(t.max_handicap != null || t.min_handicap != null) && (
          <QuickStat
            icon={<span className="text-xs font-bold">HCP</span>}
            label="Handicap"
            value={
              t.min_handicap != null && t.max_handicap != null
                ? `${t.min_handicap} bis ${t.max_handicap}`
                : t.max_handicap != null
                ? `bis ${t.max_handicap}`
                : `ab ${t.min_handicap}`
            }
          />
        )}
      </div>

      {/* Slots warning */}
      {slotsLow && !isPast && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-[#2a2410] border border-amber-200 dark:border-[#5a4a18] rounded-lg mb-6 text-sm">
          <CircleAlert size={16} className="text-amber-500 shrink-0" />
          <span className="font-medium text-amber-700 dark:text-[#e8c84a]">
            Nur noch {freeSlots} {freeSlots === 1 ? 'Platz' : 'Plätze'} frei!
          </span>
        </div>
      )}

      {/* CTA buttons — visible to all, toast for non-logged-in */}
      {!isPast && (
        <div className="flex gap-3 mb-6">
          {registrationUrl && (
            isLoggedIn ? (
              <a
                href={registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                <ExternalLink size={16} />
                Jetzt anmelden
              </a>
            ) : (
              <button
                onClick={() => {
                  setShowLoginToast(true);
                  if (loginToastTimer.current) clearTimeout(loginToastTimer.current);
                  loginToastTimer.current = setTimeout(() => setShowLoginToast(false), 4000);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                <ExternalLink size={16} />
                Jetzt anmelden
              </button>
            )
          )}
          <div className={registrationUrl ? 'flex-1' : 'w-full'}>
            <AddToCalendarButton tournamentId={t.id} size="lg" />
          </div>
        </div>
      )}

      {/* Login toast */}
      {showLoginToast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[10001] animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3 whitespace-nowrap">
            <span>Melde dich an, um dich für Turniere anzumelden</span>
            <Link
              href="/login"
              className="text-accent-light font-medium hover:underline"
              onClick={() => setShowLoginToast(false)}
            >
              Anmelden →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Tournament details (2/3 width) */}
        <div className="md:col-span-2 space-y-6">
          {/* Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Turnierdetails
            </h2>
            <dl className="space-y-3 text-sm">
              {raw.spielform && (
                <DetailRow label="Spielform" value={String(raw.spielform)} />
              )}
              {raw.turnierart && (
                <DetailRow label="Turnierart" value={String(raw.turnierart)} />
              )}
              {t.rounds && t.rounds > 1 && <DetailRow label="Runden" value={`${t.rounds}`} />}
              {holes && <DetailRow label="Löcher" value={`${holes}`} />}
              {raw.hcp_relevant !== undefined && (
                <DetailRow label="HCP-relevant" value={raw.hcp_relevant ? 'Ja' : 'Nein'} />
              )}
              {t.gender && <DetailRow label="Geschlecht" value={t.gender} />}
              {t.age_class && <DetailRow label="Altersklasse" value={t.age_class} />}
              {raw.guests_allowed !== undefined && (
                <DetailRow
                  label="Gäste"
                  value={
                    raw.guests_allowed
                      ? raw.guest_fee ? `Willkommen (zzgl. ${raw.guest_fee} €)` : 'Willkommen'
                      : 'Nur Mitglieder'
                  }
                />
              )}
              {raw.nenngeld_raw && (
                <DetailRow label="Nenngeld (Details)" value={String(raw.nenngeld_raw)} />
              )}
            </dl>
          </div>

          {/* Prizes */}
          {raw.prizes && Array.isArray(raw.prizes) && raw.prizes.length > 0 && (
            <div className="bg-prize-bg dark:bg-[#2a2410] border border-prize-border dark:border-[#5a4a18] rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-prize-text dark:text-[#e8c84a]" />
                <h2 className="text-sm font-semibold text-prize-text dark:text-[#e8c84a] uppercase tracking-wide">
                  Preise
                </h2>
              </div>
              <ul className="space-y-1.5 text-sm dark:text-[#d4d4d4]">
                {raw.prizes.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{p.category}</span>
                    {p.count > 1 && (
                      <span className="text-gray-500 dark:text-[#a0a0a0]">{p.count}x</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Save button (for past tournaments or when no registration URL) */}
          {isPast && (
            <SaveTournamentButton tournamentId={t.id} size="lg" />
          )}

          {/* External link */}
          {t.source_url && (
            <a
              href={t.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-gray-400 hover:text-accent transition-colors"
            >
              Auf {sourceLabel} ansehen →
            </a>
          )}
        </div>

        {/* Right column: Club info + Map (1/3 width) */}
        <div className="space-y-6">
          {/* Club card */}
          {club && (
            <Link
              href={`/clubs/${club.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-accent/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Golfclub
                </h2>
                <ChevronRight size={14} className="text-gray-300" />
              </div>

              <div className="flex items-center gap-3 mb-3">
                {club.logo_url ? (
                  <img
                    src={club.logo_url}
                    alt={`${club.name} Logo`}
                    className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/20 shrink-0 flex items-center justify-center dark:bg-[#1a3329] dark:border-[#2d4a3a]">
                    <Flag size={18} className="text-accent" />
                  </div>
                )}
                <div className="text-base font-semibold leading-snug">{club.name}</div>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                {(club.address || club.city) && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                    <span>
                      {club.address && <>{club.address}, </>}
                      {[club.postal_code, club.city].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {club.website && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Globe size={12} /> Website
                  </span>
                )}
                {club.phone && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Phone size={12} /> {club.phone}
                  </span>
                )}
                {club.email && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Mail size={12} /> E-Mail
                  </span>
                )}
              </div>
            </Link>
          )}

          {/* Map */}
          {club?.latitude && club?.longitude && (
            <div className="h-[250px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <ClubMapMini club={club} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function QuickStat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${
      highlight
        ? 'bg-amber-50 border-amber-200 dark:bg-[#2a2410] dark:border-[#5a4a18]'
        : 'bg-white border-gray-200'
    }`}>
      <div className={`flex items-center gap-1.5 mb-1 ${
        highlight ? 'text-amber-600 dark:text-[#e8c84a]' : 'text-gray-400'
      }`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-sm font-semibold ${
        highlight ? 'text-amber-700 dark:text-[#e8c84a]' : 'text-gray-900'
      }`}>
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className="font-medium text-gray-900 text-right">{value}</dd>
    </div>
  );
}
