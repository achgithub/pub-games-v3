package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
	_ "github.com/lib/pq"
)

var (
	appDB      *sql.DB
	identityDB *sql.DB
)

func main() {
	var err error

	// Connect to identity database (activity_hub)
	identityDB, err = initIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()
	log.Println("✅ Connected to identity database")

	// Connect to app database (setup_admin_db)
	appDB, err = initAppDatabase()
	if err != nil {
		log.Fatal("Failed to connect to app database:", err)
	}
	defer appDB.Close()
	log.Println("✅ Connected to app database")

	// Setup router
	r := mux.NewRouter()

	// API routes (all require setup_admin role)
	api := r.PathPrefix("/api").Subrouter()
	api.Use(requireSetupAdmin)

	api.HandleFunc("/health", handleHealth).Methods("GET")
	api.HandleFunc("/config", handleConfig).Methods("GET")

	// User management
	api.HandleFunc("/users", handleGetUsers).Methods("GET")
	api.HandleFunc("/users/{email}/roles", handleUpdateUserRoles).Methods("PUT")

	// App management (proxies to identity-shell admin endpoints)
	api.HandleFunc("/apps", handleGetApps).Methods("GET")
	api.HandleFunc("/apps/{id}", handleUpdateApp).Methods("PUT")
	api.HandleFunc("/apps/{id}/{action:enable|disable}", handleToggleApp).Methods("POST")

	// Serve frontend static files
	r.PathPrefix("/static/").Handler(http.FileServer(http.Dir("./static")))
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	// CORS configuration
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	// Start server
	port := getEnv("PORT", "5020")
	log.Printf("🚀 Setup Admin starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

func initIdentityDatabase() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "activityhub")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := "activity_hub"

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

func initAppDatabase() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "activityhub")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := "setup_admin_db"

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

// requireSetupAdmin middleware - verifies user has setup_admin or super_user role
func requireSetupAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

		var email string

		// Check for impersonation token
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
			// Extract email from demo token
			email = token[11:]
		} else {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Query user roles from identity database
		var roles pq.StringArray
		err := identityDB.QueryRow("SELECT COALESCE(roles, '{}') FROM users WHERE email = $1", email).Scan(&roles)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Check for setup_admin or super_user role
		hasSetupAdmin := false
		hasSuperUser := false
		for _, role := range roles {
			if role == "setup_admin" {
				hasSetupAdmin = true
			}
			if role == "super_user" {
				hasSuperUser = true
			}
		}

		if !hasSetupAdmin && !hasSuperUser {
			http.Error(w, "Forbidden - setup_admin or super_user role required", http.StatusForbidden)
			return
		}

		// Set permission level header
		if hasSetupAdmin {
			r.Header.Set("X-Permission-Level", "full")
		} else {
			r.Header.Set("X-Permission-Level", "read-only")
		}

		// Store email in context for audit logging
		r.Header.Set("X-Admin-Email", email)

		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"service": "setup-admin",
	})
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"appName": "Setup Admin",
		"version": "1.0.0",
	})
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
