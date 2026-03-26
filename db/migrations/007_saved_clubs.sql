-- Saved/favorited clubs
CREATE TABLE public.saved_clubs (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES public.golf_clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, club_id)
);

-- Enable RLS
ALTER TABLE public.saved_clubs ENABLE ROW LEVEL SECURITY;

-- Users can read their own saved clubs
CREATE POLICY "Users can read own saved clubs"
  ON public.saved_clubs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can save clubs
CREATE POLICY "Users can insert own saved clubs"
  ON public.saved_clubs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unsave clubs
CREATE POLICY "Users can delete own saved clubs"
  ON public.saved_clubs FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_saved_clubs_user ON public.saved_clubs(user_id);
