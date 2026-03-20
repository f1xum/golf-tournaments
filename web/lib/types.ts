export interface GolfClub {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  cms_type: string | null;
  has_public_tournaments: boolean;
}

export interface RawData {
  free_slots?: number | null;
  max_participants?: number | null;
  hcp_relevant?: boolean;
  guests_allowed?: boolean;
  guest_fee?: number | null;
  spielform?: string;
  nenngeld_raw?: string;
  prizes?: { category: string; count: number }[];
  [key: string]: unknown;
}

export interface Tournament {
  id: string;
  name: string;
  club_id: string | null;
  date_start: string;
  date_end: string | null;
  format: string | null;
  rounds: number | null;
  max_handicap: number | null;
  min_handicap: number | null;
  entry_fee: number | null;
  entry_fee_currency: string;
  age_class: string | null;
  gender: string | null;
  description: string | null;
  registration_url: string | null;
  source: string;
  source_url: string | null;
  raw_data: RawData | null;
}
