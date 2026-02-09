#!/bin/bash
# Phase A: Add roles column to activity_hub.users table
# Supports role-based access control for admin apps

set -e

echo "🔄 Phase A: Adding roles to users table..."

DB_USER="${DB_USER:-activityhub}"
DB_NAME="${DB_NAME:-activity_hub}"
DB_PORT="${DB_PORT:-5555}"
DB_HOST="${DB_HOST:-127.0.0.1}"

# Run migration
PGPASSWORD="${DB_PASS:-pubgames}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'SQL'

-- Add roles column (text array)
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';

-- Create index for efficient role lookups
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);

-- Migrate existing is_admin users to have setup_admin role
-- (setup_admin can configure system, game_admin manages activities)
UPDATE users
SET roles = ARRAY['setup_admin', 'game_admin']
WHERE is_admin = TRUE
  AND (roles IS NULL OR roles = '{}');

-- Show updated schema
\d users

SQL

if [ $? -eq 0 ]; then
    echo "✅ Roles column added successfully"
    echo ""
    echo "Role types:"
    echo "  - setup_admin: System configuration (Setup Admin App)"
    echo "  - game_admin:  Activity management (Game Admin App)"
    echo "  - (empty):     Regular user"
    echo ""
    echo "Checking users with roles..."
    PGPASSWORD="${DB_PASS:-pubgames}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT email, name, is_admin, roles
    FROM users
    ORDER BY is_admin DESC, email;
    "
else
    echo "❌ Migration failed"
    exit 1
fi
