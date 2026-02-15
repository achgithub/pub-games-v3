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

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// handleConfig returns app configuration.
func handleConfig(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"appId": "sweepstakes"})
}

// handleGetCompetitions returns open, locked, and completed competitions for players.
func handleGetCompetitions(w http.ResponseWriter, r *http.Request) {
	rows, err := appDB.Query(`
		SELECT id, name, type, status, COALESCE(description, ''), created_at
		FROM competitions
		WHERE status IN ('open', 'locked', 'completed')
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	comps := []Competition{}
	for rows.Next() {
		var c Competition
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.Status, &c.Description, &c.CreatedAt); err != nil {
			log.Printf("Error scanning competition: %v", err)
			continue
		}
		comps = append(comps, c)
	}
	respondJSON(w, http.StatusOK, comps)
}

// handleGetEntries returns all entries for a competition.
func handleGetEntries(w http.ResponseWriter, r *http.Request) {
	compID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, "Invalid competition ID", http.StatusBadRequest)
		return
	}

	rows, err := appDB.Query(`
		SELECT id, competition_id, name, seed, number, status, position, created_at
		FROM entries
		WHERE competition_id = $1
		ORDER BY COALESCE(position, 999), COALESCE(seed, 999), COALESCE(number, 999), name
	`, compID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	entries := []Entry{}
	for rows.Next() {
		var e Entry
		var seed, number, position sql.NullInt64
		if err := rows.Scan(&e.ID, &e.CompetitionID, &e.Name, &seed, &number, &e.Status, &position, &e.CreatedAt); err != nil {
			continue
		}
		if seed.Valid {
			v := int(seed.Int64)
			e.Seed = &v
		}
		if number.Valid {
			v := int(number.Int64)
			e.Number = &v
		}
		if position.Valid {
			v := int(position.Int64)
			e.Position = &v
		}
		entries = append(entries, e)
	}
	respondJSON(w, http.StatusOK, entries)
}

// handleGetAvailableCount returns the count of available entries for a competition.
func handleGetAvailableCount(w http.ResponseWriter, r *http.Request) {
	compID := mux.Vars(r)["id"]
	var count int
	appDB.QueryRow(`SELECT COUNT(*) FROM entries WHERE competition_id = $1 AND status = 'available'`, compID).Scan(&count)
	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}

// handleGetCompetitionDraws returns all draws for a competition with entry details.
func handleGetCompetitionDraws(w http.ResponseWriter, r *http.Request) {
	compID := mux.Vars(r)["id"]

	rows, err := appDB.Query(`
		SELECT d.id, d.user_id, d.competition_id, d.entry_id, d.drawn_at,
		       e.name, e.status, e.seed, e.number, e.position
		FROM draws d
		JOIN entries e ON d.entry_id = e.id
		WHERE d.competition_id = $1
		ORDER BY COALESCE(e.position, 999), d.drawn_at
	`, compID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	draws := []map[string]interface{}{}
	for rows.Next() {
		var id, competitionID, entryID int
		var userID, entryName, entryStatus string
		var drawnAt string
		var seed, number, position sql.NullInt64

		if err := rows.Scan(&id, &userID, &competitionID, &entryID, &drawnAt,
			&entryName, &entryStatus, &seed, &number, &position); err != nil {
			continue
		}

		d := map[string]interface{}{
			"id":             id,
			"user_id":        userID,
			"competition_id": competitionID,
			"entry_id":       entryID,
			"drawn_at":       drawnAt,
			"entry_name":     entryName,
			"entry_status":   entryStatus,
		}
		if seed.Valid {
			d["seed"] = int(seed.Int64)
		}
		if number.Valid {
			d["number"] = int(number.Int64)
		}
		if position.Valid {
			d["position"] = int(position.Int64)
		}
		draws = append(draws, d)
	}
	respondJSON(w, http.StatusOK, draws)
}

// handleGetBlindBoxes returns anonymous boxes for the blind selection UI.
// Returns empty if the user already has a draw for this competition.
func handleGetBlindBoxes(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	compID := mux.Vars(r)["id"]

	var existingCount int
	appDB.QueryRow(`SELECT COUNT(*) FROM draws WHERE user_id = $1 AND competition_id = $2`, user.ID, compID).Scan(&existingCount)
	if existingCount > 0 {
		respondJSON(w, http.StatusOK, []interface{}{})
		return
	}

	var totalAvailable int
	appDB.QueryRow(`SELECT COUNT(*) FROM entries WHERE competition_id = $1 AND status = 'available'`, compID).Scan(&totalAvailable)

	boxes := make([]map[string]int, totalAvailable)
	for i := range boxes {
		boxes[i] = map[string]int{"box_number": i + 1}
	}
	respondJSON(w, http.StatusOK, boxes)
}

// handleChooseBlindBox assigns the Nth available entry to the authenticated user.
// DB UNIQUE constraints prevent duplicate draws; no Redis lock needed.
func handleChooseBlindBox(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	compID := mux.Vars(r)["id"]

	var req struct {
		BoxNumber int `json:"box_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BoxNumber < 1 {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	tx, err := appDB.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Check if user already has an entry (inside transaction for consistency)
	var existingCount int
	tx.QueryRow(`SELECT COUNT(*) FROM draws WHERE user_id = $1 AND competition_id = $2`, user.ID, compID).Scan(&existingCount)
	if existingCount > 0 {
		http.Error(w, "You already have an entry in this competition", http.StatusBadRequest)
		return
	}

	// Get available entries ordered by id (stable order = box 1 is always the same entry)
	rows, err := tx.Query(`SELECT id FROM entries WHERE competition_id = $1 AND status = 'available' ORDER BY id`, compID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	var availableIDs []int
	for rows.Next() {
		var id int
		rows.Scan(&id)
		availableIDs = append(availableIDs, id)
	}
	rows.Close()

	if req.BoxNumber > len(availableIDs) {
		http.Error(w, "Box no longer available — someone else just picked it", http.StatusConflict)
		return
	}

	selectedEntryID := availableIDs[req.BoxNumber-1]

	// Insert draw — UNIQUE(user_id, competition_id) and UNIQUE(competition_id, entry_id)
	// constraints guard against concurrent double-picks
	if _, err := tx.Exec(`INSERT INTO draws (user_id, competition_id, entry_id) VALUES ($1, $2, $3)`,
		user.ID, compID, selectedEntryID); err != nil {
		http.Error(w, "Selection failed — try again", http.StatusConflict)
		return
	}

	if _, err := tx.Exec(`UPDATE entries SET status = 'taken' WHERE id = $1`, selectedEntryID); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete selection", http.StatusInternalServerError)
		return
	}

	var entryName string
	var seed, number sql.NullInt64
	appDB.QueryRow(`SELECT name, seed, number FROM entries WHERE id = $1`, selectedEntryID).Scan(&entryName, &seed, &number)

	result := map[string]interface{}{"entry_id": selectedEntryID, "entry_name": entryName}
	if seed.Valid {
		result["seed"] = int(seed.Int64)
	}
	if number.Valid {
		result["number"] = int(number.Int64)
	}
	respondJSON(w, http.StatusOK, result)
}

// handleRandomPick assigns a random available entry to the authenticated user.
func handleRandomPick(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	compID := mux.Vars(r)["id"]

	tx, err := appDB.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var existingCount int
	tx.QueryRow(`SELECT COUNT(*) FROM draws WHERE user_id = $1 AND competition_id = $2`, user.ID, compID).Scan(&existingCount)
	if existingCount > 0 {
		http.Error(w, "You already have an entry in this competition", http.StatusBadRequest)
		return
	}

	var selectedEntryID int
	err = tx.QueryRow(`
		SELECT id FROM entries
		WHERE competition_id = $1 AND status = 'available'
		ORDER BY RANDOM() LIMIT 1
	`, compID).Scan(&selectedEntryID)
	if err != nil {
		http.Error(w, "No available entries", http.StatusBadRequest)
		return
	}

	if _, err := tx.Exec(`INSERT INTO draws (user_id, competition_id, entry_id) VALUES ($1, $2, $3)`,
		user.ID, compID, selectedEntryID); err != nil {
		http.Error(w, "Selection failed — try again", http.StatusConflict)
		return
	}

	if _, err := tx.Exec(`UPDATE entries SET status = 'taken' WHERE id = $1`, selectedEntryID); err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to complete selection", http.StatusInternalServerError)
		return
	}

	var entryName string
	var seed, number sql.NullInt64
	appDB.QueryRow(`SELECT name, seed, number FROM entries WHERE id = $1`, selectedEntryID).Scan(&entryName, &seed, &number)

	result := map[string]interface{}{"entry_id": selectedEntryID, "entry_name": entryName}
	if seed.Valid {
		result["seed"] = int(seed.Int64)
	}
	if number.Valid {
		result["number"] = int(number.Int64)
	}
	respondJSON(w, http.StatusOK, result)
}

// handleGetUserDraws returns all draws for the authenticated user.
func handleGetUserDraws(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := appDB.Query(`
		SELECT d.id, d.user_id, d.competition_id, d.entry_id, d.drawn_at,
		       e.name, e.status, e.seed, e.number, e.position,
		       c.name, c.status
		FROM draws d
		JOIN entries e ON d.entry_id = e.id
		JOIN competitions c ON d.competition_id = c.id
		WHERE d.user_id = $1
		ORDER BY d.drawn_at DESC
	`, user.ID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	draws := []map[string]interface{}{}
	for rows.Next() {
		var id, competitionID, entryID int
		var userID, entryName, entryStatus, compName, compStatus, drawnAt string
		var seed, number, position sql.NullInt64

		if err := rows.Scan(&id, &userID, &competitionID, &entryID, &drawnAt,
			&entryName, &entryStatus, &seed, &number, &position,
			&compName, &compStatus); err != nil {
			continue
		}

		d := map[string]interface{}{
			"id":             id,
			"user_id":        userID,
			"competition_id": competitionID,
			"entry_id":       entryID,
			"drawn_at":       drawnAt,
			"entry_name":     entryName,
			"entry_status":   entryStatus,
			"comp_name":      compName,
			"comp_status":    compStatus,
		}
		if seed.Valid {
			d["seed"] = int(seed.Int64)
		}
		if number.Valid {
			d["number"] = int(number.Int64)
		}
		if position.Valid {
			d["position"] = int(position.Int64)
		}
		draws = append(draws, d)
	}
	respondJSON(w, http.StatusOK, draws)
}
