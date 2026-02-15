package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/gorilla/mux"
)

// handleConfig returns app config with optional impersonation state.
// Takes identityDB as a closure parameter — no auth middleware applied to this route.
func handleConfig(identityDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isImpersonating := false
		impersonatedBy := ""
		impersonatedEmail := ""

		if token := extractBearerToken(r); token != "" {
			if email, by, ok := resolveImpersonation(identityDB, token); ok {
				isImpersonating = true
				impersonatedBy = by
				impersonatedEmail = email
			}
		}

		sendJSON(w, map[string]interface{}{
			"appName":           "Last Man Standing",
			"version":           "1.0.0",
			"isImpersonating":   isImpersonating,
			"impersonatedBy":    impersonatedBy,
			"impersonatedEmail": impersonatedEmail,
		})
	}
}

// handleGetCurrentGame returns the current active game.
func handleGetCurrentGame(w http.ResponseWriter, r *http.Request) {
	gameID, err := getCurrentGameID()
	if err != nil {
		sendJSON(w, map[string]interface{}{"game": nil})
		return
	}

	var game struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		Status      string `json:"status"`
		WinnerCount int    `json:"winnerCount"`
	}
	err = appDB.QueryRow(`
		SELECT id, name, status, winner_count
		FROM games WHERE id = $1
	`, gameID).Scan(&game.ID, &game.Name, &game.Status, &game.WinnerCount)
	if err != nil {
		sendJSON(w, map[string]interface{}{"game": nil})
		return
	}

	sendJSON(w, map[string]interface{}{"game": game})
}

// handleJoinGame joins the current game.
func handleJoinGame(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	gameID, err := getCurrentGameID()
	if err != nil {
		sendError(w, "No active game", http.StatusBadRequest)
		return
	}

	_, err = appDB.Exec(`
		INSERT INTO game_players (user_id, game_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, game_id) DO NOTHING
	`, user.Email, gameID)
	if err != nil {
		log.Printf("Error joining game: %v", err)
		sendError(w, "Failed to join game", http.StatusInternalServerError)
		return
	}

	sendJSON(w, map[string]interface{}{"success": true})
}

// handleGetGameStatus returns the player's status in the current game.
func handleGetGameStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	gameID, err := getCurrentGameID()
	if err != nil {
		sendJSON(w, map[string]interface{}{"inGame": false, "gameID": nil})
		return
	}

	var isActive bool
	err = appDB.QueryRow(`
		SELECT is_active FROM game_players
		WHERE user_id = $1 AND game_id = $2
	`, user.Email, gameID).Scan(&isActive)
	if err != nil {
		sendJSON(w, map[string]interface{}{"inGame": false, "gameID": gameID})
		return
	}

	sendJSON(w, map[string]interface{}{
		"inGame":   true,
		"isActive": isActive,
		"gameID":   gameID,
	})
}

// handleGetOpenRounds returns rounds open for prediction.
// Returns id, label, startDate, endDate, status, hasPredicted.
func handleGetOpenRounds(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	gameID, err := getCurrentGameID()
	if err != nil {
		sendJSON(w, map[string]interface{}{"rounds": []interface{}{}})
		return
	}

	rows, err := appDB.Query(`
		SELECT id, label, start_date, end_date, submission_deadline, status
		FROM rounds
		WHERE game_id = $1 AND status = 'open'
		ORDER BY label
	`, gameID)
	if err != nil {
		log.Printf("Error getting open rounds: %v", err)
		sendError(w, "Failed to get rounds", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rounds []map[string]interface{}
	for rows.Next() {
		var id, label int
		var startDate, endDate time.Time
		var deadline sql.NullTime
		var status string
		if err := rows.Scan(&id, &label, &startDate, &endDate, &deadline, &status); err != nil {
			continue
		}
		var hasPrediction bool
		appDB.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM predictions
				WHERE user_id = $1 AND game_id = $2 AND round_id = $3 AND voided = FALSE
			)
		`, user.Email, gameID, id).Scan(&hasPrediction)

		var deadlineStr interface{}
		if deadline.Valid {
			deadlineStr = deadline.Time.Format(time.RFC3339)
		}
		rounds = append(rounds, map[string]interface{}{
			"id":                 id,
			"label":              label,
			"startDate":          startDate.Format("2006-01-02"),
			"endDate":            endDate.Format("2006-01-02"),
			"submissionDeadline": deadlineStr,
			"status":             status,
			"hasPredicted":       hasPrediction,
		})
	}

	if rounds == nil {
		rounds = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"rounds": rounds})
}

// handleGetMatches returns matches for a round (by round ID) within the round's date window.
func handleGetMatches(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameIDStr := vars["gameId"]
	roundIDStr := vars["roundId"]

	gameID, _ := strconv.Atoi(gameIDStr)
	roundID, _ := strconv.Atoi(roundIDStr)

	// Look up round date range
	var startDate, endDate time.Time
	err := appDB.QueryRow(`
		SELECT start_date, end_date FROM rounds WHERE id = $1 AND game_id = $2
	`, roundID, gameID).Scan(&startDate, &endDate)
	if err != nil {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	rows, err := appDB.Query(`
		SELECT m.id, m.match_number, m.match_date, m.location, m.home_team, m.away_team, m.result, m.status
		FROM matches m
		JOIN games g ON g.fixture_file_id = m.fixture_file_id
		WHERE g.id = $1 AND m.match_date BETWEEN $2 AND $3
		ORDER BY m.match_date, m.match_number
	`, gameID, startDate, endDate)
	if err != nil {
		log.Printf("Error getting matches: %v", err)
		sendError(w, "Failed to get matches", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var matches []map[string]interface{}
	for rows.Next() {
		var id, matchNumber int
		var matchDate time.Time
		var location, homeTeam, awayTeam, result, status string
		if err := rows.Scan(&id, &matchNumber, &matchDate, &location, &homeTeam, &awayTeam, &result, &status); err != nil {
			continue
		}
		matches = append(matches, map[string]interface{}{
			"id":          id,
			"matchNumber": matchNumber,
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

	// Check if this player has already predicted this round
	var myPrediction interface{}
	var predMatchID int
	var predTeam string
	err = appDB.QueryRow(`
		SELECT match_id, predicted_team FROM predictions
		WHERE user_id = $1 AND game_id = $2 AND round_id = $3 AND voided = FALSE
	`, user.Email, gameID, roundID).Scan(&predMatchID, &predTeam)
	if err == nil {
		myPrediction = map[string]interface{}{
			"matchId":       predMatchID,
			"predictedTeam": predTeam,
		}
	}

	sendJSON(w, map[string]interface{}{
		"matches":      matches,
		"myPrediction": myPrediction,
	})
}

// handleSubmitPrediction submits or updates a player's prediction for a round.
// Body: { matchId, roundId, team }
func handleSubmitPrediction(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		MatchID int    `json:"matchId"`
		RoundID int    `json:"roundId"`
		Team    string `json:"team"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	gameID, err := getCurrentGameID()
	if err != nil {
		sendError(w, "No active game", http.StatusBadRequest)
		return
	}

	// Check player is in game and active
	var isActive bool
	err = appDB.QueryRow(`
		SELECT is_active FROM game_players WHERE user_id = $1 AND game_id = $2
	`, user.Email, gameID).Scan(&isActive)
	if err != nil {
		sendError(w, "You are not in the current game", http.StatusBadRequest)
		return
	}
	if !isActive {
		sendError(w, "You have been eliminated from this game", http.StatusBadRequest)
		return
	}

	// Check round is open and belongs to this game
	var roundStatus string
	var startDate, endDate time.Time
	err = appDB.QueryRow(`
		SELECT status, start_date, end_date FROM rounds WHERE id = $1 AND game_id = $2
	`, req.RoundID, gameID).Scan(&roundStatus, &startDate, &endDate)
	if err != nil || roundStatus != "open" {
		sendError(w, "Round is not open for predictions", http.StatusBadRequest)
		return
	}

	// Validate the match belongs to this round's date window via the game's fixture file
	var homeTeam, awayTeam string
	err = appDB.QueryRow(`
		SELECT m.home_team, m.away_team FROM matches m
		JOIN games g ON g.fixture_file_id = m.fixture_file_id
		WHERE m.id = $1 AND g.id = $2 AND m.match_date BETWEEN $3 AND $4
	`, req.MatchID, gameID, startDate, endDate).Scan(&homeTeam, &awayTeam)
	if err != nil {
		sendError(w, "Invalid match for this round", http.StatusBadRequest)
		return
	}

	if req.Team != homeTeam && req.Team != awayTeam {
		sendError(w, "Invalid team for this match", http.StatusBadRequest)
		return
	}

	// Check team hasn't been used in this game (excluding current round and voided picks)
	var usedCount int
	appDB.QueryRow(`
		SELECT COUNT(*) FROM predictions
		WHERE user_id = $1 AND game_id = $2 AND predicted_team = $3
		  AND voided = FALSE AND round_id != $4
	`, user.Email, gameID, req.Team, req.RoundID).Scan(&usedCount)
	if usedCount > 0 {
		sendError(w, fmt.Sprintf("You have already used %s this game", req.Team), http.StatusBadRequest)
		return
	}

	// Upsert prediction
	_, err = appDB.Exec(`
		INSERT INTO predictions (user_id, game_id, round_id, match_id, predicted_team)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, game_id, round_id) DO UPDATE
		SET match_id = $4, predicted_team = $5, voided = FALSE, is_correct = NULL, bye = FALSE, created_at = NOW()
	`, user.Email, gameID, req.RoundID, req.MatchID, req.Team)
	if err != nil {
		log.Printf("Error submitting prediction: %v", err)
		sendError(w, "Failed to submit prediction", http.StatusInternalServerError)
		return
	}

	sendJSON(w, map[string]interface{}{"success": true})
}

// handleGetPredictions returns the player's predictions for the current game.
func handleGetPredictions(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	gameID, err := getCurrentGameID()
	if err != nil {
		sendJSON(w, map[string]interface{}{"predictions": []interface{}{}})
		return
	}

	rows, err := appDB.Query(`
		SELECT rnd.label, p.predicted_team, p.is_correct, p.voided, p.bye,
		       m.home_team, m.away_team, m.result, m.match_date,
		       rnd.start_date, rnd.end_date
		FROM predictions p
		JOIN rounds rnd ON rnd.id = p.round_id
		JOIN matches m ON m.id = p.match_id
		WHERE p.user_id = $1 AND p.game_id = $2
		ORDER BY rnd.label
	`, user.Email, gameID)
	if err != nil {
		log.Printf("Error getting predictions: %v", err)
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var predictions []map[string]interface{}
	for rows.Next() {
		var label int
		var predictedTeam, homeTeam, awayTeam, result string
		var matchDate, startDate, endDate time.Time
		var isCorrect *bool
		var voided, bye bool
		if err := rows.Scan(&label, &predictedTeam, &isCorrect, &voided, &bye,
			&homeTeam, &awayTeam, &result, &matchDate, &startDate, &endDate); err != nil {
			continue
		}
		predictions = append(predictions, map[string]interface{}{
			"roundNumber":   label,
			"startDate":     startDate.Format("2006-01-02"),
			"endDate":       endDate.Format("2006-01-02"),
			"predictedTeam": predictedTeam,
			"isCorrect":     isCorrect,
			"voided":        voided,
			"bye":           bye,
			"homeTeam":      homeTeam,
			"awayTeam":      awayTeam,
			"result":        result,
			"date":          matchDate.Format("2006-01-02"),
		})
	}
	if predictions == nil {
		predictions = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"predictions": predictions})
}

// handleGetUsedTeams returns teams the player has already picked this game.
func handleGetUsedTeams(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	gameID, err := getCurrentGameID()
	if err != nil {
		sendJSON(w, map[string]interface{}{"teams": []string{}})
		return
	}

	rows, err := appDB.Query(`
		SELECT predicted_team FROM predictions
		WHERE user_id = $1 AND game_id = $2 AND voided = FALSE
	`, user.Email, gameID)
	if err != nil {
		sendError(w, "Failed to get used teams", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var teams []string
	for rows.Next() {
		var team string
		if err := rows.Scan(&team); err == nil {
			teams = append(teams, team)
		}
	}
	if teams == nil {
		teams = []string{}
	}
	sendJSON(w, map[string]interface{}{"teams": teams})
}

// handleGetStandings returns all players in the current game.
func handleGetStandings(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	_ = user // standings are visible to all authenticated players

	gameID, err := getCurrentGameID()
	if err != nil {
		sendJSON(w, map[string]interface{}{"players": []interface{}{}})
		return
	}

	rows, err := appDB.Query(`
		SELECT user_id, is_active, joined_at
		FROM game_players
		WHERE game_id = $1
		ORDER BY is_active DESC, joined_at
	`, gameID)
	if err != nil {
		log.Printf("Error getting standings: %v", err)
		sendError(w, "Failed to get standings", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var players []map[string]interface{}
	for rows.Next() {
		var userID string
		var isActive bool
		var joinedAt interface{}
		if err := rows.Scan(&userID, &isActive, &joinedAt); err != nil {
			continue
		}
		players = append(players, map[string]interface{}{
			"userId":   userID,
			"isActive": isActive,
			"joinedAt": joinedAt,
		})
	}
	if players == nil {
		players = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"players": players})
}

// handleGetRoundSummary returns stats for a round (by round ID).
func handleGetRoundSummary(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	_ = user // visible to all authenticated players

	vars := mux.Vars(r)
	gameIDStr := vars["gameId"]
	roundIDStr := vars["roundId"]

	var label int
	var startDate, endDate time.Time
	var status string
	err := appDB.QueryRow(`
		SELECT label, start_date, end_date, status FROM rounds
		WHERE id = $1 AND game_id = $2
	`, roundIDStr, gameIDStr).Scan(&label, &startDate, &endDate, &status)
	if err != nil {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	rows, err := appDB.Query(`
		SELECT user_id, predicted_team, is_correct, voided, bye
		FROM predictions
		WHERE round_id = $1
		ORDER BY predicted_team
	`, roundIDStr)
	if err != nil {
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type PredSummary struct {
		UserID        string `json:"userId"`
		PredictedTeam string `json:"predictedTeam"`
		IsCorrect     *bool  `json:"isCorrect"`
		Voided        bool   `json:"voided"`
		Bye           bool   `json:"bye"`
	}
	var preds []PredSummary
	survived, eliminated := 0, 0
	for rows.Next() {
		var p PredSummary
		if err := rows.Scan(&p.UserID, &p.PredictedTeam, &p.IsCorrect, &p.Voided, &p.Bye); err != nil {
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
		preds = []PredSummary{}
	}

	sendJSON(w, map[string]interface{}{
		"gameId":      gameIDStr,
		"roundNumber": label,
		"startDate":   startDate.Format("2006-01-02"),
		"endDate":     endDate.Format("2006-01-02"),
		"status":      status,
		"predictions": preds,
		"survived":    survived,
		"eliminated":  eliminated,
	})
}

// getCurrentGameID gets the current game ID from the settings table.
func getCurrentGameID() (int, error) {
	var gameIDStr string
	err := appDB.QueryRow("SELECT value FROM settings WHERE key = 'current_game_id'").Scan(&gameIDStr)
	if err != nil {
		return 0, fmt.Errorf("no current game set")
	}
	gameID, err := strconv.Atoi(gameIDStr)
	if err != nil {
		return 0, fmt.Errorf("invalid game ID: %v", err)
	}
	return gameID, nil
}
