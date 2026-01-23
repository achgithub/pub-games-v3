#!/bin/bash
# Database setup for Smoke Test
# Run this on the Pi to create the app's database

set -e

echo "Creating database: smoke_test_db"

sudo -u postgres psql -p 5555 << 'EOF'
-- Create database
CREATE DATABASE smoke_test_db;

-- Grant database privileges to pubgames user
GRANT ALL PRIVILEGES ON DATABASE smoke_test_db TO pubgames;

-- Connect to the database and set schema permissions
\c smoke_test_db

-- Grant schema permissions (required for PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO pubgames;
GRANT CREATE ON SCHEMA public TO pubgames;

-- Set database owner
ALTER DATABASE smoke_test_db OWNER TO pubgames;

EOF

echo "✅ Database smoke_test_db created successfully"
echo "   User 'pubgames' has full access"
