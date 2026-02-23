-- LMS Manager DB Schema
-- Standalone administration tool for running Last Man Standing competitions
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE lms_manager_db;"
-- Then: psql -U activityhub -h localhost -p 5555 -d lms_manager_db -f schema.sql

DROP TABLE IF EXISTS managed_picks CASCADE;
DROP TABLE IF EXISTS managed_rounds CASCADE;
DROP TABLE IF EXISTS managed_participants CASCADE;
DROP TABLE IF EXISTS managed_games CASCADE;
DROP TABLE IF EXISTS managed_players CASCADE;
DROP TABLE IF EXISTS managed_teams CASCADE;
DROP TABLE IF EXISTS managed_groups CASCADE;

-- Groups contain teams (e.g., "Premier League 25/26")
-- Manager creates groups and populates with teams manually
CREATE TABLE managed_groups (
  id SERIAL PRIMARY KEY,
  manager_email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Teams belong to a group
-- Auto-allocation uses alphabetical order by team name
CREATE TABLE managed_teams (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES managed_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, name)
);

-- Player pool (reusable across games)
-- Just names, no user accounts - manager maintains their own pool
CREATE TABLE managed_players (
  id SERIAL PRIMARY KEY,
  manager_email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(manager_email, name)
);

-- Games reference a group and have assigned participants
-- All data scoped to manager_email
-- postpone_as_win: if true, postponed matches count as wins; if false, as losses
-- winner_mode: 'single' = only 1 winner, 'multiple' = allow multiple winners
-- rollover_mode: 'round' = un-eliminate current round only, 'game' = void entire game and restart
-- max_winners: maximum winners allowed (only applies when winner_mode = 'multiple')
CREATE TABLE managed_games (
  id SERIAL PRIMARY KEY,
  manager_email TEXT NOT NULL,
  name TEXT NOT NULL,
  group_id INTEGER REFERENCES managed_groups(id),
  status TEXT DEFAULT 'active', -- 'active', 'completed'
  winner_name TEXT,
  postpone_as_win BOOLEAN DEFAULT TRUE,
  winner_mode TEXT DEFAULT 'single', -- 'single' or 'multiple'
  rollover_mode TEXT DEFAULT 'round', -- 'round' or 'game'
  max_winners INTEGER DEFAULT 4,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Participants in a game
-- player_name is just text (not linked to user accounts)
-- is_active tracks elimination status
CREATE TABLE managed_participants (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES managed_games(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  eliminated_in_round INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, player_name)
);

-- Rounds in a game
-- Auto-created as game progresses
CREATE TABLE managed_rounds (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES managed_games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'closed'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, round_number)
);

-- Picks for each round
-- result: 'win' = survive, 'loss'/'draw' = eliminated, 'postponed' = survive (bye)
-- auto_assigned: TRUE if manager used auto-assign feature (lowest rank unused team)
CREATE TABLE managed_picks (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES managed_games(id) ON DELETE CASCADE,
  round_id INTEGER NOT NULL REFERENCES managed_rounds(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  team_id INTEGER REFERENCES managed_teams(id),
  result TEXT, -- 'win', 'loss', 'draw', 'postponed'
  auto_assigned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, round_id, player_name)
);

-- Indexes for quick lookups
CREATE INDEX idx_managed_groups_manager ON managed_groups(manager_email);
CREATE INDEX idx_managed_players_manager ON managed_players(manager_email);
CREATE INDEX idx_managed_games_manager ON managed_games(manager_email);
CREATE INDEX idx_managed_picks_game ON managed_picks(game_id, round_id);
