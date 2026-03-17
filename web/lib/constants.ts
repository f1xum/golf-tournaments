export const PAGE_SIZE = 30;

export const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const REGIONS = [
  'Oberbayern',
  'Niederbayern',
  'Schwaben',
  'Oberpfalz',
  'Oberfranken',
  'Mittelfranken',
  'Unterfranken',
  'München',
];

export const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'stableford', label: 'Stableford' },
  { value: 'strokeplay', label: 'Zählspiel' },
  { value: 'scramble', label: 'Scramble' },
  { value: 'matchplay', label: 'Lochspiel' },
  { value: 'best_ball', label: 'Best Ball' },
  { value: 'texas_scramble', label: 'Texas Scramble' },
  { value: 'chapman', label: 'Chapman' },
  { value: 'vierer', label: 'Vierer' },
];

export const FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  FORMAT_OPTIONS.map((f) => [f.value, f.label])
);
