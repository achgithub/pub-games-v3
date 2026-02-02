package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// AuthUser represents an authenticated user
type AuthUser struct {
	Email   string
	Name    string
	IsAdmin bool
}

// Context key for storing authenticated user
type contextKey string

const userContextKey = contextKey("user")

// AuthMiddleware validates JWT token and extracts user
// Validates against identity database (pubgames.users table)
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization token", http.StatusUnauthorized)
			return
		}

		// Validate Bearer format
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Invalid authorization format", http.StatusUnauthorized)
			return
		}

		// Extract token (format: "Bearer demo-token-{email}")
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if !strings.HasPrefix(token, "demo-token-") {
			http.Error(w, "Invalid token format", http.StatusUnauthorized)
			return
		}

		// Extract email from token
		email := strings.TrimPrefix(token, "demo-token-")

		// Query user from identity database
		var user AuthUser
		err := identityDB.QueryRow(`
			SELECT email, name, is_admin
			FROM users
			WHERE email = $1
		`, email).Scan(&user.Email, &user.Name, &user.IsAdmin)

		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusUnauthorized)
			return
		} else if err != nil {
			log.Printf("Database error during auth: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Sync user to local database (create if doesn't exist)
		if err := GetOrCreateUser(user.Email, user.Name, user.IsAdmin); err != nil {
			log.Printf("Failed to sync user to local db: %v", err)
			// Continue anyway - user is authenticated, local sync is convenience
		}

		// Store user in request context
		ctx := context.WithValue(r.Context(), userContextKey, user)
		next(w, r.WithContext(ctx))
	}
}

// AdminMiddleware checks if authenticated user is admin
// Must be chained after AuthMiddleware
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := getUserFromContext(r)
		if user == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !user.IsAdmin {
			http.Error(w, "Admin access required", http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// getUserFromContext extracts authenticated user from request context
func getUserFromContext(r *http.Request) *AuthUser {
	user, ok := r.Context().Value(userContextKey).(AuthUser)
	if !ok {
		return nil
	}
	return &user
}

// GetOrCreateUser ensures a user exists in the local database
// Called automatically by AuthMiddleware after validating token
func GetOrCreateUser(email, name string, isAdmin bool) error {
	// Check if user exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check user existence: %w", err)
	}

	if exists {
		// Update user info in case name or admin status changed
		_, err = db.Exec(
			"UPDATE users SET name = $2, is_admin = $3 WHERE email = $1",
			email, name, isAdmin,
		)
		return err
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
// DEPRECATED: User sync now happens automatically in AuthMiddleware
// Kept for backwards compatibility
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
