import { FORMAT_LABELS } from './constants';

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Local-date YYYY-MM-DD. We deliberately avoid toISOString() — it converts to
// UTC first, which in CEST (UTC+2) flips local midnight to the previous day.
export function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateShort(d: Date): string {
  return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${days[d.getDay()]}, ${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}

export function formatToLabel(format: string | null): string {
  if (!format) return '';
  return FORMAT_LABELS[format] || '';
}

export function todayISO(): string {
  return toISO(new Date());
}

/** Haversine distance between two coordinates in km */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
