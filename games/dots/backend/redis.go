package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
)

var rdb *redis.Client
var ctx = context.Background()

const (
	GameKeyPrefix       = "dots:game:"
	GameChannelPrefix   = "dots:game:"
	ConnectionKeyPrefix = "dots:conn:"
	GameTTL             = 3600 * time.Second // 1 hour
	ConnectionTimeout   = 15                  // seconds
)

// InitRedis initializes the Redis connection
func InitRedis() error {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6379"
	}

	rdb = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: "",
		DB:       0,
	})

	_, err := rdb.Ping(ctx).Result()
	return err
}

// CreateGame saves a new game to Redis
func CreateGame(game *Game) error {
	data, err := json.Marshal(game)
	if err != nil {
		return err
	}

	key := GameKeyPrefix + game.ID
	return rdb.Set(ctx, key, data, GameTTL).Err()
}

// GetGame retrieves a game from Redis
func GetGame(gameID string) (*Game, error) {
	key := GameKeyPrefix + gameID
	data, err := rdb.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var game Game
	if err := json.Unmarshal([]byte(data), &game); err != nil {
		return nil, err
	}

	return &game, nil
}

// UpdateGame updates a game in Redis
func UpdateGame(game *Game) error {
	data, err := json.Marshal(game)
	if err != nil {
		return err
	}

	key := GameKeyPrefix + game.ID

	// Shorter TTL for completed games
	ttl := GameTTL
	if game.Status == GameStatusCompleted || game.Status == GameStatusAbandoned {
		ttl = 5 * time.Minute
	}

	return rdb.Set(ctx, key, data, ttl).Err()
}

// DeleteGame removes a game from Redis
func DeleteGame(gameID string) error {
	key := GameKeyPrefix + gameID
	return rdb.Del(ctx, key).Err()
}

// PublishGameEvent publishes an event to the game's channel
func PublishGameEvent(gameID string, eventType string, payload interface{}) error {
	channel := GameChannelPrefix + gameID + ":updates"

	event := map[string]interface{}{
		"type":    eventType,
		"payload": payload,
	}

	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return rdb.Publish(ctx, channel, data).Err()
}

// SubscribeToGame subscribes to a game's update channel
func SubscribeToGame(gameID string) *redis.PubSub {
	channel := GameChannelPrefix + gameID + ":updates"
	return rdb.Subscribe(ctx, channel)
}

// TrackConnection records that a player is connected to a game
func TrackConnection(gameID, playerID string) error {
	key := ConnectionKeyPrefix + gameID
	return rdb.HSet(ctx, key, playerID, time.Now().Unix()).Err()
}

// RemoveConnection removes a player's connection record
func RemoveConnection(gameID, playerID string) error {
	key := ConnectionKeyPrefix + gameID
	return rdb.HDel(ctx, key, playerID).Err()
}

// GetConnectedPlayers returns the list of connected player IDs
func GetConnectedPlayers(gameID string) ([]string, error) {
	key := ConnectionKeyPrefix + gameID
	result, err := rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	now := time.Now().Unix()
	connected := []string{}

	for playerID, timestamp := range result {
		var ts int64
		fmt.Sscanf(timestamp, "%d", &ts)

		// Consider connected if timestamp is within timeout
		if now-ts < ConnectionTimeout {
			connected = append(connected, playerID)
		}
	}

	return connected, nil
}

// IsPlayerConnected checks if a specific player is connected
func IsPlayerConnected(gameID, playerID string) bool {
	key := ConnectionKeyPrefix + gameID
	timestamp, err := rdb.HGet(ctx, key, playerID).Result()
	if err != nil {
		return false
	}

	var ts int64
	fmt.Sscanf(timestamp, "%d", &ts)

	return time.Now().Unix()-ts < ConnectionTimeout
}

// RefreshConnection updates the timestamp for a player's connection
func RefreshConnection(gameID, playerID string) error {
	return TrackConnection(gameID, playerID)
}

// CleanupConnections removes stale connection records
func CleanupConnections(gameID string) {
	key := ConnectionKeyPrefix + gameID
	result, err := rdb.HGetAll(ctx, key).Result()
	if err != nil {
		return
	}

	now := time.Now().Unix()
	for playerID, timestamp := range result {
		var ts int64
		fmt.Sscanf(timestamp, "%d", &ts)

		if now-ts >= ConnectionTimeout {
			rdb.HDel(ctx, key, playerID)
			log.Printf("Cleaned up stale connection for %s in game %s", playerID, gameID)
		}
	}
}
