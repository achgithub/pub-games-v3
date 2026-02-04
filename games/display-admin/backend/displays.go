package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// handleGetDisplays returns all displays
func handleGetDisplays(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT id, name, location, description, token, is_active, created_at
		FROM displays
		ORDER BY created_at DESC
	`)
	if err != nil {
		log.Printf("❌ Error querying displays: %v", err)
		respondError(w, "Failed to fetch displays", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	displays := []Display{}
	for rows.Next() {
		var d Display
		err := rows.Scan(&d.ID, &d.Name, &d.Location, &d.Description, &d.Token, &d.IsActive, &d.CreatedAt)
		if err != nil {
			log.Printf("❌ Error scanning display: %v", err)
			continue
		}
		displays = append(displays, d)
	}

	respondJSON(w, APIResponse{Success: true, Data: displays})
}

// handleCreateDisplay creates a new display with auto-generated token
func handleCreateDisplay(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Location    string `json:"location"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		respondError(w, "Name is required", http.StatusBadRequest)
		return
	}

	// Generate unique token
	token := uuid.New().String()

	var display Display
	err := db.QueryRow(`
		INSERT INTO displays (name, location, description, token, is_active)
		VALUES ($1, $2, $3, $4, true)
		RETURNING id, name, location, description, token, is_active, created_at
	`, req.Name, req.Location, req.Description, token).Scan(
		&display.ID, &display.Name, &display.Location, &display.Description,
		&display.Token, &display.IsActive, &display.CreatedAt,
	)

	if err != nil {
		log.Printf("❌ Error creating display: %v", err)
		respondError(w, "Failed to create display", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Created display: %s (token: %s)", display.Name, display.Token)
	respondJSON(w, APIResponse{Success: true, Data: display})
}

// handleGetDisplay returns a single display by ID
func handleGetDisplay(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var display Display
	err := db.QueryRow(`
		SELECT id, name, location, description, token, is_active, created_at
		FROM displays
		WHERE id = $1
	`, id).Scan(&display.ID, &display.Name, &display.Location, &display.Description,
		&display.Token, &display.IsActive, &display.CreatedAt)

	if err == sql.ErrNoRows {
		respondError(w, "Display not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error fetching display: %v", err)
		respondError(w, "Failed to fetch display", http.StatusInternalServerError)
		return
	}

	respondJSON(w, APIResponse{Success: true, Data: display})
}

// handleUpdateDisplay updates an existing display
func handleUpdateDisplay(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Name        string `json:"name"`
		Location    string `json:"location"`
		Description string `json:"description"`
		IsActive    *bool  `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Build dynamic update query
	query := "UPDATE displays SET "
	args := []interface{}{}
	argCount := 1

	if req.Name != "" {
		query += fmt.Sprintf("name = $%d, ", argCount)
		args = append(args, req.Name)
		argCount++
	}

	if req.Location != "" {
		query += fmt.Sprintf("location = $%d, ", argCount)
		args = append(args, req.Location)
		argCount++
	}

	if req.Description != "" {
		query += fmt.Sprintf("description = $%d, ", argCount)
		args = append(args, req.Description)
		argCount++
	}

	if req.IsActive != nil {
		query += fmt.Sprintf("is_active = $%d, ", argCount)
		args = append(args, *req.IsActive)
		argCount++
	}

	// Remove trailing comma and space
	if argCount > 1 {
		query = query[:len(query)-2]
	} else {
		respondError(w, "No fields to update", http.StatusBadRequest)
		return
	}

	query += fmt.Sprintf(" WHERE id = $%d RETURNING id, name, location, description, token, is_active, created_at", argCount)
	args = append(args, id)

	var display Display
	err := db.QueryRow(query, args...).Scan(
		&display.ID, &display.Name, &display.Location, &display.Description,
		&display.Token, &display.IsActive, &display.CreatedAt,
	)

	if err == sql.ErrNoRows {
		respondError(w, "Display not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error updating display: %v", err)
		respondError(w, "Failed to update display", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Updated display: %s", display.Name)
	respondJSON(w, APIResponse{Success: true, Data: display})
}

// handleDeleteDisplay deletes a display
func handleDeleteDisplay(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := db.Exec("DELETE FROM displays WHERE id = $1", id)
	if err != nil {
		log.Printf("❌ Error deleting display: %v", err)
		respondError(w, "Failed to delete display", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, "Display not found", http.StatusNotFound)
		return
	}

	log.Printf("✅ Deleted display ID: %s", id)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Display deleted"}})
}

// handleGetDisplayURL returns the full runtime URL for a display
func handleGetDisplayURL(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var token string
	err := db.QueryRow("SELECT token FROM displays WHERE id = $1", id).Scan(&token)
	if err == sql.ErrNoRows {
		respondError(w, "Display not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error fetching display token: %v", err)
		respondError(w, "Failed to fetch display", http.StatusInternalServerError)
		return
	}

	// Get host from environment or use default
	host := getEnv("RUNTIME_HOST", "192.168.1.45")
	runtimePort := getEnv("RUNTIME_PORT", "5051")
	url := fmt.Sprintf("http://%s:%s?token=%s", host, runtimePort, token)

	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"url": url}})
}

// handleGetDisplayByToken returns display info by token (for TVs)
func handleGetDisplayByToken(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	token := vars["token"]

	var display Display
	err := db.QueryRow(`
		SELECT id, name, location, description, token, is_active, created_at
		FROM displays
		WHERE token = $1 AND is_active = true
	`, token).Scan(&display.ID, &display.Name, &display.Location, &display.Description,
		&display.Token, &display.IsActive, &display.CreatedAt)

	if err == sql.ErrNoRows {
		respondError(w, "Display not found or inactive", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error fetching display by token: %v", err)
		respondError(w, "Failed to fetch display", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Display lookup by token: %s", display.Name)
	respondJSON(w, APIResponse{Success: true, Data: display})
}

// handleGetDisplayCurrentPlaylist returns the current active playlist for a display
func handleGetDisplayCurrentPlaylist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Get active playlist based on current time and scheduling rules
	playlistID := getActivePlaylistForDisplay(id)

	if playlistID == 0 {
		respondJSON(w, APIResponse{
			Success: false,
			Error:   "No active playlist assigned to this display",
		})
		return
	}

	// Get playlist with content
	var playlist Playlist
	var createdBy sql.NullString
	err := db.QueryRow(`
		SELECT id, name, description, is_active, created_by, created_at, updated_at
		FROM playlists
		WHERE id = $1
	`, playlistID).Scan(&playlist.ID, &playlist.Name, &playlist.Description, &playlist.IsActive,
		&createdBy, &playlist.CreatedAt, &playlist.UpdatedAt)

	if err != nil {
		log.Printf("❌ Error fetching playlist: %v", err)
		respondError(w, "Failed to fetch playlist", http.StatusInternalServerError)
		return
	}

	playlist.CreatedBy = createdBy.String

	respondJSON(w, APIResponse{Success: true, Data: playlist})
}
