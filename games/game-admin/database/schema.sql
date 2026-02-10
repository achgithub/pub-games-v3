-- Game Admin DB Schema
-- Run on Pi: psql -U activityhub -h localhost -p 5555 -d game_admin_db -f schema.sql

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    admin_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
