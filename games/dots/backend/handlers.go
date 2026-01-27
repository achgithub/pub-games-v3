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
		winnerID = game.Player1ID
		winnerName = game.Player1Name
		loserID = game.Player2ID
		loserName = game.Player2Name
	}

	duration := 0
	if game.CompletedAt != nil {
		duration = int(*game.CompletedAt - game.CreatedAt)
	}

	score := fmt.Sprintf("%d-%d", game.Player1Score, game.Player2Score)

	result := map[string]interface{}{
		"gameType":   "dots",
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
	// Use interface{} for GridSize to handle both string "WxH" and int formats
	var req struct {
		ChallengeID string      `json:"challengeId"`
		Player1ID   string      `json:"player1Id"`
		Player1Name string      `json:"player1Name"`
		Player2ID   string      `json:"player2Id"`
		Player2Name string      `json:"player2Name"`
		GridSize    interface{} `json:"gridSize"`   // Can be "WxH" string or int
		GridWidth   int         `json:"gridWidth"`  // Explicit width
		GridHeight  int         `json:"gridHeight"` // Explicit height
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", 400)
		return
	}

	if req.Player1ID == "" || req.Player2ID == "" {
		sendError(w, "Missing player IDs", 400)
		return
	}

	// Determine grid dimensions
	gridWidth := req.GridWidth
	gridHeight := req.GridHeight

	// Parse GridSize - can be string "WxH" or int
	if gridWidth == 0 && gridHeight == 0 && req.GridSize != nil {
		switch v := req.GridSize.(type) {
		case string:
			// Parse "WxH" format
			var w, h int
			if _, err := fmt.Sscanf(v, "%dx%d", &w, &h); err == nil {
				gridWidth = w
				gridHeight = h
			}
		case float64:
			// JSON numbers are float64
			gridWidth = int(v)
			gridHeight = int(v)
		case int:
			gridWidth = v
			gridHeight = v
		}
	}

	// Apply defaults and limits
	if gridWidth < 2 || gridWidth > 10 {
		gridWidth = 4
	}
	if gridHeight < 2 || gridHeight > 10 {
		gridHeight = 4
	}

	gameID := fmt.Sprintf("%d-%s", time.Now().UnixNano(), req.Player1ID)
	now := time.Now().Unix()

	game := &Game{
		ID:          gameID,
		ChallengeID: req.ChallengeID,
		Player1ID:   req.Player1ID,
		Player1Name: req.Player1Name,
		Player2ID:   req.Player2ID,
		Player2Name: req.Player2Name,
		GridSize:    gridWidth, // Legacy field
		GridWidth:   gridWidth,
		GridHeight:  gridHeight,
		Status:      GameStatusActive,
		CreatedAt:   now,
		LastMoveAt:  now,
	}

	// Initialize the game board
	InitializeGame(game)

	if err := CreateGame(game); err != nil {
		log.Printf("Failed to create game in Redis: %v", err)
		sendError(w, "Failed to create game", 500)
		return
	}

	log.Printf("✅ Created dots game: %s (Challenge: %s, P1: %s, P2: %s, Grid: %dx%d)",
		gameID, req.ChallengeID, req.Player1Name, req.Player2Name, gridWidth, gridHeight)

	respondJSON(w, map[string]interface{}{
		"success": true,
		"gameId":  gameID,
		"game":    game,
	})
}

// handleMakeMove processes a move
func handleMakeMove(w http.ResponseWriter, r *http.Request) {
	var req MoveRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", 400)
		return
	}

	game, err := GetGame(req.GameID)
	if err != nil {
		sendError(w, "Game not found", 404)
		return
	}

	// Validate move
	playerNum, errMsg := ValidateMove(game, req.PlayerID, req.Row, req.Col, req.Horizontal)
	if errMsg != "" {
		sendError(w, errMsg, 400)
		return
	}

	// Make the move
	boxesCompleted, gameEnded, message := MakeMove(game, playerNum, req.Row, req.Col, req.Horizontal)

	// Update game in Redis
	if err := UpdateGame(game); err != nil {
		log.Printf("Failed to update game in Redis: %v", err)
		sendError(w, "Failed to update game", 500)
		return
	}

	if gameEnded {
		// Save to PostgreSQL
		if err := SaveCompletedGame(game); err != nil {
			log.Printf("Warning: Failed to save completed game to PostgreSQL: %v", err)
		}

		// Update player stats
		player1Won := game.WinnerID != nil && *game.WinnerID == game.Player1ID
		player2Won := game.WinnerID != nil && *game.WinnerID == game.Player2ID
		isDraw := game.WinnerID == nil

		UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, isDraw, game.Player1Score)
		UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, isDraw, game.Player2Score)

		// Report to leaderboard
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
			"game":           game,
			"message":        message,
			"boxesCompleted": boxesCompleted,
		})
	}

	respondJSON(w, map[string]interface{}{
		"success":        true,
		"game":           game,
		"gameEnded":      gameEnded,
		"boxesCompleted": boxesCompleted,
		"message":        message,
	})
}

// handleGetConfig returns game configuration and options schema
// This allows the identity shell to dynamically render challenge options
func handleGetConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"appId":       "dots",
		"name":        "Dots & Boxes",
		"icon":        "🔵",
		"description": "Connect the dots, complete the boxes!",
		"gameOptions": []map[string]interface{}{
			{
				"id":      "gridSize",
				"type":    "select",
				"label":   "Grid Size",
				"default": "4x4",
				"options": []map[string]interface{}{
					{"value": "4x4", "label": "Small (4x4)"},
					{"value": "6x6", "label": "Medium (6x6)"},
					{"value": "6x9", "label": "Mobile (6x9)"},
					{"value": "8x8", "label": "Large (8x8)"},
				},
			},
		},
	}
	respondJSON(w, config)
}

// handleGetStats returns player statistics
func handleGetStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playerID := vars["userId"]

	stats, err := GetPlayerStats(playerID)
	if err != nil {
		sendError(w, "Failed to get stats", 500)
		return
	}

	respondJSON(w, stats)
}

// handleGameStream handles SSE connections for real-time updates
func handleGameStream(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	userID := r.URL.Query().Get("userId")

	if userID == "" {
		http.Error(w, "userId required", http.StatusBadRequest)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	// Get game
	game, err := GetGame(gameID)
	if err != nil {
		sendSSE(w, flusher, "error", map[string]string{"message": "Game not found"})
		return
	}

	// Verify user is a player
	if userID != game.Player1ID && userID != game.Player2ID {
		sendSSE(w, flusher, "error", map[string]string{"message": "Not a player in this game"})
		return
	}

	// Track connection
	TrackConnection(gameID, userID)
	log.Printf("🔵 Player %s connected to dots game %s via SSE", userID, gameID)

	// Send initial state
	sendSSE(w, flusher, "connected", map[string]interface{}{
		"gameId": gameID,
		"userId": userID,
	})
	sendSSE(w, flusher, "game_state", game)

	// Notify opponent
	opponentID := game.Player1ID
	if userID == game.Player1ID {
		opponentID = game.Player2ID
	}

	var opponentName string
	if userID == game.Player1ID {
		opponentName = game.Player1Name
	} else {
		opponentName = game.Player2Name
	}

	PublishGameEvent(gameID, "opponent_connected", map[string]interface{}{
		"userId": userID,
		"name":   opponentName,
	})

	// Subscribe to game updates
	pubsub := SubscribeToGame(gameID)
	defer pubsub.Close()

	// Create channels for cleanup
	done := make(chan bool)
	clientGone := r.Context().Done()

	// Heartbeat ticker
	heartbeat := time.NewTicker(10 * time.Second)
	defer heartbeat.Stop()

	// Connection refresh ticker
	refreshTicker := time.NewTicker(5 * time.Second)
	defer refreshTicker.Stop()

	go func() {
		ch := pubsub.Channel()
		for {
			select {
			case <-done:
				return
			case <-clientGone:
				return
			case msg := <-ch:
				if msg == nil {
					continue
				}
				fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
				flusher.Flush()
			case <-heartbeat.C:
				fmt.Fprintf(w, ": heartbeat\n\n")
				flusher.Flush()
			case <-refreshTicker.C:
				RefreshConnection(gameID, userID)
			}
		}
	}()

	// Wait for client disconnect
	<-clientGone
	close(done)

	// Cleanup
	RemoveConnection(gameID, userID)
	log.Printf("🔴 Player %s disconnected from dots game %s", userID, gameID)

	// Notify opponent of disconnect
	PublishGameEvent(gameID, "opponent_disconnected", map[string]interface{}{
		"userId": userID,
	})

	// Check if opponent is still connected
	if !IsPlayerConnected(gameID, opponentID) {
		log.Printf("Both players disconnected from dots game %s", gameID)
	}
}

// handleForfeitHTTP handles forfeit requests
func handleForfeitHTTP(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	var req struct {
		UserID string `json:"userId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", 400)
		return
	}

	if req.UserID == "" {
		sendError(w, "Missing userId", 400)
		return
	}

	game, err := GetGame(gameID)
	if err != nil {
		sendError(w, "Game not found", 404)
		return
	}

	if req.UserID != game.Player1ID && req.UserID != game.Player2ID {
		sendError(w, "Not a player in this game", 403)
		return
	}

	if game.Status == GameStatusCompleted {
		sendError(w, "Game already ended", 400)
		return
	}

	// Determine winner
	var winnerID string
	if req.UserID == game.Player1ID {
		winnerID = game.Player2ID
	} else {
		winnerID = game.Player1ID
	}

	log.Printf("🏳️ Player %s forfeited dots game %s, winner: %s", req.UserID, gameID, winnerID)

	game.Status = GameStatusCompleted
	game.WinnerID = &winnerID
	now := time.Now().Unix()
	game.CompletedAt = &now

	if err := UpdateGame(game); err != nil {
		sendError(w, "Failed to update game", 500)
		return
	}

	if err := SaveCompletedGame(game); err != nil {
		log.Printf("Warning: Failed to save forfeited game to PostgreSQL: %v", err)
	}

	player1Won := winnerID == game.Player1ID
	player2Won := winnerID == game.Player2ID

	UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, false, game.Player1Score)
	UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, false, game.Player2Score)

	go reportToLeaderboard(game)

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

// handleClaimWinHTTP handles claim-win requests when opponent disconnects
func handleClaimWinHTTP(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	var req struct {
		UserID string `json:"userId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", 400)
		return
	}

	if req.UserID == "" {
		sendError(w, "Missing userId", 400)
		return
	}

	game, err := GetGame(gameID)
	if err != nil {
		sendError(w, "Game not found", 404)
		return
	}

	if req.UserID != game.Player1ID && req.UserID != game.Player2ID {
		sendError(w, "Not a player in this game", 403)
		return
	}

	if game.Status == GameStatusCompleted {
		sendError(w, "Game already ended", 400)
		return
	}

	// Check if opponent is disconnected
	opponentID := game.Player1ID
	if req.UserID == game.Player1ID {
		opponentID = game.Player2ID
	}

	if IsPlayerConnected(gameID, opponentID) {
		sendError(w, "Opponent is still connected", 400)
		return
	}

	log.Printf("🏆 Player %s claiming win after %s disconnected in dots game %s", req.UserID, opponentID, gameID)

	game.Status = GameStatusCompleted
	game.WinnerID = &req.UserID
	now := time.Now().Unix()
	game.CompletedAt = &now

	if err := UpdateGame(game); err != nil {
		sendError(w, "Failed to update game", 500)
		return
	}

	if err := SaveCompletedGame(game); err != nil {
		log.Printf("Warning: Failed to save claimed game to PostgreSQL: %v", err)
	}

	player1Won := req.UserID == game.Player1ID
	player2Won := req.UserID == game.Player2ID

	UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, false, game.Player1Score)
	UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, false, game.Player2Score)

	go reportToLeaderboard(game)

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

// Helper functions
func sendError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func sendSSE(w http.ResponseWriter, flusher http.Flusher, eventType string, data interface{}) {
	event := map[string]interface{}{
		"type":    eventType,
		"payload": data,
	}
	jsonData, _ := json.Marshal(event)
	fmt.Fprintf(w, "data: %s\n\n", jsonData)
	flusher.Flush()
}
