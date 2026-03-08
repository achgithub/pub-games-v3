package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()

	// API routes
	r.HandleFunc("/api/config", handleConfig).Methods("GET")

	// Static files
	staticDir := "./static"
	r.PathPrefix("/").Handler(http.FileServer(http.Dir(staticDir)))

	// CORS
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)(r)

	port := getEnv("PORT", "4071")
	log.Printf("Rrroll the Dice server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler))
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"appName":     "Rrroll the Dice",
		"description": "Roll dice with style",
		"maxDice":     6,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
