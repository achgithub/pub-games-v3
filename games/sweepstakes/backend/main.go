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

	// Public endpoints
	r.HandleFunc("/api/health", handleHealth).Methods("GET")
	r.HandleFunc("/api/config", handleGetConfig).Methods("GET")

	// Competition endpoints
	r.HandleFunc("/api/competitions", handleGetCompetitions).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/entries", handleGetEntries).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/available-count", handleGetAvailableCount).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/blind-boxes", handleGetBlindBoxes).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/choose-blind-box", handleChooseBlindBox).Methods("POST")
	r.HandleFunc("/api/competitions/{id}/random-pick", handleRandomPick).Methods("POST")
	r.HandleFunc("/api/competitions/{id}/lock", handleAcquireSelectionLock).Methods("POST")
	r.HandleFunc("/api/competitions/{id}/unlock", handleReleaseSelectionLock).Methods("POST")
	r.HandleFunc("/api/competitions/{id}/lock-status", handleCheckSelectionLock).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/all-draws", handleGetCompetitionDraws).Methods("GET")

	// Draw endpoints
	r.HandleFunc("/api/draws", handleGetUserDraws).Methods("GET")

	// Admin endpoints
	r.HandleFunc("/api/competitions", handleCreateCompetition).Methods("POST")
	r.HandleFunc("/api/competitions/{id}", handleUpdateCompetition).Methods("PUT")
	r.HandleFunc("/api/entries/upload", handleUploadEntries).Methods("POST")
	r.HandleFunc("/api/entries/{id}", handleUpdateEntry).Methods("PUT")
	r.HandleFunc("/api/entries/{id}", handleDeleteEntry).Methods("DELETE")
	r.HandleFunc("/api/competitions/{id}/update-position", handleUpdateEntryPosition).Methods("POST")

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
