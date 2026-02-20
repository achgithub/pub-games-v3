package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
)

type UserAppPreference struct {
	AppID       string `json:"appId"`
	IsHidden    bool   `json:"isHidden"`
	IsFavorite  bool   `json:"isFavorite"`
	CustomOrder *int   `json:"customOrder"` // Pointer to allow null
}

// handleGetUserPreferences - GET /api/user/preferences
// Returns the current user's app preferences
func handleGetUserPreferences(w http.ResponseWriter, r *http.Request) {
	// Extract user email from token
	email := extractEmailFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Query user preferences
	rows, err := db.Query(`
		SELECT app_id, is_hidden, COALESCE(is_favorite, FALSE), custom_order
		FROM user_app_preferences
		WHERE user_email = $1
	`, email)
	if err != nil {
		log.Printf("Error querying preferences: %v", err)
		http.Error(w, "Failed to fetch preferences", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var preferences []UserAppPreference
	for rows.Next() {
		var pref UserAppPreference
		var customOrder sql.NullInt64

		err := rows.Scan(&pref.AppID, &pref.IsHidden, &pref.IsFavorite, &customOrder)
		if err != nil {
			log.Printf("Error scanning preference: %v", err)
			continue
		}

		if customOrder.Valid {
			order := int(customOrder.Int64)
			pref.CustomOrder = &order
		}

		preferences = append(preferences, pref)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"preferences": preferences,
	})
}

// handleUpdateUserPreferences - PUT /api/user/preferences
// Updates the current user's app preferences (replaces all)
func handleUpdateUserPreferences(w http.ResponseWriter, r *http.Request) {
	// Extract user email from token
	email := extractEmailFromRequest(r)
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req struct {
		Preferences []UserAppPreference `json:"preferences"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Delete existing preferences
	_, err = tx.Exec("DELETE FROM user_app_preferences WHERE user_email = $1", email)
	if err != nil {
		log.Printf("Failed to delete old preferences: %v", err)
		http.Error(w, "Failed to update preferences", http.StatusInternalServerError)
		return
	}

	// Insert new preferences
	for _, pref := range req.Preferences {
		var customOrder *int
		if pref.CustomOrder != nil {
			customOrder = pref.CustomOrder
		}

		_, err = tx.Exec(`
			INSERT INTO user_app_preferences (user_email, app_id, is_hidden, is_favorite, custom_order, updated_at)
			VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
		`, email, pref.AppID, pref.IsHidden, pref.IsFavorite, customOrder)

		if err != nil {
			log.Printf("Failed to insert preference: %v", err)
			http.Error(w, "Failed to update preferences", http.StatusInternalServerError)
			return
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		http.Error(w, "Failed to update preferences", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Updated preferences for user: %s", email)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Preferences updated successfully",
	})
}

// extractEmailFromRequest extracts email from Authorization header
// Supports both demo-token and impersonate-token formats
func extractEmailFromRequest(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	// Extract token
	token := authHeader
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Check for impersonation token
	if len(token) > 12 && token[:12] == "impersonate-" {
		var impersonatedEmail string
		err := db.QueryRow(`
			SELECT impersonated_email
			FROM impersonation_sessions
			WHERE impersonation_token = $1 AND is_active = TRUE
		`, token).Scan(&impersonatedEmail)

		if err == nil {
			return impersonatedEmail
		}
	} else if len(token) > 11 && token[:11] == "demo-token-" {
		// Extract email from demo token
		return token[11:]
	}

	return ""
}
