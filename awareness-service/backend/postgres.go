package main

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/lib/pq"
)

func InitializePostgres(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	log.Println("Connected to PostgreSQL successfully")
	return db, nil
}

// CreateSchema creates the necessary tables if they don't exist
func CreateSchema(db *sql.DB) error {
	schema := `
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
	`

	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	log.Println("Database schema created/verified successfully")
	return nil
}

// LogPresenceEvent logs a presence event to the database
func LogPresenceEvent(db *sql.DB, userId, eventType, appId, sessionId string) error {
	query := `
	INSERT INTO presence_events (user_id, event_type, app_id, session_id)
	VALUES ($1, $2, $3, $4)
	`

	_, err := db.Exec(query, userId, eventType, appId, sessionId)
	return err
}

// LogSessionEvent logs a session event to the database
func LogSessionEvent(db *sql.DB, sessionId, appId, userId, eventType string) error {
	query := `
	INSERT INTO session_events (session_id, app_id, user_id, event_type)
	VALUES ($1, $2, $3, $4)
	`

	_, err := db.Exec(query, sessionId, appId, userId, eventType)
	return err
}

// GetUserPresenceHistory retrieves presence history for a user
func GetUserPresenceHistory(db *sql.DB, userId string, limit int) ([]PresenceEvent, error) {
	query := `
	SELECT id, user_id, event_type, app_id, session_id, created_at
	FROM presence_events
	WHERE user_id = $1
	ORDER BY created_at DESC
	LIMIT $2
	`

	rows, err := db.Query(query, userId, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []PresenceEvent
	for rows.Next() {
		var event PresenceEvent
		if err := rows.Scan(&event.ID, &event.UserID, &event.EventType, &event.AppID, &event.SessionID, &event.Timestamp); err != nil {
			return nil, err
		}
		events = append(events, event)
	}

	return events, rows.Err()
}

// GetSessionEventHistory retrieves all events for a session
func GetSessionEventHistory(db *sql.DB, sessionId string, limit int) ([]SessionEvent, error) {
	query := `
	SELECT id, session_id, app_id, user_id, event_type, created_at
	FROM session_events
	WHERE session_id = $1
	ORDER BY created_at DESC
	LIMIT $2
	`

	rows, err := db.Query(query, sessionId, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []SessionEvent
	for rows.Next() {
		var event SessionEvent
		if err := rows.Scan(&event.ID, &event.SessionID, &event.AppID, &event.UserID, &event.EventType, &event.Timestamp); err != nil {
			return nil, err
		}
		events = append(events, event)
	}

	return events, rows.Err()
}

// CleanupOldEvents removes events older than specified days
func CleanupOldEvents(db *sql.DB, daysOld int) (int64, error) {
	query := `
	DELETE FROM presence_events
	WHERE created_at < NOW() - INTERVAL '1 day' * $1
	`

	result, err := db.Exec(query, daysOld)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}
