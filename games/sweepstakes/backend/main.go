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
	APP_NAME     = "Sweepstakes"
	BACKEND_PORT = "4031"
)

func main() {
	log.Printf("🎭 %s Backend Starting", APP_NAME)

	// Initialize Redis
	if err := InitRedis(); err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}
	log.Println("✅ Connected to Redis")

	// Initialize local PostgreSQL
	var err error
	db, err = InitDatabase()
	if err != nil {
		log.Fatal("Failed to connect to local PostgreSQL:", err)
	}
	defer db.Close()
	log.Println("✅ Connected to local PostgreSQL")

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
	r.HandleFunc("/api/competitions", handleGetCompetitions).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/entries", handleGetEntries).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/available-count", handleGetAvailableCount).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/lock-status", handleCheckSelectionLock).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/all-draws", handleGetCompetitionDraws).Methods("GET")

	// User endpoints (authentication required)
	r.HandleFunc("/api/competitions/{id}/blind-boxes", AuthMiddleware(handleGetBlindBoxes)).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/choose-blind-box", AuthMiddleware(handleChooseBlindBox)).Methods("POST")
	r.HandleFunc("/api/competitions/{id}/random-pick", AuthMiddleware(handleRandomPick)).Methods("POST")
	r.HandleFunc("/api/competitions/{id}/lock", AuthMiddleware(handleAcquireSelectionLock)).Methods("POST")
	r.HandleFunc("/api/competitions/{id}/unlock", AuthMiddleware(handleReleaseSelectionLock)).Methods("POST")
	r.HandleFunc("/api/draws", AuthMiddleware(handleGetUserDraws)).Methods("GET")

	// Admin endpoints (authentication + admin privilege required)
	r.HandleFunc("/api/competitions", AuthMiddleware(AdminMiddleware(handleCreateCompetition))).Methods("POST")
	r.HandleFunc("/api/competitions/{id}", AuthMiddleware(AdminMiddleware(handleUpdateCompetition))).Methods("PUT")
	r.HandleFunc("/api/entries/upload", AuthMiddleware(AdminMiddleware(handleUploadEntries))).Methods("POST")
	r.HandleFunc("/api/entries/{id}", AuthMiddleware(AdminMiddleware(handleUpdateEntry))).Methods("PUT")
	r.HandleFunc("/api/entries/{id}", AuthMiddleware(AdminMiddleware(handleDeleteEntry))).Methods("DELETE")
	r.HandleFunc("/api/competitions/{id}/update-position", AuthMiddleware(AdminMiddleware(handleUpdateEntryPosition))).Methods("POST")

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
	w.Write([]byte(`{"status":"ok","service":"sweepstakes"}`))
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
