package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// UserPresence represents a user's online status
type UserPresence struct {
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Status      string `json:"status"`
	CurrentApp  string `json:"currentApp,omitempty"`
	LastSeen    int64  `json:"lastSeen"`
}

// Challenge represents a game challenge between users
type Challenge struct {
	ID         string `json:"id"`
	FromUser   string `json:"fromUser"`
	ToUser     string `json:"toUser"`
	AppID      string `json:"appId"`
	Status     string `json:"status"`
	CreatedAt  int64  `json:"createdAt"`
	ExpiresAt  int64  `json:"expiresAt"`
	RespondedAt int64  `json:"respondedAt,omitempty"`
}

// HandleGetPresence - GET /api/lobby/presence
// Returns list of all currently online users
func HandleGetPresence(w http.ResponseWriter, r *http.Request) {
	users, err := GetOnlineUsers()
	if err != nil {
		log.Printf("Failed to fetch online users: %v", err)
		http.Error(w, "Failed to fetch online users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
		"count": len(users),
	})
}

// HandleUpdatePresence - POST /api/lobby/presence
// Updates a user's presence status
func HandleUpdatePresence(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email      string `json:"email"`
		Name       string `json:"name"`
		Status     string `json:"status"`
		CurrentApp string `json:"currentApp"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Name == "" || req.Status == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	if err := SetUserPresence(req.Email, req.Name, req.Status, req.CurrentApp); err != nil {
		log.Printf("Failed to update presence: %v", err)
		http.Error(w, "Failed to update presence", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// HandleRemovePresence - POST /api/lobby/presence/remove
// Removes a user's presence (for logout/disconnect)
func HandleRemovePresence(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email parameter required", http.StatusBadRequest)
		return
	}

	if err := RemoveUserPresence(email); err != nil {
		log.Printf("Failed to remove presence: %v", err)
		// Don't return error - best effort removal
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// HandleGetChallenges - GET /api/lobby/challenges
// Returns all active challenges for a user
func HandleGetChallenges(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email parameter required", http.StatusBadRequest)
		return
	}

	challenges, err := GetUserChallenges(email)
	if err != nil {
		log.Printf("Failed to fetch challenges: %v", err)
		http.Error(w, "Failed to fetch challenges", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"challenges": challenges,
	})
}

// HandleGetSentChallenges - GET /api/lobby/challenges/sent
// Returns all challenges sent by a user
func HandleGetSentChallenges(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email parameter required", http.StatusBadRequest)
		return
	}

	challenges, err := GetSentChallenges(email)
	if err != nil {
		log.Printf("Failed to fetch sent challenges: %v", err)
		http.Error(w, "Failed to fetch sent challenges", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"challenges": challenges,
	})
}

// HandleSendChallenge - POST /api/lobby/challenge
// Sends a challenge from one user to another
func HandleSendChallenge(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FromUser string `json:"fromUser"`
		ToUser   string `json:"toUser"`
		AppID    string `json:"appId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.FromUser == "" || req.ToUser == "" || req.AppID == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Check if recipient is online (direct Redis check, more accurate)
	recipientOnline, err := IsUserOnline(req.ToUser)
	if err != nil {
		http.Error(w, "Failed to verify user status", http.StatusInternalServerError)
		return
	}

	if !recipientOnline {
		http.Error(w, "User is not online", http.StatusBadRequest)
		return
	}

	// Create challenge in Redis
	challengeID, err := CreateChallenge(req.FromUser, req.ToUser, req.AppID)
	if err != nil {
		log.Printf("Failed to create challenge: %v", err)
		http.Error(w, "Failed to create challenge", http.StatusInternalServerError)
		return
	}

	// Save to PostgreSQL for history
	_, err = db.Exec(`
		INSERT INTO challenges (id, from_user, to_user, app_id, status, expires_at)
		VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '60 seconds')
	`, challengeID, req.FromUser, req.ToUser, req.AppID)

	if err != nil {
		log.Printf("Failed to save challenge to database: %v", err)
		// Don't fail the request - Redis is source of truth for active challenges
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"challengeId": challengeID,
	})
}

// HandleAcceptChallenge - POST /api/lobby/challenge/accept
// Accepts a challenge and creates a game
func HandleAcceptChallenge(w http.ResponseWriter, r *http.Request) {
	challengeID := r.URL.Query().Get("id")
	if challengeID == "" {
		http.Error(w, "Challenge ID parameter required", http.StatusBadRequest)
		return
	}

	// Get challenge details before updating status
	challenge, err := GetChallenge(challengeID)
	if err != nil {
		log.Printf("Failed to get challenge: %v", err)
		http.Error(w, "Challenge not found or expired", http.StatusBadRequest)
		return
	}

	// Get player display names from presence
	player1Name := challenge.FromUser // default to email
	player2Name := challenge.ToUser

	if presence, err := GetUserPresence(challenge.FromUser); err == nil {
		player1Name = presence.DisplayName
	}
	if presence, err := GetUserPresence(challenge.ToUser); err == nil {
		player2Name = presence.DisplayName
	}

	// Create game via tic-tac-toe API
	gameID, err := createGameForChallenge(challenge, player1Name, player2Name)
	if err != nil {
		log.Printf("Failed to create game: %v", err)
		http.Error(w, "Failed to create game", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Game created: %s for challenge %s", gameID, challengeID)

	// Update challenge status
	if err := UpdateChallengeStatus(challengeID, "accepted"); err != nil {
		log.Printf("Failed to accept challenge: %v", err)
		// Game was created, continue anyway
	}

	// Update PostgreSQL
	_, err = db.Exec(`
		UPDATE challenges
		SET status = 'accepted', responded_at = NOW()
		WHERE id = $1
	`, challengeID)

	if err != nil {
		log.Printf("Failed to update challenge in database: %v", err)
	}

	// Notify both players that game has started
	if err := PublishGameStarted(challenge.FromUser, challenge.AppID, gameID); err != nil {
		log.Printf("Failed to notify challenger: %v", err)
	}
	if err := PublishGameStarted(challenge.ToUser, challenge.AppID, gameID); err != nil {
		log.Printf("Failed to notify accepter: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"gameId":  gameID,
		"appId":   challenge.AppID,
	})
}

// createGameForChallenge calls the game's API to create a new game
func createGameForChallenge(challenge *Challenge, player1Name, player2Name string) (string, error) {
	// Get the game backend URL from app registry
	gameURL := getGameBackendURL(challenge.AppID)
	if gameURL == "" {
		return "", fmt.Errorf("unknown app: %s", challenge.AppID)
	}

	// Create game request
	reqBody := map[string]interface{}{
		"challengeId":   challenge.ID,
		"player1Id":     challenge.FromUser, // Challenger is player 1 (X)
		"player1Name":   player1Name,
		"player2Id":     challenge.ToUser, // Accepter is player 2 (O)
		"player2Name":   player2Name,
		"mode":          "normal",
		"moveTimeLimit": 0,
		"firstTo":       1,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := http.Post(gameURL+"/api/game", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to call game API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("game API error: %s", string(body))
	}

	var result struct {
		Success bool   `json:"success"`
		GameID  string `json:"gameId"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if !result.Success {
		return "", fmt.Errorf("game creation failed")
	}

	return result.GameID, nil
}

// getGameBackendURL returns the backend URL for a game app from the registry
func getGameBackendURL(appID string) string {
	app := GetAppByID(appID)
	if app == nil || app.BackendPort == 0 {
		return ""
	}
	return fmt.Sprintf("http://127.0.0.1:%d", app.BackendPort)
}

// HandleRejectChallenge - POST /api/lobby/challenge/reject
// Rejects a challenge
func HandleRejectChallenge(w http.ResponseWriter, r *http.Request) {
	challengeID := r.URL.Query().Get("id")
	if challengeID == "" {
		http.Error(w, "Challenge ID parameter required", http.StatusBadRequest)
		return
	}

	if err := UpdateChallengeStatus(challengeID, "rejected"); err != nil {
		log.Printf("Failed to reject challenge: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Update PostgreSQL
	_, err := db.Exec(`
		UPDATE challenges
		SET status = 'rejected', responded_at = NOW()
		WHERE id = $1
	`, challengeID)

	if err != nil {
		log.Printf("Failed to update challenge in database: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// HandleLobbyStream - GET /api/lobby/stream
// Server-Sent Events endpoint for real-time lobby updates
func HandleLobbyStream(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email parameter required", http.StatusBadRequest)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Subscribe to user's Redis pub/sub channel
	pubsub := SubscribeToUserEvents(email)
	defer pubsub.Close()

	// Send initial connection event
	fmt.Fprintf(w, "data: {\"type\":\"connected\"}\n\n")
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	// Listen for events
	ch := pubsub.Channel()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg := <-ch:
			// Parse and send event to client
			event := parseSSEPayload(msg.Payload)
			data, _ := json.Marshal(event)
			fmt.Fprintf(w, "data: %s\n\n", data)
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}

		case <-ticker.C:
			// Send keepalive ping
			fmt.Fprintf(w, ": ping\n\n")
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}

		case <-r.Context().Done():
			// Client disconnected
			log.Printf("SSE client disconnected: %s", email)
			return
		}
	}
}

// parseSSEPayload converts Redis pub/sub messages to SSE event format
func parseSSEPayload(payload string) map[string]interface{} {
	// Check for game_started:appId:gameId format
	if len(payload) > 13 && payload[:13] == "game_started:" {
		parts := payload[13:] // Remove "game_started:" prefix
		// Find the separator between appId and gameId
		for i, c := range parts {
			if c == ':' {
				appID := parts[:i]
				gameID := parts[i+1:]
				return map[string]interface{}{
					"type":   "game_started",
					"appId":  appID,
					"gameId": gameID,
				}
			}
		}
	}

	// Default: simple type message
	return map[string]interface{}{"type": payload}
}
