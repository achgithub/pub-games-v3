package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

// SaveGame stores a game in Redis with 2-hour TTL
func SaveGame(game *SpoofGame) error {
	key := fmt.Sprintf("spoof:game:%s", game.ID)

	data, err := json.Marshal(game)
	if err != nil {
		return fmt.Errorf("failed to marshal game: %w", err)
	}

	if err := redisClient.Set(ctx, key, data, 2*time.Hour).Err(); err != nil {
		return fmt.Errorf("failed to save game to Redis: %w", err)
	}

	return nil
}

// GetGame retrieves a game from Redis
func GetGame(gameID string) (*SpoofGame, error) {
	key := fmt.Sprintf("spoof:game:%s", gameID)

	data, err := redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("game not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get game from Redis: %w", err)
	}

	var game SpoofGame
	if err := json.Unmarshal([]byte(data), &game); err != nil {
		return nil, fmt.Errorf("failed to unmarshal game: %w", err)
	}

	return &game, nil
}

// PublishGameUpdate publishes a game update notification
func PublishGameUpdate(gameID string) error {
	channel := fmt.Sprintf("spoof:game:%s:updates", gameID)
	return redisClient.Publish(ctx, channel, "update").Err()
}

// SubscribeToGameUpdates subscribes to game update notifications
func SubscribeToGameUpdates(gameID string) *redis.PubSub {
	channel := fmt.Sprintf("spoof:game:%s:updates", gameID)
	return redisClient.Subscribe(ctx, channel)
}
