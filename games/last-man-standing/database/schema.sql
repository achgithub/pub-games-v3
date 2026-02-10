-- Last Man Standing DB Schema
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d last_man_standing_db -f schema.sql

CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',         -- 'active', 'completed'
    winner_count INTEGER DEFAULT 0,
    postponement_rule TEXT DEFAULT 'loss', -- 'loss' or 'win' for P-P matches
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,                -- identity-shell user email
    game_id INTEGER NOT NULL REFERENCES games(id),
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, game_id)
);

CREATE TABLE IF NOT EXISTS rounds (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id),
    round_number INTEGER NOT NULL,
    submission_deadline TEXT NOT NULL,
    status TEXT DEFAULT 'draft',          -- 'draft', 'open', 'closed'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(game_id, round_number)
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id),
    match_number INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    result TEXT DEFAULT '',               -- "2 - 1" or "P - P"
    status TEXT DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    game_id INTEGER NOT NULL REFERENCES games(id),
    match_id INTEGER NOT NULL REFERENCES matches(id),
    round_number INTEGER NOT NULL,
    predicted_team TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT NULL,
    voided BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, game_id, round_number)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
-- Stores: current_game_id
