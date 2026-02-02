#!/bin/bash
# Migration script: Standardize all email addresses to @pubgames.local domain

set -e  # Exit on error

DB_USER="${DB_USER:-pubgames}"
DB_NAME="${DB_NAME:-pubgames}"
DB_PORT="${DB_PORT:-5555}"

echo "🔄 Migrating email addresses to @pubgames.local domain..."
echo "Database: $DB_NAME on port $DB_PORT"
echo ""

# Run migration - drop FK constraints, update, recreate constraints
PGPASSWORD="${DB_PASS:-pubgames}" psql -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" <<'SQL'
BEGIN;

-- Drop foreign key constraints temporarily
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_from_user_fkey;
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_to_user_fkey;

-- Update users table first
UPDATE users
SET email = REPLACE(email, '@test.com', '@pubgames.local')
WHERE email LIKE '%@test.com';

-- Update challenges table to match
UPDATE challenges
SET from_user = REPLACE(from_user, '@test.com', '@pubgames.local')
WHERE from_user LIKE '%@test.com';

UPDATE challenges
SET to_user = REPLACE(to_user, '@test.com', '@pubgames.local')
WHERE to_user LIKE '%@test.com';

-- Recreate foreign key constraints
ALTER TABLE challenges ADD CONSTRAINT challenges_from_user_fkey
  FOREIGN KEY (from_user) REFERENCES users(email) ON DELETE CASCADE;

ALTER TABLE challenges ADD CONSTRAINT challenges_to_user_fkey
  FOREIGN KEY (to_user) REFERENCES users(email) ON DELETE CASCADE;

-- Add 5 additional test users with bcrypt hash for code "123456"
INSERT INTO users (email, name, code_hash, is_admin) VALUES
('charlie@pubgames.local', 'Charlie', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('diana@pubgames.local', 'Diana', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('ethan@pubgames.local', 'Ethan', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('fiona@pubgames.local', 'Fiona', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('george@pubgames.local', 'George', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false)
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
