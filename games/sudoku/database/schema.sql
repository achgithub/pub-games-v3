-- Sudoku Database Schema

-- Game state table (saves user progress)
CREATE TABLE IF NOT EXISTS game_state (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    puzzle JSONB NOT NULL,           -- 9x9 array of initial puzzle
    current_state JSONB NOT NULL,    -- 9x9 array of current state
    elapsed_time INTEGER DEFAULT 0,  -- Seconds elapsed
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Index for quick user lookup
CREATE INDEX IF NOT EXISTS idx_game_state_user ON game_state(user_id);
CREATE INDEX IF NOT EXISTS idx_game_state_completed ON game_state(completed, created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_state_updated_at BEFORE UPDATE ON game_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
-- (Will be granted to activityhub user during setup)

-- Register app in activity_hub.applications table
INSERT INTO applications (
    id,
    name,
    icon,
    type,
    description,
    category,
    url,
    backend_port,
    realtime,
    min_players,
    max_players,
    required_roles,
    enabled,
    display_order,
    guest_accessible
) VALUES (
    'sudoku',
    'Sudoku',
    '🔢',
    'iframe',
    'Classic puzzle game - fill the 9x9 grid',
    'game',
    'http://{host}:4081',
    4081,
    'none',
    1,
    1,
    '{}',  -- Public app (no role requirements)
    true,
    60,
    true   -- Guest accessible
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    url = EXCLUDED.url,
    backend_port = EXCLUDED.backend_port,
    guest_accessible = EXCLUDED.guest_accessible,
    updated_at = CURRENT_TIMESTAMP;
