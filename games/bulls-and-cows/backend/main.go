package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/achgithub/activity-hub-common/database"
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

	// Get Redis address from environment or use default
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "127.0.0.1:6379"
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
		Addr:     redisAddr,
		Password: "",
		DB:       0,
	})
	defer redisClient.Close()

	// Test Redis connection
	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Printf("Connected to Redis at %s", redisAddr)

	// Connect to identity database for auth
	identityDB, err := database.InitIdentityDatabase()
	if err != nil {
		log.Fatalf("Failed to connect to identity database: %v", err)
	}
	defer identityDB.Close()
	log.Printf("Connected to identity database")

	// Build auth middleware
	authMiddleware := authlib.Middleware(identityDB)
	sseMiddleware := authlib.SSEMiddleware(identityDB)

	// Create router
	r := mux.NewRouter()

	// Public endpoints
	r.HandleFunc("/api/config", GetConfig).Methods("GET")

	// SSE endpoint (uses query-param auth)
	r.Handle("/api/game/{gameId}/stream", sseMiddleware(http.HandlerFunc(StreamGame(redisClient)))).Methods("GET")

	// Authenticated endpoints
	r.Handle("/api/game", authMiddleware(http.HandlerFunc(CreateGame(db, redisClient)))).Methods("POST")
	r.Handle("/api/game/{gameId}", authMiddleware(http.HandlerFunc(GetGame(db)))).Methods("GET")
	r.Handle("/api/game/{gameId}/guess", authMiddleware(http.HandlerFunc(MakeGuess(db, redisClient)))).Methods("POST")

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
