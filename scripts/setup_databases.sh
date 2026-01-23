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

# Create database (as postgres user)
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'pubgames'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE pubgames;"

# Create user if doesn't exist (use 'pubgames' as password - change in production)
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = 'pubgames'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER pubgames WITH PASSWORD 'pubgames';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE pubgames TO pubgames;"

echo "✅ PostgreSQL database 'pubgames' created"

# Enable TCP/IP connections for localhost (needed for password authentication)
echo "📝 Configuring PostgreSQL for TCP/IP connections..."
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Check if localhost md5 auth already exists
if ! sudo grep -q "^host.*pubgames.*127.0.0.1/32.*md5" "$PG_HBA"; then
    echo "host    pubgames    pubgames    127.0.0.1/32    md5" | sudo tee -a "$PG_HBA" > /dev/null
    sudo systemctl reload postgresql
    echo "✅ TCP/IP authentication configured"
else
    echo "✅ TCP/IP authentication already configured"
fi

# Run schema initialization
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
    echo "📋 Initializing schema..."
    cat "$SCHEMA_FILE" | sudo -u postgres psql -p 5555 -d pubgames

    # Grant all permissions to pubgames user
    echo "🔑 Granting table permissions to pubgames user..."
    sudo -u postgres psql -p 5555 -d pubgames -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pubgames;"
    sudo -u postgres psql -p 5555 -d pubgames -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pubgames;"

    echo "✅ Schema initialized with permissions"
else
    echo "⚠️  schema.sql not found, skipping schema initialization"
fi

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
echo "  - Database: pubgames"
echo "  - User: pubgames"
echo "  - Password: pubgames (CHANGE THIS IN PRODUCTION)"
echo "  - Port: 5555"
echo "  - Connection: postgresql://pubgames:pubgames@127.0.0.1:5555/pubgames"
echo ""
echo "Redis:"
echo "  - Running on default port 6379"
echo "  - Connection: localhost:6379"
echo ""
echo "Next steps:"
echo "  1. Update your .env or config files with database credentials"
echo "  2. Build and run your services"
