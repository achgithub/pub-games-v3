package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// sendJSON sends a JSON response.
func sendJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// sendError sends a JSON error response.
func sendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// handleConfig returns app config. Runs inside requireGameAdmin so permission level is set.
func handleConfig(w http.ResponseWriter, r *http.Request) {
	permissionLevel := r.Header.Get("X-Permission-Level")

	var currentGameID string
	lmsDB.QueryRow("SELECT value FROM settings WHERE key = 'current_game_id'").Scan(&currentGameID)

	sendJSON(w, map[string]interface{}{
		"appName":         "Game Admin",
		"version":         "1.0.0",
		"permissionLevel": permissionLevel,
		"currentGameId":   currentGameID,
	})
}

// --- LMS Game Management ---

// handleGetLMSGames returns all LMS games.
func handleGetLMSGames(w http.ResponseWriter, r *http.Request) {
	rows, err := lmsDB.Query(`
		SELECT id, name, status, winner_count, postponement_rule, start_date
		FROM games ORDER BY id DESC
	`)
	if err != nil {
		log.Printf("Error getting games: %v", err)
		sendError(w, "Failed to get games", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var games []map[string]interface{}
	for rows.Next() {
		var id, winnerCount int
		var name, status, postponementRule string
		var startDate interface{}
		if err := rows.Scan(&id, &name, &status, &winnerCount, &postponementRule, &startDate); err != nil {
			continue
		}
		games = append(games, map[string]interface{}{
			"id":               id,
			"name":             name,
			"status":           status,
			"winnerCount":      winnerCount,
			"postponementRule": postponementRule,
			"startDate":        startDate,
		})
	}
	if games == nil {
		games = []map[string]interface{}{}
	}

	// Also return current game ID
	var currentGameID string
	lmsDB.QueryRow("SELECT value FROM settings WHERE key = 'current_game_id'").Scan(&currentGameID)

	sendJSON(w, map[string]interface{}{
		"games":         games,
		"currentGameId": currentGameID,
	})
}

// handleCreateLMSGame creates a new LMS game.
func handleCreateLMSGame(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	var req struct {
		Name             string `json:"name"`
		PostponementRule string `json:"postponementRule"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		sendError(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.PostponementRule == "" {
		req.PostponementRule = "loss"
	}

	var id int
	err := lmsDB.QueryRow(`
		INSERT INTO games (name, postponement_rule) VALUES ($1, $2) RETURNING id
	`, req.Name, req.PostponementRule).Scan(&id)
	if err != nil {
		log.Printf("Error creating game: %v", err)
		sendError(w, "Failed to create game", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_game_create", strconv.Itoa(id), map[string]interface{}{"name": req.Name})
	sendJSON(w, map[string]interface{}{"success": true, "id": id})
}

// handleSetCurrentGame sets the active game via settings.
func handleSetCurrentGame(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	gameID := vars["id"]

	// Verify game exists
	var exists bool
	lmsDB.QueryRow("SELECT EXISTS(SELECT 1 FROM games WHERE id = $1)", gameID).Scan(&exists)
	if !exists {
		sendError(w, "Game not found", http.StatusNotFound)
		return
	}

	_, err := lmsDB.Exec(`
		INSERT INTO settings (key, value) VALUES ('current_game_id', $1)
		ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
	`, gameID)
	if err != nil {
		log.Printf("Error setting current game: %v", err)
		sendError(w, "Failed to set current game", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_game_set_current", gameID, nil)
	sendJSON(w, map[string]interface{}{"success": true})
}

// handleCompleteGame marks a game as completed.
func handleCompleteGame(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	gameID := vars["id"]

	_, err := lmsDB.Exec(`
		UPDATE games SET status = 'completed', end_date = NOW() WHERE id = $1
	`, gameID)
	if err != nil {
		log.Printf("Error completing game: %v", err)
		sendError(w, "Failed to complete game", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_game_complete", gameID, nil)
	sendJSON(w, map[string]interface{}{"success": true})
}

// --- LMS Round Management ---

// handleGetLMSRounds returns all rounds for a game.
func handleGetLMSRounds(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	rows, err := lmsDB.Query(`
		SELECT id, round_number, submission_deadline, status
		FROM rounds WHERE game_id = $1 ORDER BY round_number
	`, gameID)
	if err != nil {
		sendError(w, "Failed to get rounds", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rounds []map[string]interface{}
	for rows.Next() {
		var id, roundNumber int
		var deadline, status string
		if err := rows.Scan(&id, &roundNumber, &deadline, &status); err != nil {
			continue
		}
		// Count predictions for this round
		var predCount int
		lmsDB.QueryRow(
			"SELECT COUNT(*) FROM predictions WHERE game_id = $1 AND round_number = $2",
			gameID, roundNumber,
		).Scan(&predCount)

		rounds = append(rounds, map[string]interface{}{
			"id":          id,
			"roundNumber": roundNumber,
			"deadline":    deadline,
			"status":      status,
			"predCount":   predCount,
		})
	}
	if rounds == nil {
		rounds = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"rounds": rounds})
}

// handleCreateRound creates a new round for a game.
func handleCreateRound(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	var req struct {
		GameID      int    `json:"gameId"`
		RoundNumber int    `json:"roundNumber"`
		Deadline    string `json:"deadline"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GameID == 0 || req.RoundNumber == 0 || req.Deadline == "" {
		sendError(w, "gameId, roundNumber, and deadline are required", http.StatusBadRequest)
		return
	}

	var id int
	err := lmsDB.QueryRow(`
		INSERT INTO rounds (game_id, round_number, submission_deadline)
		VALUES ($1, $2, $3) RETURNING id
	`, req.GameID, req.RoundNumber, req.Deadline).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			sendError(w, fmt.Sprintf("Round %d already exists for this game", req.RoundNumber), http.StatusConflict)
			return
		}
		log.Printf("Error creating round: %v", err)
		sendError(w, "Failed to create round", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_round_create", strconv.Itoa(id), map[string]interface{}{
		"gameId": req.GameID, "roundNumber": req.RoundNumber,
	})
	sendJSON(w, map[string]interface{}{"success": true, "id": id})
}

// handleUpdateRoundStatus opens or closes a round.
func handleUpdateRoundStatus(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	gameID := vars["gameId"]
	roundNum := vars["round"]

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Status != "open" && req.Status != "closed" && req.Status != "draft" {
		sendError(w, "status must be open, closed, or draft", http.StatusBadRequest)
		return
	}

	result, err := lmsDB.Exec(`
		UPDATE rounds SET status = $3 WHERE game_id = $1 AND round_number = $2
	`, gameID, roundNum, req.Status)
	if err != nil {
		log.Printf("Error updating round status: %v", err)
		sendError(w, "Failed to update round", http.StatusInternalServerError)
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_round_status", gameID+"/"+roundNum, map[string]interface{}{"status": req.Status})
	sendJSON(w, map[string]interface{}{"success": true})
}

// handleGetAdminRoundSummary returns round stats for admin.
func handleGetAdminRoundSummary(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	roundNum := vars["round"]

	var deadline, status string
	err := lmsDB.QueryRow(`
		SELECT submission_deadline, status FROM rounds
		WHERE game_id = $1 AND round_number = $2
	`, gameID, roundNum).Scan(&deadline, &status)
	if err != nil {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	rows, err := lmsDB.Query(`
		SELECT p.user_id, p.predicted_team, p.is_correct, p.voided,
		       m.home_team, m.away_team, m.result
		FROM predictions p
		JOIN matches m ON m.id = p.match_id
		WHERE p.game_id = $1 AND p.round_number = $2
		ORDER BY p.user_id
	`, gameID, roundNum)
	if err != nil {
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type PredRow struct {
		UserID        string `json:"userId"`
		PredictedTeam string `json:"predictedTeam"`
		IsCorrect     *bool  `json:"isCorrect"`
		Voided        bool   `json:"voided"`
		HomeTeam      string `json:"homeTeam"`
		AwayTeam      string `json:"awayTeam"`
		Result        string `json:"result"`
	}
	var preds []PredRow
	survived, eliminated := 0, 0
	for rows.Next() {
		var p PredRow
		if err := rows.Scan(&p.UserID, &p.PredictedTeam, &p.IsCorrect, &p.Voided, &p.HomeTeam, &p.AwayTeam, &p.Result); err != nil {
			continue
		}
		preds = append(preds, p)
		if p.IsCorrect != nil && *p.IsCorrect {
			survived++
		} else if p.IsCorrect != nil && !*p.IsCorrect && !p.Voided {
			eliminated++
		}
	}
	if preds == nil {
		preds = []PredRow{}
	}

	sendJSON(w, map[string]interface{}{
		"gameId":      gameID,
		"roundNumber": roundNum,
		"deadline":    deadline,
		"status":      status,
		"predictions": preds,
		"survived":    survived,
		"eliminated":  eliminated,
	})
}

// --- LMS Match Management ---

// handleGetLMSMatches returns matches for a game round.
func handleGetLMSMatches(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	roundNum := vars["round"]

	rows, err := lmsDB.Query(`
		SELECT id, match_number, date, location, home_team, away_team, result, status
		FROM matches WHERE game_id = $1 AND round_number = $2
		ORDER BY match_number
	`, gameID, roundNum)
	if err != nil {
		sendError(w, "Failed to get matches", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var matches []map[string]interface{}
	for rows.Next() {
		var id, matchNumber int
		var date, location, homeTeam, awayTeam, result, status string
		if err := rows.Scan(&id, &matchNumber, &date, &location, &homeTeam, &awayTeam, &result, &status); err != nil {
			continue
		}
		matches = append(matches, map[string]interface{}{
			"id":          id,
			"matchNumber": matchNumber,
			"date":        date,
			"location":    location,
			"homeTeam":    homeTeam,
			"awayTeam":    awayTeam,
			"result":      result,
			"status":      status,
		})
	}
	if matches == nil {
		matches = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"matches": matches})
}

// handleUploadMatches handles CSV upload of matches for a round.
// Form fields: gameId, round. File field: file
// CSV format: match_number,date,location,home_team,away_team
func handleUploadMatches(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		sendError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	gameID := r.FormValue("gameId")
	roundNum := r.FormValue("round")
	if gameID == "" || roundNum == "" {
		sendError(w, "gameId and round are required", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		sendError(w, "file field is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		sendError(w, "Failed to parse CSV", http.StatusBadRequest)
		return
	}

	if len(records) < 2 {
		sendError(w, "CSV must have header row and at least one match", http.StatusBadRequest)
		return
	}

	// Skip header row (records[0])
	inserted := 0
	for _, row := range records[1:] {
		if len(row) < 5 {
			continue
		}
		matchNumber, err := strconv.Atoi(strings.TrimSpace(row[0]))
		if err != nil {
			continue
		}
		date := strings.TrimSpace(row[1])
		location := strings.TrimSpace(row[2])
		homeTeam := strings.TrimSpace(row[3])
		awayTeam := strings.TrimSpace(row[4])

		_, err = lmsDB.Exec(`
			INSERT INTO matches (game_id, match_number, round_number, date, location, home_team, away_team)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, gameID, matchNumber, roundNum, date, location, homeTeam, awayTeam)
		if err != nil {
			log.Printf("Error inserting match %d: %v", matchNumber, err)
			continue
		}
		inserted++
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_matches_upload", gameID+"/"+roundNum, map[string]interface{}{"count": inserted})
	sendJSON(w, map[string]interface{}{"success": true, "inserted": inserted})
}

// handleSetMatchResult sets a match result and triggers elimination logic.
func handleSetMatchResult(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	matchID := vars["id"]

	var req struct {
		Result string `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Result == "" {
		sendError(w, "result is required", http.StatusBadRequest)
		return
	}

	// Get match + game details
	var homeTeam, awayTeam, postponementRule string
	var gameID int
	err := lmsDB.QueryRow(`
		SELECT m.home_team, m.away_team, m.game_id, g.postponement_rule
		FROM matches m JOIN games g ON g.id = m.game_id
		WHERE m.id = $1
	`, matchID).Scan(&homeTeam, &awayTeam, &gameID, &postponementRule)
	if err != nil {
		sendError(w, "Match not found", http.StatusNotFound)
		return
	}

	// Determine winner
	winnerTeam, isPostponed := parseResult(req.Result, homeTeam, awayTeam)

	// Use a transaction for consistency
	tx, err := lmsDB.Begin()
	if err != nil {
		sendError(w, "Transaction error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Update match
	matchStatus := "completed"
	if isPostponed {
		matchStatus = "postponed"
	}
	if _, err := tx.Exec(`
		UPDATE matches SET result = $1, status = $2 WHERE id = $3
	`, req.Result, matchStatus, matchID); err != nil {
		log.Printf("Error updating match: %v", err)
		sendError(w, "Failed to update match", http.StatusInternalServerError)
		return
	}

	// Get all predictions for this match
	predRows, err := tx.Query(`
		SELECT id, user_id, game_id, predicted_team FROM predictions WHERE match_id = $1
	`, matchID)
	if err != nil {
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}

	type pred struct {
		ID            int
		UserID        string
		GameID        int
		PredictedTeam string
	}
	var preds []pred
	for predRows.Next() {
		var p pred
		if err := predRows.Scan(&p.ID, &p.UserID, &p.GameID, &p.PredictedTeam); err == nil {
			preds = append(preds, p)
		}
	}
	predRows.Close()

	// Apply results to each prediction
	for _, p := range preds {
		if isPostponed {
			if postponementRule == "loss" {
				// Mark as incorrect and eliminate
				tx.Exec("UPDATE predictions SET is_correct = FALSE WHERE id = $1", p.ID)
				tx.Exec("UPDATE game_players SET is_active = FALSE WHERE user_id = $1 AND game_id = $2", p.UserID, p.GameID)
			} else {
				// Void the prediction (player survives, team freed up)
				tx.Exec("UPDATE predictions SET voided = TRUE WHERE id = $1", p.ID)
			}
		} else if winnerTeam == "" {
			// Draw — all predictors are eliminated
			tx.Exec("UPDATE predictions SET is_correct = FALSE WHERE id = $1", p.ID)
			tx.Exec("UPDATE game_players SET is_active = FALSE WHERE user_id = $1 AND game_id = $2", p.UserID, p.GameID)
		} else {
			isCorrect := p.PredictedTeam == winnerTeam
			tx.Exec("UPDATE predictions SET is_correct = $1 WHERE id = $2", isCorrect, p.ID)
			if !isCorrect {
				tx.Exec("UPDATE game_players SET is_active = FALSE WHERE user_id = $1 AND game_id = $2", p.UserID, p.GameID)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing result: %v", err)
		sendError(w, "Failed to save result", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_match_result", matchID, map[string]interface{}{
		"result": req.Result, "eliminated": len(preds),
	})
	sendJSON(w, map[string]interface{}{"success": true, "predictionsProcessed": len(preds)})
}

// handleGetAllPredictions returns all predictions, optionally filtered by game and round.
func handleGetAllPredictions(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("gameId")
	roundNum := r.URL.Query().Get("round")

	query := `
		SELECT p.user_id, p.round_number, p.predicted_team, p.is_correct, p.voided,
		       m.home_team, m.away_team, m.result
		FROM predictions p
		JOIN matches m ON m.id = p.match_id
		WHERE 1=1
	`
	args := []interface{}{}
	argIdx := 1

	if gameID != "" {
		query += fmt.Sprintf(" AND p.game_id = $%d", argIdx)
		args = append(args, gameID)
		argIdx++
	}
	if roundNum != "" {
		query += fmt.Sprintf(" AND p.round_number = $%d", argIdx)
		args = append(args, roundNum)
		argIdx++
	}
	query += " ORDER BY p.round_number, p.user_id"

	rows, err := lmsDB.Query(query, args...)
	if err != nil {
		log.Printf("Error getting predictions: %v", err)
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type PredRow struct {
		UserID        string `json:"userId"`
		RoundNumber   int    `json:"roundNumber"`
		PredictedTeam string `json:"predictedTeam"`
		IsCorrect     *bool  `json:"isCorrect"`
		Voided        bool   `json:"voided"`
		HomeTeam      string `json:"homeTeam"`
		AwayTeam      string `json:"awayTeam"`
		Result        string `json:"result"`
	}
	var preds []PredRow
	for rows.Next() {
		var p PredRow
		if err := rows.Scan(&p.UserID, &p.RoundNumber, &p.PredictedTeam, &p.IsCorrect, &p.Voided, &p.HomeTeam, &p.AwayTeam, &p.Result); err != nil {
			continue
		}
		preds = append(preds, p)
	}
	if preds == nil {
		preds = []PredRow{}
	}
	sendJSON(w, map[string]interface{}{"predictions": preds})
}

// --- Helpers ---

// parseResult parses a match result string and returns the winning team.
// Returns ("", false) for a draw, ("", true) for postponed, or (teamName, false) for a win.
func parseResult(result, homeTeam, awayTeam string) (winnerTeam string, isPostponed bool) {
	if result == "P - P" {
		return "", true
	}
	parts := strings.SplitN(result, " - ", 2)
	if len(parts) != 2 {
		return "", false
	}
	homeScore, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
	awayScore, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err1 != nil || err2 != nil {
		return "", false
	}
	if homeScore > awayScore {
		return homeTeam, false
	}
	if awayScore > homeScore {
		return awayTeam, false
	}
	return "", false // draw
}

// logAudit logs an admin action.
func logAudit(adminEmail, actionType, targetID string, details map[string]interface{}) {
	detailsJSON, _ := json.Marshal(details)
	_, err := gameAdminDB.Exec(`
		INSERT INTO audit_log (admin_email, action_type, target_id, details)
		VALUES ($1, $2, $3, $4)
	`, adminEmail, actionType, targetID, sql.NullString{String: string(detailsJSON), Valid: details != nil})
	if err != nil {
		log.Printf("Warning: Failed to log audit action: %v", err)
	}
}
