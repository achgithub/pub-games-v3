-- Sweepstakes Database Schema

CREATE TABLE IF NOT EXISTS competitions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('knockout', 'race')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'locked', 'completed', 'archived')),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    description TEXT,
    selection_mode TEXT DEFAULT 'blind',
    blind_box_interval INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seed INTEGER,
    number INTEGER,
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'taken', 'active', 'eliminated', 'winner')),
    stage TEXT,
    eliminated_date TIMESTAMP,
    position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, name)
);

CREATE TABLE IF NOT EXISTS draws (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_draws_user_comp ON draws(user_id, competition_id);
CREATE INDEX IF NOT EXISTS idx_entries_comp_status ON entries(competition_id, status);
CREATE INDEX IF NOT EXISTS idx_entries_comp ON entries(competition_id);
CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
