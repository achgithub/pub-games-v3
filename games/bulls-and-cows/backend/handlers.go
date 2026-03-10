package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// Game represents a Bulls and Cows game
type Game struct {
	ID          string     `json:"id"`
	Mode        string     `json:"mode"`
	Variant     string     `json:"variant"`
	SecretCode  string     `json:"secretCode,omitempty"`
	CodeMaker   string     `json:"codeMaker"`
	CodeBreaker string     `json:"codeBreaker"`
	MaxGuesses  int        `json:"maxGuesses"`
	Status      string     `json:"status"`
	Winner      *string    `json:"winner,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
	Guesses     []Guess    `json:"guesses,omitempty"`
}

// Guess represents a single guess in the game
type Guess struct {
	ID          int       `json:"id"`
	GameID      string    `json:"gameId"`
	GuessNumber int       `json:"guessNumber"`
	GuessCode   string    `json:"guessCode"`
	Bulls       int       `json:"bulls"`
	Cows        int       `json:"cows"`
	GuessedAt   time.Time `json:"guessedAt"`
}

// CreateGameRequest represents the request to create a new game
type CreateGameRequest struct {
	Mode    string `json:"mode"`    // "colors" or "numbers"
	Variant string `json:"variant"` // "1player" or "2player"
	GameID  string `json:"gameId"`  // Optional: from challenge modal
}

// MakeGuessRequest represents a guess submission
type MakeGuessRequest struct {
	Guess string `json:"guess"`
}

// ConfigResponse represents the app configuration
type ConfigResponse struct {
	AppName     string       `json:"appName"`
	MinPlayers  int          `json:"minPlayers"`
	MaxPlayers  int          `json:"maxPlayers"`
	GameOptions []GameOption `json:"gameOptions"`
}

// GameOption represents a configurable game option
type GameOption struct {
	ID      string        `json:"id"`
	Label   string        `json:"label"`
	Type    string        `json:"type"`
	Default interface{}   `json:"default"`
	Options []OptionValue `json:"options,omitempty"`
}

// OptionValue represents a value option for select-type game options
type OptionValue struct {
	Value interface{} `json:"value"`
	Label string      `json:"label"`
}

// GetConfig returns app configuration for the identity shell
func GetConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ConfigResponse{
		AppName:    "Bulls and Cows",
		MinPlayers: 0,
		MaxPlayers: 2,
		GameOptions: []GameOption{
			{
				ID:      "mode",
				Label:   "Mode",
				Type:    "select",
				Default: "colors",
				Options: []OptionValue{
					{Value: "colors", Label: "Colors (6 colors)"},
					{Value: "numbers", Label: "Numbers (0-9)"},
				},
			},
		},
	})
}

// CreateGame creates a new game
func CreateGame(db *sql.DB, redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authlib.GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		userID := user.Email

		var req CreateGameRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate mode
		if req.Mode != "colors" && req.Mode != "numbers" {
			http.Error(w, "Mode must be 'colors' or 'numbers'", http.StatusBadRequest)
			return
		}

		// Validate variant
		if req.Variant != "1player" && req.Variant != "2player" {
			http.Error(w, "Variant must be '1player' or '2player'", http.StatusBadRequest)
			return
		}

		// Generate secret code
		secretCode := GenerateSecretCode(req.Mode)

		// Determine code maker
		codeMaker := "AI"
		if req.Variant == "2player" {
			codeMaker = userID // In 2-player, current user is code maker
		}

		// Use provided gameID or generate new one
		gameID := req.GameID
		if gameID == "" {
			gameID = uuid.New().String()
		}

		// Create game in database
		query := `
			INSERT INTO games (id, mode, variant, secret_code, code_maker, code_breaker, max_guesses, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING created_at, updated_at
		`
		var createdAt, updatedAt time.Time
		err := db.QueryRow(query, gameID, req.Mode, req.Variant, secretCode, codeMaker, userID, 12, "active").
			Scan(&createdAt, &updatedAt)
		if err != nil {
			log.Printf("Error creating game: %v", err)
			http.Error(w, "Failed to create game", http.StatusInternalServerError)
			return
		}

		game := Game{
			ID:          gameID,
			Mode:        req.Mode,
			Variant:     req.Variant,
			CodeMaker:   codeMaker,
			CodeBreaker: userID,
			MaxGuesses:  12,
			Status:      "active",
			CreatedAt:   createdAt,
			UpdatedAt:   updatedAt,
			Guesses:     []Guess{},
		}

		// Store in Redis for quick access (1 hour TTL)
		ctx := context.Background()
		gameJSON, _ := json.Marshal(game)
		redisClient.Set(ctx, fmt.Sprintf("game:%s", gameID), gameJSON, time.Hour)

		// Publish game created event
		PublishGameEvent(redisClient, gameID, "game_created", game)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(game)
	}
}

// GetGame retrieves a game by ID
func GetGame(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authlib.GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		userID := user.Email

		vars := mux.Vars(r)
		gameID := vars["gameId"]

		// Fetch game from database
		var game Game
		var winner sql.NullString
		var completedAt sql.NullTime
		query := `
			SELECT id, mode, variant, secret_code, code_maker, code_breaker, max_guesses, status, winner, created_at, updated_at, completed_at
			FROM games
			WHERE id = $1
		`
		err := db.QueryRow(query, gameID).Scan(
			&game.ID, &game.Mode, &game.Variant, &game.SecretCode, &game.CodeMaker, &game.CodeBreaker,
			&game.MaxGuesses, &game.Status, &winner, &game.CreatedAt, &game.UpdatedAt, &completedAt,
		)
		if err == sql.ErrNoRows {
			http.Error(w, "Game not found", http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("Error fetching game: %v", err)
			http.Error(w, "Failed to fetch game", http.StatusInternalServerError)
			return
		}

		if winner.Valid {
			game.Winner = &winner.String
		}
		if completedAt.Valid {
			game.CompletedAt = &completedAt.Time
		}

		// Verify user is part of this game
		if game.CodeBreaker != userID && game.CodeMaker != userID {
			http.Error(w, "Access denied", http.StatusForbidden)
			return
		}

		// Fetch guesses
		guessQuery := `
			SELECT id, game_id, guess_number, guess_code, bulls, cows, guessed_at
			FROM guesses
			WHERE game_id = $1
			ORDER BY guess_number ASC
		`
		rows, err := db.Query(guessQuery, gameID)
		if err != nil {
			log.Printf("Error fetching guesses: %v", err)
			http.Error(w, "Failed to fetch guesses", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		game.Guesses = []Guess{}
		for rows.Next() {
			var guess Guess
			err := rows.Scan(&guess.ID, &guess.GameID, &guess.GuessNumber, &guess.GuessCode, &guess.Bulls, &guess.Cows, &guess.GuessedAt)
			if err != nil {
				log.Printf("Error scanning guess: %v", err)
				continue
			}
			game.Guesses = append(game.Guesses, guess)
		}

		// Hide secret code if game is still active
		if game.Status == "active" {
			game.SecretCode = ""
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(game)
	}
}

// MakeGuess handles a guess submission
func MakeGuess(db *sql.DB, redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authlib.GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		userID := user.Email

		vars := mux.Vars(r)
		gameID := vars["gameId"]

		var req MakeGuessRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Fetch game
		var game Game
		query := `SELECT id, mode, variant, secret_code, code_maker, code_breaker, max_guesses, status FROM games WHERE id = $1`
		err := db.QueryRow(query, gameID).Scan(
			&game.ID, &game.Mode, &game.Variant, &game.SecretCode, &game.CodeMaker, &game.CodeBreaker, &game.MaxGuesses, &game.Status,
		)
		if err == sql.ErrNoRows {
			http.Error(w, "Game not found", http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("Error fetching game: %v", err)
			http.Error(w, "Failed to fetch game", http.StatusInternalServerError)
			return
		}

		// Verify user is the code breaker
		if game.CodeBreaker != userID {
			http.Error(w, "Only the code breaker can make guesses", http.StatusForbidden)
			return
		}

		// Check if game is active
		if game.Status != "active" {
			http.Error(w, "Game is not active", http.StatusBadRequest)
			return
		}

		// Validate guess
		guess := strings.ToUpper(req.Guess)
		if err := ValidateGuess(guess, game.Mode); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Count existing guesses
		var guessCount int
		db.QueryRow("SELECT COUNT(*) FROM guesses WHERE game_id = $1", gameID).Scan(&guessCount)

		if guessCount >= game.MaxGuesses {
			http.Error(w, "Maximum guesses reached", http.StatusBadRequest)
			return
		}

		// Calculate bulls and cows
		bulls, cows := CalculateBullsAndCows(game.SecretCode, guess)

		// Save guess
		guessNumber := guessCount + 1
		var guessID int
		var guessedAt time.Time
		insertQuery := `
			INSERT INTO guesses (game_id, guess_number, guess_code, bulls, cows)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, guessed_at
		`
		err = db.QueryRow(insertQuery, gameID, guessNumber, guess, bulls, cows).Scan(&guessID, &guessedAt)
		if err != nil {
			log.Printf("Error saving guess: %v", err)
			http.Error(w, "Failed to save guess", http.StatusInternalServerError)
			return
		}

		// Check for win or loss
		var newStatus string
		var winner *string
		var completedAt *time.Time
		now := time.Now()

		if CheckWin(bulls) {
			newStatus = "won"
			winner = &userID
			completedAt = &now
		} else if guessNumber >= game.MaxGuesses {
			newStatus = "lost"
			completedAt = &now
		} else {
			newStatus = "active"
		}

		// Update game status if changed
		if newStatus != "active" {
			updateQuery := `UPDATE games SET status = $1, winner = $2, completed_at = $3 WHERE id = $4`
			_, err = db.Exec(updateQuery, newStatus, winner, completedAt, gameID)
			if err != nil {
				log.Printf("Error updating game status: %v", err)
			}
		}

		// Create response
		guessResponse := Guess{
			ID:          guessID,
			GameID:      gameID,
			GuessNumber: guessNumber,
			GuessCode:   guess,
			Bulls:       bulls,
			Cows:        cows,
			GuessedAt:   guessedAt,
		}

		// Publish SSE event
		eventPayload := map[string]interface{}{
			"guess":  guessResponse,
			"status": newStatus,
		}
		if newStatus != "active" {
			eventPayload["secretCode"] = game.SecretCode
			eventPayload["winner"] = winner
		}
		PublishGameEvent(redisClient, gameID, "guess_made", eventPayload)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"guess":      guessResponse,
			"status":     newStatus,
			"secretCode": func() string { if newStatus != "active" { return game.SecretCode }; return "" }(),
		})
	}
}

// StreamGame handles SSE connections for game updates
func StreamGame(redisClient *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := authlib.GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		vars := mux.Vars(r)
		gameID := vars["gameId"]

		StreamGameUpdates(w, r, gameID, user.Email, redisClient)
	}
}
