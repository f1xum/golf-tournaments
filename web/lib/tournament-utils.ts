import { RawData } from './types';

/**
 * Extract number of holes from raw_data.turnierart.
 * e.g. "Einzel Zählspiel nach Stableford über 18 Löcher" → 18
 * Also checks description field for "9 holes" / "18 holes"
 */
export function extractHoles(rawData: RawData | null, description: string | null): number | null {
  const turnierart = rawData?.turnierart;
  if (typeof turnierart === 'string') {
    const match = turnierart.match(/(\d+)\s*Lö/);
    if (match) return parseInt(match[1]);
  }
  if (typeof description === 'string') {
    const match = description.match(/(\d+)\s*hole/i);
    if (match) return parseInt(match[1]);
  }
  return null;
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
