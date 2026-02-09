#!/bin/bash
# Database setup for Setup Admin App
# Run this on the Pi to create the app's database

set -e

echo "Creating database: setup_admin_db"

sudo -u postgres psql -p 5555 << 'EOF'
-- Create database
CREATE DATABASE setup_admin_db;

-- Grant database privileges to activityhub user
GRANT ALL PRIVILEGES ON DATABASE setup_admin_db TO activityhub;

-- Connect to the database and set schema permissions
\c setup_admin_db

-- Grant schema permissions (required for PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO activityhub;
GRANT CREATE ON SCHEMA public TO activityhub;

-- Set database owner
ALTER DATABASE setup_admin_db OWNER TO activityhub;

EOF

echo "✅ Database setup_admin_db created successfully"
echo "   User 'activityhub' has full access"

# Apply schema
echo "📋 Applying schema..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/../games/setup-admin/database/schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
    psql -U activityhub -p 5555 -d setup_admin_db -f "$SCHEMA_FILE"
    echo "✅ Schema applied"
else
    echo "⚠️  Schema file not found: $SCHEMA_FILE"
fi
