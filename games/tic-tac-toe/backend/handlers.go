package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

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
	var req MoveRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request body", 400)
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

	// Broadcast update to connected players via WebSocket
	broadcastGameUpdate(req.GameID, game)

	// If game ended, save to PostgreSQL and update stats
	if gameEnded {
		if err := SaveCompletedGame(game); err != nil {
			log.Printf("Warning: Failed to save completed game to PostgreSQL: %v", err)
		}

		// Update player stats
		player1Won := game.WinnerID != nil && *game.WinnerID == game.Player1ID
		player2Won := game.WinnerID != nil && *game.WinnerID == game.Player2ID
		isDraw := game.WinnerID == nil

		UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, isDraw, 0)
		UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, isDraw, 0)

		// Broadcast game_ended
		broadcastGameEnded(req.GameID, game)
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
