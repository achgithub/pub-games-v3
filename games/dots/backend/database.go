package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// InitDatabase initializes the PostgreSQL connection
func InitDatabase() (*sql.DB, error) {
	host := getEnvDB("DB_HOST", "127.0.0.1")
	port := getEnvDB("DB_PORT", "5555")
	user := getEnvDB("DB_USER", "pubgames")
	password := getEnvDB("DB_PASS", "pubgames")
	dbname := getEnvDB("DB_NAME", "dots_db")

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

func getEnvDB(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func createTables(db *sql.DB) error {
	schema := `
	-- Games history table
	CREATE TABLE IF NOT EXISTS games (
		id VARCHAR(100) PRIMARY KEY,
		challenge_id VARCHAR(100),
		player1_id VARCHAR(255) NOT NULL,
		player1_name VARCHAR(255),
		player2_id VARCHAR(255) NOT NULL,
		player2_name VARCHAR(255),
		grid_size INT DEFAULT 4,
		player1_score INT DEFAULT 0,
		player2_score INT DEFAULT 0,
		winner_id VARCHAR(255),
		status VARCHAR(20) DEFAULT 'active',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		completed_at TIMESTAMP
	);

	-- Player stats table
	CREATE TABLE IF NOT EXISTS player_stats (
		player_id VARCHAR(255) PRIMARY KEY,
		player_name VARCHAR(255),
		wins INT DEFAULT 0,
		losses INT DEFAULT 0,
		draws INT DEFAULT 0,
		total_boxes INT DEFAULT 0,
		games_played INT DEFAULT 0,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Indexes
	CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
	CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
	CREATE INDEX IF NOT EXISTS idx_games_completed ON games(completed_at DESC);
	`

	_, err := db.Exec(schema)
	return err
}

// SaveCompletedGame saves a completed game to PostgreSQL
func SaveCompletedGame(game *Game) error {
	var completedAt *time.Time
	if game.CompletedAt != nil {
		t := time.Unix(*game.CompletedAt, 0)
		completedAt = &t
	}

	_, err := db.Exec(`
		INSERT INTO games (id, challenge_id, player1_id, player1_name, player2_id, player2_name,
			grid_size, player1_score, player2_score, winner_id, status, created_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (id) DO UPDATE SET
			player1_score = EXCLUDED.player1_score,
			player2_score = EXCLUDED.player2_score,
			winner_id = EXCLUDED.winner_id,
			status = EXCLUDED.status,
			completed_at = EXCLUDED.completed_at
	`,
		game.ID, game.ChallengeID, game.Player1ID, game.Player1Name,
		game.Player2ID, game.Player2Name, game.GridSize,
		game.Player1Score, game.Player2Score, game.WinnerID,
		game.Status, time.Unix(game.CreatedAt, 0), completedAt,
	)

	return err
}

// UpdatePlayerStats updates a player's statistics
func UpdatePlayerStats(playerID, playerName string, won, lost, draw bool, boxesScored int) error {
	winInc, lossInc, drawInc := 0, 0, 0
	if won {
		winInc = 1
	}
	if lost {
		lossInc = 1
	}
	if draw {
		drawInc = 1
	}

	_, err := db.Exec(`
		INSERT INTO player_stats (player_id, player_name, wins, losses, draws, total_boxes, games_played, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 1, NOW())
		ON CONFLICT (player_id) DO UPDATE SET
			player_name = EXCLUDED.player_name,
			wins = player_stats.wins + EXCLUDED.wins,
			losses = player_stats.losses + EXCLUDED.losses,
			draws = player_stats.draws + EXCLUDED.draws,
			total_boxes = player_stats.total_boxes + EXCLUDED.total_boxes,
			games_played = player_stats.games_played + 1,
			updated_at = NOW()
	`, playerID, playerName, winInc, lossInc, drawInc, boxesScored)

	return err
}

// GetPlayerStats retrieves a player's statistics
func GetPlayerStats(playerID string) (map[string]interface{}, error) {
	var name string
	var wins, losses, draws, totalBoxes, gamesPlayed int

	err := db.QueryRow(`
		SELECT player_name, wins, losses, draws, total_boxes, games_played
		FROM player_stats WHERE player_id = $1
	`, playerID).Scan(&name, &wins, &losses, &draws, &totalBoxes, &gamesPlayed)

	if err == sql.ErrNoRows {
		return map[string]interface{}{
			"playerId":    playerID,
			"playerName":  playerID,
			"wins":        0,
			"losses":      0,
			"draws":       0,
			"totalBoxes":  0,
			"gamesPlayed": 0,
		}, nil
	}

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"playerId":    playerID,
		"playerName":  name,
		"wins":        wins,
		"losses":      losses,
		"draws":       draws,
		"totalBoxes":  totalBoxes,
		"gamesPlayed": gamesPlayed,
	}, nil
}
