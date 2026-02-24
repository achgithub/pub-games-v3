package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	authlib "pub-games-v3/lib/activity-hub-common/auth"
)

// Event models
type Event struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Status       string `json:"status"`
	ManagerEmail string `json:"managerEmail"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

type Horse struct {
	ID        int    `json:"id"`
	EventID   int    `json:"eventId"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
}

type Player struct {
	ID          int     `json:"id"`
	EventID     int     `json:"eventId"`
	PlayerEmail string  `json:"playerEmail"`
	PlayerName  string  `json:"playerName"`
	HorseID     *int    `json:"horseId"`
	HorseName   *string `json:"horseName,omitempty"`
	CreatedAt   string  `json:"createdAt"`
}

type WinningPosition struct {
	ID        int    `json:"id"`
	EventID   int    `json:"eventId"`
	Position  string `json:"position"`
	CreatedAt string `json:"createdAt"`
}

type Result struct {
	ID        int    `json:"id"`
	EventID   int    `json:"eventId"`
	HorseID   int    `json:"horseId"`
	HorseName string `json:"horseName"`
	Position  string `json:"position"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type ReportEntry struct {
	PlayerName string `json:"playerName"`
	PlayerEmail string `json:"playerEmail"`
	HorseName  string `json:"horseName"`
	Position   string `json:"position"`
}

// Utility functions
func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// Event handlers
func handleGetEvents(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())

	rows, err := appDB.Query(`
		SELECT id, name, description, status, manager_email, created_at, updated_at
		FROM events
		WHERE manager_email = $1
		ORDER BY created_at DESC
	`, user.Email)
	if err != nil {
		log.Printf("Error fetching events: %v", err)
		respondError(w, 500, "Failed to fetch events")
		return
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var e Event
		err := rows.Scan(&e.ID, &e.Name, &e.Description, &e.Status, &e.ManagerEmail, &e.CreatedAt, &e.UpdatedAt)
		if err != nil {
			log.Printf("Error scanning event: %v", err)
			continue
		}
		events = append(events, e)
	}

	respondJSON(w, events)
}

func handleCreateEvent(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())

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

	var eventID int
	err := appDB.QueryRow(`
		INSERT INTO events (name, description, manager_email)
		VALUES ($1, $2, $3)
		RETURNING id
	`, req.Name, req.Description, user.Email).Scan(&eventID)
	if err != nil {
		log.Printf("Error creating event: %v", err)
		respondError(w, 500, "Failed to create event")
		return
	}

	respondJSON(w, map[string]interface{}{"id": eventID, "message": "Event created"})
}

func handleGetEvent(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	vars := mux.Vars(r)
	eventID := vars["id"]

	var event Event
	err := appDB.QueryRow(`
		SELECT id, name, description, status, manager_email, created_at, updated_at
		FROM events
		WHERE id = $1 AND manager_email = $2
	`, eventID, user.Email).Scan(&event.ID, &event.Name, &event.Description, &event.Status, &event.ManagerEmail, &event.CreatedAt, &event.UpdatedAt)
	if err == sql.ErrNoRows {
		respondError(w, 404, "Event not found")
		return
	}
	if err != nil {
		log.Printf("Error fetching event: %v", err)
		respondError(w, 500, "Failed to fetch event")
		return
	}

	respondJSON(w, event)
}

func handleUpdateEvent(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	vars := mux.Vars(r)
	eventID := vars["id"]

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	_, err := appDB.Exec(`
		UPDATE events
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND manager_email = $3
	`, req.Status, eventID, user.Email)
	if err != nil {
		log.Printf("Error updating event: %v", err)
		respondError(w, 500, "Failed to update event")
		return
	}

	respondJSON(w, map[string]string{"message": "Event updated"})
}

func handleDeleteEvent(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	vars := mux.Vars(r)
	eventID := vars["id"]

	_, err := appDB.Exec(`
		DELETE FROM events
		WHERE id = $1 AND manager_email = $2
	`, eventID, user.Email)
	if err != nil {
		log.Printf("Error deleting event: %v", err)
		respondError(w, 500, "Failed to delete event")
		return
	}

	respondJSON(w, map[string]string{"message": "Event deleted"})
}

// Horse handlers
func handleGetHorses(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	rows, err := appDB.Query(`
		SELECT id, event_id, name, created_at
		FROM horses
		WHERE event_id = $1
		ORDER BY name
	`, eventID)
	if err != nil {
		log.Printf("Error fetching horses: %v", err)
		respondError(w, 500, "Failed to fetch horses")
		return
	}
	defer rows.Close()

	horses := []Horse{}
	for rows.Next() {
		var h Horse
		err := rows.Scan(&h.ID, &h.EventID, &h.Name, &h.CreatedAt)
		if err != nil {
			log.Printf("Error scanning horse: %v", err)
			continue
		}
		horses = append(horses, h)
	}

	respondJSON(w, horses)
}

func handleCreateHorse(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.Name == "" {
		respondError(w, 400, "Horse name is required")
		return
	}

	var horseID int
	err := appDB.QueryRow(`
		INSERT INTO horses (event_id, name)
		VALUES ($1, $2)
		RETURNING id
	`, eventID, req.Name).Scan(&horseID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			respondError(w, 400, "Horse name already exists")
			return
		}
		log.Printf("Error creating horse: %v", err)
		respondError(w, 500, "Failed to create horse")
		return
	}

	respondJSON(w, map[string]interface{}{"id": horseID, "message": "Horse added"})
}

func handleDeleteHorse(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	horseID := vars["id"]

	_, err := appDB.Exec(`DELETE FROM horses WHERE id = $1`, horseID)
	if err != nil {
		log.Printf("Error deleting horse: %v", err)
		respondError(w, 500, "Failed to delete horse")
		return
	}

	respondJSON(w, map[string]string{"message": "Horse deleted"})
}

// Player handlers
func handleGetPlayers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	rows, err := appDB.Query(`
		SELECT p.id, p.event_id, p.player_email, p.player_name, p.horse_id, h.name, p.created_at
		FROM players p
		LEFT JOIN horses h ON p.horse_id = h.id
		WHERE p.event_id = $1
		ORDER BY p.player_name
	`, eventID)
	if err != nil {
		log.Printf("Error fetching players: %v", err)
		respondError(w, 500, "Failed to fetch players")
		return
	}
	defer rows.Close()

	players := []Player{}
	for rows.Next() {
		var p Player
		var horseID sql.NullInt64
		var horseName sql.NullString
		err := rows.Scan(&p.ID, &p.EventID, &p.PlayerEmail, &p.PlayerName, &horseID, &horseName, &p.CreatedAt)
		if err != nil {
			log.Printf("Error scanning player: %v", err)
			continue
		}
		if horseID.Valid {
			id := int(horseID.Int64)
			p.HorseID = &id
		}
		if horseName.Valid {
			name := horseName.String
			p.HorseName = &name
		}
		players = append(players, p)
	}

	respondJSON(w, players)
}

func handleCreatePlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	var req struct {
		PlayerEmail string `json:"playerEmail"`
		PlayerName  string `json:"playerName"`
		HorseID     *int   `json:"horseId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.PlayerEmail == "" || req.PlayerName == "" {
		respondError(w, 400, "Player email and name are required")
		return
	}

	var playerID int
	err := appDB.QueryRow(`
		INSERT INTO players (event_id, player_email, player_name, horse_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, eventID, req.PlayerEmail, req.PlayerName, req.HorseID).Scan(&playerID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			if strings.Contains(err.Error(), "player_email") {
				respondError(w, 400, "Player already exists in this event")
				return
			}
			if strings.Contains(err.Error(), "horse_id") {
				respondError(w, 400, "Horse already assigned to another player")
				return
			}
		}
		log.Printf("Error creating player: %v", err)
		respondError(w, 500, "Failed to add player")
		return
	}

	respondJSON(w, map[string]interface{}{"id": playerID, "message": "Player added"})
}

func handleUpdatePlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playerID := vars["id"]

	var req struct {
		HorseID *int `json:"horseId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	_, err := appDB.Exec(`
		UPDATE players
		SET horse_id = $1
		WHERE id = $2
	`, req.HorseID, playerID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			respondError(w, 400, "Horse already assigned to another player")
			return
		}
		log.Printf("Error updating player: %v", err)
		respondError(w, 500, "Failed to update player")
		return
	}

	respondJSON(w, map[string]string{"message": "Player updated"})
}

func handleDeletePlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playerID := vars["id"]

	_, err := appDB.Exec(`DELETE FROM players WHERE id = $1`, playerID)
	if err != nil {
		log.Printf("Error deleting player: %v", err)
		respondError(w, 500, "Failed to delete player")
		return
	}

	respondJSON(w, map[string]string{"message": "Player deleted"})
}

// Winning Position handlers
func handleGetPositions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	rows, err := appDB.Query(`
		SELECT id, event_id, position, created_at
		FROM winning_positions
		WHERE event_id = $1
		ORDER BY id
	`, eventID)
	if err != nil {
		log.Printf("Error fetching positions: %v", err)
		respondError(w, 500, "Failed to fetch positions")
		return
	}
	defer rows.Close()

	positions := []WinningPosition{}
	for rows.Next() {
		var p WinningPosition
		err := rows.Scan(&p.ID, &p.EventID, &p.Position, &p.CreatedAt)
		if err != nil {
			log.Printf("Error scanning position: %v", err)
			continue
		}
		positions = append(positions, p)
	}

	respondJSON(w, positions)
}

func handleCreatePosition(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	var req struct {
		Position string `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	if req.Position == "" {
		respondError(w, 400, "Position is required")
		return
	}

	// Normalize "last" to lowercase
	if strings.ToLower(req.Position) == "last" {
		req.Position = "last"
	}

	var posID int
	err := appDB.QueryRow(`
		INSERT INTO winning_positions (event_id, position)
		VALUES ($1, $2)
		RETURNING id
	`, eventID, req.Position).Scan(&posID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			respondError(w, 400, "Position already exists")
			return
		}
		log.Printf("Error creating position: %v", err)
		respondError(w, 500, "Failed to add position")
		return
	}

	respondJSON(w, map[string]interface{}{"id": posID, "message": "Position added"})
}

func handleDeletePosition(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	posID := vars["id"]

	_, err := appDB.Exec(`DELETE FROM winning_positions WHERE id = $1`, posID)
	if err != nil {
		log.Printf("Error deleting position: %v", err)
		respondError(w, 500, "Failed to delete position")
		return
	}

	respondJSON(w, map[string]string{"message": "Position deleted"})
}

// Results handlers
func handleGetResults(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	rows, err := appDB.Query(`
		SELECT r.id, r.event_id, r.horse_id, h.name, r.position, r.created_at, r.updated_at
		FROM results r
		JOIN horses h ON r.horse_id = h.id
		WHERE r.event_id = $1
		ORDER BY r.position
	`, eventID)
	if err != nil {
		log.Printf("Error fetching results: %v", err)
		respondError(w, 500, "Failed to fetch results")
		return
	}
	defer rows.Close()

	results := []Result{}
	for rows.Next() {
		var r Result
		err := rows.Scan(&r.ID, &r.EventID, &r.HorseID, &r.HorseName, &r.Position, &r.CreatedAt, &r.UpdatedAt)
		if err != nil {
			log.Printf("Error scanning result: %v", err)
			continue
		}
		results = append(results, r)
	}

	respondJSON(w, results)
}

func handleSaveResults(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	var req struct {
		Results []struct {
			HorseID  int    `json:"horseId"`
			Position string `json:"position"`
		} `json:"results"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, 400, "Invalid request")
		return
	}

	// Normalize "last" positions
	for i := range req.Results {
		if strings.ToLower(req.Results[i].Position) == "last" {
			req.Results[i].Position = "last"
		}
	}

	// Get winning positions for this event
	rows, err := appDB.Query(`SELECT position FROM winning_positions WHERE event_id = $1`, eventID)
	if err != nil {
		log.Printf("Error fetching winning positions: %v", err)
		respondError(w, 500, "Failed to fetch winning positions")
		return
	}
	winningPositions := make(map[string]bool)
	for rows.Next() {
		var pos string
		rows.Scan(&pos)
		winningPositions[pos] = true
	}
	rows.Close()

	// Check all winning positions are assigned
	assignedPositions := make(map[string]bool)
	for _, result := range req.Results {
		assignedPositions[result.Position] = true
	}

	for pos := range winningPositions {
		if !assignedPositions[pos] {
			respondError(w, 400, "All winning positions must be assigned")
			return
		}
	}

	// Save results (upsert)
	tx, err := appDB.Begin()
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		respondError(w, 500, "Failed to save results")
		return
	}
	defer tx.Rollback()

	// Clear existing results
	_, err = tx.Exec(`DELETE FROM results WHERE event_id = $1`, eventID)
	if err != nil {
		log.Printf("Error clearing results: %v", err)
		respondError(w, 500, "Failed to save results")
		return
	}

	// Insert new results
	for _, result := range req.Results {
		_, err = tx.Exec(`
			INSERT INTO results (event_id, horse_id, position)
			VALUES ($1, $2, $3)
		`, eventID, result.HorseID, result.Position)
		if err != nil {
			log.Printf("Error inserting result: %v", err)
			respondError(w, 500, "Failed to save results")
			return
		}
	}

	// Update event status to completed
	_, err = tx.Exec(`
		UPDATE events
		SET status = 'completed', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, eventID)
	if err != nil {
		log.Printf("Error updating event status: %v", err)
		respondError(w, 500, "Failed to save results")
		return
	}

	if err = tx.Commit(); err != nil {
		log.Printf("Error committing transaction: %v", err)
		respondError(w, 500, "Failed to save results")
		return
	}

	respondJSON(w, map[string]string{"message": "Results saved, event completed"})
}

// Report handler
func handleGetReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	eventID := vars["eventId"]

	// Get event to ensure it's completed
	var status string
	err := appDB.QueryRow(`SELECT status FROM events WHERE id = $1`, eventID).Scan(&status)
	if err != nil {
		respondError(w, 404, "Event not found")
		return
	}

	if status != "completed" {
		respondJSON(w, []ReportEntry{})
		return
	}

	// Get winners (players whose horses finished in winning positions)
	rows, err := appDB.Query(`
		SELECT p.player_name, p.player_email, h.name, r.position
		FROM results r
		JOIN horses h ON r.horse_id = h.id
		JOIN players p ON p.horse_id = h.id
		JOIN winning_positions wp ON wp.event_id = r.event_id AND wp.position = r.position
		WHERE r.event_id = $1
		ORDER BY
			CASE
				WHEN r.position = 'last' THEN 999999
				ELSE CAST(r.position AS INTEGER)
			END
	`, eventID)
	if err != nil {
		log.Printf("Error fetching report: %v", err)
		respondError(w, 500, "Failed to generate report")
		return
	}
	defer rows.Close()

	report := []ReportEntry{}
	for rows.Next() {
		var entry ReportEntry
		err := rows.Scan(&entry.PlayerName, &entry.PlayerEmail, &entry.HorseName, &entry.Position)
		if err != nil {
			log.Printf("Error scanning report entry: %v", err)
			continue
		}
		report = append(report, entry)
	}

	respondJSON(w, report)
}
