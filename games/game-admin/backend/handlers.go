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
	"time"

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
// Date must be YYYY-MM-DD or DD/MM/YYYY. round_number is stored as metadata only.
// The result column is optional. Status is only set to 'completed' via the set-result endpoint.
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
	skipped := 0
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

		// Parse date into DATE — try YYYY-MM-DD then DD/MM/YYYY
		matchDate, err := parseMatchDate(strings.TrimSpace(row[2]))
		if err != nil {
			log.Printf("Skipping match %d: cannot parse date %q: %v", matchNumber, row[2], err)
			skipped++
			continue
		}

		location := strings.TrimSpace(row[3])
		homeTeam := strings.TrimSpace(row[4])
		awayTeam := strings.TrimSpace(row[5])

		result := ""
		if len(row) > 6 {
			result = strings.TrimSpace(row[6])
		}

		_, err = lmsDB.Exec(`
			INSERT INTO matches (fixture_file_id, match_number, round_number, match_date, location, home_team, away_team, result)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (fixture_file_id, match_number) DO UPDATE
			SET round_number=$3, match_date=$4, location=$5, home_team=$6, away_team=$7, result=$8
		`, fixtureFileID, matchNumber, roundNumber, matchDate, location, homeTeam, awayTeam, result)
		if err != nil {
			log.Printf("Error upserting match %d: %v", matchNumber, err)
			continue
		}
		upserted++
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_fixture_upload", strconv.Itoa(fixtureFileID), map[string]interface{}{
		"name": name, "upserted": upserted, "skipped": skipped,
	})
	sendJSON(w, map[string]interface{}{
		"success":  true,
		"id":       fixtureFileID,
		"name":     name,
		"upserted": upserted,
		"skipped":  skipped,
	})
}

// parseMatchDate parses a date string trying YYYY-MM-DD, then DD/MM/YYYY.
// Returns a time.Time truncated to midnight UTC.
func parseMatchDate(s string) (time.Time, error) {
	// Strip time component if present (e.g. "2025-08-16 15:00" → "2025-08-16")
	if idx := strings.Index(s, " "); idx != -1 {
		s = s[:idx]
	}
	// Try ISO format first
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	// Try UK/European format DD/MM/YYYY
	if t, err := time.Parse("02/01/2006", s); err == nil {
		return t, nil
	}
	// Try DD-MM-YYYY
	if t, err := time.Parse("02-01-2006", s); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("unsupported date format: %q", s)
}

// handleGetFixtureMatches returns all matches for a fixture file, ordered by date.
func handleGetFixtureMatches(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	fixtureID := vars["id"]

	rows, err := lmsDB.Query(`
		SELECT id, match_number, round_number, match_date, location, home_team, away_team, result, status
		FROM matches WHERE fixture_file_id = $1
		ORDER BY match_date, match_number
	`, fixtureID)
	if err != nil {
		sendError(w, "Failed to get matches", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var matches []map[string]interface{}
	for rows.Next() {
		var id, matchNumber, roundNumber int
		var matchDate time.Time
		var location, homeTeam, awayTeam, result, status string
		if err := rows.Scan(&id, &matchNumber, &roundNumber, &matchDate, &location, &homeTeam, &awayTeam, &result, &status); err != nil {
			continue
		}
		matches = append(matches, map[string]interface{}{
			"id":          id,
			"matchNumber": matchNumber,
			"roundNumber": roundNumber,
			"date":        matchDate.Format("2006-01-02"),
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
		SELECT g.id, g.name, g.status, g.winner_count,
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
		var name, status, fixtureName string
		var startDate interface{}
		if err := rows.Scan(&id, &name, &status, &winnerCount, &startDate, &fixtureFileID, &fixtureName); err != nil {
			continue
		}
		games = append(games, map[string]interface{}{
			"id":            id,
			"name":          name,
			"status":        status,
			"winnerCount":   winnerCount,
			"startDate":     startDate,
			"fixtureFileId": fixtureFileID,
			"fixtureName":   fixtureName,
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
		Name          string `json:"name"`
		FixtureFileID int    `json:"fixtureFileId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		sendError(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.FixtureFileID == 0 {
		sendError(w, "fixtureFileId is required", http.StatusBadRequest)
		return
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
		INSERT INTO games (name, fixture_file_id) VALUES ($1, $2) RETURNING id
	`, req.Name, req.FixtureFileID).Scan(&id)
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
		SELECT id, label, start_date, end_date, status
		FROM rounds WHERE game_id = $1 ORDER BY label
	`, gameID)
	if err != nil {
		sendError(w, "Failed to get rounds", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rounds []map[string]interface{}
	for rows.Next() {
		var id, label int
		var startDate, endDate time.Time
		var status string
		if err := rows.Scan(&id, &label, &startDate, &endDate, &status); err != nil {
			continue
		}
		var predCount int
		lmsDB.QueryRow(
			"SELECT COUNT(*) FROM predictions WHERE round_id = $1",
			id,
		).Scan(&predCount)

		rounds = append(rounds, map[string]interface{}{
			"id":        id,
			"label":     label,
			"startDate": startDate.Format("2006-01-02"),
			"endDate":   endDate.Format("2006-01-02"),
			"status":    status,
			"predCount": predCount,
		})
	}
	if rounds == nil {
		rounds = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"rounds": rounds})
}

// handleCreateRound creates a new round for a game using a date range.
// Body: { gameId, label, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD) }
func handleCreateRound(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	var req struct {
		GameID    int    `json:"gameId"`
		Label     int    `json:"label"`
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GameID == 0 || req.Label == 0 || req.StartDate == "" || req.EndDate == "" {
		sendError(w, "gameId, label, startDate, and endDate are required", http.StatusBadRequest)
		return
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		sendError(w, "startDate must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		sendError(w, "endDate must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if !endDate.After(startDate) {
		sendError(w, "endDate must be after startDate", http.StatusBadRequest)
		return
	}

	var id int
	err = lmsDB.QueryRow(`
		INSERT INTO rounds (game_id, label, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id
	`, req.GameID, req.Label, startDate, endDate).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			sendError(w, fmt.Sprintf("Round %d already exists for this game", req.Label), http.StatusConflict)
			return
		}
		log.Printf("Error creating round: %v", err)
		sendError(w, "Failed to create round", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_round_create", strconv.Itoa(id), map[string]interface{}{
		"gameId": req.GameID, "label": req.Label, "startDate": req.StartDate, "endDate": req.EndDate,
	})
	sendJSON(w, map[string]interface{}{"success": true, "id": id})
}

// handleUpdateRoundStatus opens or closes a round (identified by gameId + label).
func handleUpdateRoundStatus(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	gameID := vars["gameId"]
	label := vars["label"]

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
		UPDATE rounds SET status = $3 WHERE game_id = $1 AND label = $2
	`, gameID, label, req.Status)
	if err != nil {
		sendError(w, "Failed to update round", http.StatusInternalServerError)
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_round_status", gameID+"/"+label, map[string]interface{}{"status": req.Status})
	sendJSON(w, map[string]interface{}{"success": true})
}

// handleGetAdminRoundSummary returns round stats for admin (identified by gameId + label).
func handleGetAdminRoundSummary(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	label := vars["label"]

	var roundID int
	var startDate, endDate time.Time
	var status string
	err := lmsDB.QueryRow(`
		SELECT id, start_date, end_date, status FROM rounds WHERE game_id = $1 AND label = $2
	`, gameID, label).Scan(&roundID, &startDate, &endDate, &status)
	if err != nil {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	rows, err := lmsDB.Query(`
		SELECT p.user_id, p.predicted_team, p.is_correct, p.voided, p.bye,
		       m.home_team, m.away_team, m.result
		FROM predictions p
		JOIN matches m ON m.id = p.match_id
		WHERE p.round_id = $1
		ORDER BY p.user_id
	`, roundID)
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
		Bye           bool   `json:"bye"`
		HomeTeam      string `json:"homeTeam"`
		AwayTeam      string `json:"awayTeam"`
		Result        string `json:"result"`
	}
	var preds []PredRow
	survived, eliminated := 0, 0
	for rows.Next() {
		var p PredRow
		if err := rows.Scan(&p.UserID, &p.PredictedTeam, &p.IsCorrect, &p.Voided, &p.Bye, &p.HomeTeam, &p.AwayTeam, &p.Result); err != nil {
			continue
		}
		preds = append(preds, p)
		if p.Bye || (p.IsCorrect != nil && *p.IsCorrect) {
			survived++
		} else if p.IsCorrect != nil && !*p.IsCorrect && !p.Voided {
			eliminated++
		}
	}
	if preds == nil {
		preds = []PredRow{}
	}

	sendJSON(w, map[string]interface{}{
		"gameId":    gameID,
		"label":     label,
		"startDate": startDate.Format("2006-01-02"),
		"endDate":   endDate.Format("2006-01-02"),
		"status":    status,
		"predictions": preds,
		"survived":  survived,
		"eliminated": eliminated,
	})
}

// --- LMS Match Management ---

// handleGetLMSMatchesForGame returns matches for a game, optionally filtered by round label.
// When label is given, returns matches in that round's date window.
func handleGetLMSMatchesForGame(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	label := vars["label"] // may be empty

	var args []interface{}
	var query string

	if label != "" {
		// Look up round date range, then filter matches by date
		var startDate, endDate time.Time
		err := lmsDB.QueryRow(`
			SELECT start_date, end_date FROM rounds WHERE game_id = $1 AND label = $2
		`, gameID, label).Scan(&startDate, &endDate)
		if err != nil {
			sendError(w, "Round not found", http.StatusNotFound)
			return
		}
		query = `
			SELECT m.id, m.match_number, m.round_number, m.match_date, m.location,
			       m.home_team, m.away_team, m.result, m.status
			FROM matches m
			JOIN games g ON g.fixture_file_id = m.fixture_file_id
			WHERE g.id = $1 AND m.match_date BETWEEN $2 AND $3
			ORDER BY m.match_date, m.match_number
		`
		args = []interface{}{gameID, startDate, endDate}
	} else {
		query = `
			SELECT m.id, m.match_number, m.round_number, m.match_date, m.location,
			       m.home_team, m.away_team, m.result, m.status
			FROM matches m
			JOIN games g ON g.fixture_file_id = m.fixture_file_id
			WHERE g.id = $1
			ORDER BY m.match_date, m.match_number
		`
		args = []interface{}{gameID}
	}

	rows, err := lmsDB.Query(query, args...)
	if err != nil {
		sendError(w, "Failed to get matches", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var matches []map[string]interface{}
	for rows.Next() {
		var id, matchNumber, roundNumber int
		var matchDate time.Time
		var location, homeTeam, awayTeam, result, status string
		if err := rows.Scan(&id, &matchNumber, &roundNumber, &matchDate, &location, &homeTeam, &awayTeam, &result, &status); err != nil {
			continue
		}
		matches = append(matches, map[string]interface{}{
			"id":          id,
			"matchNumber": matchNumber,
			"roundNumber": roundNumber,
			"date":        matchDate.Format("2006-01-02"),
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
// Rounds are date-range based. For each prediction:
//   - Match in window and completed: evaluate win/draw/loss normally
//   - Match postponed OR moved outside window: player gets a bye (survives, team consumed)
//
// Pre-flight: all matches currently within the round's date window must have a result
// (status != 'upcoming'). Matches outside the window are automatically byes.
func handleProcessRound(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	vars := mux.Vars(r)
	gameIDStr := vars["gameId"]
	labelStr := vars["label"]

	gameID, _ := strconv.Atoi(gameIDStr)

	// Get round by game + label
	var roundID int
	var startDate, endDate time.Time
	err := lmsDB.QueryRow(`
		SELECT id, start_date, end_date FROM rounds WHERE game_id = $1 AND label = $2
	`, gameID, labelStr).Scan(&roundID, &startDate, &endDate)
	if err != nil {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	// Get game's fixture file
	var fixtureFileID int
	err = lmsDB.QueryRow(`SELECT fixture_file_id FROM games WHERE id = $1`, gameID).Scan(&fixtureFileID)
	if err != nil || fixtureFileID == 0 {
		sendError(w, "Game has no fixture file linked", http.StatusBadRequest)
		return
	}

	// Pre-flight: check that all matches within the date window have a result
	var pendingCount int
	lmsDB.QueryRow(`
		SELECT COUNT(*) FROM matches
		WHERE fixture_file_id = $1 AND match_date BETWEEN $2 AND $3 AND status = 'upcoming'
	`, fixtureFileID, startDate, endDate).Scan(&pendingCount)
	if pendingCount > 0 {
		sendError(w, fmt.Sprintf("%d match(es) in this round window still have no result", pendingCount), http.StatusBadRequest)
		return
	}

	// Get all predictions for this round
	rows, err := lmsDB.Query(`
		SELECT p.id, p.user_id, p.predicted_team, p.match_id,
		       m.home_team, m.away_team, m.result, m.status, m.match_date
		FROM predictions p
		JOIN matches m ON m.id = p.match_id
		WHERE p.round_id = $1
	`, roundID)
	if err != nil {
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}

	type predInfo struct {
		ID            int
		UserID        string
		PredictedTeam string
		MatchID       int
		HomeTeam      string
		AwayTeam      string
		Result        string
		MatchStatus   string
		MatchDate     time.Time
	}
	var preds []predInfo
	for rows.Next() {
		var p predInfo
		if err := rows.Scan(&p.ID, &p.UserID, &p.PredictedTeam, &p.MatchID,
			&p.HomeTeam, &p.AwayTeam, &p.Result, &p.MatchStatus, &p.MatchDate); err == nil {
			preds = append(preds, p)
		}
	}
	rows.Close()

	if len(preds) == 0 {
		sendJSON(w, map[string]interface{}{"success": true, "processed": 0, "survived": 0, "eliminated": 0})
		return
	}

	tx, err := lmsDB.Begin()
	if err != nil {
		sendError(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	survived, eliminated, byes := 0, 0, 0
	for _, p := range preds {
		// Determine if match is within this round's window
		inWindow := !p.MatchDate.Before(startDate) && !p.MatchDate.After(endDate)

		if !inWindow || p.MatchStatus == "postponed" {
			// Bye: player survives, team is consumed (voided stays FALSE)
			tx.Exec("UPDATE predictions SET bye = TRUE, is_correct = NULL WHERE id = $1", p.ID)
			byes++
			survived++
		} else {
			// Match is in window and completed — evaluate normally
			winnerTeam, _ := parseResult(p.Result, p.HomeTeam, p.AwayTeam)
			var isCorrect bool
			if winnerTeam == "" {
				// Draw — all predictors eliminated
				isCorrect = false
			} else {
				isCorrect = p.PredictedTeam == winnerTeam
			}
			tx.Exec("UPDATE predictions SET is_correct = $1 WHERE id = $2", isCorrect, p.ID)
			if isCorrect {
				survived++
			} else {
				tx.Exec("UPDATE game_players SET is_active = FALSE WHERE user_id = $1 AND game_id = $2", p.UserID, gameID)
				eliminated++
			}
		}
	}

	if err := tx.Commit(); err != nil {
		sendError(w, "Failed to commit results", http.StatusInternalServerError)
		return
	}

	logAudit(r.Header.Get("X-Admin-Email"), "lms_round_process", gameIDStr+"/"+labelStr, map[string]interface{}{
		"roundId": roundID, "survived": survived, "eliminated": eliminated, "byes": byes,
	})
	sendJSON(w, map[string]interface{}{
		"success":   true,
		"processed": len(preds),
		"survived":  survived,
		"eliminated": eliminated,
		"byes":      byes,
	})
}

// --- LMS Predictions ---

// handleGetAllPredictions returns all predictions, optionally filtered by game and round label.
func handleGetAllPredictions(w http.ResponseWriter, r *http.Request) {
	gameID := r.URL.Query().Get("gameId")
	labelStr := r.URL.Query().Get("round")

	query := `
		SELECT p.user_id, rnd.label, p.predicted_team, p.is_correct, p.voided, p.bye,
		       m.home_team, m.away_team, m.result
		FROM predictions p
		JOIN rounds rnd ON rnd.id = p.round_id
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
	if labelStr != "" {
		query += fmt.Sprintf(" AND rnd.label = $%d", argIdx)
		args = append(args, labelStr)
		argIdx++
	}
	query += " ORDER BY rnd.label, p.user_id"

	rows, err := lmsDB.Query(query, args...)
	if err != nil {
		log.Printf("Error getting predictions: %v", err)
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type PredRow struct {
		UserID        string `json:"userId"`
		RoundNumber   int    `json:"roundNumber"` // label, kept as roundNumber for UI compat
		PredictedTeam string `json:"predictedTeam"`
		IsCorrect     *bool  `json:"isCorrect"`
		Voided        bool   `json:"voided"`
		Bye           bool   `json:"bye"`
		HomeTeam      string `json:"homeTeam"`
		AwayTeam      string `json:"awayTeam"`
		Result        string `json:"result"`
	}
	var preds []PredRow
	for rows.Next() {
		var p PredRow
		if err := rows.Scan(&p.UserID, &p.RoundNumber, &p.PredictedTeam, &p.IsCorrect, &p.Voided, &p.Bye, &p.HomeTeam, &p.AwayTeam, &p.Result); err != nil {
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
