package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

// SaveGameToDB saves a game to PostgreSQL for history
func SaveGameToDB(game *SpoofGame) error {
	playersJSON, err := json.Marshal(game.Players)
	if err != nil {
		return fmt.Errorf("failed to marshal players: %w", err)
	}

	_, err = db.Exec(`
		INSERT INTO games (id, challenge_id, players, status, started_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO NOTHING
	`, game.ID, game.ChallengeID, playersJSON, game.Status, game.StartedAt, game.UpdatedAt)

	return err
}

// UpdateGameInDB updates game status in PostgreSQL
func UpdateGameInDB(game *SpoofGame) error {
	winnerId := sql.NullString{String: game.WinnerID, Valid: game.WinnerID != ""}

	_, err := db.Exec(`
		UPDATE games
		SET status = $1, winner_id = $2, updated_at = $3
		WHERE id = $4
	`, game.Status, winnerId, game.UpdatedAt, game.ID)

	return err
}

// RecordRoundResult saves round result to history
func RecordRoundResult(gameID string, round int, winner sql.NullString, eliminated sql.NullString, totalCoins int) error {
	_, err := db.Exec(`
		INSERT INTO round_history (game_id, round_number, winner_id, eliminated_id, total_coins, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, gameID, round, winner, eliminated, totalCoins)

	return err
}

// GetGameHistory retrieves game history from PostgreSQL
func GetGameHistory(gameID string) (map[string]interface{}, error) {
	var id, challengeID, status string
	var playersJSON []byte
	var winnerID sql.NullString
	var startedAt, updatedAt int64

	err := db.QueryRow(`
		SELECT id, challenge_id, players, status, winner_id, started_at, updated_at
		FROM games
		WHERE id = $1
	`, gameID).Scan(&id, &challengeID, &playersJSON, &status, &winnerID, &startedAt, &updatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("game not found in history")
	} else if err != nil {
		return nil, err
	}

	var players []PlayerInfo
	if err := json.Unmarshal(playersJSON, &players); err != nil {
		log.Printf("Failed to unmarshal players: %v", err)
	}

	result := map[string]interface{}{
		"id":          id,
		"challengeId": challengeID,
		"players":     players,
		"status":      status,
		"startedAt":   startedAt,
		"updatedAt":   updatedAt,
	}

	if winnerID.Valid {
		result["winnerId"] = winnerID.String
	}

	// Get round history
	rows, err := db.Query(`
		SELECT round_number, winner_id, eliminated_id, total_coins
		FROM round_history
		WHERE game_id = $1
		ORDER BY round_number ASC
	`, gameID)

	if err != nil {
		log.Printf("Failed to query round history: %v", err)
	} else {
		defer rows.Close()

		rounds := []map[string]interface{}{}
		for rows.Next() {
			var roundNum, totalCoins int
			var winner, eliminated sql.NullString

			if err := rows.Scan(&roundNum, &winner, &eliminated, &totalCoins); err != nil {
				log.Printf("Failed to scan round: %v", err)
				continue
			}

			round := map[string]interface{}{
				"round":      roundNum,
				"totalCoins": totalCoins,
			}

			if winner.Valid {
				round["winner"] = winner.String
			}
			if eliminated.Valid {
				round["eliminated"] = eliminated.String
			}

			rounds = append(rounds, round)
		}

		result["rounds"] = rounds
	}

	return result, nil
}
