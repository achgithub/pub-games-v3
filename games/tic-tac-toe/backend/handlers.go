package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// reportToLeaderboard sends game result to the leaderboard service
func reportToLeaderboard(game *Game) {
	leaderboardURL := os.Getenv("LEADERBOARD_URL")
	if leaderboardURL == "" {
		leaderboardURL = "http://127.0.0.1:5030"
	}

	// Determine winner/loser
	var winnerID, winnerName, loserID, loserName string
	isDraw := game.WinnerID == nil

	if !isDraw {
		if *game.WinnerID == game.Player1ID {
			winnerID = game.Player1ID
			winnerName = game.Player1Name
			loserID = game.Player2ID
			loserName = game.Player2Name
		} else {
			winnerID = game.Player2ID
			winnerName = game.Player2Name
			loserID = game.Player1ID
			loserName = game.Player1Name
		}
	} else {
		// For draws, store both players (winner/loser fields used for both)
		winnerID = game.Player1ID
		winnerName = game.Player1Name
		loserID = game.Player2ID
		loserName = game.Player2Name
	}

	// Calculate game duration
	duration := 0
	if game.CompletedAt != nil {
		duration = int(*game.CompletedAt - game.CreatedAt)
	}

	// Format score
	score := fmt.Sprintf("%d-%d", game.Player1Score, game.Player2Score)

	result := map[string]interface{}{
		"gameType":   "tic-tac-toe",
		"gameId":     game.ID,
		"winnerId":   winnerID,
		"winnerName": winnerName,
		"loserId":    loserID,
		"loserName":  loserName,
		"isDraw":     isDraw,
		"score":      score,
		"duration":   duration,
	}

	jsonBody, err := json.Marshal(result)
	if err != nil {
		log.Printf("Failed to marshal leaderboard result: %v", err)
		return
	}

	resp, err := http.Post(leaderboardURL+"/api/result", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		log.Printf("Failed to report to leaderboard: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		log.Printf("📊 Reported game %s to leaderboard", game.ID)
	} else {
		log.Printf("Leaderboard returned status %d", resp.StatusCode)
	}
}

// handleGetGame retrieves game state
func handleGetGame(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	game, err := GetGame(gameID)
	if err != nil {
		sendError(w, "Game not found", 404)
		return
	}

	respondJSON(w, game)
}

// handleCreateGame creates a new game (called by identity shell)
func handleCreateGame(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context
	user := getUserFromContext(r)
	if user == nil {
		sendError(w, "Unauthorized", 401)
		return
	}

	var req struct {
		ChallengeID   string   `json:"challengeId"`
		Player1ID     string   `json:"player1Id"`
		Player1Name   string   `json:"player1Name"`
		Player2ID     string   `json:"player2Id"`
		Player2Name   string   `json:"player2Name"`
		Mode          GameMode `json:"mode"`
		MoveTimeLimit int      `json:"moveTimeLimit"`
		FirstTo       int      `json:"firstTo"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", 400)
		return
	}

	// Validate inputs
	if req.Player1ID == "" || req.Player2ID == "" {
		sendError(w, "Missing player IDs", 400)
		return
	}

	// Validate authenticated user is one of the players
	if user.Email != req.Player1ID && user.Email != req.Player2ID {
		sendError(w, "Cannot create game for other players", 403)
		return
	}

	validFirstTo := map[int]bool{1: true, 2: true, 3: true, 5: true, 10: true, 20: true}
	if !validFirstTo[req.FirstTo] {
		sendError(w, "Invalid firstTo value (must be 1,2,3,5,10,20)", 400)
		return
	}

	// Create game
	gameID := fmt.Sprintf("%d-%s", time.Now().UnixNano(), req.Player1ID)
	now := time.Now().Unix()

	game := &Game{
		ID:            gameID,
		ChallengeID:   req.ChallengeID,
		Player1ID:     req.Player1ID,
		Player1Name:   req.Player1Name,
		Player1Symbol: "X",
		Player2ID:     req.Player2ID,
		Player2Name:   req.Player2Name,
		Player2Symbol: "O",
		Board:         []string{"", "", "", "", "", "", "", "", ""},
		CurrentTurn:   1, // Player 1 starts
		Status:        GameStatusActive,
		Mode:          req.Mode,
		MoveTimeLimit: req.MoveTimeLimit,
		FirstTo:       req.FirstTo,
		Player1Score:  0,
		Player2Score:  0,
		CurrentRound:  1,
		WinnerID:      nil,
		LastMoveAt:    now,
		CreatedAt:     now,
	}

	// Save to Redis
	if err := CreateGame(game); err != nil {
		log.Printf("Failed to create game in Redis: %v", err)
		sendError(w, "Failed to create game", 500)
		return
	}

	log.Printf("✅ Created game: %s (Challenge: %s, P1: %s, P2: %s)",
		gameID, req.ChallengeID, req.Player1Name, req.Player2Name)

	respondJSON(w, map[string]interface{}{
		"success": true,
		"gameId":  gameID,
		"game":    game,
	})
}

// handleMakeMove processes a move
func handleMakeMove(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context
	user := getUserFromContext(r)
	if user == nil {
		sendError(w, "Unauthorized", 401)
		return
	}

	var req MoveRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", 400)
		return
	}

	// Validate authenticated user matches the player making the move
	if user.Email != req.PlayerID {
		sendError(w, "Cannot make moves for other players", 403)
		return
	}

	// Get game from Redis
	game, err := GetGame(req.GameID)
	if err != nil {
		sendError(w, "Game not found", 404)
		return
	}

	// Apply move
	game, err = applyMove(game, req.PlayerID, req.Position)
	if err != nil {
		if gameErr, ok := err.(*GameError); ok {
			sendError(w, gameErr.Message, gameErr.Code)
		} else {
			sendError(w, err.Error(), 400)
		}
		return
	}

	// Check for win/draw
	gameEnded, message := processGameResult(game)

	// Update game in Redis
	if err := UpdateGame(game); err != nil {
		log.Printf("Failed to update game in Redis: %v", err)
		sendError(w, "Failed to update game", 500)
		return
	}

	// Publish update to connected players via SSE (through Redis pub/sub)
	if gameEnded {
		// Save to PostgreSQL and update stats
		if err := SaveCompletedGame(game); err != nil {
			log.Printf("Warning: Failed to save completed game to PostgreSQL: %v", err)
		}

		// Update player stats
		player1Won := game.WinnerID != nil && *game.WinnerID == game.Player1ID
		player2Won := game.WinnerID != nil && *game.WinnerID == game.Player2ID
		isDraw := game.WinnerID == nil

		UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, isDraw, 0)
		UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, isDraw, 0)

		// Report to leaderboard service
		go reportToLeaderboard(game)

		// Publish game_ended event
		PublishGameEvent(req.GameID, "game_ended", map[string]interface{}{
			"game":    game,
			"message": message,
			"reason":  "game_complete",
		})
	} else {
		// Publish move_update event
		PublishGameEvent(req.GameID, "move_update", map[string]interface{}{
			"game":    game,
			"message": message,
		})
	}

	respondJSON(w, map[string]interface{}{
		"success":   true,
		"game":      game,
		"gameEnded": gameEnded,
		"message":   message,
	})
}

// handleGetConfig returns game configuration and options schema
// This allows the identity shell to dynamically render challenge options
func handleGetConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"appId":       "tic-tac-toe",
		"name":        "Tic-Tac-Toe",
		"icon":        "⭕",
		"description": "Classic 3x3 grid game. Get three in a row to win!",
		"gameOptions": []map[string]interface{}{
			{
				"id":      "firstTo",
				"type":    "select",
				"label":   "First to",
				"default": 1,
				"options": []map[string]interface{}{
					{"value": 1, "label": "1 win"},
					{"value": 2, "label": "2 wins"},
					{"value": 3, "label": "3 wins (Best of 5)"},
					{"value": 5, "label": "5 wins (Best of 9)"},
				},
			},
			{
				"id":      "mode",
				"type":    "select",
				"label":   "Mode",
				"default": "normal",
				"options": []map[string]interface{}{
					{"value": "normal", "label": "Normal"},
					{"value": "timed", "label": "Timed (30s/move)"},
				},
			},
		},
	}

	respondJSON(w, config)
}

// handleGetStats retrieves player statistics
func handleGetStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]

	if userID == "" {
		sendError(w, "Invalid user ID", 400)
		return
	}

	stats, err := GetPlayerStats(userID)
	if err != nil {
		log.Printf("Failed to get player stats: %v", err)
		sendError(w, "Failed to get stats", 500)
		return
	}

	respondJSON(w, stats)
}

// Helper functions

func sendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error: message,
		Code:  code,
	})
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// handleGameStream handles SSE connections for real-time game updates
func handleGameStream(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context
	user := getUserFromContext(r)
	if user == nil {
		sendError(w, "Unauthorized", 401)
		return
	}

	vars := mux.Vars(r)
	gameID := vars["gameId"]

	if gameID == "" {
		sendError(w, "Missing gameId", 400)
		return
	}

	log.Printf("📡 SSE connection attempt: game=%s, user=%s", gameID, user.Email)

	// Validate game exists
	game, err := GetGame(gameID)
	if err != nil {
		log.Printf("❌ SSE: Game not found: %s", gameID)
		sendError(w, "Game not found", 404)
		return
	}

	// Validate user is a player
	if user.Email != game.Player1ID && user.Email != game.Player2ID {
		log.Printf("❌ SSE: User %s is not a player in game %s", user.Email, gameID)
		sendError(w, "Not a player in this game", 403)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	// Make sure we can flush
	flusher, ok := w.(http.Flusher)
	if !ok {
		log.Printf("❌ SSE: Streaming not supported")
		sendError(w, "Streaming not supported", 500)
		return
	}

	// Check if this is a reconnection (cancel pending disconnect timer)
	wasReconnecting := CancelDisconnectTimer(gameID, user.Email)
	if wasReconnecting {
		log.Printf("✅ SSE: Player %s reconnected to game %s", user.Email, gameID)
		// Notify opponent they reconnected
		PublishGameEvent(gameID, "opponent_reconnected", map[string]interface{}{
			"reconnectedUserId": user.Email,
		})
	}

	// Register connection
	AddSSEConnection(gameID, user.Email)

	// Subscribe to game events
	pubsub, msgChan := SubscribeToGame(gameID)
	defer func() {
		pubsub.Close()
		// Only handle disconnect if game is still active
		currentGame, err := GetGame(gameID)
		if err == nil && currentGame.Status == GameStatusActive {
			RemoveSSEConnection(gameID, user.Email, currentGame)
		}
		log.Printf("📡 SSE disconnected: game=%s, user=%s", gameID, user.Email)
	}()

	log.Printf("✅ SSE connected: game=%s, user=%s, reconnecting=%v", gameID, user.Email, wasReconnecting)

	// Send initial connected event with current game state
	initialEvent := SSEEvent{
		Type:    "connected",
		Payload: game,
	}
	initialData, _ := json.Marshal(initialEvent)
	fmt.Fprintf(w, "data: %s\n\n", initialData)
	flusher.Flush()

	// Set up ping ticker for keepalive (every 30 seconds)
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Listen for events
	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			// Client disconnected
			return

		case msg := <-msgChan:
			// Forward Redis message to SSE stream
			fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
			flusher.Flush()

		case <-ticker.C:
			// Send keepalive ping
			pingEvent := SSEEvent{Type: "ping"}
			pingData, _ := json.Marshal(pingEvent)
			fmt.Fprintf(w, "data: %s\n\n", pingData)
			flusher.Flush()
		}
	}
}

// handleForfeitHTTP handles HTTP forfeit requests
func handleForfeitHTTP(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context
	user := getUserFromContext(r)
	if user == nil {
		sendError(w, "Unauthorized", 401)
		return
	}

	vars := mux.Vars(r)
	gameID := vars["gameId"]

	game, err := GetGame(gameID)
	if err != nil {
		sendError(w, "Game not found", 404)
		return
	}

	// Validate user is a player
	if user.Email != game.Player1ID && user.Email != game.Player2ID {
		sendError(w, "Not a player in this game", 403)
		return
	}

	if game.Status == GameStatusCompleted {
		sendError(w, "Game already ended", 400)
		return
	}

	// Determine winner (opponent of the forfeiting player)
	var winnerID string
	if user.Email == game.Player1ID {
		winnerID = game.Player2ID
	} else {
		winnerID = game.Player1ID
	}

	log.Printf("🏳️ Player %s forfeited game %s, winner: %s", user.Email, gameID, winnerID)

	// Update game state
	game.Status = GameStatusCompleted
	game.WinnerID = &winnerID
	now := time.Now().Unix()
	game.CompletedAt = &now

	// Save to Redis
	if err := UpdateGame(game); err != nil {
		log.Printf("Failed to update game after forfeit: %v", err)
		sendError(w, "Failed to update game", 500)
		return
	}

	// Save to PostgreSQL and update stats
	if err := SaveCompletedGame(game); err != nil {
		log.Printf("Warning: Failed to save forfeited game to PostgreSQL: %v", err)
	}

	// Update player stats
	player1Won := winnerID == game.Player1ID
	player2Won := winnerID == game.Player2ID

	UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, false, 0)
	UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, false, 0)

	// Report to leaderboard service
	go reportToLeaderboard(game)

	// Publish game_ended event
	PublishGameEvent(gameID, "game_ended", map[string]interface{}{
		"game":    game,
		"message": "Opponent forfeited",
		"reason":  "forfeit",
	})

	respondJSON(w, map[string]interface{}{
		"success": true,
		"game":    game,
	})
}

// handleClaimWinHTTP handles HTTP claim-win requests
func handleClaimWinHTTP(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context
	user := getUserFromContext(r)
	if user == nil {
		sendError(w, "Unauthorized", 401)
		return
	}

	vars := mux.Vars(r)
	gameID := vars["gameId"]

	game, err := GetGame(gameID)
	if err != nil {
		sendError(w, "Game not found", 404)
		return
	}

	// Validate user is a player
	if user.Email != game.Player1ID && user.Email != game.Player2ID {
		sendError(w, "Not a player in this game", 403)
		return
	}

	if game.Status == GameStatusCompleted {
		sendError(w, "Game already ended", 400)
		return
	}

	// Get opponent ID
	var opponentID string
	if user.Email == game.Player1ID {
		opponentID = game.Player2ID
	} else {
		opponentID = game.Player1ID
	}

	// Check if opponent is disconnected
	if !WasPlayerDisconnected(gameID, opponentID) {
		sendError(w, "Cannot claim win - opponent is still connected or may reconnect", 400)
		return
	}

	log.Printf("🏆 Player %s claiming win after %s disconnected in game %s", user.Email, opponentID, gameID)

	// Update game state
	game.Status = GameStatusCompleted
	winnerEmail := user.Email
	game.WinnerID = &winnerEmail
	now := time.Now().Unix()
	game.CompletedAt = &now

	// Save to Redis
	if err := UpdateGame(game); err != nil {
		log.Printf("Failed to update game after claim win: %v", err)
		sendError(w, "Failed to update game", 500)
		return
	}

	// Save to PostgreSQL and update stats
	if err := SaveCompletedGame(game); err != nil {
		log.Printf("Warning: Failed to save claimed game to PostgreSQL: %v", err)
	}

	// Update player stats
	player1Won := user.Email == game.Player1ID
	player2Won := user.Email == game.Player2ID

	UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, false, 0)
	UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, false, 0)

	// Report to leaderboard service
	go reportToLeaderboard(game)

	// Publish game_ended event
	PublishGameEvent(gameID, "game_ended", map[string]interface{}{
		"game":    game,
		"message": "You won - opponent disconnected",
		"reason":  "disconnect",
	})

	respondJSON(w, map[string]interface{}{
		"success": true,
		"game":    game,
	})
}
