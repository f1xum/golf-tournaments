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

export const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
];

export const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'stableford', label: 'Stableford' },
  { value: 'strokeplay', label: 'Zählspiel' },
  { value: 'scramble', label: 'Scramble' },
  { value: 'matchplay', label: 'Lochspiel' },
  { value: 'best_ball', label: 'Best Ball' },
  { value: 'chapman', label: 'Chapman' },
  { value: 'vierer', label: 'Vierer' },
];

// Filter synonyms: selecting a chip on the left matches any DB value on
// the right. Texas Scramble is rolled into Scramble since browsing users
// rarely care about the distinction.
export const FORMAT_FILTER_SYNONYMS: Record<string, string[]> = {
  scramble: ['scramble', 'texas_scramble'],
};

export const FORMAT_LABELS: Record<string, string> = {
  ...Object.fromEntries(FORMAT_OPTIONS.map((f) => [f.value, f.label])),
  texas_scramble: 'Texas Scramble',
  other: 'Sonstiges',
};
