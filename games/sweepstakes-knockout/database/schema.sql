-- Sweepstakes Knockout Database Schema
-- Single-event sweepstakes for horses, greyhounds, athletics, etc.

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'setup', -- setup, active, completed
    manager_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS horses (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, name)
);

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_email VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    horse_id INTEGER REFERENCES horses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, player_email),
    UNIQUE(event_id, horse_id) -- each horse can only be assigned to one player
);

CREATE TABLE IF NOT EXISTS winning_positions (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL, -- "1", "2", "3", "last", etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, position)
);

CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, horse_id), -- each horse can only have one result
    UNIQUE(event_id, position) -- each position can only be assigned once
);

-- Indexes for performance
CREATE INDEX idx_events_manager ON events(manager_email);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_horses_event ON horses(event_id);
CREATE INDEX idx_players_event ON players(event_id);
CREATE INDEX idx_players_horse ON players(horse_id);
CREATE INDEX idx_winning_positions_event ON winning_positions(event_id);
CREATE INDEX idx_results_event ON results(event_id);
CREATE INDEX idx_results_horse ON results(horse_id);
