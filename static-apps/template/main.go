package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var db *sql.DB

func main() {
	var err error

	// Initialize database
	db, err = InitDatabase()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Setup router
	r := mux.NewRouter()

	// Public endpoints
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", HandleHealth).Methods("GET")
	api.HandleFunc("/config", HandleConfig).Methods("GET")

	// User sync endpoint (called by shell when user first accesses app)
	api.HandleFunc("/sync-user", HandleUserSync).Methods("POST")

	// Protected endpoints (require user query param from shell)
	api.HandleFunc("/items", AuthMiddleware(HandleGetItems)).Methods("GET")
	api.HandleFunc("/items", AuthMiddleware(HandleCreateItem)).Methods("POST")

	// Admin endpoints
	api.HandleFunc("/admin/stats", AdminMiddleware(HandleGetStats)).Methods("GET")

	// Get frontend and backend ports from environment
	frontendPort := getEnv("FRONTEND_PORT", "50X0")
	backendPort := getEnv("BACKEND_PORT", "50X1")

	// Get hostname for CORS (for mobile access)
	hostname := getEnv("HOSTNAME", "localhost")

	// CORS configuration - Allow requests from frontend and shell
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{
			"http://localhost:" + frontendPort,
			"http://" + hostname + ":" + frontendPort,
			"http://localhost:3000", // Identity Shell
			"http://" + hostname + ":3000",
		}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)

	// Start server
	log.Printf("🎮 PLACEHOLDER_APP_NAME Backend")
	log.Printf("📍 Listening on port %s", backendPort)
	log.Printf("🌐 CORS enabled for: localhost:%s, %s:%s, localhost:3000, %s:3000",
		frontendPort, hostname, frontendPort, hostname)
	log.Fatal(http.ListenAndServe(":"+backendPort, corsHandler(r)))
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
