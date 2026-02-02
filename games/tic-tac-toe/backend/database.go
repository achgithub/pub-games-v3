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
	dbName := getEnv("DB_NAME", "tictactoe_db")

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

	return db, nil
}

// SaveCompletedGame saves a completed game to PostgreSQL
func SaveCompletedGame(game *Game) error {
	query := `
		INSERT INTO games (
			challenge_id, player1_id, player1_name, player2_id, player2_name,
			mode, status, winner_id, move_time_limit, first_to,
			player1_score, player2_score, total_rounds, created_at, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
			to_timestamp($14), to_timestamp($15))
		RETURNING id
	`

	var dbID int
	err := db.QueryRow(
		query,
		game.ChallengeID,
		game.Player1ID,
		game.Player1Name,
		game.Player2ID,
		game.Player2Name,
		game.Mode,
		game.Status,
		game.WinnerID,
		game.MoveTimeLimit,
		game.FirstTo,
		game.Player1Score,
		game.Player2Score,
		game.CurrentRound,
		game.CreatedAt,
		game.CompletedAt,
	).Scan(&dbID)

	if err != nil {
		return fmt.Errorf("failed to save game: %w", err)
	}

	log.Printf("✅ Saved completed game to PostgreSQL: ID=%d, Game=%s", dbID, game.ID)
	return nil
}

// SaveMove saves a move to PostgreSQL for history/replay
func SaveMove(move *Move) error {
	// First, get the database game ID from the Redis game ID
	// For now, we'll skip this - moves can be saved when game completes
	// This is optional for v1
	return nil
}

// UpdatePlayerStats updates player statistics
func UpdatePlayerStats(userID string, userName string, won bool, lost bool, draw bool, moves int) error {
	query := `
		INSERT INTO player_stats (user_id, user_name, games_played, games_won, games_lost, games_draw, total_moves, last_played)
		VALUES ($1, $2, 1, $3, $4, $5, $6, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id) DO UPDATE SET
			games_played = player_stats.games_played + 1,
			games_won = player_stats.games_won + $3,
			games_lost = player_stats.games_lost + $4,
			games_draw = player_stats.games_draw + $5,
			total_moves = player_stats.total_moves + $6,
			last_played = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
	`

	wonInt := 0
	if won {
		wonInt = 1
	}
	lostInt := 0
	if lost {
		lostInt = 1
	}
	drawInt := 0
	if draw {
		drawInt = 1
	}

	_, err := db.Exec(query, userID, userName, wonInt, lostInt, drawInt, moves)
	if err != nil {
		return fmt.Errorf("failed to update player stats: %w", err)
	}

	return nil
}

// GetPlayerStats retrieves player statistics
func GetPlayerStats(userID string) (*PlayerStats, error) {
	query := `
		SELECT user_id, user_name, games_played, games_won, games_lost, games_draw, total_moves, fastest_win_moves
		FROM player_stats
		WHERE user_id = $1
	`

	var stats PlayerStats
	var fastestWin sql.NullInt64

	err := db.QueryRow(query, userID).Scan(
		&stats.UserID,
		&stats.UserName,
		&stats.GamesPlayed,
		&stats.GamesWon,
		&stats.GamesLost,
		&stats.GamesDraw,
		&stats.TotalMoves,
		&fastestWin,
	)

	if err == sql.ErrNoRows {
		// No stats yet, return zeros
		return &PlayerStats{
			UserID:      userID,
			GamesPlayed: 0,
			GamesWon:    0,
			GamesLost:   0,
			GamesDraw:   0,
		}, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get player stats: %w", err)
	}

	if fastestWin.Valid {
		fw := int(fastestWin.Int64)
		stats.FastestWinMove = &fw
	}

	// Calculate win rate
	if stats.GamesPlayed > 0 {
		stats.WinRate = float64(stats.GamesWon) / float64(stats.GamesPlayed) * 100
	}

	return &stats, nil
}

// InitIdentityDatabase connects to the identity database for authentication
func InitIdentityDatabase() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "pubgames")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := "pubgames" // Identity database

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
