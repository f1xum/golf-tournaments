-- ============================================
-- Usernames become mandatory
-- ============================================
--
-- Every account needs a unique username. The app enforces this in two places
-- (onboarding step 1, and <UsernameGate /> for accounts that predate the
-- requirement), but the client holds the anon key and profiles has an
-- "update own profile" RLS policy, so client-side checks alone are not a
-- guarantee. These constraints make the database the authority.
--
-- NOT NULL is deliberately NOT added: existing profiles still have NULL
-- usernames, and the gate needs them to stay loadable so the user can fix
-- them. Once every row has one, a follow-up migration can add:
--     ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

-- Case-insensitive uniqueness. The existing UNIQUE constraint from migration
-- 003 is case-sensitive, so "Phillip" and "phillip" could both be taken —
-- two visually identical @handles. The app lowercases input, but that is a
-- client-side habit, not a rule.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
    ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Shape check, mirroring lib/username.ts: 3–30 chars, lowercase alphanumerics
-- plus . _ -, and must start with a letter or digit (so "..." or "-x" are out).
-- NULL passes, which is what lets legacy rows survive until the gate fixes them.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS chk_profiles_username_format;
ALTER TABLE public.profiles
    ADD CONSTRAINT chk_profiles_username_format
    CHECK (username IS NULL OR username ~ '^[a-z0-9][a-z0-9_.-]{2,29}$');
