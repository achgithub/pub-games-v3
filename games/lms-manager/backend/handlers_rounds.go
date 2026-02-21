package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

// ============================================================================
// ROUNDS
// ============================================================================

// HandleGetRounds - GET /api/games/{gameId}/rounds
func HandleGetRounds(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["gameId"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Verify ownership
	var managerEmail string
	err = db.QueryRow(`SELECT manager_email FROM managed_games WHERE id = $1`, gameID).Scan(&managerEmail)
	if err != nil || managerEmail != user.Email {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	rows, err := db.Query(`
		SELECT id, game_id, round_number, status, created_at
		FROM managed_rounds
		WHERE game_id = $1
		ORDER BY round_number
	`, gameID)
	if err != nil {
		log.Printf("Failed to query rounds: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	rounds := []ManagedRound{}
	for rows.Next() {
		var rd ManagedRound
		if err := rows.Scan(&rd.ID, &rd.GameID, &rd.RoundNumber, &rd.Status, &rd.CreatedAt); err != nil {
			continue
		}
		rounds = append(rounds, rd)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rounds)
}

// HandleCreateRound - POST /api/games/{gameId}/rounds
func HandleCreateRound(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["gameId"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Verify ownership
	var managerEmail string
	err = db.QueryRow(`SELECT manager_email FROM managed_games WHERE id = $1`, gameID).Scan(&managerEmail)
	if err != nil || managerEmail != user.Email {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Get next round number
	var nextRound int
	err = db.QueryRow(`
		SELECT COALESCE(MAX(round_number), 0) + 1
		FROM managed_rounds
		WHERE game_id = $1
	`, gameID).Scan(&nextRound)
	if err != nil {
		log.Printf("Failed to get next round: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var roundID int
	err = db.QueryRow(`
		INSERT INTO managed_rounds (game_id, round_number, status)
		VALUES ($1, $2, 'open')
		RETURNING id
	`, gameID, nextRound).Scan(&roundID)

	if err != nil {
		log.Printf("Failed to create round: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":          roundID,
		"roundNumber": nextRound,
	})
}

// ============================================================================
// PICKS
// ============================================================================

// HandleGetPicks - GET /api/rounds/{roundId}/picks
func HandleGetPicks(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	roundID, err := strconv.Atoi(vars["roundId"])
	if err != nil {
		http.Error(w, "Invalid round ID", http.StatusBadRequest)
		return
	}

	// Verify ownership through game
	var managerEmail string
	err = db.QueryRow(`
		SELECT g.manager_email
		FROM managed_rounds r
		JOIN managed_games g ON r.game_id = g.id
		WHERE r.id = $1
	`, roundID).Scan(&managerEmail)
	if err != nil || managerEmail != user.Email {
		http.Error(w, "Round not found", http.StatusNotFound)
		return
	}

	rows, err := db.Query(`
		SELECT id, game_id, round_id, player_nickname, team_name, result, created_at
		FROM managed_picks
		WHERE round_id = $1
		ORDER BY player_nickname
	`, roundID)
	if err != nil {
		log.Printf("Failed to query picks: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	picks := []ManagedPick{}
	for rows.Next() {
		var p ManagedPick
		var result sql.NullString
		if err := rows.Scan(&p.ID, &p.GameID, &p.RoundID, &p.PlayerNickname, &p.TeamName, &result, &p.CreatedAt); err != nil {
			continue
		}
		if result.Valid {
			p.Result = &result.String
		}
		picks = append(picks, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(picks)
}

// HandleCreatePick - POST /api/rounds/{roundId}/picks
func HandleCreatePick(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	roundID, err := strconv.Atoi(vars["roundId"])
	if err != nil {
		http.Error(w, "Invalid round ID", http.StatusBadRequest)
		return
	}

	var req struct {
		PlayerNickname string `json:"playerNickname"`
		TeamName       string `json:"teamName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify ownership and get game ID
	var managerEmail string
	var gameID int
	err = db.QueryRow(`
		SELECT g.manager_email, g.id
		FROM managed_rounds r
		JOIN managed_games g ON r.game_id = g.id
		WHERE r.id = $1
	`, roundID).Scan(&managerEmail, &gameID)
	if err != nil || managerEmail != user.Email {
		http.Error(w, "Round not found", http.StatusNotFound)
		return
	}

	var pickID int
	err = db.QueryRow(`
		INSERT INTO managed_picks (game_id, round_id, player_nickname, team_name, result)
		VALUES ($1, $2, $3, $4, NULL)
		RETURNING id
	`, gameID, roundID, req.PlayerNickname, req.TeamName).Scan(&pickID)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			http.Error(w, "Pick already exists for this player", http.StatusConflict)
			return
		}
		log.Printf("Failed to create pick: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"id": pickID})
}

// HandleUpdatePick - PUT /api/picks/{id}
func HandleUpdatePick(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	pickID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid pick ID", http.StatusBadRequest)
		return
	}

	var req struct {
		TeamName string `json:"teamName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify ownership
	var managerEmail string
	err = db.QueryRow(`
		SELECT g.manager_email
		FROM managed_picks p
		JOIN managed_games g ON p.game_id = g.id
		WHERE p.id = $1
	`, pickID).Scan(&managerEmail)
	if err != nil || managerEmail != user.Email {
		http.Error(w, "Pick not found", http.StatusNotFound)
		return
	}

	result, err := db.Exec(`
		UPDATE managed_picks
		SET team_name = $1
		WHERE id = $2
	`, req.TeamName, pickID)

	if err != nil {
		log.Printf("Failed to update pick: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Pick not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// HandleDeletePick - DELETE /api/picks/{id}
func HandleDeletePick(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	pickID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid pick ID", http.StatusBadRequest)
		return
	}

	// Verify ownership
	var managerEmail string
	err = db.QueryRow(`
		SELECT g.manager_email
		FROM managed_picks p
		JOIN managed_games g ON p.game_id = g.id
		WHERE p.id = $1
	`, pickID).Scan(&managerEmail)
	if err != nil || managerEmail != user.Email {
		http.Error(w, "Pick not found", http.StatusNotFound)
		return
	}

	result, err := db.Exec(`DELETE FROM managed_picks WHERE id = $1`, pickID)

	if err != nil {
		log.Printf("Failed to delete pick: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Pick not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Continue in next file...
