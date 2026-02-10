package main

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var (
	identityDB  *sql.DB // activity_hub
	lmsDB       *sql.DB // last_man_standing_db
	gameAdminDB *sql.DB // game_admin_db
)

func main() {
	var err error

	identityDB, err = initIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()
	log.Println("✅ Connected to identity database")

	lmsDB, err = initLMSDatabase()
	if err != nil {
		log.Fatal("Failed to connect to LMS database:", err)
	}
	defer lmsDB.Close()
	log.Println("✅ Connected to LMS database")

	gameAdminDB, err = initGameAdminDatabase()
	if err != nil {
		log.Fatal("Failed to connect to game admin database:", err)
	}
	defer gameAdminDB.Close()
	log.Println("✅ Connected to game admin database")

	r := mux.NewRouter()

	// All API routes require game_admin or super_user role
	api := r.PathPrefix("/api").Subrouter()
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

	// LMS match management
	api.HandleFunc("/lms/matches/{gameId}/{round}", handleGetLMSMatches).Methods("GET")
	api.HandleFunc("/lms/matches/upload", handleUploadMatches).Methods("POST")
	api.HandleFunc("/lms/matches/{id}/result", handleSetMatchResult).Methods("PUT")

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

	port := getEnv("PORT", "5070")
	log.Printf("🚀 Game Admin starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
