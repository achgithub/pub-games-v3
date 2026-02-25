-- Sweepstakes Knockout Database Schema v2
-- Matches LMS Manager structure: global pools, event-specific assignments

-- Global player pool (like LMS Manager)
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_email, name)
);

-- Global horse pool (like teams in LMS Manager)
CREATE TABLE IF NOT EXISTS horses (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_email, name)
);

-- Events (the actual sweepstake games)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'setup', -- setup, active, completed
    manager_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event participants (links players to events with horse assignments)
CREATE TABLE IF NOT EXISTS event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    horse_id INTEGER REFERENCES horses(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, player_id),
    UNIQUE(event_id, horse_id)
);

-- Winning positions (event-specific configuration)
CREATE TABLE IF NOT EXISTS winning_positions (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL, -- "1", "2", "3", "last", etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, position)
);

-- Results (which horse finished in which position)
CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, horse_id),
    UNIQUE(event_id, position)
);
