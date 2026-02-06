-- Spoof Game Database Schema
-- Database: spoof_db
-- Port: 5555
-- User: pubgames

-- Games table - stores game metadata and final state
CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(255) PRIMARY KEY,
    challenge_id VARCHAR(255) NOT NULL,
    players JSONB NOT NULL,                    -- Array of player info
    status VARCHAR(50) NOT NULL,                -- coin_selection, guessing, reveal, finished
    winner_id VARCHAR(255),                     -- Email of winner
    started_at BIGINT NOT NULL,                 -- Unix timestamp
    updated_at BIGINT NOT NULL,                 -- Unix timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

-- Round history table - stores each round's results
CREATE TABLE IF NOT EXISTS round_history (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    winner_id VARCHAR(255),                     -- Who guessed correctly (if any)
    eliminated_id VARCHAR(255),                 -- Who was eliminated (if any)
    total_coins INT NOT NULL,                   -- Actual total coins in play
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_challenge_id ON games(challenge_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_started_at ON games(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_round_history_game_id ON round_history(game_id);

-- Comments
COMMENT ON TABLE games IS 'Spoof game metadata and final results';
COMMENT ON TABLE round_history IS 'Round-by-round history for each game';
COMMENT ON COLUMN games.players IS 'JSONB array of player objects with id, name, coinsRemaining, etc.';
COMMENT ON COLUMN games.status IS 'Current game status: coin_selection, guessing, reveal, finished';
COMMENT ON COLUMN round_history.winner_id IS 'Player who guessed correctly (NULL if no winner)';
COMMENT ON COLUMN round_history.eliminated_id IS 'Player eliminated for having 0 coins (NULL if someone won)';
