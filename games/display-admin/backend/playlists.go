package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

// handleGetPlaylists returns all playlists
func handleGetPlaylists(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT id, name, description, is_active, created_by, created_at, updated_at
		FROM playlists
		ORDER BY created_at DESC
	`)
	if err != nil {
		log.Printf("❌ Error querying playlists: %v", err)
		respondError(w, "Failed to fetch playlists", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	playlists := []Playlist{}
	for rows.Next() {
		var p Playlist
		var createdBy sql.NullString
		err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.IsActive, &createdBy, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			log.Printf("❌ Error scanning playlist: %v", err)
			continue
		}
		p.CreatedBy = createdBy.String
		playlists = append(playlists, p)
	}

	respondJSON(w, APIResponse{Success: true, Data: playlists})
}

// handleGetPlaylist returns a single playlist with all content items
func handleGetPlaylist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Get playlist metadata
	var playlist Playlist
	var createdBy sql.NullString
	err := db.QueryRow(`
		SELECT id, name, description, is_active, created_by, created_at, updated_at
		FROM playlists
		WHERE id = $1
	`, id).Scan(&playlist.ID, &playlist.Name, &playlist.Description, &playlist.IsActive,
		&createdBy, &playlist.CreatedAt, &playlist.UpdatedAt)

	if err == sql.ErrNoRows {
		respondError(w, "Playlist not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error fetching playlist: %v", err)
		respondError(w, "Failed to fetch playlist", http.StatusInternalServerError)
		return
	}

	playlist.CreatedBy = createdBy.String

	// Get playlist items with content details
	rows, err := db.Query(`
		SELECT c.id, c.title, c.content_type, c.duration_seconds, c.file_path,
		       c.url, c.text_content, c.bg_color, c.text_color, c.is_active,
		       c.created_by, c.created_at, c.updated_at,
		       pi.override_duration, pi.display_order
		FROM playlist_items pi
		JOIN content_items c ON pi.content_item_id = c.id
		WHERE pi.playlist_id = $1
		ORDER BY pi.display_order ASC
	`, id)

	if err != nil {
		log.Printf("❌ Error fetching playlist items: %v", err)
		respondError(w, "Failed to fetch playlist items", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []ContentItem{}
	for rows.Next() {
		var c ContentItem
		var filePath, url, textContent, bgColor, textColor, contentCreatedBy sql.NullString
		var overrideDuration sql.NullInt32
		var displayOrder int

		err := rows.Scan(&c.ID, &c.Title, &c.ContentType, &c.DurationSeconds,
			&filePath, &url, &textContent, &bgColor, &textColor, &c.IsActive,
			&contentCreatedBy, &c.CreatedAt, &c.UpdatedAt,
			&overrideDuration, &displayOrder)

		if err != nil {
			log.Printf("❌ Error scanning playlist item: %v", err)
			continue
		}

		c.FilePath = filePath.String
		c.URL = url.String
		c.TextContent = textContent.String
		c.BgColor = bgColor.String
		c.TextColor = textColor.String
		c.CreatedBy = contentCreatedBy.String

		// Use override duration if set
		if overrideDuration.Valid {
			c.DurationSeconds = int(overrideDuration.Int32)
		}

		items = append(items, c)
	}

	result := PlaylistWithContent{
		Playlist: playlist,
		Items:    items,
	}

	respondJSON(w, APIResponse{Success: true, Data: result})
}

// handleCreatePlaylist creates a new playlist
func handleCreatePlaylist(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Name        string `json:"name"`
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

	var playlist Playlist
	var createdBy sql.NullString
	err := db.QueryRow(`
		INSERT INTO playlists (name, description, created_by, is_active)
		VALUES ($1, $2, $3, true)
		RETURNING id, name, description, is_active, created_by, created_at, updated_at
	`, req.Name, req.Description, user.Email).Scan(
		&playlist.ID, &playlist.Name, &playlist.Description, &playlist.IsActive,
		&createdBy, &playlist.CreatedAt, &playlist.UpdatedAt,
	)

	if err != nil {
		log.Printf("❌ Error creating playlist: %v", err)
		respondError(w, "Failed to create playlist", http.StatusInternalServerError)
		return
	}

	playlist.CreatedBy = createdBy.String

	log.Printf("✅ Created playlist: %s by %s", playlist.Name, user.Email)
	respondJSON(w, APIResponse{Success: true, Data: playlist})
}

// handleUpdatePlaylist updates playlist metadata
func handleUpdatePlaylist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		IsActive    *bool  `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var playlist Playlist
	var createdBy sql.NullString
	err := db.QueryRow(`
		UPDATE playlists
		SET name = COALESCE(NULLIF($1, ''), name),
		    description = COALESCE(NULLIF($2, ''), description),
		    is_active = COALESCE($3, is_active),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
		RETURNING id, name, description, is_active, created_by, created_at, updated_at
	`, req.Name, req.Description, req.IsActive, id).Scan(
		&playlist.ID, &playlist.Name, &playlist.Description, &playlist.IsActive,
		&createdBy, &playlist.CreatedAt, &playlist.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		respondError(w, "Playlist not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error updating playlist: %v", err)
		respondError(w, "Failed to update playlist", http.StatusInternalServerError)
		return
	}

	playlist.CreatedBy = createdBy.String

	log.Printf("✅ Updated playlist: %s", playlist.Name)
	respondJSON(w, APIResponse{Success: true, Data: playlist})
}

// handleDeletePlaylist deletes a playlist
func handleDeletePlaylist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := db.Exec("DELETE FROM playlists WHERE id = $1", id)
	if err != nil {
		log.Printf("❌ Error deleting playlist: %v", err)
		respondError(w, "Failed to delete playlist", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, "Playlist not found", http.StatusNotFound)
		return
	}

	log.Printf("✅ Deleted playlist ID: %s", id)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Playlist deleted"}})
}

// handleAddPlaylistItem adds a content item to a playlist
func handleAddPlaylistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playlistID := vars["id"]

	var req struct {
		ContentItemID    int  `json:"content_item_id"`
		OverrideDuration *int `json:"override_duration"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ContentItemID == 0 {
		respondError(w, "content_item_id is required", http.StatusBadRequest)
		return
	}

	// Get next display_order
	var maxOrder sql.NullInt32
	db.QueryRow("SELECT MAX(display_order) FROM playlist_items WHERE playlist_id = $1", playlistID).Scan(&maxOrder)
	nextOrder := 0
	if maxOrder.Valid {
		nextOrder = int(maxOrder.Int32) + 1
	}

	_, err := db.Exec(`
		INSERT INTO playlist_items (playlist_id, content_item_id, display_order, override_duration)
		VALUES ($1, $2, $3, $4)
	`, playlistID, req.ContentItemID, nextOrder, req.OverrideDuration)

	if err != nil {
		log.Printf("❌ Error adding playlist item: %v", err)
		respondError(w, "Failed to add item to playlist", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Added content %d to playlist %s", req.ContentItemID, playlistID)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Item added to playlist"}})
}

// handleUpdatePlaylistItem updates a playlist item (override duration)
func handleUpdatePlaylistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playlistID := vars["id"]
	itemID := vars["itemId"]

	var req struct {
		OverrideDuration *int `json:"override_duration"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := db.Exec(`
		UPDATE playlist_items
		SET override_duration = $1
		WHERE playlist_id = $2 AND content_item_id = $3
	`, req.OverrideDuration, playlistID, itemID)

	if err != nil {
		log.Printf("❌ Error updating playlist item: %v", err)
		respondError(w, "Failed to update playlist item", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, "Playlist item not found", http.StatusNotFound)
		return
	}

	log.Printf("✅ Updated playlist item: playlist %s, content %s", playlistID, itemID)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Playlist item updated"}})
}

// handleRemovePlaylistItem removes a content item from a playlist
func handleRemovePlaylistItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playlistID := vars["id"]
	itemID := vars["itemId"]

	result, err := db.Exec(`
		DELETE FROM playlist_items
		WHERE playlist_id = $1 AND content_item_id = $2
	`, playlistID, itemID)

	if err != nil {
		log.Printf("❌ Error removing playlist item: %v", err)
		respondError(w, "Failed to remove item from playlist", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, "Playlist item not found", http.StatusNotFound)
		return
	}

	// Reorder remaining items
	_, err = db.Exec(`
		WITH ordered AS (
			SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 AS new_order
			FROM playlist_items
			WHERE playlist_id = $1
		)
		UPDATE playlist_items
		SET display_order = ordered.new_order
		FROM ordered
		WHERE playlist_items.id = ordered.id
	`, playlistID)

	if err != nil {
		log.Printf("⚠️  Warning: Failed to reorder items after deletion: %v", err)
	}

	log.Printf("✅ Removed content %s from playlist %s", itemID, playlistID)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Item removed from playlist"}})
}

// handleReorderPlaylist reorders all items in a playlist
func handleReorderPlaylist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playlistID := vars["id"]

	var req struct {
		ItemOrder []int `json:"item_order"` // Array of content_item_ids in desired order
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.ItemOrder) == 0 {
		respondError(w, "item_order is required", http.StatusBadRequest)
		return
	}

	// Update display_order for each item
	tx, err := db.Begin()
	if err != nil {
		log.Printf("❌ Error starting transaction: %v", err)
		respondError(w, "Failed to reorder playlist", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	for order, contentItemID := range req.ItemOrder {
		_, err := tx.Exec(`
			UPDATE playlist_items
			SET display_order = $1
			WHERE playlist_id = $2 AND content_item_id = $3
		`, order, playlistID, contentItemID)

		if err != nil {
			log.Printf("❌ Error reordering item: %v", err)
			respondError(w, "Failed to reorder playlist", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("❌ Error committing transaction: %v", err)
		respondError(w, "Failed to reorder playlist", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Reordered playlist %s", playlistID)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Playlist reordered"}})
}
