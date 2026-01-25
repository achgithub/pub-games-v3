package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

var redisClient *redis.Client
var ctx = context.Background()

const (
	GAME_TTL_ACTIVE    = 3600 // 1 hour for active games
	GAME_TTL_COMPLETED = 300  // 5 minutes for completed games
)

// InitRedis initializes Redis connection
func InitRedis() error {
	redisHost := getEnv("REDIS_HOST", "127.0.0.1")
	redisPort := getEnv("REDIS_PORT", "6379")
	redisPassword := getEnv("REDIS_PASSWORD", "")

	redisClient = redis.NewClient(&redis.Options{
		Addr:     redisHost + ":" + redisPort,
		Password: redisPassword,
		DB:       0,
	})

	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return nil
}

// CreateGame creates a new game in Redis
func CreateGame(game *Game) error {
	key := fmt.Sprintf("game:%s", game.ID)

	// Marshal game to JSON
	data, err := json.Marshal(game)
	if err != nil {
		return fmt.Errorf("failed to marshal game: %w", err)
	}

	// Store in Redis with TTL
	err = redisClient.Set(ctx, key, data, GAME_TTL_ACTIVE*time.Second).Err()
	if err != nil {
		return fmt.Errorf("failed to store game in Redis: %w", err)
	}

	return nil
}

// GetGame retrieves a game from Redis
func GetGame(gameID string) (*Game, error) {
	key := fmt.Sprintf("game:%s", gameID)

	data, err := redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("game not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get game from Redis: %w", err)
	}

	var game Game
	err = json.Unmarshal([]byte(data), &game)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal game: %w", err)
	}

	return &game, nil
}

// UpdateGame updates a game in Redis
func UpdateGame(game *Game) error {
	key := fmt.Sprintf("game:%s", game.ID)

	// Marshal game to JSON
	data, err := json.Marshal(game)
	if err != nil {
		return fmt.Errorf("failed to marshal game: %w", err)
	}

	// Determine TTL based on status
	ttl := GAME_TTL_ACTIVE
	if game.Status == GameStatusCompleted || game.Status == GameStatusAbandoned {
		ttl = GAME_TTL_COMPLETED
	}

	// Update in Redis
	err = redisClient.Set(ctx, key, data, time.Duration(ttl)*time.Second).Err()
	if err != nil {
		return fmt.Errorf("failed to update game in Redis: %w", err)
	}

	return nil
}

// DeleteGame removes a game from Redis
func DeleteGame(gameID string) error {
	key := fmt.Sprintf("game:%s", gameID)

	err := redisClient.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to delete game from Redis: %w", err)
	}

	return nil
}

// UpdateGameBoard updates just the board and current turn
func UpdateGameBoard(gameID string, board []string, currentTurn int, lastMoveAt int64) error {
	game, err := GetGame(gameID)
	if err != nil {
		return err
	}

	game.Board = board
	game.CurrentTurn = currentTurn
	game.LastMoveAt = lastMoveAt

	return UpdateGame(game)
}

// UpdateGameScore updates the score after a round
func UpdateGameScore(gameID string, player1Score, player2Score, currentRound int) error {
	game, err := GetGame(gameID)
	if err != nil {
		return err
	}

	game.Player1Score = player1Score
	game.Player2Score = player2Score
	game.CurrentRound = currentRound

	// Reset board for new round
	game.Board = []string{"", "", "", "", "", "", "", "", ""}
	game.CurrentTurn = 1 // Player 1 starts new round

	return UpdateGame(game)
}

// CompleteGame marks a game as completed
func CompleteGame(gameID string, winnerID *string) error {
	game, err := GetGame(gameID)
	if err != nil {
		return err
	}

	now := time.Now().Unix()
	game.Status = GameStatusCompleted
	game.WinnerID = winnerID
	game.CompletedAt = &now

	// Update with shorter TTL
	return UpdateGame(game)
}
