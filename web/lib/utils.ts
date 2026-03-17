import { FORMAT_LABELS } from './constants';

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
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
  return new Date().toISOString().split('T')[0];
}
