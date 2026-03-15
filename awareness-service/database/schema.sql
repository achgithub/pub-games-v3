-- Awareness Service Database Schema

-- Presence events tracking
CREATE TABLE IF NOT EXISTS presence_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    app_id VARCHAR(100),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presence_events_user_id ON presence_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_presence_events_app_session ON presence_events(app_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_presence_events_type ON presence_events(event_type, created_at);

-- Session events tracking
CREATE TABLE IF NOT EXISTS session_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    app_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_events_id ON session_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_session_events_app_user ON session_events(app_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(event_type, created_at);

-- Cleanup old events (can be run periodically)
-- DELETE FROM presence_events WHERE created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM session_events WHERE created_at < NOW() - INTERVAL '30 days';
