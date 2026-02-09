package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func main() {
	var err error

	// Get database connection string from environment or use default
	dbHost := getEnv("DB_HOST", "127.0.0.1") // Use TCP/IP for password auth
	dbPort := getEnv("DB_PORT", "5555")      // Pi uses port 5555
	dbUser := getEnv("DB_USER", "activityhub")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := getEnv("DB_NAME", "activity_hub")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	// Initialize database
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("✅ Connected to PostgreSQL database")

	// Initialize Redis
	if err := InitRedis(); err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}

	log.Println("✅ Connected to Redis")

	// Load app registry
	if err := LoadAppRegistry(); err != nil {
		log.Printf("Warning: Failed to load app registry: %v", err)
	}

	// Setup router
	r := mux.NewRouter()

	// Shared CSS for mini-apps (renamed from /static/ to /shared/ to avoid conflict)
	r.PathPrefix("/shared/").Handler(http.StripPrefix("/shared/", http.FileServer(http.Dir("./static"))))

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", handleHealth).Methods("GET")
	api.HandleFunc("/login", handleLogin).Methods("POST")
	api.HandleFunc("/login/guest", handleGuestLogin).Methods("POST")
	api.HandleFunc("/validate", handleValidate).Methods("POST")
	api.HandleFunc("/apps", handleGetApps).Methods("GET")

	// User preferences endpoints (require authentication)
	api.HandleFunc("/user/preferences", handleGetUserPreferences).Methods("GET")
	api.HandleFunc("/user/preferences", handleUpdateUserPreferences).Methods("PUT")

	// Lobby endpoints
	lobby := r.PathPrefix("/api/lobby").Subrouter()
	lobby.HandleFunc("/presence", HandleGetPresence).Methods("GET")
	lobby.HandleFunc("/presence", HandleUpdatePresence).Methods("POST")
	lobby.HandleFunc("/presence/remove", HandleRemovePresence).Methods("POST")
	lobby.HandleFunc("/challenges", HandleGetChallenges).Methods("GET")
	lobby.HandleFunc("/challenges/sent", HandleGetSentChallenges).Methods("GET")
	lobby.HandleFunc("/challenge", HandleSendChallenge).Methods("POST")
	lobby.HandleFunc("/challenge/multi", HandleSendMultiChallenge).Methods("POST") // Multi-player challenges
	lobby.HandleFunc("/challenge/accept", HandleAcceptChallenge).Methods("POST")
	lobby.HandleFunc("/challenge/reject", HandleRejectChallenge).Methods("POST")
	lobby.HandleFunc("/stream", HandleLobbyStream).Methods("GET")

	// Admin endpoints (require setup_admin role)
	admin := r.PathPrefix("/api/admin").Subrouter()
	admin.HandleFunc("/apps", requireSetupAdmin(handleAdminGetApps)).Methods("GET")
	admin.HandleFunc("/apps/{id}", requireSetupAdmin(handleAdminUpdateApp)).Methods("PUT")
	admin.HandleFunc("/apps/{id}/{action:enable|disable}", requireSetupAdmin(handleAdminToggleApp)).Methods("POST")

	// Impersonation endpoints (require super_user role)
	admin.HandleFunc("/impersonate", requireSuperUser(handleStartImpersonation)).Methods("POST")
	admin.HandleFunc("/end-impersonation", handleEndImpersonation).Methods("POST")

	// Serve frontend React app (includes /static/ for JS/CSS bundles)
	frontendDir := "../frontend/build"

	// Serve static assets (JS, CSS, images)
	r.PathPrefix("/static/").Handler(http.FileServer(http.Dir(frontendDir)))

	// SPA fallback - serve index.html for all other routes (client-side routing)
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, frontendDir+"/index.html")
	})

	// CORS configuration - Allow requests from frontend on local network
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	// Start server
	log.Println("Identity Shell Backend starting on :3001")
	log.Fatal(http.ListenAndServe(":3001", corsHandler(r)))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"service": "identity-shell",
		"timestamp": time.Now(),
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Query user from database
	var user struct {
		Email    string
		Name     string
		CodeHash string
		IsAdmin  bool
		Roles    []string
	}

	err := db.QueryRow("SELECT email, name, code_hash, is_admin, COALESCE(roles, '{}') FROM users WHERE email = $1", req.Email).
		Scan(&user.Email, &user.Name, &user.CodeHash, &user.IsAdmin, (*pq.StringArray)(&user.Roles))

	if err == sql.ErrNoRows {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	} else if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Verify password using bcrypt
	if err := bcrypt.CompareHashAndPassword([]byte(user.CodeHash), []byte(req.Code)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate simple demo token
	token := "demo-token-" + user.Email

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   token,
		"user": map[string]interface{}{
			"email":    user.Email,
			"name":     user.Name,
			"is_admin": user.IsAdmin,
			"roles":    user.Roles,
		},
	})
}

func handleGuestLogin(w http.ResponseWriter, r *http.Request) {
	// Generate unique guest ID
	guestID := uuid.New().String()
	guestToken := "guest-token-" + guestID

	// Return guest token and user info
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   guestToken,
		"user": map[string]interface{}{
			"email":    "guest-" + guestID,
			"name":     "Guest",
			"is_admin": false,
			"roles":    []string{},
			"is_guest": true,
		},
	})

	log.Printf("✅ Guest login: %s", guestID)
}

func handleValidate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check for guest token
	if len(req.Token) > 12 && req.Token[:12] == "guest-token-" {
		guestID := req.Token[12:]

		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": true,
			"user": map[string]interface{}{
				"email":    "guest-" + guestID,
				"name":     "Guest",
				"is_admin": false,
				"roles":    []string{},
				"is_guest": true,
			},
		})
		return
	}

	// Check for impersonation token
	if len(req.Token) > 12 && req.Token[:12] == "impersonate-" {
		var session struct {
			SuperUserEmail     string
			ImpersonatedEmail  string
		}

		err := db.QueryRow(`
			SELECT super_user_email, impersonated_email
			FROM impersonation_sessions
			WHERE impersonation_token = $1 AND is_active = TRUE
		`, req.Token).Scan(&session.SuperUserEmail, &session.ImpersonatedEmail)

		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid": false,
			})
			return
		}

		// Get impersonated user info
		var user struct {
			Email   string
			Name    string
			IsAdmin bool
			Roles   []string
		}

		err = db.QueryRow("SELECT email, name, is_admin, COALESCE(roles, '{}') FROM users WHERE email = $1", session.ImpersonatedEmail).
			Scan(&user.Email, &user.Name, &user.IsAdmin, (*pq.StringArray)(&user.Roles))

		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid": false,
			})
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": true,
			"user": map[string]interface{}{
				"email":         user.Email,
				"name":          user.Name,
				"is_admin":      user.IsAdmin,
				"roles":         user.Roles,
				"impersonating": true,
				"superUser":     session.SuperUserEmail,
			},
		})
		return
	}

	// For prototype, validate any demo token
	if len(req.Token) > 11 && req.Token[:11] == "demo-token-" {
		email := req.Token[11:]

		// Query user info from database
		var user struct {
			Email   string
			Name    string
			IsAdmin bool
			Roles   []string
		}

		err := db.QueryRow("SELECT email, name, is_admin, COALESCE(roles, '{}') FROM users WHERE email = $1", email).
			Scan(&user.Email, &user.Name, &user.IsAdmin, (*pq.StringArray)(&user.Roles))

		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid": false,
			})
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": true,
			"user": map[string]interface{}{
				"email":    user.Email,
				"name":     user.Name,
				"is_admin": user.IsAdmin,
				"roles":    user.Roles,
			},
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid": false,
	})
}

// getEnv gets environment variable with fallback to default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// handleGetApps returns the list of registered apps
// If Authorization header is present, filters apps based on user roles and applies user preferences
func handleGetApps(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Try to get user roles from Authorization header
	authHeader := r.Header.Get("Authorization")
	var userRoles []string
	var userEmail string
	var isGuest bool

	if authHeader != "" {
		// Extract token (format: "Bearer demo-token-email@example.com", "Bearer impersonate-uuid", or "Bearer guest-token-uuid")
		token := authHeader
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		// Check for guest token
		if len(token) > 12 && token[:12] == "guest-token-" {
			isGuest = true
			userEmail = "" // Guests don't have preferences
		} else if len(token) > 12 && token[:12] == "impersonate-" {
			// Check for impersonation token
			var impersonatedEmail string
			err := db.QueryRow(`
				SELECT impersonated_email
				FROM impersonation_sessions
				WHERE impersonation_token = $1 AND is_active = TRUE
			`, token).Scan(&impersonatedEmail)

			if err == nil {
				userEmail = impersonatedEmail
			}
		} else if len(token) > 11 && token[:11] == "demo-token-" {
			// Extract email from demo token
			userEmail = token[11:]
		}

		// Query user roles if we have an email (not guest)
		if userEmail != "" {
			var roles pq.StringArray
			err := db.QueryRow("SELECT COALESCE(roles, '{}') FROM users WHERE email = $1", userEmail).Scan(&roles)
			if err == nil {
				userRoles = roles
			}
		}
	}

	// Get apps filtered by user roles or guest access
	apps := GetAppsForUser(userRoles, isGuest)

	// Apply user preferences if authenticated (not guest)
	if userEmail != "" && !isGuest {
		apps = applyUserPreferences(apps, userEmail)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"apps": apps,
	})
}

// applyUserPreferences filters hidden apps and applies custom ordering
func applyUserPreferences(apps []AppDefinition, userEmail string) []AppDefinition {
	// Load user preferences
	prefsMap := make(map[string]UserAppPreference)
	rows, err := db.Query(`
		SELECT app_id, is_hidden, custom_order
		FROM user_app_preferences
		WHERE user_email = $1
	`, userEmail)
	if err != nil {
		log.Printf("Warning: Failed to load preferences for %s: %v", userEmail, err)
		return apps
	}
	defer rows.Close()

	for rows.Next() {
		var pref UserAppPreference
		var customOrder sql.NullInt64

		err := rows.Scan(&pref.AppID, &pref.IsHidden, &customOrder)
		if err != nil {
			continue
		}

		if customOrder.Valid {
			order := int(customOrder.Int64)
			pref.CustomOrder = &order
		}

		prefsMap[pref.AppID] = pref
	}

	// Filter out hidden apps and apply custom order
	var filteredApps []AppDefinition
	for _, app := range apps {
		if pref, exists := prefsMap[app.ID]; exists {
			if pref.IsHidden {
				continue // Skip hidden apps
			}
			// Apply custom order if set
			if pref.CustomOrder != nil {
				app.DisplayOrder = *pref.CustomOrder
			}
		}
		filteredApps = append(filteredApps, app)
	}

	// Re-sort by display_order
	// Simple bubble sort (good enough for small lists)
	for i := 0; i < len(filteredApps)-1; i++ {
		for j := 0; j < len(filteredApps)-i-1; j++ {
			if filteredApps[j].DisplayOrder > filteredApps[j+1].DisplayOrder {
				filteredApps[j], filteredApps[j+1] = filteredApps[j+1], filteredApps[j]
			}
		}
	}

	return filteredApps
}
