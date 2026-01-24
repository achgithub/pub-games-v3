#!/bin/bash

# Tic-Tac-Toe Database Migration
# Creates tictactoe_db and required tables

set -e

# Configuration
DB_USER="${DB_USER:-pubgames}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5555}"
DB_NAME="tictactoe_db"

echo "🎮 Tic-Tac-Toe Database Migration"
echo "=================================="
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Database: $DB_NAME"
echo ""

# Create database if it doesn't exist
echo "📦 Creating database..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "✅ Database ready"
echo ""

# Create tables
echo "📋 Creating tables..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF

-- Games table (completed games, history)
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    challenge_id INTEGER,  -- References identity-shell challenges table
    player1_id INTEGER NOT NULL,
    player1_name VARCHAR(100) NOT NULL,
    player2_id INTEGER NOT NULL,
    player2_name VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,  -- 'normal' or 'timed'
    status VARCHAR(20) NOT NULL,  -- 'completed' or 'abandoned'
    winner_id INTEGER,  -- NULL for draw
    move_time_limit INTEGER DEFAULT 0,  -- Seconds (0 = unlimited)
    first_to INTEGER NOT NULL,  -- 1, 2, 3, 5, 10, or 20
    player1_score INTEGER DEFAULT 0,  -- Wins in this series
    player2_score INTEGER DEFAULT 0,  -- Wins in this series
    total_rounds INTEGER DEFAULT 0,  -- Total rounds played
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Moves table (for game history/replay)
CREATE TABLE IF NOT EXISTS moves (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL,
    position INTEGER NOT NULL,  -- 0-8 (board position)
    symbol VARCHAR(1) NOT NULL,  -- 'X' or 'O'
    move_number INTEGER NOT NULL,  -- 1, 2, 3, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
    user_id INTEGER PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    games_draw INTEGER DEFAULT 0,
    total_moves INTEGER DEFAULT 0,
    fastest_win_moves INTEGER,  -- Fewest moves to win
    last_played TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_challenge ON games(challenge_id);
CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_player ON moves(player_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

EOF

echo "✅ Tables created successfully"
echo ""

# Verify tables
echo "📊 Verifying tables..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\dt"
echo ""

echo "🎉 Tic-Tac-Toe database migration complete!"
echo ""
echo "Database: $DB_NAME"
echo "Tables: games, moves, player_stats"
echo ""
echo "Next: Start tic-tac-toe backend with DB_NAME=tictactoe_db"
