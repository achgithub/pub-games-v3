package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type contextKey string

const userContextKey contextKey = "user"

// AuthUser represents the authenticated player.
type AuthUser struct {
	Email           string
	IsImpersonating bool
	ImpersonatedBy  string
}

// AuthMiddleware validates tokens and attaches user to context.
// Handles demo-token-{email} and impersonate-{uuid} formats.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			sendError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		token := authHeader
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		user, err := resolveToken(token)
		if err != nil {
			sendError(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// resolveToken extracts an AuthUser from a token string.
func resolveToken(token string) (*AuthUser, error) {
	if len(token) > 12 && token[:12] == "impersonate-" {
		var impersonatedEmail, superUserEmail string
		err := identityDB.QueryRow(`
			SELECT impersonated_email, super_user_email
			FROM impersonation_sessions
			WHERE impersonation_token = $1 AND is_active = TRUE
		`, token).Scan(&impersonatedEmail, &superUserEmail)
		if err != nil {
			return nil, err
		}
		return &AuthUser{
			Email:           impersonatedEmail,
			IsImpersonating: true,
			ImpersonatedBy:  superUserEmail,
		}, nil
	}

	if len(token) > 11 && token[:11] == "demo-token-" {
		email := token[11:]
		if email == "" {
			return nil, fmt.Errorf("empty email in token")
		}
		return &AuthUser{Email: email}, nil
	}

	return nil, fmt.Errorf("unrecognized token format")
}

// getUserFromContext extracts the authenticated user from the request context.
func getUserFromContext(r *http.Request) *AuthUser {
	user, _ := r.Context().Value(userContextKey).(*AuthUser)
	return user
}

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
