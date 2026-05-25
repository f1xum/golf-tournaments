import { RawData } from './types';

/**
 * Extract number of holes from raw_data.turnierart.
 * e.g. "Einzel Zählspiel nach Stableford über 18 Löcher" → 18
 * Also checks description field for "9 holes" / "18 holes"
 */
export function extractHoles(rawData: RawData | null, description: string | null): number {
  const turnierart = rawData?.turnierart;
  if (typeof turnierart === 'string') {
    const match = turnierart.match(/(\d+)\s*Lö/);
    if (match) return parseInt(match[1]);
  }
  if (typeof description === 'string') {
    const match = description.match(/(\d+)\s*hole/i);
    if (match) return parseInt(match[1]);
  }
  return 18; // default: most tournaments are 18 holes
}

/**
 * Format the registration deadline for display.
 * e.g. "Mi, 01.04.2026, 12:00 Uhr" → "Mi, 01.04.2026, 12:00 Uhr"
 */
export function formatMeldeschluss(rawData: RawData | null): string | null {
  const ms = rawData?.meldeschluss;
  if (typeof ms === 'string' && ms.trim()) {
    // Clean up messy BGV format
    return ms.replace(/^Meldeschluss:\s*/i, '').replace(/\s*\|.*$/, '').trim() || null;
  }
  return null;
}

/**
 * Parse the registration deadline to a Date for "days until" calculations.
 * Handles German DD.MM.YYYY (optionally with HH:MM) and falls back to native parsing.
 */
export function parseMeldeschluss(rawData: RawData | null): Date | null {
  const ms = rawData?.meldeschluss;
  if (typeof ms !== 'string' || !ms.trim()) return null;

  const cleaned = ms.replace(/^Meldeschluss:\s*/i, '').replace(/\s*\|.*$/, '').trim();
  const m = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h, min] = m;
    const dt = new Date(
      Number(y), Number(mo) - 1, Number(d),
      h ? Number(h) : 23, min ? Number(min) : 59,
    );
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(cleaned);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
