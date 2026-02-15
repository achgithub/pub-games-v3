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
-- match_date is a proper DATE for date-range round queries.
-- round_number from CSV is stored as metadata only — not used for round grouping.
-- CSV date column must be in YYYY-MM-DD format (or DD/MM/YYYY — backend tries both).
CREATE TABLE matches (
    id              SERIAL PRIMARY KEY,
    fixture_file_id INTEGER NOT NULL REFERENCES fixture_files(id),
    match_number    INTEGER NOT NULL,
    round_number    INTEGER NOT NULL,        -- CSV metadata only, not used for round logic
    match_date      DATE NOT NULL,
    location        TEXT NOT NULL,
    home_team       TEXT NOT NULL,
    away_team       TEXT NOT NULL,
    result          TEXT DEFAULT '',         -- "2 - 1" or "P - P"
    status          TEXT DEFAULT 'upcoming', -- 'upcoming', 'completed', 'postponed'
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

-- Rounds belong to a game and are defined by a date window.
-- Matches whose match_date falls within [start_date, end_date] are in scope for the round.
-- label is the display number (1, 2, 3, ...) — auto-incremented by admin, not from CSV.
-- submission_deadline: optional deadline for player picks. After this time, admin can trigger
-- auto-pick (first alphabetically available team) for players who haven't picked.
CREATE TABLE rounds (
    id                  SERIAL PRIMARY KEY,
    game_id             INTEGER NOT NULL REFERENCES games(id),
    label               INTEGER NOT NULL,               -- display number (Round 1, Round 2, ...)
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    submission_deadline TIMESTAMP,                      -- optional pick deadline
    status              TEXT DEFAULT 'draft',           -- 'draft', 'open', 'closed'
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(game_id, label)
);

-- Predictions belong to a round (via round_id) and reference a specific match.
-- A player picks one team per round.
-- bye = TRUE means the match moved outside the window or was postponed:
--   the player survives (not eliminated) but the team slot is consumed (voided stays FALSE).
-- Evaluation happens via explicit "Process Round" — NOT on result entry.
CREATE TABLE predictions (
    id             SERIAL PRIMARY KEY,
    user_id        TEXT NOT NULL,
    game_id        INTEGER NOT NULL REFERENCES games(id),
    round_id       INTEGER NOT NULL REFERENCES rounds(id),
    match_id       INTEGER NOT NULL REFERENCES matches(id),
    predicted_team TEXT NOT NULL,
    is_correct     BOOLEAN DEFAULT NULL,    -- NULL = pending, TRUE = survived, FALSE = eliminated
    voided         BOOLEAN DEFAULT FALSE,   -- TRUE = pick cancelled (team can be reused)
    bye            BOOLEAN DEFAULT FALSE,   -- TRUE = survived due to match postponed/moved
    created_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, game_id, round_id)
);

-- Key-value store. Used for: current_game_id (the game shown to players by default).
CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
