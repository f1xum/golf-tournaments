'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Tournament, GolfClub } from '@/lib/types';
import { formatDateFull, formatToLabel } from '@/lib/utils';
import { extractHoles, formatMeldeschluss } from '@/lib/tournament-utils';

const ClubMapMini = dynamic(() => import('@/components/club-map-mini'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
      Karte wird geladen...
    </div>
  ),
});

interface Props {
  tournament: Tournament;
  club: GolfClub | null;
}

export default function TurnierDetailClient({ tournament: t, club }: Props) {
  const raw = t.raw_data || {};
  const formatLabel = formatToLabel(t.format);
  const holes = extractHoles(t.raw_data, t.description);
  const meldeschluss = formatMeldeschluss(t.raw_data);

  const dateStr = formatDateFull(t.date_start);
  const endStr =
    t.date_end && t.date_end !== t.date_start
      ? ` – ${formatDateFull(t.date_end)}`
      : '';

  const slotsText =
    raw.max_participants
      ? raw.free_slots !== null && raw.free_slots !== undefined
        ? `${raw.free_slots} / ${raw.max_participants} frei`
        : `${raw.max_participants} Plätze`
      : null;

  const sourceLabel =
    t.source === 'club_website' ? 'PC CADDIE' :
    t.source === 'bgv' ? 'BGV' :
    t.source === 'dgv' ? 'DGV' : 'Quelle';

  return (
    <>
      {/* Back link */}
      <Link
        href="/turniere"
        className="inline-flex items-center text-sm text-gray-500 hover:text-accent mb-4"
      >
        ← Zurück zur Übersicht
      </Link>

      {/* Header */}
      <h1 className="text-2xl font-bold mb-2">{t.name}</h1>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-sm font-semibold text-accent">{dateStr}{endStr}</span>
        {formatLabel && (
          <span className="text-xs px-2 py-0.5 bg-accent-light text-accent rounded font-medium">
            {formatLabel}
          </span>
        )}
        {holes && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
            {holes} Löcher
          </span>
        )}
        {raw.hcp_relevant && (
          <span className="text-xs px-2 py-0.5 bg-accent-light text-accent rounded font-medium">
            HCP-relevant
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Tournament details (2/3 width) */}
        <div className="md:col-span-2 space-y-6">
          {/* Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Details
            </h2>
            <dl className="space-y-3 text-sm">
              {t.entry_fee != null && (
                <DetailRow label="Nenngeld" value={`${t.entry_fee} €`} />
              )}
              {raw.guests_allowed && (
                <DetailRow
                  label="Gäste"
                  value={
                    raw.guest_fee
                      ? `Willkommen (ab ${raw.guest_fee} €)`
                      : 'Willkommen'
                  }
                />
              )}
              {!raw.guests_allowed && raw.guests_allowed !== undefined && (
                <DetailRow label="Gäste" value="Nur Mitglieder" />
              )}
              {raw.nenngeld_raw && (
                <DetailRow label="Nenngeld (Details)" value={String(raw.nenngeld_raw)} />
              )}
              {slotsText && <DetailRow label="Plätze" value={slotsText} />}
              {meldeschluss && <DetailRow label="Meldeschluss" value={meldeschluss} />}
              {t.gender && <DetailRow label="Geschlecht" value={t.gender} />}
              {t.age_class && <DetailRow label="Altersklasse" value={t.age_class} />}
              {t.rounds && <DetailRow label="Runden" value={`${t.rounds}`} />}
              {holes && <DetailRow label="Löcher" value={`${holes}`} />}
              {(t.max_handicap != null || t.min_handicap != null) && (
                <DetailRow
                  label="Handicap"
                  value={
                    t.min_handicap != null && t.max_handicap != null
                      ? `${t.min_handicap} – ${t.max_handicap}`
                      : t.max_handicap != null
                      ? `bis ${t.max_handicap}`
                      : `ab ${t.min_handicap}`
                  }
                />
              )}
              {raw.spielform && (
                <DetailRow label="Spielform" value={String(raw.spielform)} />
              )}
              {raw.turnierart && (
                <DetailRow label="Turnierart" value={String(raw.turnierart)} />
              )}
              {raw.hcp_relevant !== undefined && (
                <DetailRow label="HCP-relevant" value={raw.hcp_relevant ? 'Ja' : 'Nein'} />
              )}
              {t.source && <DetailRow label="Quelle" value={sourceLabel} />}
            </dl>
          </div>

          {/* Prizes */}
          {raw.prizes && Array.isArray(raw.prizes) && raw.prizes.length > 0 && (
            <div className="bg-prize-bg border border-prize-border rounded-lg p-5">
              <h2 className="text-sm font-semibold text-prize-text uppercase tracking-wide mb-3">
                Preise
              </h2>
              <ul className="space-y-1.5 text-sm">
                {raw.prizes.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{p.category}</span>
                    {p.count > 1 && (
                      <span className="text-gray-500">{p.count}x</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* External link */}
          {t.source_url && (
            <a
              href={t.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              Auf {sourceLabel} ansehen →
            </a>
          )}
        </div>

        {/* Right column: Club info + Map (1/3 width) */}
        <div className="space-y-6">
          {/* Club card */}
          {club && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Golfclub
              </h2>
              <div className="text-base font-semibold mb-2">{club.name}</div>
              <div className="space-y-1.5 text-sm text-gray-600">
                {club.address && <div>{club.address}</div>}
                {(club.postal_code || club.city) && (
                  <div>{[club.postal_code, club.city].filter(Boolean).join(' ')}</div>
                )}
                {club.region && (
                  <div className="text-xs text-gray-400">{club.region}</div>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                {club.website && (
                  <a
                    href={club.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Website
                  </a>
                )}
                {club.phone && (
                  <a href={`tel:${club.phone}`} className="text-accent hover:underline">
                    {club.phone}
                  </a>
                )}
                {club.email && (
                  <a href={`mailto:${club.email}`} className="text-accent hover:underline">
                    {club.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Map */}
          {club?.latitude && club?.longitude && (
            <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <ClubMapMini club={club} />
            </div>
          )}
        </div>
      </div>
    </>
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
