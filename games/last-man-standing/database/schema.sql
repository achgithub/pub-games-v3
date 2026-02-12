-- Last Man Standing DB Schema
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d last_man_standing_db -f schema.sql
-- NOTE: DROP order respects foreign key constraints (predictions first, then dependents).

DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS rounds CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS fixture_files CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- Fixture files: independent of games. One file = one league season's schedule.
-- Multiple games can reference the same fixture file (e.g. "Andy's Friends" + "Julie's Friends").
CREATE TABLE fixture_files (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Matches belong to a fixture file, not to a game.
-- Results are facts about the match and are shared across all games using this file.
-- Re-uploading the CSV updates matches via ON CONFLICT (fixture_file_id, match_number).
CREATE TABLE matches (
    id              SERIAL PRIMARY KEY,
    fixture_file_id INTEGER NOT NULL REFERENCES fixture_files(id),
    match_number    INTEGER NOT NULL,
    round_number    INTEGER NOT NULL,
    date            TEXT NOT NULL,
    location        TEXT NOT NULL,
    home_team       TEXT NOT NULL,
    away_team       TEXT NOT NULL,
    result          TEXT DEFAULT '',           -- "2 - 1" or "P - P"
    status          TEXT DEFAULT 'upcoming',  -- 'upcoming', 'completed', 'postponed'
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(fixture_file_id, match_number)
);

-- Games reference a fixture file. Each game is an independent competition.
-- A player can be in multiple games simultaneously; elimination is scoped per game.
CREATE TABLE games (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    fixture_file_id   INTEGER REFERENCES fixture_files(id),
    status            TEXT DEFAULT 'active',       -- 'active', 'completed'
    winner_count      INTEGER DEFAULT 0,
    postponement_rule TEXT DEFAULT 'loss',          -- 'loss' or 'win' for P-P matches
    start_date        TIMESTAMP DEFAULT NOW(),
    end_date          TIMESTAMP,
    created_at        TIMESTAMP DEFAULT NOW()
);

-- Players in a game. A player can be in multiple games simultaneously.
CREATE TABLE game_players (
    id        SERIAL PRIMARY KEY,
    user_id   TEXT NOT NULL,                       -- identity-shell user email
    game_id   INTEGER NOT NULL REFERENCES games(id),
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, game_id)
);

-- Rounds belong to a game. Each round has a deadline and open/closed state for picks.
CREATE TABLE rounds (
    id                  SERIAL PRIMARY KEY,
    game_id             INTEGER NOT NULL REFERENCES games(id),
    round_number        INTEGER NOT NULL,
    submission_deadline TEXT NOT NULL,
    status              TEXT DEFAULT 'draft',      -- 'draft', 'open', 'closed'
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(game_id, round_number)
);

-- Predictions belong to a game. match_id links to the fixture file's match.
-- Evaluation (is_correct, elimination) happens via explicit "Process Round" — NOT on result entry.
CREATE TABLE predictions (
    id             SERIAL PRIMARY KEY,
    user_id        TEXT NOT NULL,
    game_id        INTEGER NOT NULL REFERENCES games(id),
    match_id       INTEGER NOT NULL REFERENCES matches(id),
    round_number   INTEGER NOT NULL,
    predicted_team TEXT NOT NULL,
    is_correct     BOOLEAN DEFAULT NULL,
    voided         BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, game_id, round_number)
);

-- Key-value store. Used for: current_game_id (the game shown to players by default).
CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
