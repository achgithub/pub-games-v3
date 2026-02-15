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

var appDB *sql.DB // sweepstakes_db

func main() {
	identityDB, err := database.InitIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()

	appDB, err = database.InitDatabaseByName("sweepstakes_db")
	if err != nil {
		log.Fatal("Failed to connect to sweepstakes database:", err)
	}
	defer appDB.Close()

	r := mux.NewRouter()

	// Public routes (no auth required)
	r.HandleFunc("/api/config", handleConfig).Methods("GET")
	r.HandleFunc("/api/competitions", handleGetCompetitions).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/entries", handleGetEntries).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/available-count", handleGetAvailableCount).Methods("GET")
	r.HandleFunc("/api/competitions/{id}/all-draws", handleGetCompetitionDraws).Methods("GET")

	// Auth-required routes
	protected := r.PathPrefix("/api").Subrouter()
	protected.Use(authlib.Middleware(identityDB))
	protected.HandleFunc("/competitions/{id}/blind-boxes", handleGetBlindBoxes).Methods("GET")
	protected.HandleFunc("/competitions/{id}/choose-blind-box", handleChooseBlindBox).Methods("POST")
	protected.HandleFunc("/competitions/{id}/random-pick", handleRandomPick).Methods("POST")
	protected.HandleFunc("/draws", handleGetUserDraws).Methods("GET")

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

	port := config.GetEnv("PORT", "4031")
	log.Printf("🎁 Sweepstakes starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
