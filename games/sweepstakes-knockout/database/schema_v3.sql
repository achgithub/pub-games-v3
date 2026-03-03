-- Sweepstakes Knockout Database Schema v3
-- Matches LMS Manager structure with Groups/Competitors pattern

-- Drop existing tables (user approved - doesn't care about existing data)
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS winning_positions CASCADE;
DROP TABLE IF EXISTS event_participants CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS horses CASCADE;
DROP TABLE IF EXISTS competitors CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS groups CASCADE;

-- Global player pool (like LMS Manager)
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_email, name)
);

-- Groups (like LMS Manager - e.g., "Grand National 2025", "Cheltenham Gold Cup")
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_email, name)
);

-- Competitors within groups (like teams in LMS Manager - horses, runners, etc.)
CREATE TABLE competitors (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, name)
);

-- Events/Games (the actual sweepstake games)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'setup', -- setup, active, completed
    manager_email VARCHAR(255) NOT NULL,
    -- Winning positions configured at creation time (comma-separated: "1,2,3,last")
    winning_positions TEXT DEFAULT '1,2,3,last',
    -- Spinner feature for randomized competitor assignment
    spinner_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event participants (links players to events with competitor assignments)
CREATE TABLE event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    competitor_id INTEGER REFERENCES competitors(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, player_id),
    UNIQUE(event_id, competitor_id)
);

-- Results (which competitor finished in which position)
CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, competitor_id),
    UNIQUE(event_id, position)
);

-- Indexes for performance
CREATE INDEX idx_players_manager ON players(manager_email);
CREATE INDEX idx_groups_manager ON groups(manager_email);
CREATE INDEX idx_competitors_group ON competitors(group_id);
CREATE INDEX idx_events_manager ON events(manager_email);
CREATE INDEX idx_events_group ON events(group_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_player ON event_participants(player_id);
CREATE INDEX idx_event_participants_competitor ON event_participants(competitor_id);
CREATE INDEX idx_results_event ON results(event_id);
CREATE INDEX idx_results_competitor ON results(competitor_id);
