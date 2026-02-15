-- Sweepstakes Database Schema
DROP TABLE IF EXISTS draws CASCADE;
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS competitions CASCADE;

CREATE TABLE competitions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('knockout', 'race')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'locked', 'completed', 'archived')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seed INTEGER,
    number INTEGER,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'taken')),
    position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, name)
);

-- UNIQUE constraints replace Redis locking:
-- (competition_id, entry_id) prevents the same entry being drawn twice.
-- (user_id, competition_id) prevents one user drawing more than once per competition.
CREATE TABLE draws (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, entry_id),
    UNIQUE(user_id, competition_id)
);

CREATE INDEX idx_draws_user_comp ON draws(user_id, competition_id);
CREATE INDEX idx_entries_comp ON entries(competition_id);
CREATE INDEX idx_competitions_status ON competitions(status);
