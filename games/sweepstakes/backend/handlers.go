package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// respondJSON sends a JSON response
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// handleGetConfig returns app configuration
func handleGetConfig(w http.ResponseWriter, r *http.Request) {
	config := Config{
		AppID: "sweepstakes",
		GameOptions: []map[string]interface{}{
			{
				"id":   "knockout",
				"name": "Knockout Tournament",
			},
			{
				"id":   "race",
				"name": "Race",
			},
		},
	}
	respondJSON(w, http.StatusOK, config)
}

// handleGetCompetitions returns all competitions
func handleGetCompetitions(w http.ResponseWriter, r *http.Request) {
	competitions, err := GetCompetitions(db)
	if err != nil {
		log.Printf("Error fetching competitions: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if competitions == nil {
		competitions = []Competition{}
	}
	respondJSON(w, http.StatusOK, competitions)
}

// handleCreateCompetition creates a new competition
func handleCreateCompetition(w http.ResponseWriter, r *http.Request) {
	var req Competition
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Status == "" {
		req.Status = "draft"
	}

	log.Printf("Creating competition: %+v", req)

	result, err := db.Exec(`
		INSERT INTO competitions (name, type, status, start_date, end_date, description, selection_mode, blind_box_interval)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`, req.Name, req.Type, req.Status, req.StartDate, req.EndDate, req.Description, req.SelectionMode, req.BlindBoxInterval)

	if err != nil {
		log.Printf("Error inserting competition: %v", err)
		http.Error(w, "Failed to create competition: "+err.Error(), http.StatusBadRequest)
		return
	}

	var lastInsertID int64
	var createdAt sql.NullTime

	// Get the inserted ID
	rows := db.QueryRow(`
		SELECT id, created_at FROM competitions WHERE id = (SELECT MAX(id) FROM competitions)
	`)
	rows.Scan(&lastInsertID, &createdAt)

	req.ID = int(lastInsertID)
	if createdAt.Valid {
		req.CreatedAt = createdAt.Time
	}

	log.Printf("✅ Competition created: %d - %s", req.ID, req.Name)

	respondJSON(w, http.StatusCreated, req)
}

// handleUpdateCompetition updates a competition
func handleUpdateCompetition(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req Competition
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding competition update: %v", err)
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Updating competition %s: %+v", id, req)

	// If marking as completed, validate at least one winner exists
	if req.Status == "completed" {
		var count int64
		db.QueryRow(`
			SELECT COUNT(*) FROM entries
			WHERE competition_id = $1 AND position = 1
		`, id).Scan(&count)

		if count == 0 {
			http.Error(w, "Cannot complete: No 1st place winner set. At least one entry must have position 1.", http.StatusBadRequest)
			return
		}
	}

	_, err := db.Exec(`
		UPDATE competitions
		SET name = $1, type = $2, status = $3, start_date = $4, end_date = $5, description = $6
		WHERE id = $7
	`, req.Name, req.Type, req.Status, req.StartDate, req.EndDate, req.Description, id)

	if err != nil {
		log.Printf("Error updating competition: %v", err)
		http.Error(w, "Failed to update: "+err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Competition %s updated successfully", id)
	w.WriteHeader(http.StatusOK)
}

// handleGetEntries returns all entries for a competition
func handleGetEntries(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID := vars["id"]

	entries, err := GetEntriesForCompetition(db, 0)
	if err != nil {
		log.Printf("Error querying entries: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if entries == nil {
		entries = []Entry{}
	}
	respondJSON(w, http.StatusOK, entries)
}

// handleUploadEntries uploads entries from CSV
func handleUploadEntries(w http.ResponseWriter, r *http.Request) {
	compID := r.FormValue("competition_id")

	var compType string
	err := db.QueryRow("SELECT type FROM competitions WHERE id = $1", compID).Scan(&compType)
	if err != nil {
		http.Error(w, "Competition not found", http.StatusNotFound)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Invalid CSV file", http.StatusBadRequest)
		return
	}

	count := 0
	errors := []string{}

	for i, record := range records {
		if i == 0 {
			log.Printf("Header row: %v", record)
			continue
		}

		if len(record) < 1 {
			continue
		}

		name := strings.TrimSpace(record[0])
		if name == "" {
			continue
		}

		var seed, number *int

		if compType == "knockout" && len(record) > 1 && record[1] != "" {
			s, err := strconv.Atoi(strings.TrimSpace(record[1]))
			if err == nil {
				seed = &s
			}
		}

		if compType == "race" && len(record) > 1 && record[1] != "" {
			n, err := strconv.Atoi(strings.TrimSpace(record[1]))
			if err == nil {
				number = &n
			}
		}

		_, err := db.Exec(`
			INSERT INTO entries (competition_id, name, seed, number, status)
			VALUES ($1, $2, $3, $4, 'available')
		`, compID, name, seed, number)

		if err != nil {
			errMsg := fmt.Sprintf("Row %d (%s): %v", i, name, err)
			errors = append(errors, errMsg)
		} else {
			count++
		}
	}

	response := fmt.Sprintf("%d entries uploaded successfully", count)
	if len(errors) > 0 {
		response += fmt.Sprintf(", %d errors", len(errors))
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(response))
}

// handleUpdateEntry updates an entry
func handleUpdateEntry(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req Entry
	json.NewDecoder(r.Body).Decode(&req)

	// Prevent changing taken entries back to available
	if req.Status == "available" {
		var currentStatus string
		db.QueryRow("SELECT status FROM entries WHERE id = $1", id).Scan(&currentStatus)
		if currentStatus == "taken" {
			http.Error(w, "Cannot change a picked entry back to available. The entry has been selected by a user.", http.StatusBadRequest)
			return
		}
	}

	_, err := db.Exec(`
		UPDATE entries
		SET name = $1, seed = $2, number = $3, status = $4
		WHERE id = $5
	`, req.Name, req.Seed, req.Number, req.Status, id)

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleUpdateEntryPosition updates an entry's position (for rankings)
func handleUpdateEntryPosition(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID := vars["id"]

	var req struct {
		EntryID  int  `json:"entry_id"`
		Position *int `json:"position"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	_, err := db.Exec(`
		UPDATE entries
		SET position = $1
		WHERE id = $2 AND competition_id = $3
	`, req.Position, req.EntryID, compID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleDeleteEntry deletes an entry
func handleDeleteEntry(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := db.Exec("DELETE FROM entries WHERE id = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleGetAvailableCount returns count of available entries
func handleGetAvailableCount(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID := vars["id"]

	var count int
	db.QueryRow(`
		SELECT COUNT(*) FROM entries
		WHERE competition_id = $1 AND status = 'available'
	`, compID).Scan(&count)

	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}

// handleGetBlindBoxes returns blind boxes for selection
func handleGetBlindBoxes(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID := vars["id"]
	userID := r.URL.Query().Get("user_id")

	// Check if user already has a selection
	var existingCount int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM draws
		WHERE user_id = $1 AND competition_id = $2
	`, userID, compID).Scan(&existingCount)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if existingCount > 0 {
		respondJSON(w, http.StatusOK, []map[string]interface{}{})
		return
	}

	// Get count of available entries
	var totalAvailable int
	err = db.QueryRow(`
		SELECT COUNT(*) FROM entries
		WHERE competition_id = $1 AND status = 'available'
	`, compID).Scan(&totalAvailable)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Return anonymous boxes
	boxes := []map[string]interface{}{}
	for i := 1; i <= totalAvailable; i++ {
		boxes = append(boxes, map[string]interface{}{
			"box_number": i,
		})
	}

	respondJSON(w, http.StatusOK, boxes)
}

// handleChooseBlindBox handles blind box selection
func handleChooseBlindBox(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID := vars["id"]

	var req struct {
		UserID    string `json:"user_id"`
		BoxNumber int    `json:"box_number"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Check if user already has an entry
	var existingCount int
	tx.QueryRow("SELECT COUNT(*) FROM draws WHERE user_id = $1 AND competition_id = $2", req.UserID, compID).Scan(&existingCount)
	if existingCount > 0 {
		http.Error(w, "You already have an entry", http.StatusBadRequest)
		return
	}

	// Get available entries in order
	rows, err := tx.Query(`
		SELECT id FROM entries
		WHERE competition_id = $1 AND status = 'available'
		ORDER BY id
	`, compID)
	if err != nil {
		http.Error(w, "Failed to fetch entries", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var availableIDs []int
	for rows.Next() {
		var id int
		rows.Scan(&id)
		availableIDs = append(availableIDs, id)
	}

	if req.BoxNumber < 1 || req.BoxNumber > len(availableIDs) {
		http.Error(w, "Invalid box number", http.StatusBadRequest)
		return
	}

	selectedEntryID := availableIDs[req.BoxNumber-1]

	// Create draw
	_, err = tx.Exec(`
		INSERT INTO draws (user_id, competition_id, entry_id)
		VALUES ($1, $2, $3)
	`, req.UserID, compID, selectedEntryID)
	if err != nil {
		http.Error(w, "Failed to assign entry", http.StatusInternalServerError)
		return
	}

	// Mark entry as taken
	_, err = tx.Exec("UPDATE entries SET status = 'taken' WHERE id = $1", selectedEntryID)
	if err != nil {
		http.Error(w, "Failed to update entry", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to complete selection", http.StatusInternalServerError)
		return
	}

	// Return the selected entry details
	var entryName string
	var seed, number sql.NullInt64
	db.QueryRow("SELECT name, seed, number FROM entries WHERE id = $1", selectedEntryID).Scan(&entryName, &seed, &number)

	result := map[string]interface{}{
		"entry_id":   selectedEntryID,
		"entry_name": entryName,
	}
	if seed.Valid {
		result["seed"] = int(seed.Int64)
	}
	if number.Valid {
		result["number"] = int(number.Int64)
	}

	respondJSON(w, http.StatusOK, result)
}

// handleRandomPick handles random entry selection
func handleRandomPick(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID := vars["id"]

	var req struct {
		UserID string `json:"user_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Check if user already has an entry
	var existingCount int
	tx.QueryRow("SELECT COUNT(*) FROM draws WHERE user_id = $1 AND competition_id = $2", req.UserID, compID).Scan(&existingCount)
	if existingCount > 0 {
		http.Error(w, "You already have an entry", http.StatusBadRequest)
		return
	}

	// Get a random available entry
	var selectedEntryID int
	err = tx.QueryRow(`
		SELECT id FROM entries
		WHERE competition_id = $1 AND status = 'available'
		ORDER BY RANDOM()
		LIMIT 1
	`, compID).Scan(&selectedEntryID)

	if err != nil {
		http.Error(w, "No available entries", http.StatusBadRequest)
		return
	}

	// Create draw
	_, err = tx.Exec(`
		INSERT INTO draws (user_id, competition_id, entry_id)
		VALUES ($1, $2, $3)
	`, req.UserID, compID, selectedEntryID)
	if err != nil {
		http.Error(w, "Failed to assign entry", http.StatusInternalServerError)
		return
	}

	// Mark entry as taken
	_, err = tx.Exec("UPDATE entries SET status = 'taken' WHERE id = $1", selectedEntryID)
	if err != nil {
		http.Error(w, "Failed to update entry", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to complete selection", http.StatusInternalServerError)
		return
	}

	// Return the selected entry details
	var entryName string
	var seed, number sql.NullInt64
	db.QueryRow("SELECT name, seed, number FROM entries WHERE id = $1", selectedEntryID).Scan(&entryName, &seed, &number)

	result := map[string]interface{}{
		"entry_id":   selectedEntryID,
		"entry_name": entryName,
	}
	if seed.Valid {
		result["seed"] = int(seed.Int64)
	}
	if number.Valid {
		result["number"] = int(number.Int64)
	}

	respondJSON(w, http.StatusOK, result)
}

// handleGetCompetitionDraws returns all draws for a competition
func handleGetCompetitionDraws(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID := vars["id"]

	rows, err := db.Query(`
		SELECT d.id, d.user_id, d.competition_id, d.entry_id, d.drawn_at,
		       e.name, e.status, e.seed, e.number, e.position
		FROM draws d
		JOIN entries e ON d.entry_id = e.id
		WHERE d.competition_id = $1
		ORDER BY
			CASE e.status
				WHEN 'winner' THEN 0
				WHEN 'active' THEN 1
				WHEN 'eliminated' THEN 2
			END,
			COALESCE(e.position, 999),
			d.drawn_at
	`, compID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	draws := []map[string]interface{}{}
	for rows.Next() {
		var id, userID, competitionID, entryID int
		var drawnAt string
		var entryName, status string
		var seed, number, position sql.NullInt64

		err := rows.Scan(&id, &userID, &competitionID, &entryID, &drawnAt,
			&entryName, &status, &seed, &number, &position)

		if err != nil {
			continue
		}

		draw := map[string]interface{}{
			"id":             id,
			"user_id":        userID,
			"competition_id": competitionID,
			"entry_id":       entryID,
			"entry_name":     entryName,
			"entry_status":   status,
			"drawn_at":       drawnAt,
		}

		if seed.Valid {
			draw["seed"] = int(seed.Int64)
		}
		if number.Valid {
			draw["number"] = int(number.Int64)
		}
		if position.Valid {
			draw["position"] = int(position.Int64)
		}

		draws = append(draws, draw)
	}

	if draws == nil {
		draws = []map[string]interface{}{}
	}
	respondJSON(w, http.StatusOK, draws)
}

// handleGetUserDraws returns draws for a specific user
func handleGetUserDraws(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	compID := r.URL.Query().Get("competition_id")

	query := `
		SELECT d.id, d.user_id, d.competition_id, d.entry_id, d.drawn_at,
		       e.name, e.status, c.status as comp_status, e.seed, e.number
		FROM draws d
		JOIN entries e ON d.entry_id = e.id
		JOIN competitions c ON d.competition_id = c.id
		WHERE d.user_id = $1
	`
	args := []interface{}{userID}

	if compID != "" {
		query += ` AND d.competition_id = $2`
		args = append(args, compID)
	}

	query += ` ORDER BY d.drawn_at DESC`

	rows, err := db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	draws := []map[string]interface{}{}
	for rows.Next() {
		var id, userID, competitionID, entryID int
		var drawnAt, entryName, status, compStatus string
		var seed, number sql.NullInt64

		err := rows.Scan(&id, &userID, &competitionID, &entryID, &drawnAt,
			&entryName, &status, &compStatus, &seed, &number)

		if err != nil {
			continue
		}

		draw := map[string]interface{}{
			"id":             id,
			"user_id":        userID,
			"competition_id": competitionID,
			"entry_id":       entryID,
			"drawn_at":       drawnAt,
			"entry_name":     entryName,
			"entry_status":   status,
			"comp_status":    compStatus,
		}

		if seed.Valid {
			draw["seed"] = int(seed.Int64)
		}
		if number.Valid {
			draw["number"] = int(number.Int64)
		}

		draws = append(draws, draw)
	}

	if draws == nil {
		draws = []map[string]interface{}{}
	}
	respondJSON(w, http.StatusOK, draws)
}

// handleAcquireSelectionLock acquires a selection lock
func handleAcquireSelectionLock(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID, _ := strconv.Atoi(vars["id"])

	var req struct {
		UserID   string `json:"user_id"`
		UserName string `json:"user_name"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	acquired, err := AcquireSelectionLock(compID, req.UserID, req.UserName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if acquired {
		respondJSON(w, http.StatusOK, map[string]bool{"acquired": true})
	} else {
		lock, _ := GetSelectionLock(compID)
		if lock != nil {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"acquired":  false,
				"locked_by": lock.UserName,
				"locked_at": lock.LockedAt,
			})
		} else {
			respondJSON(w, http.StatusOK, map[string]bool{"acquired": false})
		}
	}
}

// handleReleaseSelectionLock releases a selection lock
func handleReleaseSelectionLock(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID, _ := strconv.Atoi(vars["id"])

	var req struct {
		UserID string `json:"user_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	ReleaseSelectionLock(compID, req.UserID)
	w.WriteHeader(http.StatusOK)
}

// handleCheckSelectionLock checks the status of a selection lock
func handleCheckSelectionLock(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	compID, _ := strconv.Atoi(vars["id"])
	userID := r.URL.Query().Get("user_id")

	lock, err := CheckSelectionLock(compID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if lock != nil {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"locked":    true,
			"locked_by": lock.UserName,
			"locked_at": lock.LockedAt,
			"is_me":     lock.UserID == userID,
		})
	} else {
		respondJSON(w, http.StatusOK, map[string]bool{"locked": false})
	}
}
