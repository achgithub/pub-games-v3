package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

var db *sql.DB
var identityDB *sql.DB

const (
	APP_NAME     = "Season Scheduler"
	BACKEND_PORT = "5040"
)

func main() {
	log.Printf("🗓️  %s Backend Starting", APP_NAME)

	// Initialize PostgreSQL
	var err error
	db, err = InitDatabase()
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}
	defer db.Close()
	log.Println("✅ Connected to PostgreSQL")

	// Initialize identity database (for authentication)
	identityDB, err = InitIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()
	log.Println("✅ Connected to identity database")

	// Setup router
	r := mux.NewRouter()

	// Public endpoints (no authentication required)
	r.HandleFunc("/api/health", handleHealth).Methods("GET")
	r.HandleFunc("/api/config", handleGetConfig).Methods("GET")
	r.HandleFunc("/api/holidays", handleGetHolidays).Methods("GET")

	// User endpoints (authentication required)
	r.HandleFunc("/api/teams", AuthMiddleware(handleGetTeams)).Methods("GET")
	r.HandleFunc("/api/teams", AuthMiddleware(handleAddTeam)).Methods("POST")
	r.HandleFunc("/api/teams/{id}", AuthMiddleware(handleDeleteTeam)).Methods("DELETE")
	r.HandleFunc("/api/dates/validate", AuthMiddleware(handleValidateDates)).Methods("POST")
	r.HandleFunc("/api/schedule/generate", AuthMiddleware(handleGenerateSchedule)).Methods("POST")
	r.HandleFunc("/api/schedule/validate", AuthMiddleware(handleValidateSchedule)).Methods("POST")
	r.HandleFunc("/api/schedule/{id}/reorder", AuthMiddleware(handleReorderMatches)).Methods("POST")
	r.HandleFunc("/api/schedule/{id}", AuthMiddleware(handleSaveSchedule)).Methods("POST")
	r.HandleFunc("/api/schedules", AuthMiddleware(handleGetSchedules)).Methods("GET")
	r.HandleFunc("/api/schedules/{id}", AuthMiddleware(handleGetSchedule)).Methods("GET")
	r.HandleFunc("/api/schedules/{id}/download", AuthMiddleware(handleDownloadSchedule)).Methods("GET")
	r.HandleFunc("/api/schedules/{id}/email", AuthMiddleware(handleEmailSchedule)).Methods("POST")

	// Serve static frontend files (React build output)
	staticDir := getEnv("STATIC_DIR", "./static")
	r.PathPrefix("/").Handler(spaHandler{staticPath: staticDir, indexPath: "index.html"})

	// CORS configuration
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)

	// Start server
	port := getEnv("BACKEND_PORT", BACKEND_PORT)
	log.Printf("🚀 %s backend listening on :%s", APP_NAME, port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

// handleHealth - Health check endpoint
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"season-scheduler"}`))
}

// getEnv gets environment variable with fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// spaHandler serves a single-page application
type spaHandler struct {
	staticPath string
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Get the absolute path to prevent directory traversal
	path := r.URL.Path

	// Prepend the static directory
	fullPath := h.staticPath + path

	// Check if file exists
	_, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		// File doesn't exist, serve index.html for SPA routing
		http.ServeFile(w, r, h.staticPath+"/"+h.indexPath)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// File exists, serve it
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}
