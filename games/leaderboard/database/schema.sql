-- Leaderboard Database Schema
-- Database: leaderboard_db

-- Game results table - stores every completed game
CREATE TABLE IF NOT EXISTS game_results (
    id SERIAL PRIMARY KEY,
    game_type VARCHAR(50) NOT NULL,
    game_id VARCHAR(100) NOT NULL UNIQUE,
    winner_id VARCHAR(255),
    winner_name VARCHAR(255),
    loser_id VARCHAR(255),
    loser_name VARCHAR(255),
    is_draw BOOLEAN DEFAULT FALSE,
    score VARCHAR(20),
    duration INT DEFAULT 0,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_game_results_game_type ON game_results(game_type);
CREATE INDEX IF NOT EXISTS idx_game_results_winner ON game_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_game_results_loser ON game_results(loser_id);
CREATE INDEX IF NOT EXISTS idx_game_results_played_at ON game_results(played_at DESC);
