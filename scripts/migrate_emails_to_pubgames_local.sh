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

-- Add 5 additional test users with random names
INSERT INTO users (email, name, is_admin) VALUES
('charlie@pubgames.local', 'Charlie', false),
('diana@pubgames.local', 'Diana', false),
('ethan@pubgames.local', 'Ethan', false),
('fiona@pubgames.local', 'Fiona', false),
('george@pubgames.local', 'George', false)
ON CONFLICT (email) DO NOTHING;

COMMIT;

-- Show final result
SELECT email, name, is_admin FROM users ORDER BY email;
SQL

echo ""
echo "✅ Migration complete!"
echo ""
echo "Available test users:"
echo "  Admin:   demo-token-admin@pubgames.local"
echo "  Regular: demo-token-test@pubgames.local"
echo "  Alice:   demo-token-alice@pubgames.local"
echo "  Bob:     demo-token-bob@pubgames.local"
echo "  Charlie: demo-token-charlie@pubgames.local"
echo "  Diana:   demo-token-diana@pubgames.local"
echo "  Ethan:   demo-token-ethan@pubgames.local"
echo "  Fiona:   demo-token-fiona@pubgames.local"
echo "  George:  demo-token-george@pubgames.local"
