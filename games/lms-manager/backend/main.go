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

const APP_NAME = "LMS Manager"

func main() {
	log.Printf("🎯 %s Backend Starting", APP_NAME)

	// Initialize app database
	var err error
	db, err = database.InitDatabase("lms_manager")
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

	// Build auth middleware (requires game_manager role)
	authMiddleware := authlib.Middleware(identityDB)

	// Setup router
	r := mux.NewRouter()

	// Public endpoints
	r.HandleFunc("/api/health", handleHealth).Methods("GET")
	r.HandleFunc("/api/config", HandleConfig).Methods("GET")

	// Report endpoint (public for embed mode)
	r.HandleFunc("/api/games/{gameId}/report", HandleGetReport).Methods("GET")

	// Protected endpoints (require game_manager role)
	api := r.PathPrefix("/api").Subrouter()
	api.Use(func(next http.Handler) http.Handler {
		return authMiddleware(next)
	})

	// Teams master data
	api.HandleFunc("/teams", HandleGetTeams).Methods("GET")
	api.HandleFunc("/teams", HandleCreateTeam).Methods("POST")
	api.HandleFunc("/teams/{id}", HandleDeleteTeam).Methods("DELETE")

	// Players master data
	api.HandleFunc("/players", HandleGetPlayers).Methods("GET")
	api.HandleFunc("/players", HandleCreatePlayer).Methods("POST")
	api.HandleFunc("/players/{id}", HandleDeletePlayer).Methods("DELETE")

	// Games
	api.HandleFunc("/games", HandleGetGames).Methods("GET")
	api.HandleFunc("/games", HandleCreateGame).Methods("POST")
	api.HandleFunc("/games/{id}", HandleDeleteGame).Methods("DELETE")
	api.HandleFunc("/games/{gameId}/declare-winner", HandleDeclareWinner).Methods("POST")

	// Rounds
	api.HandleFunc("/games/{gameId}/rounds", HandleGetRounds).Methods("GET")
	api.HandleFunc("/games/{gameId}/rounds", HandleCreateRound).Methods("POST")
	api.HandleFunc("/rounds/{roundId}/close", HandleCloseRound).Methods("POST")
	api.HandleFunc("/rounds/{roundId}/process", HandleProcessRound).Methods("POST")

	// Picks
	api.HandleFunc("/rounds/{roundId}/picks", HandleGetPicks).Methods("GET")
	api.HandleFunc("/rounds/{roundId}/picks", HandleCreatePick).Methods("POST")
	api.HandleFunc("/picks/{id}", HandleUpdatePick).Methods("PUT")
	api.HandleFunc("/picks/{id}", HandleDeletePick).Methods("DELETE")
	api.HandleFunc("/picks/{id}/result", HandleSetPickResult).Methods("PUT")

	// Team results (set result for all picks of a team in a round)
	api.HandleFunc("/rounds/{roundId}/teams", HandleGetRoundTeams).Methods("GET")
	api.HandleFunc("/rounds/{roundId}/teams/{teamName}/result", HandleSetTeamResult).Methods("PUT")

	// Helper endpoints
	api.HandleFunc("/rounds/{roundId}/available-teams", HandleGetAvailableTeams).Methods("GET")
	api.HandleFunc("/rounds/{roundId}/available-players", HandleGetAvailablePlayers).Methods("GET")

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
	port := "4022"
	log.Printf("🚀 %s backend listening on :%s", APP_NAME, port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

// handleHealth - Health check endpoint
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"lms-manager"}`))
}
