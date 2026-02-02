#!/bin/bash
# Migration script: Standardize all email addresses to @pubgames.local domain

set -e  # Exit on error

DB_USER="${DB_USER:-pubgames}"
DB_NAME="${DB_NAME:-pubgames}"
DB_PORT="${DB_PORT:-5555}"

echo "🔄 Migrating email addresses to @pubgames.local domain..."
echo "Database: $DB_NAME on port $DB_PORT"
echo ""

# Run migration in a single transaction with deferred constraints
PGPASSWORD="${DB_PASS:-pubgames}" psql -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" <<'SQL'
BEGIN;

-- Defer constraint checking until commit
SET CONSTRAINTS ALL DEFERRED;

-- Update challenges table first
UPDATE challenges
SET from_user = REPLACE(from_user, '@test.com', '@pubgames.local')
WHERE from_user LIKE '%@test.com';

UPDATE challenges
SET to_user = REPLACE(to_user, '@test.com', '@pubgames.local')
WHERE to_user LIKE '%@test.com';

-- Remove duplicate admin user if exists
DELETE FROM users WHERE email = 'admin@pubgames.local';

-- Update users table
UPDATE users
SET email = REPLACE(email, '@test.com', '@pubgames.local')
WHERE email LIKE '%@test.com';

COMMIT;

-- Show final result
SELECT email, name, is_admin FROM users ORDER BY email;
SQL

echo ""
echo "✅ Migration complete!"
echo ""
echo "Updated tokens:"
echo "  Regular user: demo-token-test@pubgames.local"
echo "  Admin user:   demo-token-admin@pubgames.local"
echo "  Alice:        demo-token-alice@pubgames.local"
echo "  Bob:          demo-token-bob@pubgames.local"
