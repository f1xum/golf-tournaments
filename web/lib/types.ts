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
  pccaddie_id: string | null;
  nexxchange_id: string | null;
  courses: { name: string; holes: number | null }[] | null;
  has_9_holes: boolean;
  has_18_holes: boolean;
}

export interface RawData {
  free_slots?: number | null;
  max_participants?: number | null;
  hcp_relevant?: boolean;
  guests_allowed?: boolean;
  guest_fee?: number | null;
  spielform?: string;
  turnierart?: string;
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

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  home_club_id: string | null;
  handicap: number | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  notify_tournament_reminder: boolean;
  notify_registration_closing: boolean;
  notify_new_nearby: boolean;
  notify_hcp_match: boolean;
  reminder_days_before: number;
}

export type NotificationType =
  | 'tournament_reminder'
  | 'registration_closing'
  | 'new_tournament_nearby'
  | 'hcp_match';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  tournament_id: string | null;
  read: boolean;
  created_at: string;
}
