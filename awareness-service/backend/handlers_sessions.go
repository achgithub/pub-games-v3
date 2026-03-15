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

// handleJoinSession adds a user to a session
func handleJoinSession(redisClient *redis.Client, db *sql.DB, broadcaster *Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SessionJoinRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if req.UserID == "" || req.AppID == "" || req.SessionID == "" {
			http.Error(w, "Missing required fields", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Cancel grace period if it exists
		graceKey := "session:grace:" + req.AppID + ":" + req.SessionID + ":" + req.UserID
		wasInGrace, _ := redisClient.Exists(ctx, graceKey).Result()
		if wasInGrace == 1 {
			redisClient.Del(ctx, graceKey)
		}

		// Join session
		if err := JoinSession(ctx, redisClient, req.AppID, req.SessionID, req.UserID); err != nil {
			log.Printf("Error joining session: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Log to database
		go LogSessionEvent(db, req.SessionID, req.AppID, req.UserID, "joined")

		// Get participants
		participants, _ := GetSessionParticipants(ctx, redisClient, req.AppID, req.SessionID)

		response := SessionResponse{
			Success:      true,
			SessionID:    req.SessionID,
			AppID:        req.AppID,
			Participants: participants,
			Count:        len(participants),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// handleLeaveSession removes a user from a session with grace period
func handleLeaveSession(redisClient *redis.Client, db *sql.DB, broadcaster *Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SessionLeaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		if req.UserID == "" || req.AppID == "" || req.SessionID == "" {
			http.Error(w, "Missing required fields", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Leave session with grace period
		if err := LeaveSession(ctx, redisClient, req.AppID, req.SessionID, req.UserID); err != nil {
			log.Printf("Error leaving session: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Log to database
		go LogSessionEvent(db, req.SessionID, req.AppID, req.UserID, "left")

		// Get remaining participants
		participants, _ := GetSessionParticipants(ctx, redisClient, req.AppID, req.SessionID)

		response := SessionResponse{
			Success:      true,
			SessionID:    req.SessionID,
			AppID:        req.AppID,
			Participants: participants,
			Count:        len(participants),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// handleGetSessionParticipants returns all participants in a session
func handleGetSessionParticipants(redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appID := r.PathValue("appId")
		sessionID := r.URL.Query().Get("sessionId")

		if appID == "" || sessionID == "" {
			http.Error(w, "Missing appId or sessionId", http.StatusBadRequest)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		participants, err := GetSessionParticipants(ctx, redisClient, appID, sessionID)
		if err != nil {
			log.Printf("Error getting session participants: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		response := SessionResponse{
			Success:      true,
			SessionID:    sessionID,
			AppID:        appID,
			Participants: participants,
			Count:        len(participants),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// handleSessionStream streams session updates via SSE
func handleSessionStream(redisClient *redis.Client, broadcaster *Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appID := r.PathValue("appId")
		sessionID := r.PathValue("sessionId")

		if appID == "" || sessionID == "" {
			http.Error(w, "Missing appId or sessionId", http.StatusBadRequest)
			return
		}

		// SSE headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		ctx := r.Context()
		channelID := "session:app:" + appID + ":" + sessionID

		// Subscribe to broadcaster
		ch := broadcaster.Subscribe(ctx, channelID)
		defer broadcaster.Unsubscribe(channelID, ch)

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
