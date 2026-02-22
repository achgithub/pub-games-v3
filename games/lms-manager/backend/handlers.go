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
		GROUP BY g.id
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
