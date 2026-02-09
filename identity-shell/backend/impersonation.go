package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// handleStartImpersonation - POST /api/admin/impersonate
// Allows super_user to impersonate another user for debugging/support
func handleStartImpersonation(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract token
	token := authHeader
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Extract super user email from token
	if len(token) < 11 || token[:11] != "demo-token-" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	superUserEmail := token[11:]

	// Verify super_user role
	var roles pq.StringArray
	err := db.QueryRow("SELECT COALESCE(roles, '{}') FROM users WHERE email = $1", superUserEmail).Scan(&roles)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	hasSuperUser := false
	for _, role := range roles {
		if role == "super_user" {
			hasSuperUser = true
			break
		}
	}

	if !hasSuperUser {
		http.Error(w, "Forbidden - super_user role required", http.StatusForbidden)
		return
	}

	// Parse request body
	var req struct {
		TargetEmail string `json:"targetEmail"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Verify target user exists
	var targetUser struct {
		Email string
		Name  string
		Roles []string
	}

	err = db.QueryRow("SELECT email, name, COALESCE(roles, '{}') FROM users WHERE email = $1", req.TargetEmail).
		Scan(&targetUser.Email, &targetUser.Name, (*pq.StringArray)(&targetUser.Roles))

	if err == sql.ErrNoRows {
		http.Error(w, "Target user not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Generate impersonation token
	impersonationToken := "impersonate-" + uuid.New().String()

	// Store session in database
	_, err = db.Exec(`
		INSERT INTO impersonation_sessions
		(super_user_email, impersonated_email, original_token, impersonation_token, is_active)
		VALUES ($1, $2, $3, $4, TRUE)
	`, superUserEmail, targetUser.Email, token, impersonationToken)

	if err != nil {
		log.Printf("Failed to create impersonation session: %v", err)
		http.Error(w, "Failed to start impersonation", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 Impersonation started: %s -> %s", superUserEmail, targetUser.Email)

	// Return impersonation token and target user info
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   impersonationToken,
		"user": map[string]interface{}{
			"email":         targetUser.Email,
			"name":          targetUser.Name,
			"roles":         targetUser.Roles,
			"impersonating": true,
			"superUser":     superUserEmail,
		},
	})
}

// handleEndImpersonation - POST /api/admin/end-impersonation
// Ends an active impersonation session and returns to super_user
func handleEndImpersonation(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract token
	token := authHeader
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Verify it's an impersonation token
	if len(token) < 12 || token[:12] != "impersonate-" {
		http.Error(w, "Not an impersonation session", http.StatusBadRequest)
		return
	}

	// Look up session
	var session struct {
		SuperUserEmail string
		OriginalToken  string
	}

	err := db.QueryRow(`
		SELECT super_user_email, original_token
		FROM impersonation_sessions
		WHERE impersonation_token = $1 AND is_active = TRUE
	`, token).Scan(&session.SuperUserEmail, &session.OriginalToken)

	if err == sql.ErrNoRows {
		http.Error(w, "Invalid or expired impersonation session", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Mark session as ended
	_, err = db.Exec(`
		UPDATE impersonation_sessions
		SET is_active = FALSE, ended_at = CURRENT_TIMESTAMP
		WHERE impersonation_token = $1
	`, token)

	if err != nil {
		log.Printf("Failed to end impersonation session: %v", err)
		http.Error(w, "Failed to end impersonation", http.StatusInternalServerError)
		return
	}

	// Get super user info
	var superUser struct {
		Email string
		Name  string
		Roles []string
	}

	err = db.QueryRow("SELECT email, name, COALESCE(roles, '{}') FROM users WHERE email = $1", session.SuperUserEmail).
		Scan(&superUser.Email, &superUser.Name, (*pq.StringArray)(&superUser.Roles))

	if err != nil {
		log.Printf("Failed to fetch super user: %v", err)
		http.Error(w, "Failed to restore super user", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Impersonation ended: %s", session.SuperUserEmail)

	// Return original super_user token and info
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   session.OriginalToken,
		"user": map[string]interface{}{
			"email": superUser.Email,
			"name":  superUser.Name,
			"roles": superUser.Roles,
		},
	})
}
