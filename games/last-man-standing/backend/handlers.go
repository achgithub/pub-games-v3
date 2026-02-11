package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

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
		ID               int    `json:"id"`
		Name             string `json:"name"`
		Status           string `json:"status"`
		WinnerCount      int    `json:"winnerCount"`
		PostponementRule string `json:"postponementRule"`
	}
	err = appDB.QueryRow(`
		SELECT id, name, status, winner_count, postponement_rule
		FROM games WHERE id = $1
	`, gameID).Scan(&game.ID, &game.Name, &game.Status, &game.WinnerCount, &game.PostponementRule)
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
		SELECT id, round_number, submission_deadline, status
		FROM rounds
		WHERE game_id = $1 AND status = 'open'
		ORDER BY round_number
	`, gameID)
	if err != nil {
		log.Printf("Error getting open rounds: %v", err)
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
		var hasPrediction bool
		appDB.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM predictions
				WHERE user_id = $1 AND game_id = $2 AND round_number = $3 AND voided = FALSE
			)
		`, user.Email, gameID, roundNumber).Scan(&hasPrediction)

		rounds = append(rounds, map[string]interface{}{
			"id":           id,
			"roundNumber":  roundNumber,
			"deadline":     deadline,
			"status":       status,
			"hasPredicted": hasPrediction,
		})
	}

	if rounds == nil {
		rounds = []map[string]interface{}{}
	}
	sendJSON(w, map[string]interface{}{"rounds": rounds})
}

// handleGetMatches returns matches for a specific game round.
func handleGetMatches(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameIDStr := vars["gameId"]
	roundStr := vars["round"]

	rows, err := appDB.Query(`
		SELECT id, match_number, date, location, home_team, away_team, result, status
		FROM matches
		WHERE game_id = $1 AND round_number = $2
		ORDER BY match_number
	`, gameIDStr, roundStr)
	if err != nil {
		log.Printf("Error getting matches: %v", err)
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

	// Check if this player has already predicted this round
	gameID, _ := strconv.Atoi(gameIDStr)
	roundNumber, _ := strconv.Atoi(roundStr)
	var myPrediction interface{}
	var predMatchID int
	var predTeam string
	err = appDB.QueryRow(`
		SELECT match_id, predicted_team FROM predictions
		WHERE user_id = $1 AND game_id = $2 AND round_number = $3 AND voided = FALSE
	`, user.Email, gameID, roundNumber).Scan(&predMatchID, &predTeam)
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
func handleSubmitPrediction(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		MatchID     int    `json:"matchId"`
		RoundNumber int    `json:"roundNumber"`
		Team        string `json:"team"`
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

	// Check round is open
	var roundStatus string
	err = appDB.QueryRow(`
		SELECT status FROM rounds WHERE game_id = $1 AND round_number = $2
	`, gameID, req.RoundNumber).Scan(&roundStatus)
	if err != nil || roundStatus != "open" {
		sendError(w, "Round is not open for predictions", http.StatusBadRequest)
		return
	}

	// Validate the match belongs to this round and get teams
	var homeTeam, awayTeam string
	err = appDB.QueryRow(`
		SELECT home_team, away_team FROM matches
		WHERE id = $1 AND game_id = $2 AND round_number = $3
	`, req.MatchID, gameID, req.RoundNumber).Scan(&homeTeam, &awayTeam)
	if err != nil {
		sendError(w, "Invalid match for this round", http.StatusBadRequest)
		return
	}

	if req.Team != homeTeam && req.Team != awayTeam {
		sendError(w, "Invalid team for this match", http.StatusBadRequest)
		return
	}

	// Check team hasn't been used in this game (excluding current round and voided)
	var usedCount int
	appDB.QueryRow(`
		SELECT COUNT(*) FROM predictions
		WHERE user_id = $1 AND game_id = $2 AND predicted_team = $3
		  AND voided = FALSE AND round_number != $4
	`, user.Email, gameID, req.Team, req.RoundNumber).Scan(&usedCount)
	if usedCount > 0 {
		sendError(w, fmt.Sprintf("You have already used %s this game", req.Team), http.StatusBadRequest)
		return
	}

	// Upsert prediction
	_, err = appDB.Exec(`
		INSERT INTO predictions (user_id, game_id, match_id, round_number, predicted_team)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, game_id, round_number) DO UPDATE
		SET match_id = $3, predicted_team = $5, voided = FALSE, is_correct = NULL, created_at = NOW()
	`, user.Email, gameID, req.MatchID, req.RoundNumber, req.Team)
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
		SELECT p.round_number, p.predicted_team, p.is_correct, p.voided,
		       m.home_team, m.away_team, m.result, m.date
		FROM predictions p
		JOIN matches m ON m.id = p.match_id
		WHERE p.user_id = $1 AND p.game_id = $2
		ORDER BY p.round_number
	`, user.Email, gameID)
	if err != nil {
		log.Printf("Error getting predictions: %v", err)
		sendError(w, "Failed to get predictions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var predictions []map[string]interface{}
	for rows.Next() {
		var roundNumber int
		var predictedTeam, homeTeam, awayTeam, result, date string
		var isCorrect *bool
		var voided bool
		if err := rows.Scan(&roundNumber, &predictedTeam, &isCorrect, &voided, &homeTeam, &awayTeam, &result, &date); err != nil {
			continue
		}
		predictions = append(predictions, map[string]interface{}{
			"roundNumber":   roundNumber,
			"predictedTeam": predictedTeam,
			"isCorrect":     isCorrect,
			"voided":        voided,
			"homeTeam":      homeTeam,
			"awayTeam":      awayTeam,
			"result":        result,
			"date":          date,
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

// handleGetRoundSummary returns stats for a round (works for open or closed).
func handleGetRoundSummary(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	_ = user // visible to all authenticated players

	vars := mux.Vars(r)
	gameIDStr := vars["gameId"]
	roundStr := vars["round"]

	var deadline, status string
	err := appDB.QueryRow(`
		SELECT submission_deadline, status FROM rounds
		WHERE game_id = $1 AND round_number = $2
	`, gameIDStr, roundStr).Scan(&deadline, &status)
	if err != nil {
		sendError(w, "Round not found", http.StatusNotFound)
		return
	}

	rows, err := appDB.Query(`
		SELECT user_id, predicted_team, is_correct, voided
		FROM predictions
		WHERE game_id = $1 AND round_number = $2
		ORDER BY predicted_team
	`, gameIDStr, roundStr)
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
	}
	var preds []PredSummary
	survived, eliminated := 0, 0
	for rows.Next() {
		var p PredSummary
		if err := rows.Scan(&p.UserID, &p.PredictedTeam, &p.IsCorrect, &p.Voided); err != nil {
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
		preds = []PredSummary{}
	}

	sendJSON(w, map[string]interface{}{
		"gameId":      gameIDStr,
		"roundNumber": roundStr,
		"deadline":    deadline,
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
