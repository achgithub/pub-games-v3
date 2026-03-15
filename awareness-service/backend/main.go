package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// Environment variables
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	postgresURL := os.Getenv("DATABASE_URL")
	if postgresURL == "" {
		postgresURL = "postgres://activityhub:pubgames@localhost:5555/pubgames?sslmode=disable"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "6001"
	}

	// Initialize Redis
	redisClient := InitializeRedis(redisAddr)
	defer redisClient.Close()

	// Initialize PostgreSQL
	db, err := InitializePostgres(postgresURL)
	if err != nil {
		log.Fatalf("Failed to initialize postgres: %v", err)
	}
	defer db.Close()

	// Create database schema
	if err := CreateSchema(db); err != nil {
		log.Fatalf("Failed to create schema: %v", err)
	}

	// Initialize SSE broadcaster
	broadcaster := NewBroadcaster()

	// HTTP routing
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	})

	// Presence endpoints
	mux.HandleFunc("GET /api/presence/users", handleGetAllPresence(redisClient))
	mux.HandleFunc("GET /api/presence/user/{id}", handleGetUserPresence(redisClient))
	mux.HandleFunc("POST /api/presence/heartbeat", handleHeartbeat(redisClient, db, broadcaster))
	mux.HandleFunc("POST /api/presence/status", handleSetStatus(redisClient, db, broadcaster))
	mux.HandleFunc("GET /api/presence/stream", handlePresenceStream(redisClient, broadcaster))

	// Session endpoints
	mux.HandleFunc("POST /api/sessions/join", handleJoinSession(redisClient, db, broadcaster))
	mux.HandleFunc("POST /api/sessions/leave", handleLeaveSession(redisClient, db, broadcaster))
	mux.HandleFunc("GET /api/sessions/app/{appId}", handleGetSessionParticipants(redisClient))
	mux.HandleFunc("GET /api/sessions/stream/{appId}/{sessionId}", handleSessionStream(redisClient, broadcaster))

	// Metrics placeholder
	mux.HandleFunc("GET /metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "# Placeholder for Prometheus metrics\n")
	})

	// Create HTTP server with timeouts
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Awareness Service listening on :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Shutdown error: %v", err)
	}

	log.Println("Server gracefully shutdown")
}
