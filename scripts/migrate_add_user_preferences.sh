#!/bin/bash
# Migration: Add user app preferences
# Purpose: Allow users to hide/reorder apps via Settings UI

set -e

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5555}"
DB_USER="${DB_USER:-activityhub}"
DB_NAME="activity_hub"

echo "🔄 Running user preferences migration on $DB_NAME..."

psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" <<SQL

-- User app preferences for hiding/reordering apps
CREATE TABLE IF NOT EXISTS user_app_preferences (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    app_id VARCHAR(50) NOT NULL,
    is_hidden BOOLEAN DEFAULT FALSE,
    custom_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, app_id)
);

CREATE INDEX IF NOT EXISTS idx_user_app_prefs_user ON user_app_preferences(user_email);

SQL

echo "✅ User preferences migration completed successfully"
