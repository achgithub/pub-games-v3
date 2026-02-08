package sse

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/redis/go-redis/v9"
)

// StreamConfig configures an SSE stream handler.
type StreamConfig struct {
	// RedisClient is the Redis client for pub/sub
	RedisClient *redis.Client

	// Channel is the Redis channel to subscribe to (e.g., "game:123:events")
	Channel string

	// InitialData is sent as the first SSE event (optional)
	InitialData interface{}

	// ValidateAccess is called to validate the user has access to this stream (optional)
	// If it returns an error, the stream is closed with 403
	ValidateAccess func(userId string) error

	// UserID is the authenticated user ID (for access validation)
	UserID string
}

// HandleStream handles Server-Sent Events streaming with Redis pub/sub integration.
// It sends an initial data event, then streams updates from Redis channel.
//
// Usage:
//   func handleGameStream(w http.ResponseWriter, r *http.Request) {
//       gameID := mux.Vars(r)["gameId"]
//       user, _ := auth.GetUserFromContext(r.Context())
//
//       var game Game
//       redis.GetGame(r.Context(), redisClient, "game:"+gameID, &game)
//
//       sse.HandleStream(w, r, sse.StreamConfig{
//           RedisClient: redisClient,
//           Channel:     "game:" + gameID + ":events",
//           InitialData: game,
//           UserID:      user.Email,
//           ValidateAccess: func(userId string) error {
//               if userId != game.Player1ID && userId != game.Player2ID {
//                   return errors.New("not a player")
//               }
//               return nil
//           },
//       })
//   }
func HandleStream(w http.ResponseWriter, r *http.Request, config StreamConfig) error {
	ctx := r.Context()

	// Validate access if validator provided
	if config.ValidateAccess != nil && config.UserID != "" {
		if err := config.ValidateAccess(config.UserID); err != nil {
			log.Printf("❌ SSE access denied for user %s: %v", config.UserID, err)
			http.Error(w, "Forbidden", http.StatusForbidden)
			return err
		}
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Ensure response is flushed
	flusher, ok := w.(http.Flusher)
	if !ok {
		log.Printf("❌ Streaming not supported")
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return fmt.Errorf("streaming not supported")
	}

	log.Printf("✅ SSE stream started: channel=%s, user=%s", config.Channel, config.UserID)

	// Send initial data if provided
	if config.InitialData != nil {
		event := Event{
			Type: "initial",
			Data: config.InitialData,
		}
		fmt.Fprintf(w, "%s\n\n", FormatSSE(event))
		flusher.Flush()
		log.Printf("📤 Sent initial SSE event")
	}

	// Subscribe to Redis channel
	pubsub := config.RedisClient.Subscribe(ctx, config.Channel)
	defer pubsub.Close()

	msgChan := pubsub.Channel()

	// Stream events until client disconnects
	for {
		select {
		case <-ctx.Done():
			log.Printf("🔌 SSE client disconnected: channel=%s, user=%s", config.Channel, config.UserID)
			return nil

		case msg := <-msgChan:
			if msg == nil {
				continue
			}

			// Parse event from Redis
			var event Event
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				log.Printf("❌ Failed to unmarshal SSE event: %v", err)
				continue
			}

			// Send event to client
			fmt.Fprintf(w, "%s\n\n", FormatSSE(event))
			flusher.Flush()
			log.Printf("📤 Sent SSE event: type=%s", event.Type)
		}
	}
}
