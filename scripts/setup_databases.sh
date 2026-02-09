#!/bin/bash
# Setup databases for PubGames V3
# Run this on the Raspberry Pi

set -e

echo "🔧 Setting up PubGames V3 databases..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed"
    echo "Install with: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo "❌ Redis is not installed"
    echo "Install with: sudo apt-get install redis-server"
    exit 1
fi

# PostgreSQL setup
echo ""
echo "📊 Setting up PostgreSQL..."

# Create user if doesn't exist (use 'pubgames' as password - change in production)
sudo -u postgres psql -p 5555 -tc "SELECT 1 FROM pg_user WHERE usename = 'activityhub'" | grep -q 1 || \
    sudo -u postgres psql -p 5555 -c "CREATE USER activityhub WITH PASSWORD 'pubgames';"

# Grant CREATEDB privilege so user can create databases for new apps
sudo -u postgres psql -p 5555 -c "ALTER USER activityhub CREATEDB;"

echo "✅ PostgreSQL user 'activityhub' configured with CREATEDB privilege"

# List of all databases needed by apps
DATABASES="activity_hub tictactoe_db dots_db leaderboard_db season_scheduler_db"

for DB in $DATABASES; do
    if sudo -u postgres psql -p 5555 -tc "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1; then
        echo "  ✓ Database '$DB' already exists"
    else
        sudo -u postgres psql -p 5555 -c "CREATE DATABASE $DB OWNER activityhub;"
        echo "  ✓ Database '$DB' created"
    fi
done

echo "✅ All databases created"

# Enable TCP/IP connections for localhost (needed for password authentication)
echo "📝 Configuring PostgreSQL for TCP/IP connections..."
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Check if localhost md5 auth already exists for all databases
if ! sudo grep -q "^host.*all.*activityhub.*127.0.0.1/32.*md5" "$PG_HBA"; then
    echo "host    all    activityhub    127.0.0.1/32    md5" | sudo tee -a "$PG_HBA" > /dev/null
    sudo systemctl reload postgresql
    echo "✅ TCP/IP authentication configured for all databases"
else
    echo "✅ TCP/IP authentication already configured"
fi

# Run schema initialization for identity shell (main pubgames db)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
    echo "📋 Initializing identity shell schema..."
    cat "$SCHEMA_FILE" | sudo -u postgres psql -p 5555 -d activity_hub

    # Grant all permissions to activityhub user
    echo "🔑 Granting table permissions to activityhub user..."
    sudo -u postgres psql -p 5555 -d activity_hub -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO activityhub;"
    sudo -u postgres psql -p 5555 -d activity_hub -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO activityhub;"

    echo "✅ Identity shell schema initialized"
else
    echo "⚠️  schema.sql not found, skipping identity shell schema"
fi

echo ""
echo "📋 Note: Game tables are created automatically on first app startup"

# Redis setup
echo ""
echo "📊 Setting up Redis..."

# Check if Redis is running
if sudo systemctl is-active --quiet redis-server; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis is not running. Starting..."
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
    echo "✅ Redis started and enabled"
fi

# Test Redis connection
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
    exit 1
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "PostgreSQL:"
echo "  - User: activityhub (with CREATEDB privilege)"
echo "  - Password: pubgames (CHANGE THIS IN PRODUCTION)"
echo "  - Port: 5555"
echo "  - Databases:"
echo "      activity_hub          - Identity Shell"
echo "      tictactoe_db          - Tic-Tac-Toe"
echo "      dots_db               - Dots & Boxes"
echo "      leaderboard_db        - Leaderboard"
echo "      season_scheduler_db   - Season Scheduler"
echo ""
echo "Redis:"
echo "  - Running on default port 6379"
echo "  - Connection: localhost:6379"
echo ""
echo "Next steps:"
echo "  ./start_services.sh"
