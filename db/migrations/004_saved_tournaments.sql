-- Saved/bookmarked tournaments
CREATE TABLE public.saved_tournaments (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, tournament_id)
);

-- Enable RLS
ALTER TABLE public.saved_tournaments ENABLE ROW LEVEL SECURITY;

-- Users can read their own saved tournaments
CREATE POLICY "Users can read own saves"
  ON public.saved_tournaments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can save tournaments
CREATE POLICY "Users can insert own saves"
  ON public.saved_tournaments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unsave tournaments
CREATE POLICY "Users can delete own saves"
  ON public.saved_tournaments FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_saved_tournaments_user ON public.saved_tournaments(user_id);
