package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var db *sql.DB

const (
	APP_NAME     = "Leaderboard"
	BACKEND_PORT = "5030"
)

func main() {
	log.Printf("🏆 %s Backend Starting", APP_NAME)

	// Initialize database
	var err error
	db, err = InitDatabase()
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}
	defer db.Close()
	log.Println("✅ Connected to PostgreSQL")

	// Setup router
	r := mux.NewRouter()

	// API endpoints
	r.HandleFunc("/api/health", handleHealth).Methods("GET")
	r.HandleFunc("/api/config", HandleConfig).Methods("GET")

	// Result reporting (called by games)
	r.HandleFunc("/api/result", HandleReportResult).Methods("POST")

	// Standings queries
	r.HandleFunc("/api/standings", HandleGetAllStandings).Methods("GET")
	r.HandleFunc("/api/standings/{gameType}", HandleGetStandings).Methods("GET")

	// Recent games
	r.HandleFunc("/api/recent", HandleGetRecentGames).Methods("GET")
	r.HandleFunc("/api/recent/{gameType}", HandleGetRecentGames).Methods("GET")

	// Player stats
	r.HandleFunc("/api/player/{playerId}", HandleGetPlayerStats).Methods("GET")

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
	w.Write([]byte(`{"status":"ok","service":"leaderboard"}`))
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
	path := r.URL.Path
	fullPath := h.staticPath + path

	_, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		http.ServeFile(w, r, h.staticPath+"/"+h.indexPath)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}
