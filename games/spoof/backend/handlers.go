package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// handleCreateGame creates a new multi-player Spoof game
func handleCreateGame(w http.ResponseWriter, r *http.Request) {
	var req CreateGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate players (3-6 players)
	if len(req.Players) < 3 || len(req.Players) > 6 {
		respondError(w, "Spoof requires 3-6 players", http.StatusBadRequest)
		return
	}

	// Convert players from map to PlayerInfo
	players := make([]PlayerInfo, len(req.Players))
	for i, p := range req.Players {
		id, _ := p["id"].(string)
		name, _ := p["name"].(string)

		players[i] = PlayerInfo{
			ID:             id,
			Name:           name,
			CoinsRemaining: 3, // Each player starts with 3 coins
			Order:          i,
		}
	}

	// Create new game
	game := NewSpoofGame(req.ChallengeID, players)

	// Store in Redis with 2-hour TTL
	if err := SaveGame(game); err != nil {
		log.Printf("Failed to save game: %v", err)
		respondError(w, "Failed to create game", http.StatusInternalServerError)
		return
	}

	// Save to PostgreSQL for history
	if err := SaveGameToDB(game); err != nil {
		log.Printf("Failed to save game to DB: %v", err)
		// Don't fail - Redis is source of truth
	}

	log.Printf("✅ Created Spoof game %s with %d players", game.ID, len(players))

	respondJSON(w, GameResponse{
		Success: true,
		GameID:  game.ID,
		Message: "Game created successfully",
	})
}

// handleGetGame retrieves the current game state for a player
func handleGetGame(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	playerID := r.URL.Query().Get("userId")

	if playerID == "" {
		respondError(w, "userId query parameter required", http.StatusBadRequest)
		return
	}

	game, err := GetGame(gameID)
	if err != nil {
		respondError(w, "Game not found", http.StatusNotFound)
		return
	}

	// Return player-specific view
	playerView := game.PlayerView(playerID)

	respondJSON(w, GameResponse{
		Success: true,
		GameID:  game.ID,
		Game:    playerView,
	})
}

// handleSelectCoins handles a player selecting their coins (0-3)
func handleSelectCoins(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	var req SelectCoinsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate coins
	if req.CoinsInHand < 0 || req.CoinsInHand > 3 {
		respondError(w, "Coins must be between 0 and 3", http.StatusBadRequest)
		return
	}

	game, err := GetGame(gameID)
	if err != nil {
		respondError(w, "Game not found", http.StatusNotFound)
		return
	}

	// Validate game state
	if game.Status != "coin_selection" {
		respondError(w, "Not in coin selection phase", http.StatusBadRequest)
		return
	}

	// Find player
	player := game.GetPlayer(req.PlayerID)
	if player == nil {
		respondError(w, "Player not found in game", http.StatusNotFound)
		return
	}

	if player.IsEliminated {
		respondError(w, "Player is eliminated", http.StatusBadRequest)
		return
	}

	// Check if player has enough coins remaining
	if req.CoinsInHand > player.CoinsRemaining {
		respondError(w, fmt.Sprintf("You only have %d coins remaining", player.CoinsRemaining), http.StatusBadRequest)
		return
	}

	// Update player's selection
	for i := range game.Players {
		if game.Players[i].ID == req.PlayerID {
			game.Players[i].CoinsInHand = req.CoinsInHand
			game.Players[i].HasSelected = true
			break
		}
	}

	game.UpdatedAt = time.Now().Unix()

	// Check if all players have selected
	if game.AllPlayersSelected() {
		game.Status = "guessing"
		log.Printf("All players selected coins, moving to guessing phase")
	}

	// Save game
	if err := SaveGame(game); err != nil {
		respondError(w, "Failed to save game", http.StatusInternalServerError)
		return
	}

	// Broadcast update
	PublishGameUpdate(gameID)

	respondJSON(w, GameResponse{
		Success: true,
		GameID:  game.ID,
		Message: "Coins selected",
	})
}

// handleMakeGuess handles a player making a guess
func handleMakeGuess(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	var req MakeGuessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	game, err := GetGame(gameID)
	if err != nil {
		respondError(w, "Game not found", http.StatusNotFound)
		return
	}

	// Validate game state
	if game.Status != "guessing" {
		respondError(w, "Not in guessing phase", http.StatusBadRequest)
		return
	}

	// Find player
	player := game.GetPlayer(req.PlayerID)
	if player == nil {
		respondError(w, "Player not found in game", http.StatusNotFound)
		return
	}

	if player.IsEliminated {
		respondError(w, "Player is eliminated", http.StatusBadRequest)
		return
	}

	if player.HasGuessed {
		respondError(w, "You have already guessed", http.StatusBadRequest)
		return
	}

	// Validate guess range (0 to numActivePlayers * 3)
	activePlayers := game.GetActivePlayers()
	maxGuess := len(activePlayers) * 3
	if req.Guess < 0 || req.Guess > maxGuess {
		respondError(w, fmt.Sprintf("Guess must be between 0 and %d", maxGuess), http.StatusBadRequest)
		return
	}

	// Check if guess is already used
	for _, usedGuess := range game.RoundData.UsedGuesses {
		if usedGuess == req.Guess {
			respondError(w, "That guess has already been made", http.StatusBadRequest)
			return
		}
	}

	// Record guess
	for i := range game.Players {
		if game.Players[i].ID == req.PlayerID {
			game.Players[i].Guess = req.Guess
			game.Players[i].HasGuessed = true
			break
		}
	}

	game.RoundData.GuessesThisRound[req.PlayerID] = req.Guess
	game.RoundData.UsedGuesses = append(game.RoundData.UsedGuesses, req.Guess)
	game.UpdatedAt = time.Now().Unix()

	// Check if all players have guessed
	if game.AllPlayersGuessed() {
		// Move to reveal phase
		game.Status = "reveal"
		game.RoundData.TotalCoins = game.CalculateTotalCoins()

		// Find winner
		winner := game.FindWinner()
		if winner != nil {
			game.RoundData.WinnerThisRound = winner.ID
			log.Printf("Round %d winner: %s (guessed %d, total was %d)",
				game.CurrentRound, winner.Name, winner.Guess, game.RoundData.TotalCoins)
		} else {
			// No winner - find player with 0 coins to eliminate
			eliminated := FindPlayerToEliminate(game)
			if eliminated != nil {
				game.RoundData.EliminatedThisRound = eliminated.ID

				// Mark player as eliminated
				for i := range game.Players {
					if game.Players[i].ID == eliminated.ID {
						game.Players[i].IsEliminated = true
						break
					}
				}
				game.EliminatedIDs = append(game.EliminatedIDs, eliminated.ID)

				log.Printf("Round %d: No winner, %s eliminated (had 0 coins)", game.CurrentRound, eliminated.Name)
			}
		}

		// Check if game is over
		activeCount := len(game.GetActivePlayers())
		if activeCount == 1 {
			game.Status = "finished"
			game.WinnerID = game.GetActivePlayers()[0].ID
			log.Printf("Game finished! Winner: %s", game.WinnerID)
		}
	}

	// Save game
	if err := SaveGame(game); err != nil {
		respondError(w, "Failed to save game", http.StatusInternalServerError)
		return
	}

	// Broadcast update
	PublishGameUpdate(gameID)

	respondJSON(w, GameResponse{
		Success: true,
		GameID:  game.ID,
		Message: "Guess recorded",
	})
}

// FindPlayerToEliminate finds the player with 0 coins to eliminate (if no winner)
func FindPlayerToEliminate(game *SpoofGame) *PlayerInfo {
	for i := range game.Players {
		p := &game.Players[i]
		if !p.IsEliminated && p.CoinsInHand == 0 {
			return p
		}
	}
	return nil
}

// handleGameStream provides SSE updates for real-time game state
func handleGameStream(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Subscribe to game updates
	pubsub := SubscribeToGameUpdates(gameID)
	defer pubsub.Close()

	// Send initial connection event
	fmt.Fprintf(w, "data: {\"type\":\"connected\"}\n\n")
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	// Listen for updates
	ch := pubsub.Channel()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ch:
			// Game updated
			fmt.Fprintf(w, "data: {\"type\":\"game_update\"}\n\n")
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}

		case <-ticker.C:
			// Keepalive
			fmt.Fprintf(w, ": ping\n\n")
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}

		case <-r.Context().Done():
			return
		}
	}
}
