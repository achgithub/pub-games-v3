package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// --- Managed Players ---

type ManagedPlayer struct {
	ID           int    `json:"id"`
	ManagerEmail string `json:"managerEmail"`
	Name         string `json:"name"`
	CreatedAt    string `json:"createdAt"`
}

type ManagedGroup struct {
	ID           int    `json:"id"`
	ManagerEmail string `json:"managerEmail"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	CreatedAt    string `json:"createdAt"`
}

type ManagedTeam struct {
	ID        int    `json:"id"`
	GroupID   int    `json:"groupId"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
}

// getManagerEmail extracts the manager email from the request.
// Supports ?impersonate=email for game_admin role.
func getManagerEmail(r *http.Request) string {
	// Check for impersonation parameter (only works if user has game_admin role)
	if impersonate := r.URL.Query().Get("impersonate"); impersonate != "" {
		permissionLevel := r.Header.Get("X-Permission-Level")
		if permissionLevel == "full" {
			return impersonate
		}
	}

	// Default to authenticated user's email
	return r.Header.Get("X-Admin-Email")
}

// handleGetPlayers returns all players for the manager.
func handleGetPlayers(w http.ResponseWriter, r *http.Request) {
	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := gameAdminDB.Query(`
		SELECT id, manager_email, name, created_at
		FROM managed_players
		WHERE manager_email = $1
		ORDER BY created_at DESC
	`, managerEmail)
	if err != nil {
		log.Printf("Error getting players: %v", err)
		sendError(w, "Failed to get players", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var players []ManagedPlayer
	for rows.Next() {
		var p ManagedPlayer
		if err := rows.Scan(&p.ID, &p.ManagerEmail, &p.Name, &p.CreatedAt); err != nil {
			continue
		}
		players = append(players, p)
	}

	if players == nil {
		players = []ManagedPlayer{}
	}

	sendJSON(w, map[string]interface{}{"players": players})
}

// handleCreatePlayer creates a new player for the manager.
func handleCreatePlayer(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		sendError(w, "name is required", http.StatusBadRequest)
		return
	}

	var player ManagedPlayer
	err := gameAdminDB.QueryRow(`
		INSERT INTO managed_players (manager_email, name)
		VALUES ($1, $2)
		RETURNING id, manager_email, name, created_at
	`, managerEmail, req.Name).Scan(&player.ID, &player.ManagerEmail, &player.Name, &player.CreatedAt)

	if err != nil {
		log.Printf("Error creating player: %v", err)
		sendError(w, "Failed to create player (duplicate name?)", http.StatusInternalServerError)
		return
	}

	sendJSON(w, player)
}

// handleDeletePlayer deletes a player (only if owned by manager).
func handleDeletePlayer(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, "Invalid player ID", http.StatusBadRequest)
		return
	}

	result, err := gameAdminDB.Exec(`
		DELETE FROM managed_players
		WHERE id = $1 AND manager_email = $2
	`, id, managerEmail)

	if err != nil {
		log.Printf("Error deleting player: %v", err)
		sendError(w, "Failed to delete player", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, "Player not found or not owned by manager", http.StatusNotFound)
		return
	}

	sendJSON(w, map[string]string{"status": "deleted"})
}

// --- Managed Groups ---

// handleGetGroups returns all groups for the manager.
func handleGetGroups(w http.ResponseWriter, r *http.Request) {
	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := gameAdminDB.Query(`
		SELECT id, manager_email, name, description, created_at
		FROM managed_groups
		WHERE manager_email = $1
		ORDER BY created_at DESC
	`, managerEmail)
	if err != nil {
		log.Printf("Error getting groups: %v", err)
		sendError(w, "Failed to get groups", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var groups []ManagedGroup
	for rows.Next() {
		var g ManagedGroup
		if err := rows.Scan(&g.ID, &g.ManagerEmail, &g.Name, &g.Description, &g.CreatedAt); err != nil {
			continue
		}
		groups = append(groups, g)
	}

	if groups == nil {
		groups = []ManagedGroup{}
	}

	sendJSON(w, map[string]interface{}{"groups": groups})
}

// handleCreateGroup creates a new group for the manager.
func handleCreateGroup(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		sendError(w, "name is required", http.StatusBadRequest)
		return
	}

	var group ManagedGroup
	err := gameAdminDB.QueryRow(`
		INSERT INTO managed_groups (manager_email, name, description)
		VALUES ($1, $2, $3)
		RETURNING id, manager_email, name, description, created_at
	`, managerEmail, req.Name, req.Description).Scan(&group.ID, &group.ManagerEmail, &group.Name, &group.Description, &group.CreatedAt)

	if err != nil {
		log.Printf("Error creating group: %v", err)
		sendError(w, "Failed to create group (duplicate name?)", http.StatusInternalServerError)
		return
	}

	sendJSON(w, group)
}

// handleDeleteGroup deletes a group (only if owned by manager).
func handleDeleteGroup(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	result, err := gameAdminDB.Exec(`
		DELETE FROM managed_groups
		WHERE id = $1 AND manager_email = $2
	`, id, managerEmail)

	if err != nil {
		log.Printf("Error deleting group: %v", err)
		sendError(w, "Failed to delete group", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, "Group not found or not owned by manager", http.StatusNotFound)
		return
	}

	sendJSON(w, map[string]string{"status": "deleted"})
}

// --- Managed Teams (within Groups) ---

// handleGetTeams returns all teams for a group (verifies ownership via group's manager_email).
func handleGetTeams(w http.ResponseWriter, r *http.Request) {
	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["groupId"])
	if err != nil {
		sendError(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Verify group ownership
	var ownerEmail string
	err = gameAdminDB.QueryRow(`SELECT manager_email FROM managed_groups WHERE id = $1`, groupID).Scan(&ownerEmail)
	if err != nil {
		sendError(w, "Group not found", http.StatusNotFound)
		return
	}
	if ownerEmail != managerEmail {
		sendError(w, "Not authorized to view teams for this group", http.StatusForbidden)
		return
	}

	rows, err := gameAdminDB.Query(`
		SELECT id, group_id, name, created_at
		FROM managed_teams
		WHERE group_id = $1
		ORDER BY created_at ASC
	`, groupID)
	if err != nil {
		log.Printf("Error getting teams: %v", err)
		sendError(w, "Failed to get teams", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var teams []ManagedTeam
	for rows.Next() {
		var t ManagedTeam
		if err := rows.Scan(&t.ID, &t.GroupID, &t.Name, &t.CreatedAt); err != nil {
			continue
		}
		teams = append(teams, t)
	}

	if teams == nil {
		teams = []ManagedTeam{}
	}

	sendJSON(w, map[string]interface{}{"teams": teams})
}

// handleCreateTeam creates a new team within a group.
func handleCreateTeam(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["groupId"])
	if err != nil {
		sendError(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Verify group ownership
	var ownerEmail string
	err = gameAdminDB.QueryRow(`SELECT manager_email FROM managed_groups WHERE id = $1`, groupID).Scan(&ownerEmail)
	if err != nil {
		sendError(w, "Group not found", http.StatusNotFound)
		return
	}
	if ownerEmail != managerEmail {
		sendError(w, "Not authorized to modify this group", http.StatusForbidden)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		sendError(w, "name is required", http.StatusBadRequest)
		return
	}

	var team ManagedTeam
	err = gameAdminDB.QueryRow(`
		INSERT INTO managed_teams (group_id, name)
		VALUES ($1, $2)
		RETURNING id, group_id, name, created_at
	`, groupID, req.Name).Scan(&team.ID, &team.GroupID, &team.Name, &team.CreatedAt)

	if err != nil {
		log.Printf("Error creating team: %v", err)
		sendError(w, "Failed to create team (duplicate name in group?)", http.StatusInternalServerError)
		return
	}

	sendJSON(w, team)
}

// handleDeleteTeam deletes a team (verifies ownership via group).
func handleDeleteTeam(w http.ResponseWriter, r *http.Request) {
	if !requireWritePermission(w, r) {
		return
	}

	managerEmail := getManagerEmail(r)
	if managerEmail == "" {
		sendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	teamID, err := strconv.Atoi(vars["id"])
	if err != nil {
		sendError(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	// Verify ownership via group
	var ownerEmail string
	err = gameAdminDB.QueryRow(`
		SELECT g.manager_email
		FROM managed_teams t
		JOIN managed_groups g ON t.group_id = g.id
		WHERE t.id = $1
	`, teamID).Scan(&ownerEmail)

	if err != nil {
		sendError(w, "Team not found", http.StatusNotFound)
		return
	}

	if ownerEmail != managerEmail {
		sendError(w, "Not authorized to delete this team", http.StatusForbidden)
		return
	}

	result, err := gameAdminDB.Exec(`DELETE FROM managed_teams WHERE id = $1`, teamID)
	if err != nil {
		log.Printf("Error deleting team: %v", err)
		sendError(w, "Failed to delete team", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, "Team not found", http.StatusNotFound)
		return
	}

	sendJSON(w, map[string]string{"status": "deleted"})
}

// --- Export Endpoints (No Auth - Read-Only) ---

// handleExportPlayers exports players for a manager (no auth required).
// Used by LMS/Sweepstakes to import players.
func handleExportPlayers(w http.ResponseWriter, r *http.Request) {
	managerEmail := r.URL.Query().Get("manager_email")
	if managerEmail == "" {
		sendError(w, "manager_email query parameter required", http.StatusBadRequest)
		return
	}

	rows, err := gameAdminDB.Query(`
		SELECT id, manager_email, name, created_at
		FROM managed_players
		WHERE manager_email = $1
		ORDER BY name ASC
	`, managerEmail)
	if err != nil {
		log.Printf("Error exporting players: %v", err)
		sendError(w, "Failed to export players", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var players []ManagedPlayer
	for rows.Next() {
		var p ManagedPlayer
		if err := rows.Scan(&p.ID, &p.ManagerEmail, &p.Name, &p.CreatedAt); err != nil {
			continue
		}
		players = append(players, p)
	}

	if players == nil {
		players = []ManagedPlayer{}
	}

	sendJSON(w, map[string]interface{}{"players": players})
}

// handleExportGroups exports groups with their teams for a manager (no auth required).
// Used by LMS/Sweepstakes to import groups.
func handleExportGroups(w http.ResponseWriter, r *http.Request) {
	managerEmail := r.URL.Query().Get("manager_email")
	if managerEmail == "" {
		sendError(w, "manager_email query parameter required", http.StatusBadRequest)
		return
	}

	rows, err := gameAdminDB.Query(`
		SELECT id, manager_email, name, description, created_at
		FROM managed_groups
		WHERE manager_email = $1
		ORDER BY name ASC
	`, managerEmail)
	if err != nil {
		log.Printf("Error exporting groups: %v", err)
		sendError(w, "Failed to export groups", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type GroupWithTeams struct {
		ManagedGroup
		Teams []ManagedTeam `json:"teams"`
	}

	var groups []GroupWithTeams
	for rows.Next() {
		var g GroupWithTeams
		if err := rows.Scan(&g.ID, &g.ManagerEmail, &g.Name, &g.Description, &g.CreatedAt); err != nil {
			continue
		}

		// Fetch teams for this group
		teamRows, err := gameAdminDB.Query(`
			SELECT id, group_id, name, created_at
			FROM managed_teams
			WHERE group_id = $1
			ORDER BY name ASC
		`, g.ID)
		if err != nil {
			log.Printf("Error fetching teams for group %d: %v", g.ID, err)
			g.Teams = []ManagedTeam{}
		} else {
			defer teamRows.Close()
			var teams []ManagedTeam
			for teamRows.Next() {
				var t ManagedTeam
				if err := teamRows.Scan(&t.ID, &t.GroupID, &t.Name, &t.CreatedAt); err != nil {
					continue
				}
				teams = append(teams, t)
			}
			if teams == nil {
				teams = []ManagedTeam{}
			}
			g.Teams = teams
		}

		groups = append(groups, g)
	}

	if groups == nil {
		groups = []GroupWithTeams{}
	}

	sendJSON(w, map[string]interface{}{"groups": groups})
}
