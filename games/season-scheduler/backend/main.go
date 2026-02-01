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

	// Setup router
	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/api/health", handleHealth).Methods("GET")

	// Config endpoint (required for app registry)
	r.HandleFunc("/api/config", handleGetConfig).Methods("GET")

	// Team management endpoints
	r.HandleFunc("/api/teams", handleGetTeams).Methods("GET")
	r.HandleFunc("/api/teams", handleAddTeam).Methods("POST")
	r.HandleFunc("/api/teams/{id}", handleDeleteTeam).Methods("DELETE")

	// Calendar/Holiday checking
	r.HandleFunc("/api/holidays", handleGetHolidays).Methods("GET")
	r.HandleFunc("/api/dates/validate", handleValidateDates).Methods("POST")

	// Schedule generation
	r.HandleFunc("/api/schedule/generate", handleGenerateSchedule).Methods("POST")
	r.HandleFunc("/api/schedule/validate", handleValidateSchedule).Methods("POST")
	r.HandleFunc("/api/schedule/{id}/reorder", handleReorderMatches).Methods("POST")
	r.HandleFunc("/api/schedule/{id}", handleSaveSchedule).Methods("POST")

	// Saved schedules
	r.HandleFunc("/api/schedules", handleGetSchedules).Methods("GET")
	r.HandleFunc("/api/schedules/{id}", handleGetSchedule).Methods("GET")
	r.HandleFunc("/api/schedules/{id}/download", handleDownloadSchedule).Methods("GET")
	r.HandleFunc("/api/schedules/{id}/email", handleEmailSchedule).Methods("POST")

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
