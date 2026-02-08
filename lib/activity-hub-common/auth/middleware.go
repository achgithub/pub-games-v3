package auth

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strings"
)

// Middleware validates JWT token and extracts user from identity database.
// Validates against identity database (pubgames.users table).
//
// Usage:
//   identityDB, _ := database.InitIdentityDatabase()
//   authMiddleware := auth.Middleware(identityDB)
//   r.HandleFunc("/api/game", authMiddleware(handleCreateGame))
func Middleware(identityDB *sql.DB) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			log.Printf("🔍 Auth request: %s %s", r.Method, r.URL.Path)

			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				log.Printf("❌ Missing Authorization header")
				http.Error(w, "Missing authorization token", http.StatusUnauthorized)
				return
			}

			// Validate Bearer format
			if !strings.HasPrefix(authHeader, "Bearer ") {
				log.Printf("❌ Invalid auth format: %s", authHeader)
				http.Error(w, "Invalid authorization format", http.StatusUnauthorized)
				return
			}

			// Extract token (format: "Bearer demo-token-{email}")
			token := strings.TrimPrefix(authHeader, "Bearer ")
			if !strings.HasPrefix(token, "demo-token-") {
				log.Printf("❌ Invalid token format: %s", token)
				http.Error(w, "Invalid token format", http.StatusUnauthorized)
				return
			}

			// Extract email from token
			email := strings.TrimPrefix(token, "demo-token-")
			log.Printf("🔍 Validating token for user: %s", email)

			// Query user from identity database
			var user AuthUser
			err := identityDB.QueryRow(`
				SELECT email, name, is_admin
				FROM users
				WHERE email = $1
			`, email).Scan(&user.Email, &user.Name, &user.IsAdmin)

			if err == sql.ErrNoRows {
				log.Printf("❌ User not found in identity database: %s", email)
				http.Error(w, "User not found", http.StatusUnauthorized)
				return
			} else if err != nil {
				log.Printf("❌ Database error during auth: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}

			log.Printf("✅ Authenticated user: %s (admin=%v)", user.Email, user.IsAdmin)

			// Store user in request context
			ctx := context.WithValue(r.Context(), userContextKey, user)
			next(w, r.WithContext(ctx))
		}
	}
}

// SSEMiddleware validates JWT token from query parameter (for EventSource compatibility).
// EventSource API doesn't support custom headers, so token must be in URL.
//
// Usage:
//   identityDB, _ := database.InitIdentityDatabase()
//   sseAuthMiddleware := auth.SSEMiddleware(identityDB)
//   r.HandleFunc("/api/game/{gameId}/stream", sseAuthMiddleware(handleGameStream))
func SSEMiddleware(identityDB *sql.DB) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			log.Printf("🔍 SSE Auth request: %s %s", r.Method, r.URL.Path)

			// Extract token from query parameter
			token := r.URL.Query().Get("token")
			if token == "" {
				log.Printf("❌ Missing token query parameter")
				http.Error(w, "Missing authorization token", http.StatusUnauthorized)
				return
			}

			// Validate token format
			if !strings.HasPrefix(token, "demo-token-") {
				log.Printf("❌ Invalid token format: %s", token)
				http.Error(w, "Invalid token format", http.StatusUnauthorized)
				return
			}

			// Extract email from token
			email := strings.TrimPrefix(token, "demo-token-")
			log.Printf("🔍 Validating SSE token for user: %s", email)

			// Query user from identity database
			var user AuthUser
			err := identityDB.QueryRow(`
				SELECT email, name, is_admin
				FROM users
				WHERE email = $1
			`, email).Scan(&user.Email, &user.Name, &user.IsAdmin)

			if err == sql.ErrNoRows {
				log.Printf("❌ User not found in identity database: %s", email)
				http.Error(w, "User not found", http.StatusUnauthorized)
				return
			} else if err != nil {
				log.Printf("❌ Database error during SSE auth: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}

			log.Printf("✅ Authenticated SSE user: %s (admin=%v)", user.Email, user.IsAdmin)

			// Store user in request context
			ctx := context.WithValue(r.Context(), userContextKey, user)
			next(w, r.WithContext(ctx))
		}
	}
}

// AdminMiddleware validates that the authenticated user is an admin.
// Must be used AFTER auth.Middleware or auth.SSEMiddleware.
//
// Usage:
//   r.HandleFunc("/api/admin/users", authMiddleware(adminMiddleware(handleGetUsers)))
func AdminMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := GetUserFromContext(r.Context())
		if !ok {
			log.Printf("❌ AdminMiddleware: No user in context")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !user.IsAdmin {
			log.Printf("❌ AdminMiddleware: User %s is not admin", user.Email)
			http.Error(w, "Forbidden: Admin access required", http.StatusForbidden)
			return
		}

		log.Printf("✅ Admin access granted: %s", user.Email)
		next(w, r)
	}
}

// GetUserFromContext extracts the authenticated user from the request context.
// Returns (user, true) if user is found, (nil, false) otherwise.
//
// Usage:
//   user, ok := auth.GetUserFromContext(r.Context())
//   if !ok {
//       http.Error(w, "Unauthorized", http.StatusUnauthorized)
//       return
//   }
//   log.Printf("User %s is making request", user.Email)
func GetUserFromContext(ctx context.Context) (*AuthUser, bool) {
	user, ok := ctx.Value(userContextKey).(AuthUser)
	if !ok {
		return nil, false
	}
	return &user, true
}
