package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

// InitDatabase initializes PostgreSQL connection
func InitDatabase() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "pubgames")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := getEnv("DB_NAME", "sweepstakes_db")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Initialize schema
	if err := initSchema(db); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return db, nil
}

func initSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS competitions (
		id SERIAL PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('knockout', 'race')),
		status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'open', 'locked', 'completed', 'archived')),
		start_date TIMESTAMP,
		end_date TIMESTAMP,
		description TEXT,
		selection_mode TEXT DEFAULT 'blind',
		blind_box_interval INTEGER DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS entries (
		id SERIAL PRIMARY KEY,
		competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		seed INTEGER,
		number INTEGER,
		status TEXT DEFAULT 'available' CHECK(status IN ('available', 'taken', 'active', 'eliminated', 'winner')),
		stage TEXT,
		eliminated_date TIMESTAMP,
		position INTEGER,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(competition_id, name)
	);

	CREATE TABLE IF NOT EXISTS draws (
		id SERIAL PRIMARY KEY,
		user_id TEXT NOT NULL,
		competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
		entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
		drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_draws_user_comp ON draws(user_id, competition_id);
	CREATE INDEX IF NOT EXISTS idx_entries_comp_status ON entries(competition_id, status);
	CREATE INDEX IF NOT EXISTS idx_entries_comp ON entries(competition_id);
	CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
	`

	_, err := db.Exec(schema)
	return err
}

// GetCompetitions returns all competitions
func GetCompetitions(db *sql.DB) ([]Competition, error) {
	rows, err := db.Query(`
		SELECT id, name, type, status, start_date, end_date, description,
		       selection_mode, blind_box_interval, created_at
		FROM competitions
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var competitions []Competition
	for rows.Next() {
		var c Competition
		var startDate, endDate sql.NullTime
		var description sql.NullString

		err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.Status, &startDate, &endDate,
			&description, &c.SelectionMode, &c.BlindBoxInterval, &c.CreatedAt)
		if err != nil {
			log.Printf("Error scanning competition: %v", err)
			continue
		}

		if startDate.Valid {
			c.StartDate = &startDate.Time
		}
		if endDate.Valid {
			c.EndDate = &endDate.Time
		}
		if description.Valid {
			c.Description = description.String
		}

		competitions = append(competitions, c)
	}

	return competitions, rows.Err()
}

// GetEntriesForCompetition returns all entries for a competition
func GetEntriesForCompetition(db *sql.DB, competitionID int) ([]Entry, error) {
	rows, err := db.Query(`
		SELECT id, competition_id, name, seed, number, status, position, created_at
		FROM entries
		WHERE competition_id = ?
		ORDER BY
			CASE WHEN status = 'winner' THEN 0
				 WHEN status = 'active' THEN 1
				 WHEN status = 'eliminated' THEN 2
				 WHEN status = 'taken' THEN 3
				 WHEN status = 'available' THEN 4 END,
			COALESCE(position, 999),
			COALESCE(seed, 999),
			COALESCE(number, 999),
			name
	`, competitionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var e Entry
		var seed, number, position sql.NullInt64

		err := rows.Scan(&e.ID, &e.CompetitionID, &e.Name, &seed, &number, &e.Status, &position, &e.CreatedAt)
		if err != nil {
			log.Printf("Error scanning entry: %v", err)
			continue
		}

		if seed.Valid {
			seedVal := int(seed.Int64)
			e.Seed = &seedVal
		}
		if number.Valid {
			numVal := int(number.Int64)
			e.Number = &numVal
		}
		if position.Valid {
			posVal := int(position.Int64)
			e.Position = &posVal
		}

		entries = append(entries, e)
	}

	return entries, rows.Err()
}
