-- PubGames V3 Database Schema
-- PostgreSQL

-- Users table - Core identity
CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User presence tracking - Real-time status
CREATE TABLE IF NOT EXISTS user_presence (
    email TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('online', 'in_game', 'away')),
    current_app TEXT,
    last_seen TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON user_presence(last_seen);

-- Seed data: Admin user with code "123456"
-- Password hash for "123456" using bcrypt (generated via Go bcrypt.GenerateFromPassword)
INSERT INTO users (email, name, code_hash, is_admin)
VALUES (
    'admin@pubgames.local',
    'Admin User',
    '$2a$10$uwXWNdFfI9GWqzaGuh3PPunUuKmK52mjpLihTmr5cMlwOEJlmTRd6', -- bcrypt hash of "123456"
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Test user
INSERT INTO users (email, name, code_hash, is_admin)
VALUES (
    'test@pubgames.local',
    'Test User',
    '$2a$10$uwXWNdFfI9GWqzaGuh3PPunUuKmK52mjpLihTmr5cMlwOEJlmTRd6', -- bcrypt hash of "123456"
    FALSE
)
ON CONFLICT (email) DO NOTHING;

-- Display initialization complete
DO $$
BEGIN
    RAISE NOTICE '✅ Schema initialized successfully';
    RAISE NOTICE 'Default users created:';
    RAISE NOTICE '  - admin@pubgames.local / 123456 (admin)';
    RAISE NOTICE '  - test@pubgames.local / 123456 (user)';
END $$;
