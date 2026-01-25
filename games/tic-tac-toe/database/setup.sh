#!/bin/bash

# Tic-Tac-Toe Database Setup Script
# Run on Pi: ./setup.sh

set -e

DB_PORT="${DB_PORT:-5555}"
DB_NAME="tictactoe_db"
DB_USER="pubgames"
DB_PASS="pubgames"

echo "🎮 Tic-Tac-Toe Database Setup"
echo "=============================="
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Create database
echo "📦 Creating database..."
sudo -u postgres psql -p $DB_PORT -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database exists"

# Create user
echo "👤 Creating user..."
sudo -u postgres psql -p $DB_PORT -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "User exists"

# Run schema
echo "📋 Creating tables..."
cat "$(dirname "$0")/schema.sql" | sudo -u postgres psql -p $DB_PORT -d $DB_NAME

# Grant permissions
echo "🔐 Granting permissions..."
sudo -u postgres psql -p $DB_PORT -d $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -p $DB_PORT -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
sudo -u postgres psql -p $DB_PORT -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Test with: curl http://localhost:4001/api/health"
