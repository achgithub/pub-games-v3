package main

import (
	"net/http"

	"github.com/lib/pq"
)

// requireGameAdmin middleware - verifies user has game_admin or super_user role.
// Mirrors requireSetupAdmin from setup-admin, checking game_admin role instead.
func requireGameAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		token := authHeader
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		var email string

		if len(token) > 12 && token[:12] == "impersonate-" {
			var impersonatedEmail string
			err := identityDB.QueryRow(`
				SELECT impersonated_email
				FROM impersonation_sessions
				WHERE impersonation_token = $1 AND is_active = TRUE
			`, token).Scan(&impersonatedEmail)
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			email = impersonatedEmail
		} else if len(token) > 11 && token[:11] == "demo-token-" {
			email = token[11:]
		} else {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var roles pq.StringArray
		err := identityDB.QueryRow(
			"SELECT COALESCE(roles, '{}') FROM users WHERE email = $1", email,
		).Scan(&roles)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		hasGameAdmin := false
		hasSuperUser := false
		for _, role := range roles {
			if role == "game_admin" {
				hasGameAdmin = true
			}
			if role == "super_user" {
				hasSuperUser = true
			}
		}

		if !hasGameAdmin && !hasSuperUser {
			http.Error(w, "Forbidden - game_admin or super_user role required", http.StatusForbidden)
			return
		}

		if hasGameAdmin {
			r.Header.Set("X-Permission-Level", "full")
		} else {
			r.Header.Set("X-Permission-Level", "read-only")
		}

		r.Header.Set("X-Admin-Email", email)
		next.ServeHTTP(w, r)
	})
}

// requireWritePermission checks if the request has full write permission.
func requireWritePermission(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("X-Permission-Level") == "read-only" {
		http.Error(w, "Forbidden - read-only access. game_admin role required for modifications.", http.StatusForbidden)
		return false
	}
	return true
}
