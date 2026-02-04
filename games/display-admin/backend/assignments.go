package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// handleGetAssignments returns all display assignments with details
func handleGetAssignments(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT da.id, da.display_id, da.playlist_id, da.priority,
		       da.start_date, da.end_date, da.start_time, da.end_time, da.days_of_week,
		       da.created_at, da.updated_at,
		       d.name AS display_name, p.name AS playlist_name
		FROM display_assignments da
		JOIN displays d ON da.display_id = d.id
		JOIN playlists p ON da.playlist_id = p.id
		ORDER BY da.created_at DESC
	`)
	if err != nil {
		log.Printf("❌ Error querying assignments: %v", err)
		respondError(w, "Failed to fetch assignments", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	assignments := []DisplayAssignmentWithDetails{}
	for rows.Next() {
		var a DisplayAssignmentWithDetails
		var startDate, endDate sql.NullTime
		var startTime, endTime, daysOfWeek sql.NullString

		err := rows.Scan(&a.ID, &a.DisplayID, &a.PlaylistID, &a.Priority,
			&startDate, &endDate, &startTime, &endTime, &daysOfWeek,
			&a.CreatedAt, &a.UpdatedAt, &a.DisplayName, &a.PlaylistName)

		if err != nil {
			log.Printf("❌ Error scanning assignment: %v", err)
			continue
		}

		if startDate.Valid {
			a.StartDate = &startDate.Time
		}
		if endDate.Valid {
			a.EndDate = &endDate.Time
		}
		if startTime.Valid {
			a.StartTime = &startTime.String
		}
		if endTime.Valid {
			a.EndTime = &endTime.String
		}
		if daysOfWeek.Valid {
			a.DaysOfWeek = &daysOfWeek.String
		}

		assignments = append(assignments, a)
	}

	respondJSON(w, APIResponse{Success: true, Data: assignments})
}

// handleGetDisplayAssignments returns assignments for a specific display
func handleGetDisplayAssignments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	displayID := vars["displayId"]

	rows, err := db.Query(`
		SELECT da.id, da.display_id, da.playlist_id, da.priority,
		       da.start_date, da.end_date, da.start_time, da.end_time, da.days_of_week,
		       da.created_at, da.updated_at,
		       d.name AS display_name, p.name AS playlist_name
		FROM display_assignments da
		JOIN displays d ON da.display_id = d.id
		JOIN playlists p ON da.playlist_id = p.id
		WHERE da.display_id = $1
		ORDER BY da.priority DESC, da.created_at DESC
	`, displayID)
	if err != nil {
		log.Printf("❌ Error querying display assignments: %v", err)
		respondError(w, "Failed to fetch assignments", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	assignments := []DisplayAssignmentWithDetails{}
	for rows.Next() {
		var a DisplayAssignmentWithDetails
		var startDate, endDate sql.NullTime
		var startTime, endTime, daysOfWeek sql.NullString

		err := rows.Scan(&a.ID, &a.DisplayID, &a.PlaylistID, &a.Priority,
			&startDate, &endDate, &startTime, &endTime, &daysOfWeek,
			&a.CreatedAt, &a.UpdatedAt, &a.DisplayName, &a.PlaylistName)

		if err != nil {
			log.Printf("❌ Error scanning assignment: %v", err)
			continue
		}

		if startDate.Valid {
			a.StartDate = &startDate.Time
		}
		if endDate.Valid {
			a.EndDate = &endDate.Time
		}
		if startTime.Valid {
			a.StartTime = &startTime.String
		}
		if endTime.Valid {
			a.EndTime = &endTime.String
		}
		if daysOfWeek.Valid {
			a.DaysOfWeek = &daysOfWeek.String
		}

		assignments = append(assignments, a)
	}

	respondJSON(w, APIResponse{Success: true, Data: assignments})
}

// handleGetAssignment returns a single assignment
func handleGetAssignment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var a DisplayAssignmentWithDetails
	var startDate, endDate sql.NullTime
	var startTime, endTime, daysOfWeek sql.NullString

	err := db.QueryRow(`
		SELECT da.id, da.display_id, da.playlist_id, da.priority,
		       da.start_date, da.end_date, da.start_time, da.end_time, da.days_of_week,
		       da.created_at, da.updated_at,
		       d.name AS display_name, p.name AS playlist_name
		FROM display_assignments da
		JOIN displays d ON da.display_id = d.id
		JOIN playlists p ON da.playlist_id = p.id
		WHERE da.id = $1
	`, id).Scan(&a.ID, &a.DisplayID, &a.PlaylistID, &a.Priority,
		&startDate, &endDate, &startTime, &endTime, &daysOfWeek,
		&a.CreatedAt, &a.UpdatedAt, &a.DisplayName, &a.PlaylistName)

	if err == sql.ErrNoRows {
		respondError(w, "Assignment not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error fetching assignment: %v", err)
		respondError(w, "Failed to fetch assignment", http.StatusInternalServerError)
		return
	}

	if startDate.Valid {
		a.StartDate = &startDate.Time
	}
	if endDate.Valid {
		a.EndDate = &endDate.Time
	}
	if startTime.Valid {
		a.StartTime = &startTime.String
	}
	if endTime.Valid {
		a.EndTime = &endTime.String
	}
	if daysOfWeek.Valid {
		a.DaysOfWeek = &daysOfWeek.String
	}

	respondJSON(w, APIResponse{Success: true, Data: a})
}

// handleCreateAssignment creates a new display assignment
func handleCreateAssignment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayID  int        `json:"display_id"`
		PlaylistID int        `json:"playlist_id"`
		Priority   int        `json:"priority"`
		StartDate  *time.Time `json:"start_date"`
		EndDate    *time.Time `json:"end_date"`
		StartTime  *string    `json:"start_time"`
		EndTime    *string    `json:"end_time"`
		DaysOfWeek *string    `json:"days_of_week"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.DisplayID == 0 || req.PlaylistID == 0 {
		respondError(w, "display_id and playlist_id are required", http.StatusBadRequest)
		return
	}

	var assignment DisplayAssignment
	var startDate, endDate sql.NullTime
	var startTime, endTime, daysOfWeek sql.NullString

	err := db.QueryRow(`
		INSERT INTO display_assignments (display_id, playlist_id, priority,
		                                  start_date, end_date, start_time, end_time, days_of_week)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, display_id, playlist_id, priority,
		          start_date, end_date, start_time, end_time, days_of_week,
		          created_at, updated_at
	`, req.DisplayID, req.PlaylistID, req.Priority,
		req.StartDate, req.EndDate, req.StartTime, req.EndTime, req.DaysOfWeek).Scan(
		&assignment.ID, &assignment.DisplayID, &assignment.PlaylistID, &assignment.Priority,
		&startDate, &endDate, &startTime, &endTime, &daysOfWeek,
		&assignment.CreatedAt, &assignment.UpdatedAt,
	)

	if err != nil {
		log.Printf("❌ Error creating assignment: %v", err)
		respondError(w, "Failed to create assignment", http.StatusInternalServerError)
		return
	}

	if startDate.Valid {
		assignment.StartDate = &startDate.Time
	}
	if endDate.Valid {
		assignment.EndDate = &endDate.Time
	}
	if startTime.Valid {
		assignment.StartTime = &startTime.String
	}
	if endTime.Valid {
		assignment.EndTime = &endTime.String
	}
	if daysOfWeek.Valid {
		assignment.DaysOfWeek = &daysOfWeek.String
	}

	log.Printf("✅ Created assignment: display %d -> playlist %d", req.DisplayID, req.PlaylistID)
	respondJSON(w, APIResponse{Success: true, Data: assignment})
}

// handleUpdateAssignment updates an existing assignment
func handleUpdateAssignment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		DisplayID  *int       `json:"display_id"`
		PlaylistID *int       `json:"playlist_id"`
		Priority   *int       `json:"priority"`
		StartDate  *time.Time `json:"start_date"`
		EndDate    *time.Time `json:"end_date"`
		StartTime  *string    `json:"start_time"`
		EndTime    *string    `json:"end_time"`
		DaysOfWeek *string    `json:"days_of_week"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var assignment DisplayAssignment
	var startDate, endDate sql.NullTime
	var startTime, endTime, daysOfWeek sql.NullString

	err := db.QueryRow(`
		UPDATE display_assignments
		SET display_id = COALESCE($1, display_id),
		    playlist_id = COALESCE($2, playlist_id),
		    priority = COALESCE($3, priority),
		    start_date = COALESCE($4, start_date),
		    end_date = COALESCE($5, end_date),
		    start_time = COALESCE($6, start_time),
		    end_time = COALESCE($7, end_time),
		    days_of_week = COALESCE($8, days_of_week),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $9
		RETURNING id, display_id, playlist_id, priority,
		          start_date, end_date, start_time, end_time, days_of_week,
		          created_at, updated_at
	`, req.DisplayID, req.PlaylistID, req.Priority,
		req.StartDate, req.EndDate, req.StartTime, req.EndTime, req.DaysOfWeek, id).Scan(
		&assignment.ID, &assignment.DisplayID, &assignment.PlaylistID, &assignment.Priority,
		&startDate, &endDate, &startTime, &endTime, &daysOfWeek,
		&assignment.CreatedAt, &assignment.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		respondError(w, "Assignment not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error updating assignment: %v", err)
		respondError(w, "Failed to update assignment", http.StatusInternalServerError)
		return
	}

	if startDate.Valid {
		assignment.StartDate = &startDate.Time
	}
	if endDate.Valid {
		assignment.EndDate = &endDate.Time
	}
	if startTime.Valid {
		assignment.StartTime = &startTime.String
	}
	if endTime.Valid {
		assignment.EndTime = &endTime.String
	}
	if daysOfWeek.Valid {
		assignment.DaysOfWeek = &daysOfWeek.String
	}

	log.Printf("✅ Updated assignment ID: %s", id)
	respondJSON(w, APIResponse{Success: true, Data: assignment})
}

// handleDeleteAssignment deletes an assignment
func handleDeleteAssignment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := db.Exec("DELETE FROM display_assignments WHERE id = $1", id)
	if err != nil {
		log.Printf("❌ Error deleting assignment: %v", err)
		respondError(w, "Failed to delete assignment", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, "Assignment not found", http.StatusNotFound)
		return
	}

	log.Printf("✅ Deleted assignment ID: %s", id)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Assignment deleted"}})
}
