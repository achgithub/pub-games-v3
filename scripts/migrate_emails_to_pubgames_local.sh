#!/bin/bash
# Migration script: Standardize all email addresses to @pubgames.local domain

set -e  # Exit on error

DB_USER="${DB_USER:-pubgames}"
DB_NAME="${DB_NAME:-pubgames}"
DB_PORT="${DB_PORT:-5555}"

echo "🔄 Migrating email addresses to @pubgames.local domain..."
echo "Database: $DB_NAME on port $DB_PORT"
echo ""

# Run migration - create new users, then copy old users with new emails
PGPASSWORD="${DB_PASS:-pubgames}" psql -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" <<'SQL'
BEGIN;

-- Add 5 new test users with bcrypt hash for code "123456"
INSERT INTO users (email, name, code_hash, is_admin) VALUES
('charlie@pubgames.local', 'Charlie', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('diana@pubgames.local', 'Diana', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('ethan@pubgames.local', 'Ethan', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('fiona@pubgames.local', 'Fiona', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false),
('george@pubgames.local', 'George', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', false)
ON CONFLICT (email) DO NOTHING;

-- Copy @test.com users to @pubgames.local (keeps their code_hash)
INSERT INTO users (email, name, code_hash, is_admin)
SELECT
  REPLACE(email, '@test.com', '@pubgames.local'),
  name,
  code_hash,
  is_admin
FROM users
WHERE email LIKE '%@test.com'
ON CONFLICT (email) DO NOTHING;

-- Update challenges to reference new email addresses
UPDATE challenges
SET from_user = REPLACE(from_user, '@test.com', '@pubgames.local')
WHERE from_user LIKE '%@test.com';

UPDATE challenges
SET to_user = REPLACE(to_user, '@test.com', '@pubgames.local')
WHERE to_user LIKE '%@test.com';

-- Delete old @test.com users (challenges now reference new emails)
DELETE FROM users WHERE email LIKE '%@test.com';

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
