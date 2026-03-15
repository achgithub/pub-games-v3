package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// handleGetAllPresence returns all online users
func handleGetAllPresence(redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		users, statusCounts, err := GetAllPresence(ctx, redisClient)
		if err != nil {
			log.Printf("Error getting all presence: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		response := AllPresenceResponse{
			Users:    users,
			Total:    len(users),
			ByStatus: statusCounts,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// handleGetUserPresence returns a single user's presence
func handleGetUserPresence(redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.PathValue("id")
		if userID == "" {
			http.Error(w, "Missing user ID", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		presence, err := GetUserPresence(ctx, redisClient, userID)
		if err != nil {
			log.Printf("Error getting user presence: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(presence)
	}
}

// handleHeartbeat updates user presence and returns TTL
func handleHeartbeat(redisClient *redis.Client, db *sql.DB, broadcaster *Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req HeartbeatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if req.UserID == "" {
			http.Error(w, "Missing userId", http.StatusBadRequest)
			return
		}

		// Default values
		if req.Status == "" {
			req.Status = StatusOnline
		}
		if req.Platform == "" {
			req.Platform = "web"
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Update presence in Redis
		if err := SetUserPresence(ctx, redisClient, req.UserID, req.DisplayName, req.Status, req.CurrentApp, req.CurrentSession, req.Platform); err != nil {
			log.Printf("Error setting user presence: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Log to database
		go LogPresenceEvent(db, req.UserID, "heartbeat", req.CurrentApp, req.CurrentSession)

		// Broadcast update
		event := PresenceUpdate{
			UserID:         req.UserID,
			DisplayName:    req.DisplayName,
			Status:         req.Status,
			CurrentApp:     req.CurrentApp,
			CurrentSession: req.CurrentSession,
			LastSeen:       time.Now().Unix(),
		}
		broadcaster.Publish("presence:updates", EventPresenceUpdate, event)

		response := HeartbeatResponse{
			Success: true,
			TTL:     int(PresenceTTL.Seconds()),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// handleSetStatus updates user status
func handleSetStatus(redisClient *redis.Client, db *sql.DB, broadcaster *Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req StatusUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if req.UserID == "" {
			http.Error(w, "Missing userId", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Get current presence to preserve other fields
		current, err := GetUserPresence(ctx, redisClient, req.UserID)
		if err != nil {
			log.Printf("Error getting current presence: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Update presence with new status
		if err := SetUserPresence(ctx, redisClient, req.UserID, current.DisplayName, req.Status, req.CurrentApp, req.CurrentSession, current.Platform); err != nil {
			log.Printf("Error updating status: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Log to database
		go LogPresenceEvent(db, req.UserID, "status_change", req.CurrentApp, req.CurrentSession)

		// Broadcast update
		event := PresenceUpdate{
			UserID:         req.UserID,
			DisplayName:    current.DisplayName,
			Status:         req.Status,
			CurrentApp:     req.CurrentApp,
			CurrentSession: req.CurrentSession,
			LastSeen:       time.Now().Unix(),
		}
		broadcaster.Publish("presence:updates", EventPresenceUpdate, event)

		response := HeartbeatResponse{
			Success: true,
			TTL:     int(PresenceTTL.Seconds()),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// handlePresenceStream streams presence updates via SSE
func handlePresenceStream(redisClient *redis.Client, broadcaster *Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("userId")

		// SSE headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		ctx := r.Context()

		// Subscribe to broadcaster
		ch := broadcaster.Subscribe(ctx, "presence:updates")
		defer broadcaster.Unsubscribe("presence:updates", ch)

		// Keep flusher alive
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming not supported", http.StatusInternalServerError)
			return
		}

		// Send heartbeat to keep connection alive
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case msg := <-ch:
				encoded, _ := EncodeSSE(msg.Event, msg.Data)
				w.Write([]byte(encoded))
				flusher.Flush()

			case <-ticker.C:
				// Send keep-alive comment
				w.Write([]byte(": keep-alive\n\n"))
				flusher.Flush()

			case <-ctx.Done():
				return
			}
		}
	}
}
