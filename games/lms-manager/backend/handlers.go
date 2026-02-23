package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/gorilla/mux"
)

// HandleConfig returns app configuration
func HandleConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"appName": APP_NAME,
		"appIcon": "🎯",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// getManagerEmail extracts manager email from context or impersonation
func getManagerEmail(r *http.Request) (string, bool) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		return "", false
	}

	// Check for impersonation (admin only)
	impersonate := r.URL.Query().Get("impersonate")
	if impersonate != "" {
		// Verify user has game_admin role
		for _, role := range user.Roles {
			if role == "game_admin" {
				return impersonate, true
			}
		}
		// If impersonation requested but user not admin, deny
		return "", false
	}

	return user.Email, true
}

// ============================================
// GROUP ENDPOINTS
// ============================================

// HandleListGroups returns all groups for the manager
func HandleListGroups(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := db.Query(`
		SELECT
			g.id, g.manager_email, g.name, g.created_at,
			COALESCE(COUNT(t.id), 0) as team_count
		FROM managed_groups g
		LEFT JOIN managed_teams t ON t.group_id = g.id
		WHERE g.manager_email = $1
		GROUP BY g.id, g.manager_email, g.name, g.created_at
		ORDER BY g.created_at DESC
	`, managerEmail)
	if err != nil {
		log.Printf("Failed to query groups: %v", err)
		http.Error(w, "Failed to fetch groups", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	groups := []GroupWithTeamCount{}
	for rows.Next() {
		var g GroupWithTeamCount
		if err := rows.Scan(&g.ID, &g.ManagerEmail, &g.Name, &g.CreatedAt, &g.TeamCount); err != nil {
			log.Printf("Failed to scan group: %v", err)
			continue
		}
		groups = append(groups, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"groups": groups,
	})
}

// HandleCreateGroup creates a new group
func HandleCreateGroup(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Group name required", http.StatusBadRequest)
		return
	}

	var groupID int
	err := db.QueryRow(`
		INSERT INTO managed_groups (manager_email, name)
		VALUES ($1, $2)
		RETURNING id
	`, managerEmail, req.Name).Scan(&groupID)
	if err != nil {
		log.Printf("Failed to create group: %v", err)
		http.Error(w, "Failed to create group", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": groupID,
	})
}

// HandleDeleteGroup deletes a group
func HandleDeleteGroup(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	result, err := db.Exec(`
		DELETE FROM managed_groups
		WHERE id = $1 AND manager_email = $2
	`, groupID, managerEmail)
	if err != nil {
		log.Printf("Failed to delete group: %v", err)
		http.Error(w, "Failed to delete group", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============================================
// TEAM ENDPOINTS
// ============================================

// HandleListTeams returns all teams in a group
func HandleListTeams(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Verify group belongs to manager
	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM managed_groups WHERE id = $1 AND manager_email = $2`, groupID, managerEmail).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	rows, err := db.Query(`
		SELECT id, group_id, name, created_at
		FROM managed_teams
		WHERE group_id = $1
		ORDER BY name ASC
	`, groupID)
	if err != nil {
		log.Printf("Failed to query teams: %v", err)
		http.Error(w, "Failed to fetch teams", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	teams := []Team{}
	for rows.Next() {
		var t Team
		if err := rows.Scan(&t.ID, &t.GroupID, &t.Name, &t.CreatedAt); err != nil {
			log.Printf("Failed to scan team: %v", err)
			continue
		}
		teams = append(teams, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"teams": teams,
	})
}

// HandleCreateTeam creates a new team in a group
func HandleCreateTeam(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Verify group belongs to manager
	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM managed_groups WHERE id = $1 AND manager_email = $2`, groupID, managerEmail).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	var req CreateTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Team name required", http.StatusBadRequest)
		return
	}

	var teamID int
	err = db.QueryRow(`
		INSERT INTO managed_teams (group_id, name)
		VALUES ($1, $2)
		RETURNING id
	`, groupID, req.Name).Scan(&teamID)
	if err != nil {
		log.Printf("Failed to create team: %v", err)
		http.Error(w, "Failed to create team", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": teamID,
	})
}

// HandleUpdateTeam updates a team
func HandleUpdateTeam(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	teamID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var req UpdateTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Verify team belongs to manager's group
	result, err := db.Exec(`
		UPDATE managed_teams
		SET name = $1
		WHERE id = $2
		AND group_id IN (SELECT id FROM managed_groups WHERE manager_email = $3)
	`, req.Name, teamID, managerEmail)
	if err != nil {
		log.Printf("Failed to update team: %v", err)
		http.Error(w, "Failed to update team", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleDeleteTeam deletes a team
func HandleDeleteTeam(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	teamID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	// Verify team belongs to manager's group
	result, err := db.Exec(`
		DELETE FROM managed_teams
		WHERE id = $1
		AND group_id IN (SELECT id FROM managed_groups WHERE manager_email = $2)
	`, teamID, managerEmail)
	if err != nil {
		log.Printf("Failed to delete team: %v", err)
		http.Error(w, "Failed to delete team", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============================================
// PLAYER ENDPOINTS
// ============================================

// HandleListPlayers returns all players in the manager's pool
func HandleListPlayers(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := db.Query(`
		SELECT id, manager_email, name, created_at
		FROM managed_players
		WHERE manager_email = $1
		ORDER BY name ASC
	`, managerEmail)
	if err != nil {
		log.Printf("Failed to query players: %v", err)
		http.Error(w, "Failed to fetch players", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	players := []Player{}
	for rows.Next() {
		var p Player
		if err := rows.Scan(&p.ID, &p.ManagerEmail, &p.Name, &p.CreatedAt); err != nil {
			log.Printf("Failed to scan player: %v", err)
			continue
		}
		players = append(players, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"players": players,
	})
}

// HandleCreatePlayer creates a new player in the pool
func HandleCreatePlayer(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreatePlayerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Player name required", http.StatusBadRequest)
		return
	}

	var playerID int
	err := db.QueryRow(`
		INSERT INTO managed_players (manager_email, name)
		VALUES ($1, $2)
		RETURNING id
	`, managerEmail, req.Name).Scan(&playerID)
	if err != nil {
		log.Printf("Failed to create player: %v", err)
		http.Error(w, "Failed to create player (name may already exist)", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": playerID,
	})
}

// HandleDeletePlayer deletes a player from the pool
func HandleDeletePlayer(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	playerID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid player ID", http.StatusBadRequest)
		return
	}

	result, err := db.Exec(`
		DELETE FROM managed_players
		WHERE id = $1 AND manager_email = $2
	`, playerID, managerEmail)
	if err != nil {
		log.Printf("Failed to delete player: %v", err)
		http.Error(w, "Failed to delete player", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Player not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============================================
// GAME ENDPOINTS
// ============================================

// HandleListGames returns all games for the manager
func HandleListGames(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := db.Query(`
		SELECT
			g.id, g.manager_email, g.name, g.group_id, g.status, g.winner_name, g.postpone_as_win, g.winner_mode, g.rollover_mode, g.max_winners, g.created_at,
			gr.name as group_name,
			COALESCE(COUNT(DISTINCT p.id), 0) as participant_count,
			COALESCE(MAX(r.round_number), 0) as current_round
		FROM managed_games g
		LEFT JOIN managed_groups gr ON gr.id = g.group_id
		LEFT JOIN managed_participants p ON p.game_id = g.id
		LEFT JOIN managed_rounds r ON r.game_id = g.id
		WHERE g.manager_email = $1
		GROUP BY g.id, gr.name
		ORDER BY g.created_at DESC
	`, managerEmail)
	if err != nil {
		log.Printf("Failed to query games: %v", err)
		http.Error(w, "Failed to fetch games", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	games := []GameWithDetails{}
	for rows.Next() {
		var gwd GameWithDetails
		var winnerName sql.NullString
		if err := rows.Scan(
			&gwd.ID, &gwd.ManagerEmail, &gwd.Name, &gwd.GroupID, &gwd.Status, &winnerName, &gwd.PostponeAsWin, &gwd.WinnerMode, &gwd.RolloverMode, &gwd.MaxWinners, &gwd.CreatedAt,
			&gwd.GroupName, &gwd.ParticipantCount, &gwd.CurrentRound,
		); err != nil {
			log.Printf("Failed to scan game: %v", err)
			continue
		}
		if winnerName.Valid {
			gwd.WinnerName = &winnerName.String
		}
		games = append(games, gwd)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"games": games,
	})
}

// HandleCreateGame creates a new game with selected players
func HandleCreateGame(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Game name required", http.StatusBadRequest)
		return
	}

	if req.GroupID == 0 {
		http.Error(w, "Group ID required", http.StatusBadRequest)
		return
	}

	if len(req.PlayerNames) == 0 {
		http.Error(w, "At least one player required", http.StatusBadRequest)
		return
	}

	// Verify group belongs to manager
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM managed_groups WHERE id = $1 AND manager_email = $2`, req.GroupID, managerEmail).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, "Failed to create game", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Create game
	var gameID int
	err = tx.QueryRow(`
		INSERT INTO managed_games (manager_email, name, group_id, status, postpone_as_win, winner_mode, rollover_mode, max_winners)
		VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
		RETURNING id
	`, managerEmail, req.Name, req.GroupID, req.PostponeAsWin, req.WinnerMode, req.RolloverMode, req.MaxWinners).Scan(&gameID)
	if err != nil {
		log.Printf("Failed to create game: %v", err)
		http.Error(w, "Failed to create game", http.StatusInternalServerError)
		return
	}

	// Add participants
	for _, playerName := range req.PlayerNames {
		_, err = tx.Exec(`
			INSERT INTO managed_participants (game_id, player_name, is_active)
			VALUES ($1, $2, TRUE)
		`, gameID, playerName)
		if err != nil {
			log.Printf("Failed to add participant: %v", err)
			http.Error(w, "Failed to add participants", http.StatusInternalServerError)
			return
		}
	}

	// Create round 1
	_, err = tx.Exec(`
		INSERT INTO managed_rounds (game_id, round_number, status)
		VALUES ($1, 1, 'open')
	`, gameID)
	if err != nil {
		log.Printf("Failed to create initial round: %v", err)
		http.Error(w, "Failed to create initial round", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, "Failed to create game", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": gameID,
	})
}

// HandleGetGame returns game details with participants and rounds
func HandleGetGame(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Get game details
	var game GameWithDetails
	var winnerName sql.NullString
	err = db.QueryRow(`
		SELECT
			g.id, g.manager_email, g.name, g.group_id, g.status, g.winner_name, g.postpone_as_win, g.winner_mode, g.rollover_mode, g.max_winners, g.created_at,
			gr.name as group_name,
			COALESCE(COUNT(DISTINCT p.id), 0) as participant_count,
			COALESCE(MAX(r.round_number), 0) as current_round
		FROM managed_games g
		LEFT JOIN managed_groups gr ON gr.id = g.group_id
		LEFT JOIN managed_participants p ON p.game_id = g.id
		LEFT JOIN managed_rounds r ON r.game_id = g.id
		WHERE g.id = $1 AND g.manager_email = $2
		GROUP BY g.id, gr.name
	`, gameID, managerEmail).Scan(
		&game.ID, &game.ManagerEmail, &game.Name, &game.GroupID, &game.Status, &winnerName, &game.PostponeAsWin, &game.WinnerMode, &game.RolloverMode, &game.MaxWinners, &game.CreatedAt,
		&game.GroupName, &game.ParticipantCount, &game.CurrentRound,
	)
	if err == sql.ErrNoRows {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to fetch game: %v", err)
		http.Error(w, "Failed to fetch game", http.StatusInternalServerError)
		return
	}
	if winnerName.Valid {
		game.WinnerName = &winnerName.String
	}

	// Get participants
	participantRows, err := db.Query(`
		SELECT id, game_id, player_name, is_active, eliminated_in_round, created_at
		FROM managed_participants
		WHERE game_id = $1
		ORDER BY player_name ASC
	`, gameID)
	if err != nil {
		log.Printf("Failed to query participants: %v", err)
		http.Error(w, "Failed to fetch participants", http.StatusInternalServerError)
		return
	}
	defer participantRows.Close()

	participants := []Participant{}
	for participantRows.Next() {
		var p Participant
		var eliminatedInRound sql.NullInt64
		if err := participantRows.Scan(&p.ID, &p.GameID, &p.PlayerName, &p.IsActive, &eliminatedInRound, &p.CreatedAt); err != nil {
			log.Printf("Failed to scan participant: %v", err)
			continue
		}
		if eliminatedInRound.Valid {
			val := int(eliminatedInRound.Int64)
			p.EliminatedInRound = &val
		}
		participants = append(participants, p)
	}

	// Get rounds
	roundRows, err := db.Query(`
		SELECT id, game_id, round_number, status, created_at
		FROM managed_rounds
		WHERE game_id = $1
		ORDER BY round_number ASC
	`, gameID)
	if err != nil {
		log.Printf("Failed to query rounds: %v", err)
		http.Error(w, "Failed to fetch rounds", http.StatusInternalServerError)
		return
	}
	defer roundRows.Close()

	rounds := []Round{}
	for roundRows.Next() {
		var r Round
		if err := roundRows.Scan(&r.ID, &r.GameID, &r.RoundNumber, &r.Status, &r.CreatedAt); err != nil {
			log.Printf("Failed to scan round: %v", err)
			continue
		}
		rounds = append(rounds, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"game":         game,
		"participants": participants,
		"rounds":       rounds,
	})
}

func HandleDeleteGame(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Verify ownership
	var exists bool
	err = db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM managed_games WHERE id = $1 AND manager_email = $2)
	`, gameID, managerEmail).Scan(&exists)
	if err != nil {
		log.Printf("Failed to verify game ownership: %v", err)
		http.Error(w, "Failed to verify game", http.StatusInternalServerError)
		return
	}
	if !exists {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Delete game (cascades will handle related data)
	_, err = db.Exec(`DELETE FROM managed_games WHERE id = $1`, gameID)
	if err != nil {
		log.Printf("Failed to delete game: %v", err)
		http.Error(w, "Failed to delete game", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============================================
// ROUND & PICK ENDPOINTS
// ============================================

// HandleGetRoundPicks returns all picks for a specific round
func HandleGetRoundPicks(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	roundID, err := strconv.Atoi(vars["roundId"])
	if err != nil {
		http.Error(w, "Invalid round ID", http.StatusBadRequest)
		return
	}

	// Verify round belongs to manager's game
	var count int
	err = db.QueryRow(`
		SELECT COUNT(*)
		FROM managed_rounds r
		JOIN managed_games g ON g.id = r.game_id
		WHERE r.id = $1 AND g.manager_email = $2
	`, roundID, managerEmail).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Round not found", http.StatusNotFound)
		return
	}

	// Get picks with team names
	rows, err := db.Query(`
		SELECT
			p.id, p.game_id, p.round_id, p.player_name, p.team_id, p.result, p.auto_assigned, p.created_at,
			COALESCE(t.name, '') as team_name
		FROM managed_picks p
		LEFT JOIN managed_teams t ON t.id = p.team_id
		WHERE p.round_id = $1
		ORDER BY p.player_name ASC
	`, roundID)
	if err != nil {
		log.Printf("Failed to query picks: %v", err)
		http.Error(w, "Failed to fetch picks", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	picks := []PickWithTeamName{}
	for rows.Next() {
		var p PickWithTeamName
		var teamID sql.NullInt64
		var result sql.NullString
		if err := rows.Scan(
			&p.ID, &p.GameID, &p.RoundID, &p.PlayerName, &teamID, &result, &p.AutoAssigned, &p.CreatedAt,
			&p.TeamName,
		); err != nil {
			log.Printf("Failed to scan pick: %v", err)
			continue
		}
		if teamID.Valid {
			val := int(teamID.Int64)
			p.TeamID = &val
		}
		if result.Valid {
			p.Result = &result.String
		}
		picks = append(picks, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"picks": picks,
	})
}

// HandleSavePicks creates or updates picks for a round
func HandleSavePicks(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	roundID, err := strconv.Atoi(vars["roundId"])
	if err != nil {
		http.Error(w, "Invalid round ID", http.StatusBadRequest)
		return
	}

	// Verify round belongs to manager's game and is open
	var gameID int
	var roundStatus string
	err = db.QueryRow(`
		SELECT r.game_id, r.status
		FROM managed_rounds r
		JOIN managed_games g ON g.id = r.game_id
		WHERE r.id = $1 AND g.manager_email = $2
	`, roundID, managerEmail).Scan(&gameID, &roundStatus)
	if err == sql.ErrNoRows {
		http.Error(w, "Round not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to query round: %v", err)
		http.Error(w, "Failed to verify round", http.StatusInternalServerError)
		return
	}

	// Allow saving picks to any round (including closed) for Edit tab corrections
	// Manager is trusted to make corrections at any time

	var req SavePicksRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Save picks
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, "Failed to save picks", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	for _, pick := range req.Picks {
		_, err = tx.Exec(`
			INSERT INTO managed_picks (game_id, round_id, player_name, team_id, auto_assigned)
			VALUES ($1, $2, $3, $4, FALSE)
			ON CONFLICT (game_id, round_id, player_name)
			DO UPDATE SET team_id = EXCLUDED.team_id, auto_assigned = EXCLUDED.auto_assigned
		`, gameID, roundID, pick.PlayerName, pick.TeamID)
		if err != nil {
			log.Printf("Failed to save pick: %v", err)
			http.Error(w, "Failed to save picks", http.StatusInternalServerError)
			return
		}
	}

	if err = tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, "Failed to save picks", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleSaveResults saves results and processes eliminations
func HandleSaveResults(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	roundID, err := strconv.Atoi(vars["roundId"])
	if err != nil {
		http.Error(w, "Invalid round ID", http.StatusBadRequest)
		return
	}

	// Verify round belongs to manager's game and get postpone setting
	var gameID int
	var roundNumber int
	var postponeAsWin bool
	err = db.QueryRow(`
		SELECT r.game_id, r.round_number, g.postpone_as_win
		FROM managed_rounds r
		JOIN managed_games g ON g.id = r.game_id
		WHERE r.id = $1 AND g.manager_email = $2
	`, roundID, managerEmail).Scan(&gameID, &roundNumber, &postponeAsWin)
	if err == sql.ErrNoRows {
		http.Error(w, "Round not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to query round: %v", err)
		http.Error(w, "Failed to verify round", http.StatusInternalServerError)
		return
	}

	var req SaveResultsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Save results and eliminate players
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, "Failed to save results", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	for _, result := range req.Results {
		// Update pick result
		_, err = tx.Exec(`
			UPDATE managed_picks
			SET result = $1
			WHERE id = $2
		`, result.Result, result.PickID)
		if err != nil {
			log.Printf("Failed to update pick result: %v", err)
			http.Error(w, "Failed to save results", http.StatusInternalServerError)
			return
		}

		// Determine if player should be eliminated
		shouldEliminate := false
		if result.Result == "loss" || result.Result == "draw" {
			shouldEliminate = true
		} else if result.Result == "postponed" && !postponeAsWin {
			// If postpone counts as loss, eliminate
			shouldEliminate = true
		}

		if shouldEliminate {
			var playerName string
			err = tx.QueryRow(`SELECT player_name FROM managed_picks WHERE id = $1`, result.PickID).Scan(&playerName)
			if err != nil {
				log.Printf("Failed to get player name: %v", err)
				http.Error(w, "Failed to process elimination", http.StatusInternalServerError)
				return
			}

			_, err = tx.Exec(`
				UPDATE managed_participants
				SET is_active = FALSE, eliminated_in_round = $1
				WHERE game_id = $2 AND player_name = $3
			`, roundNumber, gameID, playerName)
			if err != nil {
				log.Printf("Failed to eliminate player: %v", err)
				http.Error(w, "Failed to process elimination", http.StatusInternalServerError)
				return
			}
		}
	}

	// Close the round
	_, err = tx.Exec(`UPDATE managed_rounds SET status = 'closed' WHERE id = $1`, roundID)
	if err != nil {
		log.Printf("Failed to close round: %v", err)
		http.Error(w, "Failed to close round", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, "Failed to save results", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleAdvanceRound creates the next round for active players
func HandleAdvanceRound(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Verify game belongs to manager and get settings
	var winnerMode, rolloverMode string
	var maxWinners int
	err = db.QueryRow(`
		SELECT winner_mode, rollover_mode, max_winners
		FROM managed_games
		WHERE id = $1 AND manager_email = $2
	`, gameID, managerEmail).Scan(&winnerMode, &rolloverMode, &maxWinners)
	if err == sql.ErrNoRows {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to get game: %v", err)
		http.Error(w, "Failed to advance round", http.StatusInternalServerError)
		return
	}

	// Get current round number
	var currentRound int
	err = db.QueryRow(`SELECT COALESCE(MAX(round_number), 0) FROM managed_rounds WHERE game_id = $1`, gameID).Scan(&currentRound)
	if err != nil {
		log.Printf("Failed to get current round: %v", err)
		http.Error(w, "Failed to advance round", http.StatusInternalServerError)
		return
	}

	// Check how many active players remain
	var activeCount int
	err = db.QueryRow(`SELECT COUNT(*) FROM managed_participants WHERE game_id = $1 AND is_active = TRUE`, gameID).Scan(&activeCount)
	if err != nil {
		log.Printf("Failed to count active players: %v", err)
		http.Error(w, "Failed to advance round", http.StatusInternalServerError)
		return
	}

	// SCENARIO HANDLING
	// 4 combinations: (single/multiple) × (round/game)

	if winnerMode == "single" {
		// ======== SINGLE WINNER MODE ========
		if activeCount == 1 {
			// Exactly 1 player remains - declare winner
			var winnerName string
			err = db.QueryRow(`SELECT player_name FROM managed_participants WHERE game_id = $1 AND is_active = TRUE`, gameID).Scan(&winnerName)
			if err != nil {
				log.Printf("Failed to get winner: %v", err)
				http.Error(w, "Failed to complete game", http.StatusInternalServerError)
				return
			}

			_, err = db.Exec(`UPDATE managed_games SET status = 'completed', winner_name = $1 WHERE id = $2`, winnerName, gameID)
			if err != nil {
				log.Printf("Failed to complete game: %v", err)
				http.Error(w, "Failed to complete game", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":     "completed",
				"winnerName": winnerName,
			})
			return
		}

		if activeCount == 0 {
			// All players eliminated - apply rollover
			if rolloverMode == "round" {
				// Rollover round: Un-eliminate current round only
				_, err = db.Exec(`
					UPDATE managed_participants
					SET is_active = TRUE, eliminated_in_round = NULL
					WHERE game_id = $1 AND eliminated_in_round = $2
				`, gameID, currentRound)
				if err != nil {
					log.Printf("Failed to un-eliminate players: %v", err)
					http.Error(w, "Failed to rollover round", http.StatusInternalServerError)
					return
				}
				// Fall through to create next round
			} else {
				// Rollover game: Reset entire game
				tx, err := db.Begin()
				if err != nil {
					log.Printf("Failed to begin transaction: %v", err)
					http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
					return
				}
				defer tx.Rollback()

				// Reset all participants to active
				_, err = tx.Exec(`
					UPDATE managed_participants
					SET is_active = TRUE, eliminated_in_round = NULL
					WHERE game_id = $1
				`, gameID)
				if err != nil {
					log.Printf("Failed to reset participants: %v", err)
					http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
					return
				}

				// Delete all rounds and picks
				_, err = tx.Exec(`DELETE FROM managed_picks WHERE game_id = $1`, gameID)
				if err != nil {
					log.Printf("Failed to delete picks: %v", err)
					http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
					return
				}

				_, err = tx.Exec(`DELETE FROM managed_rounds WHERE game_id = $1`, gameID)
				if err != nil {
					log.Printf("Failed to delete rounds: %v", err)
					http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
					return
				}

				// Create round 1
				_, err = tx.Exec(`
					INSERT INTO managed_rounds (game_id, round_number, status)
					VALUES ($1, 1, 'open')
				`, gameID)
				if err != nil {
					log.Printf("Failed to create round 1: %v", err)
					http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
					return
				}

				if err = tx.Commit(); err != nil {
					log.Printf("Failed to commit rollover: %v", err)
					http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
					return
				}

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"roundNumber": 1,
					"rollover":    "game",
				})
				return
			}
		}
	} else {
		// ======== MULTIPLE WINNERS MODE ========
		// Check if we should declare winners (activeCount > 0 and <= maxWinners, or activeCount == 0 and eliminated <= maxWinners)
		if activeCount > 0 && activeCount <= maxWinners {
			// Remaining active players are winners
			rows, err := db.Query(`
				SELECT player_name
				FROM managed_participants
				WHERE game_id = $1 AND is_active = TRUE
				ORDER BY player_name
			`, gameID)
			if err != nil {
				log.Printf("Failed to get winners: %v", err)
				http.Error(w, "Failed to complete game", http.StatusInternalServerError)
				return
			}
			defer rows.Close()

			winners := []string{}
			for rows.Next() {
				var name string
				if err := rows.Scan(&name); err != nil {
					log.Printf("Failed to scan winner: %v", err)
					continue
				}
				winners = append(winners, name)
			}

			winnerNames := ""
			for i, name := range winners {
				if i > 0 {
					winnerNames += ", "
				}
				winnerNames += name
			}

			_, err = db.Exec(`UPDATE managed_games SET status = 'completed', winner_name = $1 WHERE id = $2`, winnerNames, gameID)
			if err != nil {
				log.Printf("Failed to complete game: %v", err)
				http.Error(w, "Failed to complete game", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":          "completed",
				"winnerName":      winnerNames,
				"multipleWinners": true,
			})
			return
		}

		if activeCount == 0 {
			// All eliminated - check if eliminated count <= maxWinners
			var eliminatedCount int
			err = db.QueryRow(`
				SELECT COUNT(*)
				FROM managed_participants
				WHERE game_id = $1 AND eliminated_in_round = $2
			`, gameID, currentRound).Scan(&eliminatedCount)
			if err != nil {
				log.Printf("Failed to count eliminated: %v", err)
				http.Error(w, "Failed to advance round", http.StatusInternalServerError)
				return
			}

			if eliminatedCount <= maxWinners {
				// Declare all eliminated as winners
				rows, err := db.Query(`
					SELECT player_name
					FROM managed_participants
					WHERE game_id = $1 AND eliminated_in_round = $2
					ORDER BY player_name
				`, gameID, currentRound)
				if err != nil {
					log.Printf("Failed to get winners: %v", err)
					http.Error(w, "Failed to complete game", http.StatusInternalServerError)
					return
				}
				defer rows.Close()

				winners := []string{}
				for rows.Next() {
					var name string
					if err := rows.Scan(&name); err != nil {
						log.Printf("Failed to scan winner: %v", err)
						continue
					}
					winners = append(winners, name)
				}

				winnerNames := ""
				for i, name := range winners {
					if i > 0 {
						winnerNames += ", "
					}
					winnerNames += name
				}

				_, err = db.Exec(`UPDATE managed_games SET status = 'completed', winner_name = $1 WHERE id = $2`, winnerNames, gameID)
				if err != nil {
					log.Printf("Failed to complete game: %v", err)
					http.Error(w, "Failed to complete game", http.StatusInternalServerError)
					return
				}

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]interface{}{
					"status":          "completed",
					"winnerName":      winnerNames,
					"multipleWinners": true,
				})
				return
			} else {
				// Too many eliminated - apply rollover
				if rolloverMode == "round" {
					// Rollover round: Un-eliminate current round only
					_, err = db.Exec(`
						UPDATE managed_participants
						SET is_active = TRUE, eliminated_in_round = NULL
						WHERE game_id = $1 AND eliminated_in_round = $2
					`, gameID, currentRound)
					if err != nil {
						log.Printf("Failed to un-eliminate players: %v", err)
						http.Error(w, "Failed to rollover round", http.StatusInternalServerError)
						return
					}
					// Fall through to create next round
				} else {
					// Rollover game: Reset entire game
					tx, err := db.Begin()
					if err != nil {
						log.Printf("Failed to begin transaction: %v", err)
						http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
						return
					}
					defer tx.Rollback()

					// Reset all participants to active
					_, err = tx.Exec(`
						UPDATE managed_participants
						SET is_active = TRUE, eliminated_in_round = NULL
						WHERE game_id = $1
					`, gameID)
					if err != nil {
						log.Printf("Failed to reset participants: %v", err)
						http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
						return
					}

					// Delete all rounds and picks
					_, err = tx.Exec(`DELETE FROM managed_picks WHERE game_id = $1`, gameID)
					if err != nil {
						log.Printf("Failed to delete picks: %v", err)
						http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
						return
					}

					_, err = tx.Exec(`DELETE FROM managed_rounds WHERE game_id = $1`, gameID)
					if err != nil {
						log.Printf("Failed to delete rounds: %v", err)
						http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
						return
					}

					// Create round 1
					_, err = tx.Exec(`
						INSERT INTO managed_rounds (game_id, round_number, status)
						VALUES ($1, 1, 'open')
					`, gameID)
					if err != nil {
						log.Printf("Failed to create round 1: %v", err)
						http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
						return
					}

					if err = tx.Commit(); err != nil {
						log.Printf("Failed to commit rollover: %v", err)
						http.Error(w, "Failed to rollover game", http.StatusInternalServerError)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					json.NewEncoder(w).Encode(map[string]interface{}{
						"roundNumber": 1,
						"rollover":    "game",
					})
					return
				}
			}
		}
	}

	// Normal flow: Multiple active players remain (> maxWinners or single mode with > 1 active)
	// Create next round
	nextRound := currentRound + 1
	_, err = db.Exec(`
		INSERT INTO managed_rounds (game_id, round_number, status)
		VALUES ($1, $2, 'open')
	`, gameID, nextRound)
	if err != nil {
		log.Printf("Failed to create next round: %v", err)
		http.Error(w, "Failed to advance round", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"roundNumber": nextRound,
	})
}

// HandleGetUsedTeams returns teams already used by each player in a game
func HandleGetUsedTeams(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Verify game belongs to manager
	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM managed_games WHERE id = $1 AND manager_email = $2`, gameID, managerEmail).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Get picks from CLOSED rounds only (teams from open rounds can still be changed)
	rows, err := db.Query(`
		SELECT p.player_name, p.team_id
		FROM managed_picks p
		JOIN managed_rounds r ON r.id = p.round_id
		WHERE p.game_id = $1 AND p.team_id IS NOT NULL AND r.status = 'closed'
		ORDER BY p.player_name, p.round_id
	`, gameID)
	if err != nil {
		log.Printf("Failed to query used teams: %v", err)
		http.Error(w, "Failed to fetch used teams", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Build map of player -> array of team IDs
	usedTeams := make(map[string][]int)
	for rows.Next() {
		var playerName string
		var teamID int
		if err := rows.Scan(&playerName, &teamID); err != nil {
			log.Printf("Failed to scan used team: %v", err)
			continue
		}
		usedTeams[playerName] = append(usedTeams[playerName], teamID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"usedTeams": usedTeams,
	})
}

// HandleAddParticipants adds new participants to an active game
func HandleAddParticipants(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Verify game belongs to manager and is active
	var status string
	err = db.QueryRow(`SELECT status FROM managed_games WHERE id = $1 AND manager_email = $2`, gameID, managerEmail).Scan(&status)
	if err == sql.ErrNoRows {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to query game: %v", err)
		http.Error(w, "Failed to verify game", http.StatusInternalServerError)
		return
	}

	if status != "active" {
		http.Error(w, "Game is not active", http.StatusBadRequest)
		return
	}

	var req struct {
		PlayerNames []string `json:"playerNames"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if len(req.PlayerNames) == 0 {
		http.Error(w, "No player names provided", http.StatusBadRequest)
		return
	}

	// Add participants
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, "Failed to add participants", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	for _, playerName := range req.PlayerNames {
		_, err = tx.Exec(`
			INSERT INTO managed_participants (game_id, player_name, is_active)
			VALUES ($1, $2, TRUE)
			ON CONFLICT (game_id, player_name) DO NOTHING
		`, gameID, playerName)
		if err != nil {
			log.Printf("Failed to add participant: %v", err)
			http.Error(w, "Failed to add participants", http.StatusInternalServerError)
			return
		}
	}

	if err = tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, "Failed to add participants", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleReopenRound reopens a closed round for editing
func HandleReopenRound(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	roundID, err := strconv.Atoi(vars["roundId"])
	if err != nil {
		http.Error(w, "Invalid round ID", http.StatusBadRequest)
		return
	}

	// Verify round belongs to manager's game
	var gameID int
	var roundNumber int
	err = db.QueryRow(`
		SELECT r.game_id, r.round_number
		FROM managed_rounds r
		JOIN managed_games g ON g.id = r.game_id
		WHERE r.id = $1 AND g.manager_email = $2
	`, roundID, managerEmail).Scan(&gameID, &roundNumber)
	if err == sql.ErrNoRows {
		http.Error(w, "Round not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to query round: %v", err)
		http.Error(w, "Failed to verify round", http.StatusInternalServerError)
		return
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, "Failed to reopen round", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Reactivate players who were eliminated in this round
	_, err = tx.Exec(`
		UPDATE managed_participants
		SET is_active = TRUE, eliminated_in_round = NULL
		WHERE game_id = $1 AND eliminated_in_round = $2
	`, gameID, roundNumber)
	if err != nil {
		log.Printf("Failed to reactivate players: %v", err)
		http.Error(w, "Failed to reactivate players", http.StatusInternalServerError)
		return
	}

	// Clear results for this round
	_, err = tx.Exec(`
		UPDATE managed_picks
		SET result = NULL
		WHERE round_id = $1
	`, roundID)
	if err != nil {
		log.Printf("Failed to clear results: %v", err)
		http.Error(w, "Failed to clear results", http.StatusInternalServerError)
		return
	}

	// Reopen the round
	_, err = tx.Exec(`UPDATE managed_rounds SET status = 'open' WHERE id = $1`, roundID)
	if err != nil {
		log.Printf("Failed to reopen round: %v", err)
		http.Error(w, "Failed to reopen round", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, "Failed to reopen round", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleFinalizePicks validates all picks exist, auto-assigns if needed
func HandleFinalizePicks(w http.ResponseWriter, r *http.Request) {
	managerEmail, ok := getManagerEmail(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	roundID, err := strconv.Atoi(vars["roundId"])
	if err != nil {
		http.Error(w, "Invalid round ID", http.StatusBadRequest)
		return
	}

	// Verify round belongs to manager's game and is open
	var gameID int
	var groupID int
	err = db.QueryRow(`
		SELECT r.game_id, g.group_id
		FROM managed_rounds r
		JOIN managed_games g ON g.id = r.game_id
		WHERE r.id = $1 AND g.manager_email = $2 AND r.status = 'open'
	`, roundID, managerEmail).Scan(&gameID, &groupID)
	if err == sql.ErrNoRows {
		http.Error(w, "Round not found or already closed", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to query round: %v", err)
		http.Error(w, "Failed to verify round", http.StatusInternalServerError)
		return
	}

	// Get all active participants
	participantRows, err := db.Query(`
		SELECT player_name
		FROM managed_participants
		WHERE game_id = $1 AND is_active = TRUE
		ORDER BY player_name
	`, gameID)
	if err != nil {
		log.Printf("Failed to query participants: %v", err)
		http.Error(w, "Failed to get participants", http.StatusInternalServerError)
		return
	}
	defer participantRows.Close()

	participants := []string{}
	for participantRows.Next() {
		var name string
		if err := participantRows.Scan(&name); err != nil {
			log.Printf("Failed to scan participant: %v", err)
			continue
		}
		participants = append(participants, name)
	}

	// Get existing picks for this round
	pickRows, err := db.Query(`
		SELECT player_name, team_id
		FROM managed_picks
		WHERE round_id = $1 AND team_id IS NOT NULL
	`, roundID)
	if err != nil {
		log.Printf("Failed to query picks: %v", err)
		http.Error(w, "Failed to get picks", http.StatusInternalServerError)
		return
	}
	defer pickRows.Close()

	picksMap := make(map[string]int)
	for pickRows.Next() {
		var playerName string
		var teamID int
		if err := pickRows.Scan(&playerName, &teamID); err != nil {
			log.Printf("Failed to scan pick: %v", err)
			continue
		}
		picksMap[playerName] = teamID
	}

	// Find players missing picks
	missingPlayers := []string{}
	for _, player := range participants {
		if _, hasPick := picksMap[player]; !hasPick {
			missingPlayers = append(missingPlayers, player)
		}
	}

	// If there are missing picks, auto-assign them
	if len(missingPlayers) > 0 {
		// Get all teams for this group (alphabetically)
		teamRows, err := db.Query(`
			SELECT id
			FROM managed_teams
			WHERE group_id = $1
			ORDER BY name ASC
		`, groupID)
		if err != nil {
			log.Printf("Failed to query teams: %v", err)
			http.Error(w, "Failed to get teams", http.StatusInternalServerError)
			return
		}
		defer teamRows.Close()

		allTeams := []int{}
		for teamRows.Next() {
			var teamID int
			if err := teamRows.Scan(&teamID); err != nil {
				log.Printf("Failed to scan team: %v", err)
				continue
			}
			allTeams = append(allTeams, teamID)
		}

		// Get used teams (from closed rounds only)
		usedTeamsRows, err := db.Query(`
			SELECT p.player_name, p.team_id
			FROM managed_picks p
			JOIN managed_rounds r ON r.id = p.round_id
			WHERE p.game_id = $1 AND p.team_id IS NOT NULL AND r.status = 'closed'
		`, gameID)
		if err != nil {
			log.Printf("Failed to query used teams: %v", err)
			http.Error(w, "Failed to get used teams", http.StatusInternalServerError)
			return
		}
		defer usedTeamsRows.Close()

		usedTeamsMap := make(map[string]map[int]bool)
		for usedTeamsRows.Next() {
			var playerName string
			var teamID int
			if err := usedTeamsRows.Scan(&playerName, &teamID); err != nil {
				log.Printf("Failed to scan used team: %v", err)
				continue
			}
			if usedTeamsMap[playerName] == nil {
				usedTeamsMap[playerName] = make(map[int]bool)
			}
			usedTeamsMap[playerName][teamID] = true
		}

		// Auto-assign for each missing player
		tx, err := db.Begin()
		if err != nil {
			log.Printf("Failed to begin transaction: %v", err)
			http.Error(w, "Failed to finalize picks", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback()

		for _, player := range missingPlayers {
			// Find first available team for this player
			var assignedTeam int
			for _, teamID := range allTeams {
				if usedTeamsMap[player] == nil || !usedTeamsMap[player][teamID] {
					assignedTeam = teamID
					break
				}
			}

			if assignedTeam == 0 {
				// No available teams
				http.Error(w, "No available teams for auto-assignment", http.StatusBadRequest)
				return
			}

			// Insert auto-assigned pick
			_, err = tx.Exec(`
				INSERT INTO managed_picks (game_id, round_id, player_name, team_id, auto_assigned)
				VALUES ($1, $2, $3, $4, TRUE)
				ON CONFLICT (game_id, round_id, player_name)
				DO UPDATE SET team_id = EXCLUDED.team_id, auto_assigned = EXCLUDED.auto_assigned
			`, gameID, roundID, player, assignedTeam)
			if err != nil {
				log.Printf("Failed to auto-assign pick: %v", err)
				http.Error(w, "Failed to auto-assign picks", http.StatusInternalServerError)
				return
			}

			// Mark as used for next player in this round
			if usedTeamsMap[player] == nil {
				usedTeamsMap[player] = make(map[int]bool)
			}
			usedTeamsMap[player][assignedTeam] = true
		}

		if err = tx.Commit(); err != nil {
			log.Printf("Failed to commit transaction: %v", err)
			http.Error(w, "Failed to finalize picks", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"missingCount": len(missingPlayers),
		"autoAssigned": missingPlayers,
	})
}

// HandleGetReport returns a public report for a game (no auth required)
// Used by display screens and Reports tab
func HandleGetReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID, err := strconv.Atoi(vars["gameId"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	// Get game info
	var gameName, gameStatus, winnerMode, rolloverMode string
	var winnerName sql.NullString
	var postponeAsWin bool
	var maxWinners int
	err = db.QueryRow(`
		SELECT name, status, winner_name, postpone_as_win, winner_mode, rollover_mode, max_winners
		FROM managed_games
		WHERE id = $1
	`, gameID).Scan(&gameName, &gameStatus, &winnerName, &postponeAsWin, &winnerMode, &rolloverMode, &maxWinners)
	if err == sql.ErrNoRows {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Failed to get game: %v", err)
		http.Error(w, "Failed to get game", http.StatusInternalServerError)
		return
	}

	// Get all rounds for this game
	roundRows, err := db.Query(`
		SELECT id, round_number, status
		FROM managed_rounds
		WHERE game_id = $1
		ORDER BY round_number ASC
	`, gameID)
	if err != nil {
		log.Printf("Failed to get rounds: %v", err)
		http.Error(w, "Failed to get rounds", http.StatusInternalServerError)
		return
	}
	defer roundRows.Close()

	type RoundReport struct {
		RoundNumber    int                       `json:"roundNumber"`
		Status         string                    `json:"status"`
		ActivePlayers  int                       `json:"activePlayers,omitempty"`
		TeamPicks      map[string]int            `json:"teamPicks,omitempty"`      // Team name -> count (for open rounds)
		EliminatedCount int                      `json:"eliminatedCount,omitempty"` // For closed rounds
		ThroughCount    int                      `json:"throughCount,omitempty"`    // For closed rounds
		TeamResults    map[string]string         `json:"teamResults,omitempty"`     // Team name -> result (for closed rounds)
	}

	rounds := []RoundReport{}

	for roundRows.Next() {
		var roundID, roundNumber int
		var roundStatus string
		if err := roundRows.Scan(&roundID, &roundNumber, &roundStatus); err != nil {
			log.Printf("Failed to scan round: %v", err)
			continue
		}

		report := RoundReport{
			RoundNumber: roundNumber,
			Status:      roundStatus,
		}

		if roundStatus == "open" {
			// Count active players at this point
			var activeCount int
			db.QueryRow(`
				SELECT COUNT(*)
				FROM managed_participants
				WHERE game_id = $1 AND is_active = TRUE
			`, gameID).Scan(&activeCount)
			report.ActivePlayers = activeCount

			// Get team pick counts
			pickRows, err := db.Query(`
				SELECT t.name, COUNT(p.id)
				FROM managed_picks p
				JOIN managed_teams t ON t.id = p.team_id
				WHERE p.game_id = $1 AND p.round_id = $2 AND p.team_id IS NOT NULL
				GROUP BY t.name
				ORDER BY COUNT(p.id) DESC, t.name
			`, gameID, roundID)
			if err == nil {
				defer pickRows.Close()
				teamPicks := make(map[string]int)
				for pickRows.Next() {
					var teamName string
					var count int
					if err := pickRows.Scan(&teamName, &count); err == nil {
						teamPicks[teamName] = count
					}
				}
				report.TeamPicks = teamPicks
			}
		} else {
			// Round is closed
			// Count eliminated players in this round
			var eliminatedCount int
			db.QueryRow(`
				SELECT COUNT(*)
				FROM managed_participants
				WHERE game_id = $1 AND eliminated_in_round = $2
			`, gameID, roundNumber).Scan(&eliminatedCount)
			report.EliminatedCount = eliminatedCount

			// Count players who made it through to next round
			// This includes players who were never eliminated OR eliminated in a later round
			var throughCount int
			db.QueryRow(`
				SELECT COUNT(*)
				FROM managed_participants
				WHERE game_id = $1 AND (eliminated_in_round IS NULL OR eliminated_in_round > $2)
			`, gameID, roundNumber).Scan(&throughCount)
			report.ThroughCount = throughCount

			// Get team results
			resultRows, err := db.Query(`
				SELECT DISTINCT t.name, p.result
				FROM managed_picks p
				JOIN managed_teams t ON t.id = p.team_id
				WHERE p.game_id = $1 AND p.round_id = $2 AND p.result IS NOT NULL
				ORDER BY t.name
			`, gameID, roundID)
			if err == nil {
				defer resultRows.Close()
				teamResults := make(map[string]string)
				for resultRows.Next() {
					var teamName, result string
					if err := resultRows.Scan(&teamName, &result); err == nil {
						teamResults[teamName] = result
					}
				}
				report.TeamResults = teamResults
			}
		}

		rounds = append(rounds, report)
	}

	// Get starting player count
	var startingPlayers int
	db.QueryRow(`
		SELECT COUNT(*)
		FROM managed_participants
		WHERE game_id = $1
	`, gameID).Scan(&startingPlayers)

	// Build response
	response := map[string]interface{}{
		"game": map[string]interface{}{
			"name":            gameName,
			"status":          gameStatus,
			"winnerName":      winnerName.String,
			"postponeAsWin":   postponeAsWin,
			"winnerMode":      winnerMode,
			"rolloverMode":    rolloverMode,
			"maxWinners":      maxWinners,
			"startingPlayers": startingPlayers,
		},
		"rounds": rounds,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
