package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

var db *sql.DB         // Display admin database
var identityDB *sql.DB // Identity database for authentication

// InitDatabases initializes connections to both databases
func InitDatabases() error {
	var err error

	// Connect to identity database (pubgames)
	identityDB, err = sql.Open("postgres", "host=localhost port=5432 user=pubgames password=pubgames123 dbname=pubgames sslmode=disable")
	if err != nil {
		return fmt.Errorf("failed to connect to identity database: %w", err)
	}

	if err = identityDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping identity database: %w", err)
	}

	log.Println("✅ Connected to identity database (pubgames)")

	// Connect to display admin database
	db, err = sql.Open("postgres", "host=localhost port=5432 user=pubgames password=pubgames123 dbname=display_admin_db sslmode=disable")
	if err != nil {
		return fmt.Errorf("failed to connect to display_admin_db: %w", err)
	}

	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping display_admin_db: %w", err)
	}

	log.Println("✅ Connected to display_admin_db")

	// Create tables
	if err := createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

// createTables creates all required tables if they don't exist
func createTables() error {
	schema := `
	-- Physical displays/TVs
	CREATE TABLE IF NOT EXISTS displays (
		id SERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		location VARCHAR(255),
		description TEXT,
		token UUID UNIQUE NOT NULL,
		is_active BOOLEAN DEFAULT true,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_displays_token ON displays(token);

	-- Content items (images, URLs, announcements, etc.)
	CREATE TABLE IF NOT EXISTS content_items (
		id SERIAL PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		content_type VARCHAR(50) NOT NULL, -- image, url, social_feed, leaderboard, schedule, announcement
		duration_seconds INTEGER NOT NULL DEFAULT 10,

		-- Type-specific fields (use appropriate field based on content_type)
		file_path VARCHAR(500),           -- For image: path to uploaded file
		url TEXT,                          -- For url, social_feed, leaderboard, schedule
		text_content TEXT,                 -- For announcement
		bg_color VARCHAR(20),              -- For announcement background
		text_color VARCHAR(20),            -- For announcement text color

		is_active BOOLEAN DEFAULT true,
		created_by VARCHAR(255),           -- Admin email who created this
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Playlists (ordered sequences of content)
	CREATE TABLE IF NOT EXISTS playlists (
		id SERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		description TEXT,
		is_active BOOLEAN DEFAULT true,
		created_by VARCHAR(255),           -- Admin email
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Links content to playlists with ordering
	CREATE TABLE IF NOT EXISTS playlist_items (
		id SERIAL PRIMARY KEY,
		playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
		content_item_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
		display_order INTEGER NOT NULL,    -- Order within playlist (0, 1, 2, ...)
		override_duration INTEGER,          -- Optional: override content's default duration
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

		UNIQUE(playlist_id, content_item_id)
	);

	CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
	CREATE INDEX IF NOT EXISTS idx_playlist_items_order ON playlist_items(playlist_id, display_order);

	-- Assigns playlists to displays with scheduling
	CREATE TABLE IF NOT EXISTS display_assignments (
		id SERIAL PRIMARY KEY,
		display_id INTEGER NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
		playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
		priority INTEGER DEFAULT 0,        -- Higher priority wins conflicts

		-- Scheduling (NULL = always active)
		start_date DATE,                   -- NULL = no start constraint
		end_date DATE,                     -- NULL = no end constraint
		start_time TIME,                   -- NULL = all day
		end_time TIME,                     -- NULL = all day
		days_of_week VARCHAR(50),          -- Comma-separated: "Mon,Tue,Wed" or NULL for all days

		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_display_assignments_display ON display_assignments(display_id);
	CREATE INDEX IF NOT EXISTS idx_display_assignments_priority ON display_assignments(display_id, priority DESC);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	log.Println("✅ Database tables created/verified")
	return nil
}
