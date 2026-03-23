-- Notification types enum
CREATE TYPE notification_type AS ENUM (
  'tournament_reminder',      -- saved tournament coming up soon
  'registration_closing',     -- registration deadline approaching
  'new_tournament_nearby',    -- new tournament near home club
  'hcp_match'                 -- new tournament matching user's handicap
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read = false;

-- RLS: users can only see and update their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Only service role / triggers can insert notifications
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Notification preferences on profile
ALTER TABLE profiles
  ADD COLUMN notify_tournament_reminder BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN notify_registration_closing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN notify_new_nearby BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN notify_hcp_match BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN reminder_days_before INTEGER NOT NULL DEFAULT 3;
