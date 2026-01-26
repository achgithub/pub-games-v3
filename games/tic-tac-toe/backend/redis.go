package main

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
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

// SSEEvent represents an event published via Redis pub/sub
type SSEEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// PublishGameEvent publishes an event to a game's event channel
func PublishGameEvent(gameID string, eventType string, payload interface{}) error {
	channel := fmt.Sprintf("game:%s:events", gameID)

	event := SSEEvent{
		Type:    eventType,
		Payload: payload,
	}

	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = redisClient.Publish(ctx, channel, string(data)).Err()
	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	return nil
}

// SubscribeToGame subscribes to a game's event channel and returns a channel for receiving messages
// The caller is responsible for calling the returned cancel function to clean up
func SubscribeToGame(gameID string) (*redis.PubSub, <-chan *redis.Message) {
	channel := fmt.Sprintf("game:%s:events", gameID)
	pubsub := redisClient.Subscribe(ctx, channel)
	return pubsub, pubsub.Channel()
}

// Connection tracking for SSE disconnect detection
var (
	connectionsMu sync.RWMutex
	connections   = make(map[string]map[string]bool) // gameID -> map[userID]bool
	disconnectTimers = make(map[string]*time.Timer)  // gameID:userID -> timer
)

// AddSSEConnection registers a player's SSE connection
func AddSSEConnection(gameID, userID string) {
	connectionsMu.Lock()
	defer connectionsMu.Unlock()

	if connections[gameID] == nil {
		connections[gameID] = make(map[string]bool)
	}
	connections[gameID][userID] = true

	// Cancel any pending disconnect timer
	timerKey := fmt.Sprintf("%s:%s", gameID, userID)
	if timer, exists := disconnectTimers[timerKey]; exists {
		timer.Stop()
		delete(disconnectTimers, timerKey)
	}
}

// RemoveSSEConnection removes a player's SSE connection and starts disconnect timer
func RemoveSSEConnection(gameID, userID string, game *Game) {
	connectionsMu.Lock()
	defer connectionsMu.Unlock()

	if connections[gameID] != nil {
		delete(connections[gameID], userID)
		if len(connections[gameID]) == 0 {
			delete(connections, gameID)
		}
	}

	// Start disconnect timer (15 seconds grace period)
	timerKey := fmt.Sprintf("%s:%s", gameID, userID)
	disconnectTimers[timerKey] = time.AfterFunc(15*time.Second, func() {
		connectionsMu.Lock()
		delete(disconnectTimers, timerKey)
		connectionsMu.Unlock()

		// Notify opponent that player disconnected
		PublishGameEvent(gameID, "opponent_disconnected", map[string]interface{}{
			"disconnectedUserId": userID,
			"claimWinAfter":      15,
		})
	})
}

// IsPlayerConnected checks if a player has an active SSE connection
func IsPlayerConnected(gameID, userID string) bool {
	connectionsMu.RLock()
	defer connectionsMu.RUnlock()

	if connections[gameID] == nil {
		return false
	}
	return connections[gameID][userID]
}

// WasPlayerDisconnected checks if a player was disconnected (timer expired)
func WasPlayerDisconnected(gameID, userID string) bool {
	connectionsMu.RLock()
	defer connectionsMu.RUnlock()

	timerKey := fmt.Sprintf("%s:%s", gameID, userID)
	_, hasTimer := disconnectTimers[timerKey]

	// If no timer and not connected, they were disconnected
	connected := false
	if connections[gameID] != nil {
		connected = connections[gameID][userID]
	}

	return !connected && !hasTimer
}

// CancelDisconnectTimer cancels a pending disconnect timer (player reconnected)
func CancelDisconnectTimer(gameID, userID string) bool {
	connectionsMu.Lock()
	defer connectionsMu.Unlock()

	timerKey := fmt.Sprintf("%s:%s", gameID, userID)
	if timer, exists := disconnectTimers[timerKey]; exists {
		timer.Stop()
		delete(disconnectTimers, timerKey)
		return true
	}
	return false
}
