package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

// InitDatabase initializes a PostgreSQL connection to an app-specific database.
// The database name is constructed as {appName}_db (e.g., "tictactoe_db").
//
// Usage:
//   appDB, err := database.InitDatabase("tictactoe")
//   if err != nil {
//       log.Fatal(err)
//   }
//   defer appDB.Close()
func InitDatabase(appName string) (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "activityhub")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := fmt.Sprintf("%s_db", appName)

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database %s: %w", dbName, err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database %s: %w", dbName, err)
	}

	log.Printf("✅ Connected to app database: %s", dbName)
	return db, nil
}

// InitDatabaseByName connects to a PostgreSQL database by its exact name.
// Use this when the database name doesn't follow the {appName}_db convention.
//
// Usage:
//
//	db, err := database.InitDatabaseByName("last_man_standing_db")
func InitDatabaseByName(dbName string) (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "activityhub")
	dbPass := getEnv("DB_PASS", "pubgames")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database %s: %w", dbName, err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database %s: %w", dbName, err)
	}

	log.Printf("✅ Connected to database: %s", dbName)
	return db, nil
}

// InitIdentityDatabase connects to the shared identity database for authentication.
// This database contains the users table and is shared across all apps.
//
// Usage:
//   identityDB, err := database.InitIdentityDatabase()
//   if err != nil {
//       log.Fatal(err)
//   }
//   defer identityDB.Close()
func InitIdentityDatabase() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "activityhub")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := "activity_hub" // Identity database

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open identity database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to identity database: %w", err)
	}

	log.Printf("✅ Connected to identity database: %s", dbName)
	return db, nil
}

// ScanNullString converts a sql.NullString to a regular string.
// Returns empty string if the value is NULL.
//
// Usage:
//   var username sql.NullString
//   err := db.QueryRow("SELECT username FROM users WHERE id = $1", id).Scan(&username)
//   name := database.ScanNullString(username) // Returns "" if NULL
func ScanNullString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

// getEnv retrieves an environment variable with a fallback default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
