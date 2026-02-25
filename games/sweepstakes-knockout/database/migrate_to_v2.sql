-- Migration script: Restructure to match LMS Manager design
-- Run this on the Pi after backing up any data

-- Drop old tables (in reverse dependency order)
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS winning_positions;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS horses;
DROP TABLE IF EXISTS events;

-- Create new schema

-- Global player pool
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_email, name)
);

-- Global horse pool
CREATE TABLE horses (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_email, name)
);

-- Events
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'setup',
    manager_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event participants (player + horse assignments)
CREATE TABLE event_participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    horse_id INTEGER REFERENCES horses(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, player_id),
    UNIQUE(event_id, horse_id)
);

-- Winning positions
CREATE TABLE winning_positions (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, position)
);

-- Results
CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, horse_id),
    UNIQUE(event_id, position)
);
