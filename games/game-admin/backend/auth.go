package main

import (
	"net/http"

	authlib "github.com/achgithub/activity-hub-common/auth"
)

// requireGameAdmin checks that the authenticated user has game_admin or super_user role.
// Must be used after authlib.Middleware (which puts the user in context).
//
// game_admin role → X-Permission-Level: full
// super_user role → X-Permission-Level: read-only
func requireGameAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := authlib.GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		hasGameAdmin := user.HasRole("game_admin")
		hasSuperUser := user.HasRole("super_user")

		if !hasGameAdmin && !hasSuperUser {
			http.Error(w, "Forbidden - game_admin or super_user role required", http.StatusForbidden)
			return
		}

		if hasGameAdmin {
			r.Header.Set("X-Permission-Level", "full")
		} else {
			r.Header.Set("X-Permission-Level", "read-only")
		}

		r.Header.Set("X-Admin-Email", user.Email)
		next.ServeHTTP(w, r)
	})
}

// requireWritePermission blocks the request when the caller has read-only access.
func requireWritePermission(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("X-Permission-Level") == "read-only" {
		http.Error(w, "Forbidden - read-only access. game_admin role required for modifications.", http.StatusForbidden)
		return false
	}
	return true
}
