-- Migration: Add Players & Groups Management
-- Date: 2026-03-06
-- Purpose: Central registry for players and groups that LMS/Sweepstakes can import

-- Global player pool (reusable across all games)
CREATE TABLE IF NOT EXISTS managed_players (
    id SERIAL PRIMARY KEY,
    manager_email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(manager_email, name)
);

-- Groups for organizing teams
CREATE TABLE IF NOT EXISTS managed_groups (
    id SERIAL PRIMARY KEY,
    manager_email TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(manager_email, name)
);

CREATE INDEX IF NOT EXISTS idx_managed_players_manager ON managed_players(manager_email);
CREATE INDEX IF NOT EXISTS idx_managed_groups_manager ON managed_groups(manager_email);
