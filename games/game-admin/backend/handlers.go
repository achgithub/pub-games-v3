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

// --- Fixture File Management ---

// handleGetFixtures returns all fixture files with match counts.
func handleGetFixtures(w http.ResponseWriter, r *http.Request) {
	rows, err := lmsDB.Query(`
		SELECT f.id, f.name, COUNT(m.id) AS match_count, f.updated_at
		FROM fixture_files f
		LEFT JOIN matches m ON m.fixture_file_id = f.id
		GROUP BY f.id, f.name, f.updated_at
		ORDER BY f.updated_at DESC
	`)
	if err != nil {
		log.Printf("Error getting fixtures: %v", err)
		sendError(w, "Failed to get fixtures", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var fixtures []map[string]interface{}
	for rows.Next() {
		var id, matchCount int
		var name string
		var updatedAt interface{}
		if err := rows.Scan(&id, &name, &matchCount, &updatedAt); err != nil {
			continue
		}
		fixtures = append(fixtures, map[string]interface{}{
			"id":         id,
			"name":       name,
			"matchCount": matchCount,
			"updatedAt":  updatedAt,
		})
	}
	if fixtures == nil {
		fixtures = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"fixtures": fixtures})
}

// handleUploadFixture uploads a fixture CSV to create or update a named fixture file.
// Form fields: name (string), file (CSV).
// CSV format: match_number, round_number, date, location, home_team, away_team[, result]
// The result column is optional. If present it is stored as-is; status is NOT changed.
// Status is only set to 'completed' via the manual set-result endpoint.
// Matches are upserted on (fixture_file_id, match_number).
func handleUploadFixture(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		sendError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		sendError(w, "name is required", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		sendError(w, "file field is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Find or create fixture file by name
	var fixtureFileID int
	err = lmsDB.QueryRow("SELECT id FROM fixture_files WHERE name = $1", name).Scan(&fixtureFileID)
	if err != nil {
		err = lmsDB.QueryRow(
			"INSERT INTO fixture_files (name) VALUES ($1) RETURNING id", name,
		).Scan(&fixtureFileID)
		if err != nil {
			log.Printf("Error creating fixture file: %v", err)
			sendError(w, "Failed to create fixture file", http.StatusInternalServerError)
			return
		}
	} else {
		lmsDB.Exec("UPDATE fixture_files SET updated_at = NOW() WHERE id = $1", fixtureFileID)
	}

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		sendError(w, "Failed to parse CSV", http.StatusBadRequest)
		return
	}
	if len(records) < 2 {
		sendError(w, "CSV must have a header row and at least one match", http.StatusBadRequest)
		return
	}

	upserted := 0
	for _, row := range records[1:] {
		if len(row) < 6 {
			continue
		}
		matchNumber, err := strconv.Atoi(strings.TrimSpace(row[0]))
		if err != nil {
			continue
		}
		roundNumber, err := strconv.Atoi(strings.TrimSpace(row[1]))
		if err != nil {
			continue
		}
		date := strings.TrimSpace(row[2])
		location := strings.TrimSpace(row[3])
		homeTeam := strings.TrimSpace(row[4])
		awayTeam := strings.TrimSpace(row[5])

		result := ""
		if len(row) > 6 {
			result = strings.TrimSpace(row[6])
		}

		_, err = lmsDB.Exec(`
			INSERT INTO matches (fixture_file_id, match_number, round_number, date, location, home_team, away_team, result)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (fixture_file_id, match_number) DO UPDATE
			SET round_number=$3, date=$4, location=$5, home_team=$6, away_team=$7, result=$8
		`, fixtureFileID, matchNumber, roundNumber, date, location, homeTeam, awayTeam, result)
		if err != nil {
			log.Printf("Error upserting match %d: %v", matchNumber, err)
			continue
		}
		upserted++
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_fixture_upload", strconv.Itoa(fixtureFileID), map[string]interface{}{
		"name": name, "upserted": upserted,
	})
	sendJSON(w, map[string]interface{}{
		"success":  true,
		"id":       fixtureFileID,
		"name":     name,
		"upserted": upserted,
	})
}

// handleGetFixtureMatches returns all matches for a fixture file.
func handleGetFixtureMatches(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	fixtureID := vars["id"]

	rows, err := lmsDB.Query(`
		SELECT id, match_number, round_number, date, location, home_team, away_team, result, status
		FROM matches WHERE fixture_file_id = $1
		ORDER BY round_number, match_number
	`, fixtureID)
	if err != nil {
		sendError(w, "Failed to get matches", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var matches []map[string]interface{}
	for rows.Next() {
		var id, matchNumber, roundNumber int
		var date, location, homeTeam, awayTeam, result, status string
		if err := rows.Scan(&id, &matchNumber, &roundNumber, &date, &location, &homeTeam, &awayTeam, &result, &status); err != nil {
			continue
		}
		matches = append(matches, map[string]interface{}{
			"id":          id,
			"matchNumber": matchNumber,
			"roundNumber": roundNumber,
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

// --- LMS Game Management ---

// handleGetLMSGames returns all LMS games with their fixture file names.
func handleGetLMSGames(w http.ResponseWriter, r *http.Request) {
	rows, err := lmsDB.Query(`
		SELECT g.id, g.name, g.status, g.winner_count, g.postponement_rule,
		       g.start_date, COALESCE(g.fixture_file_id, 0), COALESCE(f.name, '')
		FROM games g
		LEFT JOIN fixture_files f ON f.id = g.fixture_file_id
		ORDER BY g.id DESC
	`)
	if err != nil {
		log.Printf("Error getting games: %v", err)
		sendError(w, "Failed to get games", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var games []map[string]interface{}
	for rows.Next() {
		var id, winnerCount, fixtureFileID int
		var name, status, postponementRule, fixtureName string
		var startDate interface{}
		if err := rows.Scan(&id, &name, &status, &winnerCount, &postponementRule, &startDate, &fixtureFileID, &fixtureName); err != nil {
			continue
		}
		games = append(games, map[string]interface{}{
			"id":               id,
			"name":             name,
			"status":           status,
			"winnerCount":      winnerCount,
			"postponementRule": postponementRule,
			"startDate":        startDate,
			"fixtureFileId":    fixtureFileID,
			"fixtureName":      fixtureName,
		})
	}
	if games == nil {
		games = []map[string]interface{}{}
	}

	var currentGameID string
	lmsDB.QueryRow("SELECT value FROM settings WHERE key = 'current_game_id'").Scan(&currentGameID)

	sendJSON(w, map[string]interface{}{
		"games":         games,
		"currentGameId": currentGameID,
	})
}

// handleCreateLMSGame creates a new LMS game linked to a fixture file.
func handleCreateLMSGame(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	var req struct {
		Name             string `json:"name"`
		FixtureFileID    int    `json:"fixtureFileId"`
		PostponementRule string `json:"postponementRule"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		sendError(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.FixtureFileID == 0 {
		sendError(w, "fixtureFileId is required", http.StatusBadRequest)
		return
	}
	if req.PostponementRule == "" {
		req.PostponementRule = "loss"
	}

	// Verify fixture file exists
	var exists bool
	lmsDB.QueryRow("SELECT EXISTS(SELECT 1 FROM fixture_files WHERE id = $1)", req.FixtureFileID).Scan(&exists)
	if !exists {
		sendError(w, "Fixture file not found", http.StatusBadRequest)
		return
	}

	var id int
	err := lmsDB.QueryRow(`
		INSERT INTO games (name, fixture_file_id, postponement_rule) VALUES ($1, $2, $3) RETURNING id
	`, req.Name, req.FixtureFileID, req.PostponementRule).Scan(&id)
	if err != nil {
		log.Printf("Error creating game: %v", err)
		sendError(w, "Failed to create game", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_game_create", strconv.Itoa(id), map[string]interface{}{
		"name": req.Name, "fixtureFileId": req.FixtureFileID,
	})
	sendJSON(w, map[string]interface{}{"success": true, "id": id})
}

// handleSetCurrentGame sets the active game via settings.
func handleSetCurrentGame(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	gameID := vars["id"]

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

	_, err := lmsDB.Exec(`UPDATE games SET status = 'completed', end_date = NOW() WHERE id = $1`, gameID)
	if err != nil {
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
		INSERT INTO rounds (game_id, round_number, submission_deadline) VALUES ($1, $2, $3) RETURNING id
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
		SELECT submission_deadline, status FROM rounds WHERE game_id = $1 AND round_number = $2
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

// handleGetLMSMatchesForGame returns all matches for a game (via its fixture file), optionally for one round.
func handleGetLMSMatchesForGame(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	roundNum := vars["round"] // may be empty if route has no round param

	query := `
		SELECT m.id, m.match_number, m.round_number, m.date, m.location,
		       m.home_team, m.away_team, m.result, m.status
		FROM matches m
		JOIN games g ON g.fixture_file_id = m.fixture_file_id
		WHERE g.id = $1
	`
	args := []interface{}{gameID}
	if roundNum != "" {
		query += " AND m.round_number = $2"
		args = append(args, roundNum)
	}
	query += " ORDER BY m.round_number, m.match_number"

	rows, err := lmsDB.Query(query, args...)
	if err != nil {
		sendError(w, "Failed to get matches", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var matches []map[string]interface{}
	for rows.Next() {
		var id, matchNumber, roundNumber int
		var date, location, homeTeam, awayTeam, result, status string
		if err := rows.Scan(&id, &matchNumber, &roundNumber, &date, &location, &homeTeam, &awayTeam, &result, &status); err != nil {
			continue
		}
		matches = append(matches, map[string]interface{}{
			"id":          id,
			"matchNumber": matchNumber,
			"roundNumber": roundNumber,
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

// handleSetMatchResult stores a result on a match.
// Does NOT evaluate predictions — use handleProcessRound for that.
func handleSetMatchResult(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	matchIDStr := vars["id"]

	var req struct {
		Result string `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Result == "" {
		sendError(w, "result is required", http.StatusBadRequest)
		return
	}

	var homeTeam, awayTeam string
	err := lmsDB.QueryRow("SELECT home_team, away_team FROM matches WHERE id = $1", matchIDStr).Scan(&homeTeam, &awayTeam)
	if err != nil {
		sendError(w, "Match not found", http.StatusNotFound)
		return
	}

	_, isPostponed := parseResult(req.Result, homeTeam, awayTeam)
	matchStatus := "completed"
	if isPostponed {
		matchStatus = "postponed"
	}

	if _, err := lmsDB.Exec(`UPDATE matches SET result = $1, status = $2 WHERE id = $3`,
		req.Result, matchStatus, matchIDStr); err != nil {
		sendError(w, "Failed to update match", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_match_result", matchIDStr, map[string]interface{}{"result": req.Result})
	sendJSON(w, map[string]interface{}{"success": true})
}

// handleProcessRound evaluates all picks for a round in a game.
// Pre-flight: all matches in the round must have a result. Returns survived/eliminated counts.
func handleProcessRound(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	gameIDStr := vars["gameId"]
	roundStr := vars["round"]

	gameID, _ := strconv.Atoi(gameIDStr)
	roundNumber, _ := strconv.Atoi(roundStr)

	// Get game's fixture file and postponement rule
	var fixtureFileID int
	var postponementRule string
	err := lmsDB.QueryRow(`
		SELECT fixture_file_id, postponement_rule FROM games WHERE id = $1
	`, gameID).Scan(&fixtureFileID, &postponementRule)
	if err != nil {
		sendError(w, "Game not found", http.StatusNotFound)
		return
	}
	if fixtureFileID == 0 {
		sendError(w, "Game has no fixture file linked", http.StatusBadRequest)
		return
	}

	// Get all matches in this round from the fixture file
	rows, err := lmsDB.Query(`
		SELECT id, home_team, away_team, result
		FROM matches WHERE fixture_file_id = $1 AND round_number = $2
	`, fixtureFileID, roundNumber)
	if err != nil {
		sendError(w, "Failed to get matches", http.StatusInternalServerError)
		return
	}

	type matchInfo struct {
		ID       int
		HomeTeam string
		AwayTeam string
		Result   string
	}
	var matches []matchInfo
	for rows.Next() {
		var m matchInfo
		if err := rows.Scan(&m.ID, &m.HomeTeam, &m.AwayTeam, &m.Result); err == nil {
			matches = append(matches, m)
		}
	}
	rows.Close()

	if len(matches) == 0 {
		sendError(w, "No matches found for this round in the fixture file", http.StatusBadRequest)
		return
	}

	// Check all matches have results
	missing := 0
	for _, m := range matches {
		if strings.TrimSpace(m.Result) == "" {
			missing++
		}
	}
	if missing > 0 {
		sendError(w, fmt.Sprintf("%d match(es) in this round have no result yet", missing), http.StatusBadRequest)
		return
	}

	// Evaluate predictions for each match, scoped to this game
	totalProcessed := 0
	for _, m := range matches {
		processed, err := evaluatePredictionsForMatch(m.ID, gameID, m.HomeTeam, m.AwayTeam, m.Result, postponementRule)
		if err != nil {
			log.Printf("Error evaluating match %d: %v", m.ID, err)
		}
		totalProcessed += processed
	}

	// Count survived/eliminated for this game/round
	var survived, eliminated int
	lmsDB.QueryRow(`
		SELECT
			COUNT(CASE WHEN is_correct = TRUE THEN 1 END),
			COUNT(CASE WHEN is_correct = FALSE AND voided = FALSE THEN 1 END)
		FROM predictions
		WHERE game_id = $1 AND round_number = $2
	`, gameID, roundNumber).Scan(&survived, &eliminated)

	logAudit(r.Header.Get("X-Admin-Email"), "lms_round_process", gameIDStr+"/"+roundStr, map[string]interface{}{
		"processed": totalProcessed, "survived": survived, "eliminated": eliminated,
	})
	sendJSON(w, map[string]interface{}{
		"success":   true,
		"processed": totalProcessed,
		"survived":  survived,
		"eliminated": eliminated,
	})
}

// --- LMS Predictions ---

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

// evaluatePredictionsForMatch marks predictions correct/incorrect for a specific game.
// gameID ensures that only picks in this competition are affected (multiple games, same fixture file).
func evaluatePredictionsForMatch(matchID int, gameID int, homeTeam, awayTeam, result, postponementRule string) (int, error) {
	winnerTeam, isPostponed := parseResult(result, homeTeam, awayTeam)

	rows, err := lmsDB.Query(`
		SELECT id, user_id, predicted_team FROM predictions WHERE match_id = $1 AND game_id = $2
	`, matchID, gameID)
	if err != nil {
		return 0, err
	}

	type pred struct {
		ID            int
		UserID        string
		PredictedTeam string
	}
	var preds []pred
	for rows.Next() {
		var p pred
		if err := rows.Scan(&p.ID, &p.UserID, &p.PredictedTeam); err == nil {
			preds = append(preds, p)
		}
	}
	rows.Close()

	if len(preds) == 0 {
		return 0, nil
	}

	tx, err := lmsDB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	for _, p := range preds {
		if isPostponed {
			if postponementRule == "loss" {
				tx.Exec("UPDATE predictions SET is_correct = FALSE WHERE id = $1", p.ID)
				tx.Exec("UPDATE game_players SET is_active = FALSE WHERE user_id = $1 AND game_id = $2", p.UserID, gameID)
			} else {
				tx.Exec("UPDATE predictions SET voided = TRUE WHERE id = $1", p.ID)
			}
		} else if winnerTeam == "" {
			// Draw — all predictors eliminated
			tx.Exec("UPDATE predictions SET is_correct = FALSE WHERE id = $1", p.ID)
			tx.Exec("UPDATE game_players SET is_active = FALSE WHERE user_id = $1 AND game_id = $2", p.UserID, gameID)
		} else {
			isCorrect := p.PredictedTeam == winnerTeam
			tx.Exec("UPDATE predictions SET is_correct = $1 WHERE id = $2", isCorrect, p.ID)
			if !isCorrect {
				tx.Exec("UPDATE game_players SET is_active = FALSE WHERE user_id = $1 AND game_id = $2", p.UserID, gameID)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return len(preds), nil
}

// parseResult parses a match result string and returns the winning team.
// Returns ("", false) for a draw, ("", true) for postponed, or (teamName, false) for a win.
func parseResult(result, homeTeam, awayTeam string) (winnerTeam string, isPostponed bool) {
	if strings.ToUpper(strings.TrimSpace(result)) == "P - P" {
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
