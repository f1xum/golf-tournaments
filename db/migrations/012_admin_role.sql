-- Add role column to profiles (default 'user', Phillip gets 'admin')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

UPDATE profiles SET role = 'admin' WHERE id = 'cf529324-50b4-48f8-9bab-c3e97c6abf8f';
