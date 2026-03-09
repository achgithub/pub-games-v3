-- Sudoku Database Schema v2
-- Migration: Add puzzles library and game progress tracking
-- Run: psql -h localhost -p 5555 -U activityhub -d sudoku_db -f schema_v2.sql

-- Drop old table if exists
DROP TABLE IF EXISTS game_state;

-- Puzzles library table
CREATE TABLE IF NOT EXISTS puzzles (
    id SERIAL PRIMARY KEY,
    puzzle_number INTEGER UNIQUE NOT NULL,  -- User-visible unique ID
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    puzzle_grid JSONB NOT NULL,             -- 9x9 array with clues (0 = empty)
    solution_grid JSONB NOT NULL,           -- 9x9 complete solution
    clue_count INTEGER NOT NULL,            -- Number of given cells
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)                 -- Admin email who created it
);

CREATE INDEX idx_puzzles_difficulty ON puzzles(difficulty);
CREATE INDEX idx_puzzles_number ON puzzles(puzzle_number);

-- Game progress tracking table
CREATE TABLE IF NOT EXISTS game_progress (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    current_state JSONB NOT NULL,          -- 9x9 array with user's progress
    notes JSONB,                            -- Cell notes: {"0-0": [1,2,3], ...}
    completed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(user_id, puzzle_id)
);

CREATE INDEX idx_progress_user ON game_progress(user_id, last_accessed DESC);
CREATE INDEX idx_progress_cleanup ON game_progress(last_accessed) WHERE completed = FALSE;

-- Auto-update trigger for last_accessed
CREATE OR REPLACE FUNCTION update_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_progress_last_accessed
    BEFORE UPDATE ON game_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_last_accessed();

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE puzzles TO activityhub;
GRANT ALL PRIVILEGES ON TABLE game_progress TO activityhub;
GRANT USAGE, SELECT ON SEQUENCE puzzles_id_seq TO activityhub;
GRANT USAGE, SELECT ON SEQUENCE game_progress_id_seq TO activityhub;
