package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

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

	if stats.GamesPlayed > 0 {
		stats.WinRate = float64(stats.GamesWon) / float64(stats.GamesPlayed) * 100
	}

	return &stats, nil
}
