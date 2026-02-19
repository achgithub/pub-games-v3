#!/bin/bash
# Migration: Add guest mode support
# Purpose: Allow public access to specific apps without authentication

set -e

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5555}"
DB_USER="${DB_USER:-activityhub}"
DB_NAME="activity_hub"

echo "🔄 Running guest mode migration on $DB_NAME..."

psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" <<SQL

-- Add guest_accessible column to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guest_accessible BOOLEAN DEFAULT FALSE;

-- Create index for efficient guest access queries
CREATE INDEX IF NOT EXISTS idx_applications_guest ON applications(guest_accessible);

-- Mark leaderboard as guest accessible (example)
UPDATE applications SET guest_accessible = TRUE WHERE id = 'leaderboard';

SQL

echo "✅ Guest mode migration completed successfully"
