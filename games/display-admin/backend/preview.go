package main

import (
	"database/sql"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

// handlePreviewPlaylist returns a preview of a playlist with all content
func handlePreviewPlaylist(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playlistID := vars["id"]

	// Get playlist with content (reuse existing logic)
	var playlist Playlist
	var createdBy sql.NullString
	err := db.QueryRow(`
		SELECT id, name, description, is_active, created_by, created_at, updated_at
		FROM playlists
		WHERE id = $1
	`, playlistID).Scan(&playlist.ID, &playlist.Name, &playlist.Description, &playlist.IsActive,
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
	`, playlistID)

	if err != nil {
		log.Printf("❌ Error fetching playlist items: %v", err)
		respondError(w, "Failed to fetch playlist items", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []ContentItem{}
	totalDuration := 0
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

		totalDuration += c.DurationSeconds
		items = append(items, c)
	}

	result := map[string]interface{}{
		"playlist":       playlist,
		"items":          items,
		"total_duration": totalDuration,
		"item_count":     len(items),
	}

	respondJSON(w, APIResponse{Success: true, Data: result})
}

// handlePreviewDisplay returns the current active playlist for a display
func handlePreviewDisplay(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	displayID := vars["id"]

	// Get active playlist based on current time and scheduling rules
	playlistID := getActivePlaylistForDisplay(displayID)

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

	// Get playlist items
	rows, err := db.Query(`
		SELECT c.id, c.title, c.content_type, c.duration_seconds, c.file_path,
		       c.url, c.text_content, c.bg_color, c.text_color, c.is_active,
		       c.created_by, c.created_at, c.updated_at,
		       pi.override_duration, pi.display_order
		FROM playlist_items pi
		JOIN content_items c ON pi.content_item_id = c.id
		WHERE pi.playlist_id = $1
		ORDER BY pi.display_order ASC
	`, playlistID)

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

// getActivePlaylistForDisplay determines which playlist should be active now
// based on scheduling rules and priority
func getActivePlaylistForDisplay(displayID string) int {
	now := time.Now()
	currentDate := now.Format("2006-01-02")
	currentTime := now.Format("15:04:05")
	currentDay := now.Weekday().String()[:3] // "Mon", "Tue", etc.

	rows, err := db.Query(`
		SELECT playlist_id, priority, start_date, end_date, start_time, end_time, days_of_week
		FROM display_assignments
		WHERE display_id = $1
		ORDER BY priority DESC
	`, displayID)

	if err != nil {
		log.Printf("❌ Error querying assignments: %v", err)
		return 0
	}
	defer rows.Close()

	for rows.Next() {
		var playlistID, priority int
		var startDate, endDate sql.NullTime
		var startTime, endTime, daysOfWeek sql.NullString

		err := rows.Scan(&playlistID, &priority, &startDate, &endDate, &startTime, &endTime, &daysOfWeek)
		if err != nil {
			log.Printf("❌ Error scanning assignment: %v", err)
			continue
		}

		// Check date range
		if startDate.Valid {
			if currentDate < startDate.Time.Format("2006-01-02") {
				continue // Not yet active
			}
		}
		if endDate.Valid {
			if currentDate > endDate.Time.Format("2006-01-02") {
				continue // Expired
			}
		}

		// Check time range
		if startTime.Valid && endTime.Valid {
			if currentTime < startTime.String || currentTime > endTime.String {
				continue // Outside time window
			}
		}

		// Check days of week
		if daysOfWeek.Valid && daysOfWeek.String != "" {
			days := strings.Split(daysOfWeek.String, ",")
			isValidDay := false
			for _, day := range days {
				if strings.TrimSpace(day) == currentDay {
					isValidDay = true
					break
				}
			}
			if !isValidDay {
				continue // Not active on this day
			}
		}

		// All checks passed - this is the active playlist (highest priority match)
		log.Printf("✅ Active playlist for display %s: playlist %d (priority %d)", displayID, playlistID, priority)
		return playlistID
	}

	log.Printf("⚠️  No active playlist for display %s at current time", displayID)
	return 0
}
