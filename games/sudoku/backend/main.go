package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/achgithub/activity-hub-common/database"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

var db *sql.DB

const APP_NAME = "Sudoku"

type Config struct {
	AppName string `json:"appName"`
	Port    int    `json:"port"`
}

func main() {
	log.Printf("🎯 %s Backend Starting", APP_NAME)

	// Initialize app database
	var err error
	db, err = database.InitDatabase("sudoku")
	if err != nil {
		log.Fatal("Failed to connect to app database:", err)
	}
	defer db.Close()

	// Initialize identity database (for authentication)
	identityDB, err := database.InitIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()

	// Run cleanup of stale progress on startup
	go cleanupStaleProgress()

	// Build authentication middleware
	authMiddleware := authlib.Middleware(identityDB)

	// Setup router
	r := mux.NewRouter()

	// Public endpoints
	r.HandleFunc("/api/config", handleConfig).Methods("GET")
	r.HandleFunc("/api/ping", handlePing).Methods("GET")
	r.HandleFunc("/api/puzzles", handleListPuzzles).Methods("GET")
	r.HandleFunc("/api/puzzles/{id}", handleGetPuzzle).Methods("GET")

	// Authenticated endpoints
	r.Handle("/api/progress", authMiddleware(http.HandlerFunc(handleGetProgress))).Methods("GET")
	r.Handle("/api/progress", authMiddleware(http.HandlerFunc(handleSaveProgress))).Methods("POST")

	// Admin endpoints (puzzle creation/generation)
	r.Handle("/api/puzzles", authMiddleware(http.HandlerFunc(handleCreatePuzzle))).Methods("POST")
	r.Handle("/api/puzzles/generate", authMiddleware(http.HandlerFunc(handleGeneratePuzzle))).Methods("POST")

	// Serve static frontend files
	staticDir := "./static"
	r.PathPrefix("/").Handler(http.FileServer(http.Dir(staticDir)))

	// CORS for local development
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)(r)

	port := getEnv("PORT", "4081")
	log.Printf("✅ %s server running on port %s", APP_NAME, port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler))
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	config := Config{
		AppName: "sudoku",
		Port:    4081,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func handlePing(w http.ResponseWriter, r *http.Request) {
	response := map[string]string{
		"status": "ok",
		"app":    "sudoku",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
