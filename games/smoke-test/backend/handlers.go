package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/redis/go-redis/v9"
)

const REDIS_COUNTER_KEY = "smoke_test:counter"
const REDIS_PUBSUB_CHANNEL = "smoke_test:updates"

// HandleConfig returns app configuration
func HandleConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"appName": APP_NAME,
		"appIcon": "🧪",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// HandleGetCounter returns the current counter value from Redis
func HandleGetCounter(w http.ResponseWriter, r *http.Request) {
	val, err := redisClient.Get(ctx, REDIS_COUNTER_KEY).Result()
	if err == redis.Nil {
		// Counter doesn't exist yet, initialize to 0
		redisClient.Set(ctx, REDIS_COUNTER_KEY, 0, 0)
		val = "0"
	} else if err != nil {
		http.Error(w, "Failed to get counter", http.StatusInternalServerError)
		return
	}

	counter, _ := strconv.Atoi(val)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"counter": counter,
	})
}

// HandleIncrementCounter increments the counter and broadcasts via Redis pub/sub
func HandleIncrementCounter(w http.ResponseWriter, r *http.Request) {
	user := authlib.GetUserFromContext(r.Context())

	// Increment counter in Redis
	newVal, err := redisClient.Incr(ctx, REDIS_COUNTER_KEY).Result()
	if err != nil {
		http.Error(w, "Failed to increment counter", http.StatusInternalServerError)
		return
	}

	// Log to PostgreSQL
	_, err = db.Exec(`
		INSERT INTO activity_log (user_email, user_name, action, counter_value)
		VALUES ($1, $2, $3, $4)
	`, user.Email, user.Name, "increment", newVal)
	if err != nil {
		log.Printf("Failed to log activity: %v", err)
	}

	// Broadcast update via Redis pub/sub
	message := fmt.Sprintf(`{"type":"counter_update","counter":%d,"user":"%s"}`, newVal, user.Name)
	redisClient.Publish(ctx, REDIS_PUBSUB_CHANNEL, message)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"counter": newVal,
	})
}

// HandleGetActivity returns recent activity from PostgreSQL
func HandleGetActivity(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT user_email, user_name, action, counter_value, created_at
		FROM activity_log
		ORDER BY created_at DESC
		LIMIT 20
	`)
	if err != nil {
		http.Error(w, "Failed to fetch activity", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Activity struct {
		UserEmail    string    `json:"userEmail"`
		UserName     string    `json:"userName"`
		Action       string    `json:"action"`
		CounterValue int       `json:"counterValue"`
		CreatedAt    time.Time `json:"createdAt"`
	}

	activities := []Activity{}
	for rows.Next() {
		var a Activity
		if err := rows.Scan(&a.UserEmail, &a.UserName, &a.Action, &a.CounterValue, &a.CreatedAt); err != nil {
			continue
		}
		activities = append(activities, a)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"activities": activities,
	})
}

// HandleSSE streams real-time counter updates via Server-Sent Events
func HandleSSE(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	// Subscribe to Redis pub/sub
	pubsub := redisClient.Subscribe(ctx, REDIS_PUBSUB_CHANNEL)
	defer pubsub.Close()

	ch := pubsub.Channel()

	// Send initial connection message
	fmt.Fprintf(w, "data: %s\n\n", `{"type":"connected"}`)
	flusher.Flush()

	// Listen for updates
	for {
		select {
		case msg := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
			flusher.Flush()
		case <-r.Context().Done():
			log.Println("SSE client disconnected")
			return
		}
	}
}
