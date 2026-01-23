package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
)

// AuthMiddleware validates the user session
// In V3, the Identity Shell passes user info via URL params or headers
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get user email from query param (passed by shell) or session
		email := r.URL.Query().Get("user")
		if email == "" {
			// Check if user is already in session (stored in cookie or localStorage)
			// For prototype, we'll require the user param
			http.Error(w, "Unauthorized - no user provided", http.StatusUnauthorized)
			return
		}

		// Store user in request context for handlers to use
		// For prototype, we'll just validate and pass through
		next(w, r)
	}
}

// AdminMiddleware validates the user is an admin
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		email := r.URL.Query().Get("user")
		if email == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Check if user is admin in database
		var isAdmin bool
		err := db.QueryRow("SELECT is_admin FROM users WHERE email = $1", email).Scan(&isAdmin)
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusUnauthorized)
			return
		} else if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if !isAdmin {
			http.Error(w, "Forbidden - admin access required", http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// GetOrCreateUser ensures a user exists in the local database
// Called when a user first accesses this app from the shell
func GetOrCreateUser(email, name string, isAdmin bool) error {
	// Check if user exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check user existence: %w", err)
	}

	if exists {
		return nil
	}

	// Create user
	_, err = db.Exec(
		"INSERT INTO users (email, name, is_admin) VALUES ($1, $2, $3)",
		email, name, isAdmin,
	)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// HandleUserSync syncs user data from identity shell
func HandleUserSync(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email   string `json:"email"`
		Name    string `json:"name"`
		IsAdmin bool   `json:"is_admin"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := GetOrCreateUser(req.Email, req.Name, req.IsAdmin); err != nil {
		http.Error(w, "Failed to sync user", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
