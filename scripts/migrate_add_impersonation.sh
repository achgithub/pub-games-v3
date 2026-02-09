#!/bin/bash
# Migration: Add impersonation session tracking
# Purpose: Track when super_users impersonate other users for audit purposes

set -e

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5555}"
DB_USER="${DB_USER:-activityhub}"
DB_NAME="activity_hub"

echo "🔄 Running impersonation migration on $DB_NAME..."

psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" <<SQL

-- Track impersonation sessions for audit
CREATE TABLE IF NOT EXISTS impersonation_sessions (
    id SERIAL PRIMARY KEY,
    super_user_email VARCHAR(255) NOT NULL,
    impersonated_email VARCHAR(255) NOT NULL,
    original_token TEXT NOT NULL,
    impersonation_token TEXT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_impersonation_active ON impersonation_sessions(super_user_email, is_active);
CREATE INDEX IF NOT EXISTS idx_impersonation_token ON impersonation_sessions(impersonation_token);

SQL

echo "✅ Impersonation migration completed successfully"
