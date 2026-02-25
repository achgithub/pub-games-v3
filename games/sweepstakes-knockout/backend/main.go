package main

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"

	authlib "pub-games-v3/lib/activity-hub-common/auth"
	"pub-games-v3/lib/activity-hub-common/database"
)

var (
	identityDB *sql.DB
	appDB      *sql.DB
)

func main() {
	var err error

	// Connect to identity database
	identityDB, err = database.InitIdentityDatabase()
	if err != nil {
		log.Fatalf("Failed to connect to identity database: %v", err)
	}
	defer identityDB.Close()

	// Connect to app database
	appDB, err = database.InitDatabaseByName("sweepstakes_knockout_db")
	if err != nil {
		log.Fatalf("Failed to connect to app database: %v", err)
	}
	defer appDB.Close()

	log.Println("Database connections established")

	r := mux.NewRouter()

	// CORS
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	// Public routes
	r.HandleFunc("/api/config", handleConfig).Methods("GET")

	// Protected routes - require game_manager role
	api := r.PathPrefix("/api").Subrouter()
	api.Use(authlib.Middleware(identityDB))
	api.Use(authlib.RequireRole("game_manager"))

	// Setup tab - Player pool
	api.HandleFunc("/players", handleGetPlayers).Methods("GET")
	api.HandleFunc("/players", handleCreatePlayer).Methods("POST")
	api.HandleFunc("/players/{id}", handleDeletePlayer).Methods("DELETE")

	// Setup tab - Horse pool
	api.HandleFunc("/horses", handleGetHorses).Methods("GET")
	api.HandleFunc("/horses", handleCreateHorse).Methods("POST")
	api.HandleFunc("/horses/{id}", handleDeleteHorse).Methods("DELETE")

	// Games tab - Events
	api.HandleFunc("/events", handleGetEvents).Methods("GET")
	api.HandleFunc("/events", handleCreateEvent).Methods("POST")
	api.HandleFunc("/events/{id}", handleGetEventDetail).Methods("GET")
	api.HandleFunc("/events/{id}", handleDeleteEvent).Methods("DELETE")

	// Games tab - Participants
	api.HandleFunc("/events/{id}/participants", handleAddParticipants).Methods("POST")
	api.HandleFunc("/participants/{id}", handleAssignHorse).Methods("PUT")
	api.HandleFunc("/participants/{id}", handleRemoveParticipant).Methods("DELETE")

	// Games tab - Winning Positions
	api.HandleFunc("/events/{eventId}/positions", handleCreatePosition).Methods("POST")
	api.HandleFunc("/positions/{id}", handleDeletePosition).Methods("DELETE")

	// Games tab - Results
	api.HandleFunc("/events/{eventId}/results", handleGetResults).Methods("GET")
	api.HandleFunc("/events/{eventId}/results", handleSaveResults).Methods("POST")

	// Reports tab
	api.HandleFunc("/events/{eventId}/report", handleGetReport).Methods("GET")

	// Serve static files
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	port := "4032"
	log.Printf("Sweepstakes Knockout server starting on port %s...", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"app_name": "Sweepstakes Knockout",
		"version":  "1.0.0",
	})
}
