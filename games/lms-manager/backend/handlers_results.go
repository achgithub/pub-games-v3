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
// RESULTS & PROCESSING
// ============================================================================

// HandleSetPickResult - PUT /api/picks/{id}/result
func HandleSetPickResult(w http.ResponseWriter, r *http.Request) {
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
		Result string `json:"result"` // "win" or "lose"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Result != "win" && req.Result != "lose" {
		http.Error(w, "result must be 'win' or 'lose'", http.StatusBadRequest)
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

	_, err = db.Exec(`
		UPDATE managed_picks
		SET result = $1
		WHERE id = $2
	`, req.Result, pickID)

	if err != nil {
		log.Printf("Failed to set pick result: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// HandleCloseRound - POST /api/rounds/{roundId}/close
func HandleCloseRound(w http.ResponseWriter, r *http.Request) {
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

	// Verify ownership
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

	_, err = db.Exec(`
		UPDATE managed_rounds
		SET status = 'closed'
		WHERE id = $1
	`, roundID)

	if err != nil {
		log.Printf("Failed to close round: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// HandleProcessRound - POST /api/rounds/{roundId}/process
func HandleProcessRound(w http.ResponseWriter, r *http.Request) {
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

	// Verify ownership and get round info
	var managerEmail string
	var gameID, roundNumber int
	err = db.QueryRow(`
		SELECT g.manager_email, r.game_id, r.round_number
		FROM managed_rounds r
		JOIN managed_games g ON r.game_id = g.id
		WHERE r.id = $1
	`, roundID).Scan(&managerEmail, &gameID, &roundNumber)
	if err != nil || managerEmail != user.Email {
		http.Error(w, "Round not found", http.StatusNotFound)
		return
	}

	// Get all picks with results for this round
	rows, err := db.Query(`
		SELECT player_nickname, result
		FROM managed_picks
		WHERE round_id = $1 AND result IS NOT NULL
	`, roundID)
	if err != nil {
		log.Printf("Failed to query picks: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	eliminated := []string{}
	for rows.Next() {
		var playerNickname string
		var result string
		if err := rows.Scan(&playerNickname, &result); err != nil {
			continue
		}
		if result == "lose" {
			eliminated = append(eliminated, playerNickname)
		}
	}

	// Eliminate losing players
	if len(eliminated) > 0 {
		_, err = db.Exec(`
			UPDATE managed_game_players
			SET status = 'eliminated', eliminated_round = $1
			WHERE game_id = $2 AND player_nickname = ANY($3)
		`, roundNumber, gameID, pq.Array(eliminated))

		if err != nil {
			log.Printf("Failed to eliminate players: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"eliminated": eliminated,
	})
}

// HandleDeclareWinner - POST /api/games/{gameId}/declare-winner
func HandleDeclareWinner(w http.ResponseWriter, r *http.Request) {
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

	// Get all active players (they become joint winners)
	rows, err := db.Query(`
		SELECT player_nickname
		FROM managed_game_players
		WHERE game_id = $1 AND status = 'active'
	`, gameID)
	if err != nil {
		log.Printf("Failed to query active players: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	winners := []string{}
	for rows.Next() {
		var playerNickname string
		if err := rows.Scan(&playerNickname); err != nil {
			continue
		}
		winners = append(winners, playerNickname)
	}

	if len(winners) == 0 {
		http.Error(w, "No active players to declare as winners", http.StatusBadRequest)
		return
	}

	// Update game as completed with winners
	_, err = db.Exec(`
		UPDATE managed_games
		SET status = 'completed', winner_names = $1
		WHERE id = $2
	`, pq.Array(winners), gameID)

	if err != nil {
		log.Printf("Failed to declare winners: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Mark players as winners
	_, err = db.Exec(`
		UPDATE managed_game_players
		SET status = 'winner'
		WHERE game_id = $1 AND player_nickname = ANY($2)
	`, gameID, pq.Array(winners))

	if err != nil {
		log.Printf("Failed to update player status: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"winners": winners,
	})
}

// ============================================================================
// REPORTING
// ============================================================================

// HandleGetReport - GET /api/games/{gameId}/report
// Public endpoint (can be called without auth for embed mode)
func HandleGetReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["gameId"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Get game info
	var game ManagedGame
	var winnerNames pq.StringArray
	err = db.QueryRow(`
		SELECT id, manager_email, game_name, status, winner_names, created_at
		FROM managed_games
		WHERE id = $1
	`, gameID).Scan(&game.ID, &game.ManagerEmail, &game.GameName, &game.Status, &winnerNames, &game.CreatedAt)
	if err != nil {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}
	game.WinnerNames = winnerNames

	// Get all rounds
	roundRows, err := db.Query(`
		SELECT id, round_number, status
		FROM managed_rounds
		WHERE game_id = $1
		ORDER BY round_number
	`, gameID)
	if err != nil {
		log.Printf("Failed to query rounds: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer roundRows.Close()

	rounds := []RoundReport{}
	for roundRows.Next() {
		var roundID, roundNumber int
		var status string
		if err := roundRows.Scan(&roundID, &roundNumber, &status); err != nil {
			continue
		}

		// Count active players at start of this round
		var activePlayers int
		db.QueryRow(`
			SELECT COUNT(*)
			FROM managed_game_players
			WHERE game_id = $1 AND (status = 'active' OR (status = 'eliminated' AND eliminated_round >= $2))
		`, gameID, roundNumber).Scan(&activePlayers)

		// Get team summary for this round (anonymous counts + manager flag)
		pickRows, err := db.Query(`
			SELECT team_name, COUNT(*) as count
			FROM managed_picks
			WHERE round_id = $1
			GROUP BY team_name
			ORDER BY count DESC, team_name
		`, roundID)
		if err != nil {
			continue
		}

		teamSummary := []TeamSummary{}
		for pickRows.Next() {
			var ts TeamSummary
			if err := pickRows.Scan(&ts.TeamName, &ts.Count); err != nil {
				continue
			}

			// Check if manager picked this team
			var managerPicked bool
			db.QueryRow(`
				SELECT EXISTS(
					SELECT 1 FROM managed_picks
					WHERE round_id = $1 AND team_name = $2
					AND player_nickname IN (
						SELECT player_nickname FROM managed_players WHERE manager_email = $3
					)
				)
			`, roundID, ts.TeamName, game.ManagerEmail).Scan(&managerPicked)
			ts.ManagerPicked = managerPicked

			teamSummary = append(teamSummary, ts)
		}
		pickRows.Close()

		// Get eliminated players for this round (if closed)
		eliminatedList := []string{}
		if status == "closed" {
			elimRows, err := db.Query(`
				SELECT player_nickname
				FROM managed_game_players
				WHERE game_id = $1 AND eliminated_round = $2
				ORDER BY player_nickname
			`, gameID, roundNumber)
			if err == nil {
				for elimRows.Next() {
					var playerNickname string
					if err := elimRows.Scan(&playerNickname); err == nil {
						eliminatedList = append(eliminatedList, playerNickname)
					}
				}
				elimRows.Close()
			}
		}

		rounds = append(rounds, RoundReport{
			RoundNumber:    roundNumber,
			Status:         status,
			ActivePlayers:  activePlayers,
			TeamSummary:    teamSummary,
			EliminatedList: eliminatedList,
		})
	}

	report := GameReport{
		GameID:       game.ID,
		GameName:     game.GameName,
		ManagerEmail: game.ManagerEmail,
		Status:       game.Status,
		WinnerNames:  game.WinnerNames,
		Rounds:       rounds,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

// HandleGetAvailableTeams - GET /api/rounds/{roundId}/available-teams
func HandleGetAvailableTeams(w http.ResponseWriter, r *http.Request) {
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

	// Get game teams minus already used teams
	rows, err := db.Query(`
		SELECT t.team_name
		FROM managed_game_teams t
		JOIN managed_rounds r ON t.game_id = r.game_id
		WHERE r.id = $1
		AND t.team_name NOT IN (
			SELECT team_name FROM managed_picks WHERE game_id = r.game_id
		)
		ORDER BY t.team_name
	`, roundID)
	if err != nil {
		log.Printf("Failed to query available teams: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	teams := []string{}
	for rows.Next() {
		var teamName string
		if err := rows.Scan(&teamName); err == nil {
			teams = append(teams, teamName)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

// HandleGetAvailablePlayers - GET /api/rounds/{roundId}/available-players
func HandleGetAvailablePlayers(w http.ResponseWriter, r *http.Request) {
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

	// Get active players who haven't picked yet in this round
	rows, err := db.Query(`
		SELECT p.player_nickname
		FROM managed_game_players p
		JOIN managed_rounds r ON p.game_id = r.game_id
		WHERE r.id = $1 AND p.status = 'active'
		AND p.player_nickname NOT IN (
			SELECT player_nickname FROM managed_picks WHERE round_id = $1
		)
		ORDER BY p.player_nickname
	`, roundID)
	if err != nil {
		log.Printf("Failed to query available players: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	players := []string{}
	for rows.Next() {
		var playerNickname string
		if err := rows.Scan(&playerNickname); err == nil {
			players = append(players, playerNickname)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}
