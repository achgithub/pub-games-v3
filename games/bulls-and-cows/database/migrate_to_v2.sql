-- Migration script: Bulls and Cows v1 → v2 (dual-code 2-player mode)
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d bulls_and_cows_db -f games/bulls-and-cows/database/migrate_to_v2.sql

BEGIN;

-- Make solo-only columns nullable (2-player games don't use these)
ALTER TABLE games ALTER COLUMN secret_code DROP NOT NULL;
ALTER TABLE games ALTER COLUMN code_maker DROP NOT NULL;
ALTER TABLE games ALTER COLUMN code_breaker DROP NOT NULL;

-- Add new columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS player1_id VARCHAR(255);
ALTER TABLE games ADD COLUMN IF NOT EXISTS player1_code VARCHAR(10);
ALTER TABLE games ADD COLUMN IF NOT EXISTS player1_code_set BOOLEAN DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS player2_id VARCHAR(255);
ALTER TABLE games ADD COLUMN IF NOT EXISTS player2_code VARCHAR(10);
ALTER TABLE games ADD COLUMN IF NOT EXISTS player2_code_set BOOLEAN DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_turn INTEGER DEFAULT 0;

-- Migrate existing data (solo games)
UPDATE games
SET
    code_breaker = code_breaker,  -- Keep existing
    secret_code = secret_code,    -- Keep existing
    player1_id = NULL,
    player2_id = NULL
WHERE variant = '1player';

-- Update status constraints to include new states
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check
    CHECK (status IN ('code_setting', 'active', 'won', 'draw', 'lost', 'abandoned'));

-- Add new columns to guesses table
ALTER TABLE guesses ADD COLUMN IF NOT EXISTS turn_number INTEGER;
ALTER TABLE guesses ADD COLUMN IF NOT EXISTS player_id VARCHAR(255);

-- Migrate existing guesses (solo games use guess_number as turn_number)
UPDATE guesses
SET
    turn_number = guess_number,
    player_id = (SELECT code_breaker FROM games WHERE games.id = guesses.game_id)
WHERE turn_number IS NULL;

-- Make new columns NOT NULL after migration
ALTER TABLE guesses ALTER COLUMN turn_number SET NOT NULL;
ALTER TABLE guesses ALTER COLUMN player_id SET NOT NULL;

-- Add unique constraint for turn-based guessing
ALTER TABLE guesses DROP CONSTRAINT IF EXISTS guesses_game_turn_player_unique;
ALTER TABLE guesses ADD CONSTRAINT guesses_game_turn_player_unique
    UNIQUE(game_id, turn_number, player_id);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_guesses_player ON guesses(game_id, player_id);

COMMIT;
