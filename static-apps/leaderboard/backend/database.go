package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

func getEnvDB(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// InitDatabase initializes the PostgreSQL connection and creates tables
func InitDatabase() (*sql.DB, error) {
	host := getEnvDB("DB_HOST", "127.0.0.1")
	port := getEnvDB("DB_PORT", "5555")
	user := getEnvDB("DB_USER", "pubgames")
	password := getEnvDB("DB_PASS", "pubgames")
	dbname := getEnvDB("DB_NAME", "leaderboard_db")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	if err := createTables(db); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return db, nil
}

// InitIdentityDatabase initializes connection to the identity database (for authentication)
func InitIdentityDatabase() (*sql.DB, error) {
	host := getEnvDB("IDENTITY_DB_HOST", "127.0.0.1")
	port := getEnvDB("IDENTITY_DB_PORT", "5555")
	user := getEnvDB("IDENTITY_DB_USER", "pubgames")
	password := getEnvDB("IDENTITY_DB_PASS", "pubgames")
	dbname := getEnvDB("IDENTITY_DB_NAME", "pubgames")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	identityDB, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open identity database: %w", err)
	}

	if err := identityDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping identity database: %w", err)
	}

	return identityDB, nil
}

func createTables(db *sql.DB) error {
	schema := `
	-- Game results table - stores every completed game
	CREATE TABLE IF NOT EXISTS game_results (
		id SERIAL PRIMARY KEY,
		game_type VARCHAR(50) NOT NULL,
		game_id VARCHAR(100) NOT NULL UNIQUE,
		winner_id VARCHAR(255),
		winner_name VARCHAR(255),
		loser_id VARCHAR(255),
		loser_name VARCHAR(255),
		is_draw BOOLEAN DEFAULT FALSE,
		score VARCHAR(20),
		duration INT DEFAULT 0,
		played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Index for querying by game type
	CREATE INDEX IF NOT EXISTS idx_game_results_game_type ON game_results(game_type);

	-- Index for querying by player
	CREATE INDEX IF NOT EXISTS idx_game_results_winner ON game_results(winner_id);
	CREATE INDEX IF NOT EXISTS idx_game_results_loser ON game_results(loser_id);

	-- Index for recent games
	CREATE INDEX IF NOT EXISTS idx_game_results_played_at ON game_results(played_at DESC);
	`

	_, err := db.Exec(schema)
	return err
}
