package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

// HandleConfig returns app configuration
func HandleConfig(w http.ResponseWriter, r *http.Request) {
	config := Config{
		AppName: "LMS Manager",
		AppIcon: "🎯",
		Version: "1.0.0",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// ============================================================================
// TEAMS MASTER DATA
// ============================================================================

// HandleGetTeams - GET /api/teams
func HandleGetTeams(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := db.Query(`
		SELECT id, manager_email, team_name, created_at
		FROM managed_teams
		WHERE manager_email = $1
		ORDER BY team_name
	`, user.Email)
	if err != nil {
		log.Printf("Failed to query teams: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	teams := []ManagedTeam{}
	for rows.Next() {
		var t ManagedTeam
		if err := rows.Scan(&t.ID, &t.ManagerEmail, &t.TeamName, &t.CreatedAt); err != nil {
			continue
		}
		teams = append(teams, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

// HandleCreateTeam - POST /api/teams
func HandleCreateTeam(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		TeamName string `json:"teamName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.TeamName == "" {
		http.Error(w, "teamName is required", http.StatusBadRequest)
		return
	}

	var id int
	err := db.QueryRow(`
		INSERT INTO managed_teams (manager_email, team_name)
		VALUES ($1, $2)
		RETURNING id
	`, user.Email, req.TeamName).Scan(&id)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			http.Error(w, "Team already exists", http.StatusConflict)
			return
		}
		log.Printf("Failed to create team: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"id": id})
}

// HandleDeleteTeam - DELETE /api/teams/{id}
func HandleDeleteTeam(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	result, err := db.Exec(`
		DELETE FROM managed_teams
		WHERE id = $1 AND manager_email = $2
	`, id, user.Email)

	if err != nil {
		log.Printf("Failed to delete team: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// ============================================================================
// PLAYERS MASTER DATA
// ============================================================================

// HandleGetPlayers - GET /api/players
func HandleGetPlayers(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := db.Query(`
		SELECT id, manager_email, player_nickname, created_at
		FROM managed_players
		WHERE manager_email = $1
		ORDER BY player_nickname
	`, user.Email)
	if err != nil {
		log.Printf("Failed to query players: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	players := []ManagedPlayer{}
	for rows.Next() {
		var p ManagedPlayer
		if err := rows.Scan(&p.ID, &p.ManagerEmail, &p.PlayerNickname, &p.CreatedAt); err != nil {
			continue
		}
		players = append(players, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}

// HandleCreatePlayer - POST /api/players
func HandleCreatePlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		PlayerNickname string `json:"playerNickname"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.PlayerNickname == "" {
		http.Error(w, "playerNickname is required", http.StatusBadRequest)
		return
	}

	var id int
	err := db.QueryRow(`
		INSERT INTO managed_players (manager_email, player_nickname)
		VALUES ($1, $2)
		RETURNING id
	`, user.Email, req.PlayerNickname).Scan(&id)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			http.Error(w, "Player already exists", http.StatusConflict)
			return
		}
		log.Printf("Failed to create player: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"id": id})
}

// HandleDeletePlayer - DELETE /api/players/{id}
func HandleDeletePlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid player ID", http.StatusBadRequest)
		return
	}

	result, err := db.Exec(`
		DELETE FROM managed_players
		WHERE id = $1 AND manager_email = $2
	`, id, user.Email)

	if err != nil {
		log.Printf("Failed to delete player: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Player not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// ============================================================================
// GAMES
// ============================================================================

// HandleGetGames - GET /api/games
func HandleGetGames(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := db.Query(`
		SELECT id, manager_email, game_name, status, winner_names, created_at
		FROM managed_games
		WHERE manager_email = $1
		ORDER BY created_at DESC
	`, user.Email)
	if err != nil {
		log.Printf("Failed to query games: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	games := []ManagedGame{}
	for rows.Next() {
		var g ManagedGame
		var winnerNames pq.StringArray
		if err := rows.Scan(&g.ID, &g.ManagerEmail, &g.GameName, &g.Status, &winnerNames, &g.CreatedAt); err != nil {
			continue
		}
		g.WinnerNames = winnerNames
		games = append(games, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(games)
}

// HandleCreateGame - POST /api/games
func HandleCreateGame(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		GameName string   `json:"gameName"`
		Teams    []string `json:"teams"`
		Players  []string `json:"players"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.GameName == "" || len(req.Teams) == 0 || len(req.Players) == 0 {
		http.Error(w, "gameName, teams, and players are required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Failed to start transaction: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Create game
	var gameID int
	err = tx.QueryRow(`
		INSERT INTO managed_games (manager_email, game_name, status)
		VALUES ($1, $2, 'active')
		RETURNING id
	`, user.Email, req.GameName).Scan(&gameID)
	if err != nil {
		log.Printf("Failed to create game: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Add teams
	for _, teamName := range req.Teams {
		_, err = tx.Exec(`
			INSERT INTO managed_game_teams (game_id, team_name)
			VALUES ($1, $2)
		`, gameID, teamName)
		if err != nil {
			log.Printf("Failed to add team: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	}

	// Add players
	for _, playerNickname := range req.Players {
		_, err = tx.Exec(`
			INSERT INTO managed_game_players (game_id, player_nickname, status)
			VALUES ($1, $2, 'active')
		`, gameID, playerNickname)
		if err != nil {
			log.Printf("Failed to add player: %v", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"id": gameID})
}

// HandleDeleteGame - DELETE /api/games/{id}
func HandleDeleteGame(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid game ID", http.StatusBadRequest)
		return
	}

	result, err := db.Exec(`
		DELETE FROM managed_games
		WHERE id = $1 AND manager_email = $2
	`, id, user.Email)

	if err != nil {
		log.Printf("Failed to delete game: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Continue in next part...
