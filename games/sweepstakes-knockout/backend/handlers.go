package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	authlib "pub-games-v3/lib/activity-hub-common/auth"
)

// ========== SETUP TAB HANDLERS ==========

// Player pool handlers
func handleGetPlayers(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	rows, err := appDB.Query(`
		SELECT id, manager_email, name, created_at
		FROM players
		WHERE manager_email = $1
		ORDER BY name ASC
	`, user.Email)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	type Player struct {
		ID           int    `json:"id"`
		ManagerEmail string `json:"managerEmail"`
		Name         string `json:"name"`
		CreatedAt    string `json:"createdAt"`
	}

	players := []Player{}
	for rows.Next() {
		var p Player
		if err := rows.Scan(&p.ID, &p.ManagerEmail, &p.Name, &p.CreatedAt); err != nil {
			continue
		}
		players = append(players, p)
	}

	respondJSON(w, map[string]interface{}{"players": players})
}

func handleCreatePlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.Name == "" {
		respondError(w, 400, "Player name is required")
		return
	}

	_, err := appDB.Exec(`
		INSERT INTO players (manager_email, name)
		VALUES ($1, $2)
	`, user.Email, req.Name)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			respondError(w, 400, "Player already exists")
			return
		}
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func handleDeletePlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	playerID := vars["id"]

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM players WHERE id = $1`, playerID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Player not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	_, err = appDB.Exec(`DELETE FROM players WHERE id = $1`, playerID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Group handlers
func handleGetGroups(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	rows, err := appDB.Query(`
		SELECT g.id, g.manager_email, g.name, g.created_at,
		       COALESCE(COUNT(c.id), 0) as competitor_count
		FROM groups g
		LEFT JOIN competitors c ON g.id = c.group_id
		WHERE g.manager_email = $1
		GROUP BY g.id
		ORDER BY g.name ASC
	`, user.Email)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	type Group struct {
		ID              int    `json:"id"`
		ManagerEmail    string `json:"managerEmail"`
		Name            string `json:"name"`
		CreatedAt       string `json:"createdAt"`
		CompetitorCount int    `json:"competitorCount"`
	}

	groups := []Group{}
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.ManagerEmail, &g.Name, &g.CreatedAt, &g.CompetitorCount); err != nil {
			continue
		}
		groups = append(groups, g)
	}

	respondJSON(w, map[string]interface{}{"groups": groups})
}

func handleCreateGroup(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.Name == "" {
		respondError(w, 400, "Group name is required")
		return
	}

	_, err := appDB.Exec(`
		INSERT INTO groups (manager_email, name)
		VALUES ($1, $2)
	`, user.Email, req.Name)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			respondError(w, 400, "Group already exists")
			return
		}
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func handleDeleteGroup(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	groupID := vars["id"]

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM groups WHERE id = $1`, groupID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Group not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	_, err = appDB.Exec(`DELETE FROM groups WHERE id = $1`, groupID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Competitor handlers (now belong to groups)
func handleGetGroupCompetitors(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	groupID := vars["groupId"]

	// Verify ownership of group
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM groups WHERE id = $1`, groupID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Group not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	rows, err := appDB.Query(`
		SELECT id, group_id, name, created_at
		FROM competitors
		WHERE group_id = $1
		ORDER BY name ASC
	`, groupID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	type Competitor struct {
		ID        int    `json:"id"`
		GroupID   int    `json:"groupId"`
		Name      string `json:"name"`
		CreatedAt string `json:"createdAt"`
	}

	competitors := []Competitor{}
	for rows.Next() {
		var c Competitor
		if err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.CreatedAt); err != nil {
			continue
		}
		competitors = append(competitors, c)
	}

	respondJSON(w, map[string]interface{}{"competitors": competitors})
}

func handleCreateGroupCompetitor(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	groupID := vars["groupId"]

	// Verify ownership of group
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM groups WHERE id = $1`, groupID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Group not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.Name == "" {
		respondError(w, 400, "Competitor name is required")
		return
	}

	_, err = appDB.Exec(`
		INSERT INTO competitors (group_id, name)
		VALUES ($1, $2)
	`, groupID, req.Name)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			respondError(w, 400, "Competitor already exists in this group")
			return
		}
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func handleDeleteCompetitor(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	competitorID := vars["id"]

	// Verify ownership via group
	var managerEmail string
	err := appDB.QueryRow(`
		SELECT g.manager_email
		FROM competitors c
		JOIN groups g ON c.group_id = g.id
		WHERE c.id = $1
	`, competitorID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Competitor not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	_, err = appDB.Exec(`DELETE FROM competitors WHERE id = $1`, competitorID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== GAMES TAB HANDLERS ==========

func handleGetEvents(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	rows, err := appDB.Query(`
		SELECT e.id, e.name, e.group_id, g.name as group_name, e.status, e.manager_email,
		       e.winning_positions, e.spinner_enabled, e.created_at, e.updated_at,
		       COALESCE(COUNT(DISTINCT ep.player_id), 0) as participant_count
		FROM events e
		JOIN groups g ON e.group_id = g.id
		LEFT JOIN event_participants ep ON e.id = ep.event_id
		WHERE e.manager_email = $1
		GROUP BY e.id, g.name
		ORDER BY e.created_at DESC
	`, user.Email)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	type Event struct {
		ID               int    `json:"id"`
		Name             string `json:"name"`
		GroupID          int    `json:"groupId"`
		GroupName        string `json:"groupName"`
		Status           string `json:"status"`
		ManagerEmail     string `json:"managerEmail"`
		WinningPositions string `json:"winningPositions"`
		SpinnerEnabled   bool   `json:"spinnerEnabled"`
		CreatedAt        string `json:"createdAt"`
		UpdatedAt        string `json:"updatedAt"`
		ParticipantCount int    `json:"participantCount"`
	}

	events := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.Name, &e.GroupID, &e.GroupName, &e.Status, &e.ManagerEmail, &e.WinningPositions, &e.SpinnerEnabled, &e.CreatedAt, &e.UpdatedAt, &e.ParticipantCount); err != nil {
			continue
		}
		events = append(events, e)
	}

	respondJSON(w, map[string]interface{}{"events": events})
}

func handleCreateEvent(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	var req struct {
		Name             string   `json:"name"`
		GroupID          int      `json:"groupId"`
		PlayerNames      []string `json:"playerNames"`
		WinningPositions string   `json:"winningPositions"`
		SpinnerEnabled   bool     `json:"spinnerEnabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.Name == "" {
		respondError(w, 400, "Event name is required")
		return
	}
	if req.GroupID == 0 {
		respondError(w, 400, "Group is required")
		return
	}
	if len(req.PlayerNames) == 0 {
		respondError(w, 400, "At least one player is required")
		return
	}
	if req.WinningPositions == "" {
		req.WinningPositions = "1,2,3,last"
	}

	// Verify group ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM groups WHERE id = $1`, req.GroupID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Group not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	// Begin transaction
	tx, err := appDB.Begin()
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer tx.Rollback()

	// Create event
	var eventID int
	err = tx.QueryRow(`
		INSERT INTO events (name, group_id, manager_email, winning_positions, spinner_enabled)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, req.Name, req.GroupID, user.Email, req.WinningPositions, req.SpinnerEnabled).Scan(&eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	// Create participants from player names
	for _, playerName := range req.PlayerNames {
		// Get player ID by name and manager email
		var playerID int
		err = tx.QueryRow(`
			SELECT id FROM players
			WHERE name = $1 AND manager_email = $2
		`, playerName, user.Email).Scan(&playerID)
		if err != nil {
			respondError(w, 400, "Player not found: "+playerName)
			return
		}

		// Insert participant
		_, err = tx.Exec(`
			INSERT INTO event_participants (event_id, player_id)
			VALUES ($1, $2)
		`, eventID, playerID)
		if err != nil {
			respondError(w, 500, "Failed to add participant")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func handleDeleteEvent(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	eventID := vars["id"]

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM events WHERE id = $1`, eventID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Event not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	_, err = appDB.Exec(`DELETE FROM events WHERE id = $1`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Get event details (participants, positions)
func handleGetEventDetail(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	eventID := vars["id"]

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM events WHERE id = $1`, eventID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Event not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	// Get participants
	type Participant struct {
		ID            int     `json:"id"`
		EventID       int     `json:"eventId"`
		PlayerID      int     `json:"playerId"`
		PlayerName    string  `json:"playerName"`
		CompetitorID   *int    `json:"competitorId"`
		CompetitorName *string `json:"competitorName"`
	}

	participantRows, err := appDB.Query(`
		SELECT ep.id, ep.event_id, ep.player_id, p.name,
		       ep.competitor_id, c.name
		FROM event_participants ep
		JOIN players p ON ep.player_id = p.id
		LEFT JOIN competitors c ON ep.competitor_id = c.id
		WHERE ep.event_id = $1
		ORDER BY p.name ASC
	`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer participantRows.Close()

	participants := []Participant{}
	for participantRows.Next() {
		var p Participant
		var competitorID sql.NullInt64
		var competitorName sql.NullString
		if err := participantRows.Scan(&p.ID, &p.EventID, &p.PlayerID, &p.PlayerName, &competitorID, &competitorName); err != nil {
			continue
		}
		if competitorID.Valid {
			id := int(competitorID.Int64)
			p.CompetitorID = &id
		}
		if competitorName.Valid {
			p.CompetitorName = &competitorName.String
		}
		participants = append(participants, p)
	}

	respondJSON(w, map[string]interface{}{
		"participants": participants,
	})
}

// Add participants to event
// Assign competitor to participant
func handleAssignCompetitor(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	participantID := vars["id"]

	var req struct {
		CompetitorID *int `json:"competitorId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	// Verify ownership via event
	var eventID int
	err := appDB.QueryRow(`
		SELECT ep.event_id
		FROM event_participants ep
		JOIN events e ON ep.event_id = e.id
		WHERE ep.id = $1 AND e.manager_email = $2
	`, participantID, user.Email).Scan(&eventID)
	if err != nil {
		respondError(w, 404, "Participant not found")
		return
	}

	_, err = appDB.Exec(`
		UPDATE event_participants
		SET competitor_id = $1
		WHERE id = $2
	`, req.CompetitorID, participantID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			respondError(w, 400, "Competitor already assigned in this event")
			return
		}
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Remove participant from event
func handleRemoveParticipant(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	participantID := vars["id"]

	// Verify ownership via event
	var eventID int
	err := appDB.QueryRow(`
		SELECT ep.event_id
		FROM event_participants ep
		JOIN events e ON ep.event_id = e.id
		WHERE ep.id = $1 AND e.manager_email = $2
	`, participantID, user.Email).Scan(&eventID)
	if err != nil {
		respondError(w, 404, "Participant not found")
		return
	}

	_, err = appDB.Exec(`DELETE FROM event_participants WHERE id = $1`, participantID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Winning positions handlers
// Results handlers
func handleGetResults(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	eventID := vars["eventId"]

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM events WHERE id = $1`, eventID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Event not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	type Result struct {
		ID             int    `json:"id"`
		EventID        int    `json:"eventId"`
		CompetitorID   int    `json:"competitorId"`
		CompetitorName string `json:"competitorName"`
		Position       string `json:"position"`
	}

	rows, err := appDB.Query(`
		SELECT r.id, r.event_id, r.competitor_id, c.name, r.position
		FROM results r
		JOIN competitors c ON r.competitor_id = c.id
		WHERE r.event_id = $1
		ORDER BY r.position ASC
	`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	results := []Result{}
	for rows.Next() {
		var res Result
		if err := rows.Scan(&res.ID, &res.EventID, &res.CompetitorID, &res.CompetitorName, &res.Position); err != nil {
			continue
		}
		results = append(results, res)
	}

	respondJSON(w, results)
}

func handleSaveResults(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	eventID := vars["eventId"]

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM events WHERE id = $1`, eventID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Event not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	var req struct {
		Results []struct {
			CompetitorID int    `json:"competitorId"`
			Position     string `json:"position"`
		} `json:"results"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	// Delete existing results
	_, err = appDB.Exec(`DELETE FROM results WHERE event_id = $1`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	// Insert new results
	for _, result := range req.Results {
		_, err := appDB.Exec(`
			INSERT INTO results (event_id, competitor_id, position)
			VALUES ($1, $2, $3)
		`, eventID, result.CompetitorID, result.Position)
		if err != nil {
			respondError(w, 500, "Database error")
			return
		}
	}

	// Update event status to completed
	_, err = appDB.Exec(`UPDATE events SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ========== REPORTS TAB HANDLERS ==========

func handleGetReport(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	eventID := vars["eventId"]

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM events WHERE id = $1`, eventID).Scan(&managerEmail)
	if err != nil {
		respondError(w, 404, "Event not found")
		return
	}
	if managerEmail != user.Email {
		respondError(w, 403, "Forbidden")
		return
	}

	type ReportEntry struct {
		PlayerName     string `json:"playerName"`
		CompetitorName string `json:"competitorName"`
		Position       string `json:"position"`
	}

	rows, err := appDB.Query(`
		SELECT p.name, c.name, r.position
		FROM results r
		JOIN competitors c ON r.competitor_id = c.id
		JOIN event_participants ep ON r.event_id = ep.event_id AND r.competitor_id = ep.competitor_id
		JOIN players p ON ep.player_id = p.id
		JOIN winning_positions wp ON r.event_id = wp.event_id AND r.position = wp.position
		WHERE r.event_id = $1
		ORDER BY r.position ASC
	`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	report := []ReportEntry{}
	for rows.Next() {
		var entry ReportEntry
		if err := rows.Scan(&entry.PlayerName, &entry.CompetitorName, &entry.Position); err != nil {
			continue
		}
		report = append(report, entry)
	}

	respondJSON(w, report)
}

// Public report endpoint (for display screens - no auth required)
func handlePublicReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID, _ := strconv.Atoi(vars["eventId"])

	// Fetch event details
	var eventName, eventStatus string
	err := appDB.QueryRow(`SELECT name, status FROM events WHERE id = $1`, eventID).Scan(&eventName, &eventStatus)
	if err != nil {
		respondError(w, 404, "Event not found")
		return
	}

	type ReportEntry struct {
		PlayerName     string `json:"playerName"`
		CompetitorName string `json:"competitorName"`
		Position       string `json:"position"`
	}

	rows, err := appDB.Query(`
		SELECT p.name, c.name, r.position
		FROM results r
		JOIN competitors c ON r.competitor_id = c.id
		JOIN event_participants ep ON r.event_id = ep.event_id AND r.competitor_id = ep.competitor_id
		JOIN players p ON ep.player_id = p.id
		JOIN winning_positions wp ON r.event_id = wp.event_id AND r.position = wp.position
		WHERE r.event_id = $1
		ORDER BY r.position ASC
	`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	report := []ReportEntry{}
	for rows.Next() {
		var entry ReportEntry
		if err := rows.Scan(&entry.PlayerName, &entry.CompetitorName, &entry.Position); err != nil {
			continue
		}
		report = append(report, entry)
	}

	respondJSON(w, map[string]interface{}{
		"event": map[string]interface{}{
			"id":     eventID,
			"name":   eventName,
			"status": eventStatus,
		},
		"results": report,
	})
}

// ========== HELPERS ==========

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, code int, message string) {
	w.WriteHeader(code)
	respondJSON(w, map[string]string{"error": message})
}
