#!/bin/bash
# Phase B: Create applications table and migrate from apps.json
# Enables dynamic app registry with role-based visibility

set -e

echo "🔄 Phase B: Creating applications table..."

DB_USER="${DB_USER:-activityhub}"
DB_NAME="${DB_NAME:-activity_hub}"
DB_PORT="${DB_PORT:-5555}"
DB_HOST="${DB_HOST:-127.0.0.1}"

# Run migration
PGPASSWORD="${DB_PASS:-pubgames}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'SQL'

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('internal', 'iframe')),
    description TEXT,
    category VARCHAR(20) NOT NULL CHECK (category IN ('game', 'utility', 'admin')),
    url VARCHAR(255),
    backend_port INTEGER,
    realtime VARCHAR(20) DEFAULT 'none',
    min_players INTEGER,
    max_players INTEGER,
    required_roles TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for enabled apps
CREATE INDEX IF NOT EXISTS idx_applications_enabled ON applications(enabled);

-- Create index for category
CREATE INDEX IF NOT EXISTS idx_applications_category ON applications(category);

-- Create index for display order
CREATE INDEX IF NOT EXISTS idx_applications_display_order ON applications(display_order);

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_applications_roles ON applications USING GIN(required_roles);

-- Seed with existing apps from apps.json
INSERT INTO applications (id, name, icon, type, description, category, url, backend_port, realtime, display_order, required_roles) VALUES
    ('lobby', 'Lobby', '🏠', 'internal', 'View online users and challenges', 'utility', NULL, NULL, NULL, 1, '{}'),
    ('tic-tac-toe', 'Tic-Tac-Toe', '⭕', 'iframe', 'Classic grid game - first to 3 wins!', 'game', 'http://{host}:4001', 4001, 'sse', 2, '{}'),
    ('dots', 'Dots & Boxes', '🔵', 'iframe', 'Connect the dots, complete the boxes!', 'game', 'http://{host}:4011', 4011, 'sse', 3, '{}'),
    ('spoof', 'Spoof', '🪙', 'iframe', 'Guess the total coins - 3-6 player coin game', 'game', 'http://{host}:4051', 4051, 'sse', 4, '{}'),
    ('smoke-test', 'Smoke Test', '🧪', 'iframe', 'Template validation and smoke testing', 'utility', 'http://{host}:5010', 5010, 'none', 5, '{}'),
    ('sweepstakes', 'Sweepstakes', '🎁', 'iframe', 'Draw competitions and blind box selections', 'game', 'http://{host}:4031', 4031, 'none', 6, '{}'),
    ('leaderboard', 'Leaderboard', '🏆', 'iframe', 'Game standings and statistics', 'utility', 'http://{host}:5030', 5030, 'none', 7, '{}'),
    ('season-scheduler', 'Season Scheduler', '🗓️', 'iframe', 'Schedule pub league seasons for Darts, Pool, and Crib', 'utility', 'http://{host}:5040', 5040, 'none', 8, '{}')
ON CONFLICT (id) DO NOTHING;

-- Add minPlayers and maxPlayers for Spoof
UPDATE applications SET min_players = 3, max_players = 6 WHERE id = 'spoof';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Show created table
\d applications

SQL

if [ $? -eq 0 ]; then
    echo "✅ Applications table created successfully"
    echo ""
    echo "Features:"
    echo "  - Dynamic app registry (no code changes needed)"
    echo "  - Role-based visibility (required_roles)"
    echo "  - Enable/disable apps without deletion"
    echo "  - Custom display ordering"
    echo "  - Auto-updating timestamps"
    echo ""
    echo "Checking seeded applications..."
    PGPASSWORD="${DB_PASS:-pubgames}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT id, name, category, enabled, required_roles, display_order
    FROM applications
    ORDER BY display_order;
    "
else
    echo "❌ Migration failed"
    exit 1
fi
