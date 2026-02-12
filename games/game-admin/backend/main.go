package main

import (
	"database/sql"
	"log"
	"net/http"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/achgithub/activity-hub-common/config"
	"github.com/achgithub/activity-hub-common/database"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var (
	lmsDB       *sql.DB // last_man_standing_db — used by handlers
	gameAdminDB *sql.DB // game_admin_db — used for audit log
)

func main() {
	identityDB, err := database.InitIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()

	lmsDB, err = database.InitDatabaseByName("last_man_standing_db")
	if err != nil {
		log.Fatal("Failed to connect to LMS database:", err)
	}
	defer lmsDB.Close()

	gameAdminDB, err = database.InitDatabaseByName("game_admin_db")
	if err != nil {
		log.Fatal("Failed to connect to game admin database:", err)
	}
	defer gameAdminDB.Close()

	r := mux.NewRouter()

	// All API routes: first resolve token, then check game_admin/super_user role
	api := r.PathPrefix("/api").Subrouter()
	api.Use(authlib.Middleware(identityDB))
	api.Use(requireGameAdmin)

	api.HandleFunc("/config", handleConfig).Methods("GET")

	// LMS game management
	api.HandleFunc("/lms/games", handleGetLMSGames).Methods("GET")
	api.HandleFunc("/lms/games", handleCreateLMSGame).Methods("POST")
	api.HandleFunc("/lms/games/{id}/set-current", handleSetCurrentGame).Methods("PUT")
	api.HandleFunc("/lms/games/{id}/complete", handleCompleteGame).Methods("PUT")

	// LMS round management
	api.HandleFunc("/lms/rounds/{gameId}", handleGetLMSRounds).Methods("GET")
	api.HandleFunc("/lms/rounds", handleCreateRound).Methods("POST")
	api.HandleFunc("/lms/rounds/{gameId}/{round}/status", handleUpdateRoundStatus).Methods("PUT")
	api.HandleFunc("/lms/rounds/{gameId}/{round}/summary", handleGetAdminRoundSummary).Methods("GET")

	// LMS fixture file management
	api.HandleFunc("/lms/fixtures", handleGetFixtures).Methods("GET")
	api.HandleFunc("/lms/fixtures/upload", handleUploadFixture).Methods("POST")
	api.HandleFunc("/lms/fixtures/{id}/matches", handleGetFixtureMatches).Methods("GET")

	// LMS match management (queries via game → fixture file)
	api.HandleFunc("/lms/matches/{gameId}", handleGetLMSMatchesForGame).Methods("GET")
	api.HandleFunc("/lms/matches/{gameId}/{round}", handleGetLMSMatchesForGame).Methods("GET")
	api.HandleFunc("/lms/matches/{id}/result", handleSetMatchResult).Methods("PUT")

	// LMS round processing (explicit batch evaluation — no auto-process on result entry)
	api.HandleFunc("/lms/rounds/{gameId}/{round}/process", handleProcessRound).Methods("POST")

	// LMS predictions (read)
	api.HandleFunc("/lms/predictions", handleGetAllPredictions).Methods("GET")

	// Serve React frontend
	r.PathPrefix("/static/").Handler(http.FileServer(http.Dir("./static")))
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	port := config.GetEnv("PORT", "5070")
	log.Printf("🚀 Game Admin starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
