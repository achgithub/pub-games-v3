-- Season Scheduler Database Schema
-- Supports scheduling for Darts, Pool, and Crib leagues

-- Drop existing tables if they exist
DROP TABLE IF EXISTS schedule_matches CASCADE;
DROP TABLE IF EXISTS schedule_dates CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    sport VARCHAR(50) NOT NULL CHECK (sport IN ('darts', 'pool', 'crib')),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, sport, name)
);

-- Schedules table (saved/confirmed schedules)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    sport VARCHAR(50) NOT NULL CHECK (sport IN ('darts', 'pool', 'crib')),
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    day_of_week VARCHAR(20) NOT NULL,
    season_start DATE NOT NULL,
    season_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, sport, name, version)
);

-- Schedule dates metadata (catch-up, free, special event markers)
CREATE TABLE schedule_dates (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    match_date DATE NOT NULL,
    date_type VARCHAR(20) NOT NULL CHECK (date_type IN ('normal', 'catchup', 'free', 'special', 'bye')),
    notes TEXT,
    UNIQUE(schedule_id, match_date)
);

-- Individual matches within a schedule
CREATE TABLE schedule_matches (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    match_date DATE NOT NULL,
    home_team VARCHAR(255) NOT NULL,
    away_team VARCHAR(255),  -- NULL for bye weeks
    match_order INTEGER NOT NULL,  -- For manual rearrangement
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_match_per_schedule UNIQUE(schedule_id, match_order)
);

-- Indexes for performance
CREATE INDEX idx_teams_user_sport ON teams(user_id, sport);
CREATE INDEX idx_schedules_user ON schedules(user_id);
CREATE INDEX idx_schedules_created ON schedules(created_at);
CREATE INDEX idx_schedule_matches_schedule ON schedule_matches(schedule_id);
CREATE INDEX idx_schedule_dates_schedule ON schedule_dates(schedule_id);

-- Cleanup trigger for 30-day old schedules
CREATE OR REPLACE FUNCTION delete_old_schedules()
RETURNS void AS $$
BEGIN
    DELETE FROM schedules
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Note: This function should be called periodically by a cron job or background task
-- For now, it can be manually triggered: SELECT delete_old_schedules();
