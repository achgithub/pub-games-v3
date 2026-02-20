#!/bin/bash
# Migration: Add is_favorite column to user_app_preferences
# Purpose: Allow users to favorite apps in Lobby UI

set -e

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5555}"
DB_USER="${DB_USER:-activityhub}"
DB_NAME="activity_hub"

echo "🔄 Adding is_favorite column to user_app_preferences..."

psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" <<SQL

-- Add is_favorite column if it doesn't exist
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_app_preferences'
        AND column_name = 'is_favorite'
    ) THEN
        ALTER TABLE user_app_preferences ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
    END IF;
END \$\$;

SQL

echo "✅ is_favorite column migration completed successfully"
