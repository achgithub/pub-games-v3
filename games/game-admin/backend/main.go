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
	lmsDB         *sql.DB // last_man_standing_db — used by handlers
	gameAdminDB   *sql.DB // game_admin_db — used for audit log
	sweepstakesDB *sql.DB // sweepstakes_db — used by sweepstakes admin handlers
	quizDB        *sql.DB // quiz_db — used by quiz admin handlers
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

	sweepstakesDB, err = database.InitDatabaseByName("sweepstakes_db")
	if err != nil {
		log.Fatal("Failed to connect to sweepstakes database:", err)
	}
	defer sweepstakesDB.Close()

	quizDB, err = database.InitDatabaseByName("quiz_db")
	if err != nil {
		log.Fatal("Failed to connect to quiz database:", err)
	}
	defer quizDB.Close()

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
	api.HandleFunc("/lms/games/{id}", handleDeleteGame).Methods("DELETE")

	// LMS round management
	api.HandleFunc("/lms/rounds/{gameId}", handleGetLMSRounds).Methods("GET")
	api.HandleFunc("/lms/rounds", handleCreateRound).Methods("POST")
	api.HandleFunc("/lms/rounds/{gameId}/{label}/status", handleUpdateRoundStatus).Methods("PUT")
	api.HandleFunc("/lms/rounds/{gameId}/{label}/summary", handleGetAdminRoundSummary).Methods("GET")
	api.HandleFunc("/lms/rounds/{gameId}/{label}", handleDeleteRound).Methods("DELETE")

	// LMS fixture file management
	api.HandleFunc("/lms/fixtures", handleGetFixtures).Methods("GET")
	api.HandleFunc("/lms/fixtures/upload", handleUploadFixture).Methods("POST")
	api.HandleFunc("/lms/fixtures/{id}/matches", handleGetFixtureMatches).Methods("GET")

	// LMS match management (queries via game → fixture file)
	api.HandleFunc("/lms/matches/{gameId}", handleGetLMSMatchesForGame).Methods("GET")
	api.HandleFunc("/lms/matches/{gameId}/{label}", handleGetLMSMatchesForGame).Methods("GET")
	api.HandleFunc("/lms/matches/{id}/result", handleSetMatchResult).Methods("PUT")

	// LMS round processing (explicit batch evaluation — no auto-process on result entry)
	api.HandleFunc("/lms/rounds/{gameId}/{label}/process", handleProcessRound).Methods("POST")

	// LMS predictions (read)
	api.HandleFunc("/lms/predictions", handleGetAllPredictions).Methods("GET")

	// Sweepstakes competition management
	api.HandleFunc("/sweepstakes/competitions", handleGetSweepCompetitions).Methods("GET")
	api.HandleFunc("/sweepstakes/competitions", handleCreateSweepCompetition).Methods("POST")
	api.HandleFunc("/sweepstakes/competitions/{id}", handleUpdateSweepCompetition).Methods("PUT")
	api.HandleFunc("/sweepstakes/competitions/{id}", handleDeleteSweepCompetition).Methods("DELETE")
	api.HandleFunc("/sweepstakes/competitions/{id}/entries", handleGetSweepEntries).Methods("GET")
	api.HandleFunc("/sweepstakes/competitions/{id}/all-draws", handleGetSweepAllDraws).Methods("GET")
	api.HandleFunc("/sweepstakes/competitions/{id}/update-position", handleUpdateSweepPosition).Methods("POST")

	// Sweepstakes entry management
	api.HandleFunc("/sweepstakes/entries/upload", handleUploadSweepEntries).Methods("POST")
	api.HandleFunc("/sweepstakes/entries/{id}", handleUpdateSweepEntry).Methods("PUT")
	api.HandleFunc("/sweepstakes/entries/{id}", handleDeleteSweepEntry).Methods("DELETE")

	// Quiz media management
	api.HandleFunc("/quiz/media/upload", handleQuizMediaUpload).Methods("POST")
	api.HandleFunc("/quiz/media", handleGetQuizMedia).Methods("GET")
	api.HandleFunc("/quiz/media/{id}", handleDeleteQuizMedia).Methods("DELETE")

	// Quiz question management
	api.HandleFunc("/quiz/questions", handleGetQuizQuestions).Methods("GET")
	api.HandleFunc("/quiz/questions", handleCreateQuizQuestion).Methods("POST")
	api.HandleFunc("/quiz/questions/{id}", handleUpdateQuizQuestion).Methods("PUT")
	api.HandleFunc("/quiz/questions/{id}", handleDeleteQuizQuestion).Methods("DELETE")

	// Quiz pack management
	api.HandleFunc("/quiz/packs", handleGetQuizPacks).Methods("GET")
	api.HandleFunc("/quiz/packs", handleCreateQuizPack).Methods("POST")
	api.HandleFunc("/quiz/packs/{packId}", handleDeleteQuizPack).Methods("DELETE")

	// Round management within a pack
	api.HandleFunc("/quiz/packs/{packId}/rounds", handleGetPackRounds).Methods("GET")
	api.HandleFunc("/quiz/packs/{packId}/rounds", handleCreatePackRound).Methods("POST")
	api.HandleFunc("/quiz/packs/{packId}/rounds/{roundId}", handleDeletePackRound).Methods("DELETE")
	api.HandleFunc("/quiz/packs/{packId}/rounds/{roundId}/questions", handleSetRoundQuestions).Methods("PUT")

	// Serve uploaded media files
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

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
