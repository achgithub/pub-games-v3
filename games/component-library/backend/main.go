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

const APP_NAME = "Component Library"

func main() {
	log.Printf("📚 %s Backend Starting", APP_NAME)

	// Initialize Redis
	if err := InitRedis(); err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}
	log.Println("✅ Connected to Redis")

	// Initialize app database
	var err error
	db, err = database.InitDatabase("component_library")
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

	// Build per-route middleware
	authMiddleware := authlib.Middleware(identityDB)
	sseMiddleware := authlib.SSEMiddleware(identityDB)
	adminOnly := authlib.RequireRole("admin")

	// Setup router
	r := mux.NewRouter()

	// Public endpoint
	r.HandleFunc("/api/config", HandleConfig).Methods("GET")

	// Protected endpoints (require authentication)
	r.Handle("/api/counter", authMiddleware(http.HandlerFunc(HandleGetCounter))).Methods("GET")
	r.Handle("/api/counter/increment", authMiddleware(http.HandlerFunc(HandleIncrementCounter))).Methods("POST")
	r.Handle("/api/activity", authMiddleware(http.HandlerFunc(HandleGetActivity))).Methods("GET")

	// SSE endpoint for real-time counter updates
	r.Handle("/api/events", sseMiddleware(http.HandlerFunc(HandleSSE))).Methods("GET")

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
	port := "5010"
	log.Printf("🚀 %s backend listening on :%s (Admin Only)", APP_NAME, port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
