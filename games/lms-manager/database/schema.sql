-- LMS Manager Database Schema
-- Database: lms_manager_db
-- Purpose: Managed Last Man Standing games (no fixtures, manager controls everything)

-- Manager's team master data (personal nicknames per manager)
CREATE TABLE IF NOT EXISTS managed_teams (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(manager_email, team_name)
);

-- Manager's player master data (personal nicknames per manager)
CREATE TABLE IF NOT EXISTS managed_players (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    player_nickname VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(manager_email, player_nickname)
);

-- Managed games
CREATE TABLE IF NOT EXISTS managed_games (
    id SERIAL PRIMARY KEY,
    manager_email VARCHAR(255) NOT NULL,
    game_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed'
    winner_names TEXT[], -- array of player nicknames (joint winners if split)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Teams selected for a game (subset of manager's teams)
CREATE TABLE IF NOT EXISTS managed_game_teams (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES managed_games(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    UNIQUE(game_id, team_name)
);

-- Players in a game
CREATE TABLE IF NOT EXISTS managed_game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES managed_games(id) ON DELETE CASCADE,
    player_nickname VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'eliminated', 'winner'
    eliminated_round INTEGER, -- round number they were eliminated
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(game_id, player_nickname)
);

-- Rounds in a game
CREATE TABLE IF NOT EXISTS managed_rounds (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES managed_games(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'closed'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(game_id, round_number)
);

-- Picks made in rounds
CREATE TABLE IF NOT EXISTS managed_picks (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES managed_games(id) ON DELETE CASCADE,
    round_id INTEGER NOT NULL REFERENCES managed_rounds(id) ON DELETE CASCADE,
    player_nickname VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    result VARCHAR(50), -- NULL = pending, 'win', 'lose'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(game_id, round_id, player_nickname)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_managed_teams_manager ON managed_teams(manager_email);
CREATE INDEX IF NOT EXISTS idx_managed_players_manager ON managed_players(manager_email);
CREATE INDEX IF NOT EXISTS idx_managed_games_manager ON managed_games(manager_email);
CREATE INDEX IF NOT EXISTS idx_managed_picks_game ON managed_picks(game_id);
CREATE INDEX IF NOT EXISTS idx_managed_picks_round ON managed_picks(round_id);
