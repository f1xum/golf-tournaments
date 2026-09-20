'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { ScoringProfile } from '@/lib/recommendations';

/**
 * Everything the public pages used to read from the session server-side.
 *
 * Fetching it here instead keeps `/`, `/turniere`, `/clubs`, `/karte` and the
 * geo pages statically renderable, so they are served from the CDN rather than
 * re-rendered per request. The trade is that saved-state paints a moment after
 * the page does.
 */
export interface Viewer {
  userId: string | null;
  savedClubIds: string[];
  savedTournamentIds: string[];
  profile: ScoringProfile | null;
}

export const VIEWER_QUERY_KEY = ['viewer'] as const;

const ANONYMOUS: Viewer = {
  userId: null,
  savedClubIds: [],
  savedTournamentIds: [],
  profile: null,
};

async function fetchViewer(): Promise<Viewer> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ANONYMOUS;

  const [profileRes, savedClubsRes, savedTournamentsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('handicap,home_club_id,recommendation_max_distance,recommendation_prefer_hcp,recommendation_formats')
      .eq('id', user.id)
      .single(),
    supabase.from('saved_clubs').select('club_id').eq('user_id', user.id),
    supabase.from('saved_tournaments').select('tournament_id').eq('user_id', user.id),
  ]);

  return {
    userId: user.id,
    savedClubIds: (savedClubsRes.data ?? []).map((r) => r.club_id),
    savedTournamentIds: (savedTournamentsRes.data ?? []).map((r) => r.tournament_id),
    profile: (profileRes.data as ScoringProfile | null) ?? null,
  };
}

export function useViewer(): Viewer & { isLoading: boolean } {
  const { data, isPending } = useQuery({
    queryKey: VIEWER_QUERY_KEY,
    queryFn: fetchViewer,
    staleTime: 5 * 60 * 1000,
  });

  return { ...(data ?? ANONYMOUS), isLoading: isPending };
}

/**
 * Flip one saved-tournament id in the cached viewer. Used by the save button so
 * the heart reacts immediately and every other card showing that tournament
 * follows, without a refetch.
 */
export function useSetTournamentSaved() {
  const queryClient = useQueryClient();

  return (tournamentId: string, saved: boolean) => {
    queryClient.setQueryData<Viewer>(VIEWER_QUERY_KEY, (prev) => {
      if (!prev) return prev;
      const ids = prev.savedTournamentIds.filter((id) => id !== tournamentId);
      return {
        ...prev,
        savedTournamentIds: saved ? [...ids, tournamentId] : ids,
      };
    });
  };
}

/** Same, for saved clubs. */
export function useSetClubSaved() {
  const queryClient = useQueryClient();

  return (clubId: string, saved: boolean) => {
    queryClient.setQueryData<Viewer>(VIEWER_QUERY_KEY, (prev) => {
      if (!prev) return prev;
      const ids = prev.savedClubIds.filter((id) => id !== clubId);
      return { ...prev, savedClubIds: saved ? [...ids, clubId] : ids };
    });
  };
}
