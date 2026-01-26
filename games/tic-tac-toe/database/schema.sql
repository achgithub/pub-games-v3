-- Tic-Tac-Toe Database Schema
-- Run: sudo -u postgres psql -p 5555 -d tictactoe_db -f schema.sql
--
-- NOTE: If updating from integer IDs to string IDs (email), drop tables first:
-- DROP TABLE IF EXISTS moves, games, player_stats CASCADE;

-- Games table (completed games, history)
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    challenge_id VARCHAR(100),
    player1_id VARCHAR(255) NOT NULL,
    player1_name VARCHAR(100) NOT NULL,
    player2_id VARCHAR(255) NOT NULL,
    player2_name VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    winner_id VARCHAR(255),
    move_time_limit INTEGER DEFAULT 0,
    first_to INTEGER NOT NULL,
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    total_rounds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Moves table (for game history/replay)
CREATE TABLE IF NOT EXISTS moves (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL,
    symbol VARCHAR(1) NOT NULL,
    move_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
    user_id VARCHAR(255) PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    games_draw INTEGER DEFAULT 0,
    total_moves INTEGER DEFAULT 0,
    fastest_win_moves INTEGER,
    last_played TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_games_challenge ON games(challenge_id);
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_player ON moves(player_id);

-- Grant permissions to pubgames user
GRANT ALL ON ALL TABLES IN SCHEMA public TO pubgames;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO pubgames;

-- Grant on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pubgames;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pubgames;
