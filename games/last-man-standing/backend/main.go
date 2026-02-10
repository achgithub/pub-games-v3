package main

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var (
	appDB      *sql.DB // last_man_standing_db
	identityDB *sql.DB // activity_hub
)

func main() {
	var err error

	identityDB, err = initIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()
	log.Println("✅ Connected to identity database")

	appDB, err = initLMSDatabase()
	if err != nil {
		log.Fatal("Failed to connect to LMS database:", err)
	}
	defer appDB.Close()
	log.Println("✅ Connected to LMS database")

	r := mux.NewRouter()

	// Public routes (no auth required)
	r.HandleFunc("/api/config", handleConfig).Methods("GET")
	r.HandleFunc("/api/games/current", handleGetCurrentGame).Methods("GET")

	// Auth-protected routes
	protected := r.PathPrefix("/api").Subrouter()
	protected.Use(AuthMiddleware)
	protected.HandleFunc("/games/join", handleJoinGame).Methods("POST")
	protected.HandleFunc("/games/status", handleGetGameStatus).Methods("GET")
	protected.HandleFunc("/rounds/open", handleGetOpenRounds).Methods("GET")
	protected.HandleFunc("/matches/{gameId}/round/{round}", handleGetMatches).Methods("GET")
	protected.HandleFunc("/predictions/used-teams", handleGetUsedTeams).Methods("GET")
	protected.HandleFunc("/predictions", handleGetPredictions).Methods("GET")
	protected.HandleFunc("/predictions", handleSubmitPrediction).Methods("POST")
	protected.HandleFunc("/standings", handleGetStandings).Methods("GET")
	protected.HandleFunc("/rounds/{gameId}/{round}/summary", handleGetRoundSummary).Methods("GET")

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

	port := getEnv("PORT", "4021")
	log.Printf("🚀 Last Man Standing starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
