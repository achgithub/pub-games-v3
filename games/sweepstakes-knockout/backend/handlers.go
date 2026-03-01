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

// Competitor pool handlers
func handleGetCompetitors(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	rows, err := appDB.Query(`
		SELECT id, manager_email, name, created_at
		FROM competitors
		WHERE manager_email = $1
		ORDER BY name ASC
	`, user.Email)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer rows.Close()

	type Competitor struct {
		ID           int    `json:"id"`
		ManagerEmail string `json:"managerEmail"`
		Name         string `json:"name"`
		CreatedAt    string `json:"createdAt"`
	}

	competitors := []Competitor{}
	for rows.Next() {
		var c Competitor
		if err := rows.Scan(&c.ID, &c.ManagerEmail, &c.Name, &c.CreatedAt); err != nil {
			continue
		}
		competitors = append(competitors, c)
	}

	respondJSON(w, map[string]interface{}{"competitors": competitors})
}

func handleCreateCompetitor(w http.ResponseWriter, r *http.Request) {
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
		respondError(w, 400, "Competitor name is required")
		return
	}

	_, err := appDB.Exec(`
		INSERT INTO competitors (manager_email, name)
		VALUES ($1, $2)
	`, user.Email, req.Name)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			respondError(w, 400, "Competitor already exists")
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

	// Verify ownership
	var managerEmail string
	err := appDB.QueryRow(`SELECT manager_email FROM competitors WHERE id = $1`, competitorID).Scan(&managerEmail)
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
		SELECT e.id, e.name, e.description, e.status, e.manager_email, e.created_at, e.updated_at,
		       COALESCE(COUNT(DISTINCT ep.player_id), 0) as participant_count
		FROM events e
		LEFT JOIN event_participants ep ON e.id = ep.event_id
		WHERE e.manager_email = $1
		GROUP BY e.id
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
		Description      string `json:"description"`
		Status           string `json:"status"`
		ManagerEmail     string `json:"managerEmail"`
		CreatedAt        string `json:"createdAt"`
		UpdatedAt        string `json:"updatedAt"`
		ParticipantCount int    `json:"participantCount"`
	}

	events := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.Name, &e.Description, &e.Status, &e.ManagerEmail, &e.CreatedAt, &e.UpdatedAt, &e.ParticipantCount); err != nil {
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
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.Name == "" {
		respondError(w, 400, "Event name is required")
		return
	}

	_, err := appDB.Exec(`
		INSERT INTO events (name, description, manager_email)
		VALUES ($1, $2, $3)
	`, req.Name, req.Description, user.Email)
	if err != nil {
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

	// Get winning positions
	type Position struct {
		ID       int    `json:"id"`
		EventID  int    `json:"eventId"`
		Position string `json:"position"`
	}

	positionRows, err := appDB.Query(`
		SELECT id, event_id, position
		FROM winning_positions
		WHERE event_id = $1
		ORDER BY id ASC
	`, eventID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}
	defer positionRows.Close()

	positions := []Position{}
	for positionRows.Next() {
		var pos Position
		if err := positionRows.Scan(&pos.ID, &pos.EventID, &pos.Position); err != nil {
			continue
		}
		positions = append(positions, pos)
	}

	respondJSON(w, map[string]interface{}{
		"participants": participants,
		"positions":    positions,
	})
}

// Add participants to event
func handleAddParticipants(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		PlayerIDs []int `json:"playerIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	for _, playerID := range req.PlayerIDs {
		_, err := appDB.Exec(`
			INSERT INTO event_participants (event_id, player_id)
			VALUES ($1, $2)
			ON CONFLICT (event_id, player_id) DO NOTHING
		`, eventID, playerID)
		if err != nil {
			respondError(w, 500, "Database error")
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
}

// Assign horse to participant
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
func handleCreatePosition(w http.ResponseWriter, r *http.Request) {
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
		Position string `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	// Normalize "last" to lowercase
	if strings.ToLower(req.Position) == "last" {
		req.Position = "last"
	}

	_, err = appDB.Exec(`
		INSERT INTO winning_positions (event_id, position)
		VALUES ($1, $2)
	`, eventID, req.Position)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			respondError(w, 400, "Position already exists")
			return
		}
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func handleDeletePosition(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		respondError(w, 401, "Unauthorized")
		return
	}

	vars := mux.Vars(r)
	positionID := vars["id"]

	// Verify ownership via event
	var eventID int
	err := appDB.QueryRow(`
		SELECT wp.event_id
		FROM winning_positions wp
		JOIN events e ON wp.event_id = e.id
		WHERE wp.id = $1 AND e.manager_email = $2
	`, positionID, user.Email).Scan(&eventID)
	if err != nil {
		respondError(w, 404, "Position not found")
		return
	}

	_, err = appDB.Exec(`DELETE FROM winning_positions WHERE id = $1`, positionID)
	if err != nil {
		respondError(w, 500, "Database error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

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
