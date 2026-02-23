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

	// Build authentication middleware
	authMiddleware := authlib.Middleware(identityDB)

	// Setup router
	r := mux.NewRouter()

	// Public endpoints
	r.HandleFunc("/api/config", HandleConfig).Methods("GET")
	r.HandleFunc("/api/report/{gameId}", HandleGetReport).Methods("GET")

	// Setup endpoints (groups, teams, players)
	r.Handle("/api/groups", authMiddleware(http.HandlerFunc(HandleListGroups))).Methods("GET")
	r.Handle("/api/groups", authMiddleware(http.HandlerFunc(HandleCreateGroup))).Methods("POST")
	r.Handle("/api/groups/{id}", authMiddleware(http.HandlerFunc(HandleDeleteGroup))).Methods("DELETE")

	r.Handle("/api/groups/{id}/teams", authMiddleware(http.HandlerFunc(HandleListTeams))).Methods("GET")
	r.Handle("/api/groups/{id}/teams", authMiddleware(http.HandlerFunc(HandleCreateTeam))).Methods("POST")
	r.Handle("/api/teams/{id}", authMiddleware(http.HandlerFunc(HandleUpdateTeam))).Methods("PUT")
	r.Handle("/api/teams/{id}", authMiddleware(http.HandlerFunc(HandleDeleteTeam))).Methods("DELETE")

	r.Handle("/api/players", authMiddleware(http.HandlerFunc(HandleListPlayers))).Methods("GET")
	r.Handle("/api/players", authMiddleware(http.HandlerFunc(HandleCreatePlayer))).Methods("POST")
	r.Handle("/api/players/{id}", authMiddleware(http.HandlerFunc(HandleDeletePlayer))).Methods("DELETE")

	// Game endpoints
	r.Handle("/api/games", authMiddleware(http.HandlerFunc(HandleListGames))).Methods("GET")
	r.Handle("/api/games", authMiddleware(http.HandlerFunc(HandleCreateGame))).Methods("POST")
	r.Handle("/api/games/{id}", authMiddleware(http.HandlerFunc(HandleGetGame))).Methods("GET")
	r.Handle("/api/games/{id}", authMiddleware(http.HandlerFunc(HandleDeleteGame))).Methods("DELETE")
	r.Handle("/api/games/{id}/advance", authMiddleware(http.HandlerFunc(HandleAdvanceRound))).Methods("POST")
	r.Handle("/api/games/{id}/used-teams", authMiddleware(http.HandlerFunc(HandleGetUsedTeams))).Methods("GET")
	r.Handle("/api/games/{id}/participants", authMiddleware(http.HandlerFunc(HandleAddParticipants))).Methods("POST")

	// Round/Pick endpoints
	r.Handle("/api/rounds/{roundId}/picks", authMiddleware(http.HandlerFunc(HandleGetRoundPicks))).Methods("GET")
	r.Handle("/api/rounds/{roundId}/picks", authMiddleware(http.HandlerFunc(HandleSavePicks))).Methods("POST")
	r.Handle("/api/rounds/{roundId}/finalize-picks", authMiddleware(http.HandlerFunc(HandleFinalizePicks))).Methods("POST")
	r.Handle("/api/rounds/{roundId}/results", authMiddleware(http.HandlerFunc(HandleSaveResults))).Methods("POST")
	r.Handle("/api/rounds/{roundId}/reopen", authMiddleware(http.HandlerFunc(HandleReopenRound))).Methods("POST")

	// Serve static files (React build output)
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
