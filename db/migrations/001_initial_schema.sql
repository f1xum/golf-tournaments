-- Golf Tournament Aggregator — Initial Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Golf Clubs
-- ============================================
CREATE TABLE golf_clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    region TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    website TEXT,
    bgv_url TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    cms_type TEXT,
    has_public_tournaments BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_clubs_name_city ON golf_clubs (name, city);
CREATE INDEX idx_clubs_region ON golf_clubs (region);
CREATE INDEX idx_clubs_location ON golf_clubs (latitude, longitude) WHERE latitude IS NOT NULL;

-- ============================================
-- Tournaments
-- ============================================
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    club_id UUID REFERENCES golf_clubs(id) ON DELETE SET NULL,
    date_start DATE NOT NULL,
    date_end DATE,
    format TEXT,
    rounds INTEGER,
    max_handicap DOUBLE PRECISION,
    min_handicap DOUBLE PRECISION,
    entry_fee DOUBLE PRECISION,
    entry_fee_currency TEXT DEFAULT 'EUR',
    age_class TEXT,
    gender TEXT,
    description TEXT,
    registration_url TEXT,
    source TEXT NOT NULL,
    source_url TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tournaments_dedup
    ON tournaments (name, date_start, club_id, source);
CREATE INDEX idx_tournaments_date ON tournaments (date_start);
CREATE INDEX idx_tournaments_club ON tournaments (club_id);
CREATE INDEX idx_tournaments_source ON tournaments (source);

-- ============================================
-- Scrape Logs
-- ============================================
CREATE TABLE scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    items_found INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    errors JSONB,
    duration_seconds DOUBLE PRECISION,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_scrape_logs_source ON scrape_logs (source);
CREATE INDEX idx_scrape_logs_started ON scrape_logs (started_at DESC);

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clubs_updated_at
    BEFORE UPDATE ON golf_clubs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tournaments_updated_at
    BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
