package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

// sendError sends a JSON error response.
func sendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// sendJSON sends a JSON success response.
func sendJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// extractBearerToken returns the token from "Authorization: Bearer <token>".
func extractBearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return ""
}

// resolveImpersonation checks whether token is an active impersonation session.
// Used by /api/config for optional auth without blocking on missing token.
func resolveImpersonation(identityDB *sql.DB, token string) (impersonatedEmail, superUserEmail string, ok bool) {
	if !strings.HasPrefix(token, "impersonate-") {
		return "", "", false
	}
	err := identityDB.QueryRow(`
		SELECT impersonated_email, super_user_email
		FROM impersonation_sessions
		WHERE impersonation_token = $1 AND is_active = true
	`, token).Scan(&impersonatedEmail, &superUserEmail)
	if err != nil {
		return "", "", false
	}
	return impersonatedEmail, superUserEmail, true
}
