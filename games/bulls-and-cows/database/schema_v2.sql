-- Bulls and Cows Database Schema v2
-- Dual-code simultaneous 2-player mode

-- Games table for dual-code 2-player
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('colors', 'numbers')),
    variant VARCHAR(20) NOT NULL CHECK (variant IN ('1player', '2player')),

    -- Solo play fields (variant='1player')
    secret_code VARCHAR(10),  -- AI-generated code for solo play
    code_breaker VARCHAR(255),  -- Player email for solo play

    -- 2-player fields (variant='2player')
    player1_id VARCHAR(255),  -- Challenger (code maker + breaker)
    player1_code VARCHAR(10),  -- Player 1's secret code
    player1_code_set BOOLEAN DEFAULT false,  -- Has player 1 set their code?

    player2_id VARCHAR(255),  -- Accepter (code maker + breaker)
    player2_code VARCHAR(10),  -- Player 2's secret code
    player2_code_set BOOLEAN DEFAULT false,  -- Has player 2 set their code?

    current_turn INTEGER DEFAULT 0,  -- Current turn number (0 = code setting, 1-12 = gameplay)
    max_guesses INTEGER DEFAULT 12,

    status VARCHAR(20) DEFAULT 'code_setting' CHECK (status IN ('code_setting', 'active', 'won', 'draw', 'abandoned')),
    winner VARCHAR(255),  -- 'player1', 'player2', 'draw', or NULL

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_code_breaker ON games(code_breaker);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);

-- Guesses table for turn-based dual guessing
CREATE TABLE IF NOT EXISTS guesses (
    id SERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,  -- Which turn (1-12)
    player_id VARCHAR(255) NOT NULL,  -- Who made this guess (player1_id or player2_id)
    guess_code VARCHAR(10) NOT NULL,  -- What they guessed
    bulls INTEGER NOT NULL,  -- Bulls feedback (0-4 for colors, 0-5 for numbers)
    cows INTEGER NOT NULL,   -- Cows feedback
    guessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure each player can only guess once per turn
    UNIQUE(game_id, turn_number, player_id)
);

CREATE INDEX IF NOT EXISTS idx_guesses_game ON guesses(game_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_guesses_player ON guesses(game_id, player_id);

-- Auto-update trigger for games.updated_at
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS games_updated_at ON games;
CREATE TRIGGER games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_games_updated_at();
