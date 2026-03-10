package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"activity-hub-common/middleware"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"github.com/rs/cors"
)

var (
	db          *sql.DB
	redisClient *redis.Client
)

func main() {
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "4091"
	}

	// Get database host from environment or use default
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	// Get Redis host from environment or use default
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}

	// Initialize database connection
	connStr := fmt.Sprintf("host=%s port=5555 user=activityhub password=pubgames dbname=bulls_and_cows_db sslmode=disable", dbHost)
	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Printf("Connected to PostgreSQL database: bulls_and_cows_db")

	// Initialize Redis client
	redisClient = redis.NewClient(&redis.Options{
		Addr: redisHost,
		DB:   0,
	})
	defer redisClient.Close()

	// Test Redis connection
	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Printf("Connected to Redis at %s", redisHost)

	// Create router
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/config", GetConfig).Methods("GET")
	api.HandleFunc("/game", middleware.AuthMiddleware(CreateGame(db, redisClient))).Methods("POST")
	api.HandleFunc("/game/{gameId}", middleware.AuthMiddleware(GetGame(db))).Methods("GET")
	api.HandleFunc("/game/{gameId}/guess", middleware.AuthMiddleware(MakeGuess(db, redisClient))).Methods("POST")
	api.HandleFunc("/game/{gameId}/stream", StreamGame(redisClient)).Methods("GET")

	// Serve static files (React build)
	staticDir := "./static"
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		log.Printf("Warning: Static directory not found at %s", staticDir)
	} else {
		// Serve index.html for root
		r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
		})

		// Serve other static files
		r.PathPrefix("/").Handler(http.StripPrefix("/", http.FileServer(http.Dir(staticDir))))
	}

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)

	// Start server
	log.Printf("Bulls and Cows server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
