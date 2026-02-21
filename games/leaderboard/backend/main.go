package main

import (
	"database/sql"
	"log"
	"net/http"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/achgithub/activity-hub-common/database"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

var db *sql.DB

const APP_NAME = "Leaderboard"

func main() {
	log.Printf("🏆 %s Backend Starting", APP_NAME)

	// Initialize app database
	var err error
	db, err = database.InitDatabase("leaderboard_db")
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

	// Build auth middleware (only needed for result reporting)
	authMiddleware := authlib.Middleware(identityDB)

	// Setup router
	r := mux.NewRouter()

	// Public API endpoints (no authentication required)
	r.HandleFunc("/api/health", handleHealth).Methods("GET")
	r.HandleFunc("/api/config", HandleConfig).Methods("GET")

	// Standings queries (public - it's a public scoreboard)
	r.HandleFunc("/api/standings", HandleGetAllStandings).Methods("GET")
	r.HandleFunc("/api/standings/{gameType}", HandleGetStandings).Methods("GET")

	// Recent games (public)
	r.HandleFunc("/api/recent", HandleGetRecentGames).Methods("GET")
	r.HandleFunc("/api/recent/{gameType}", HandleGetRecentGames).Methods("GET")

	// Player stats (public)
	r.HandleFunc("/api/player/{playerId}", HandleGetPlayerStats).Methods("GET")

	// Result reporting (authentication required - prevents fake results)
	// Games report results using a player's token to prove legitimacy
	r.Handle("/api/result", authMiddleware(http.HandlerFunc(HandleReportResult))).Methods("POST")

	// Serve static frontend files (React build output)
	staticDir := "./static"
	r.PathPrefix("/").Handler(http.FileServer(http.Dir(staticDir)))

	// CORS configuration
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)

	// Start server
	port := "5030"
	log.Printf("🚀 %s backend listening on :%s", APP_NAME, port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

// handleHealth - Health check endpoint
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"leaderboard"}`))
}
