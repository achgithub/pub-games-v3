package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// InitRedis initializes a Redis client connection.
//
// Usage:
//   redisClient, err := redis.InitRedis()
//   if err != nil {
//       log.Fatal(err)
//   }
//   defer redisClient.Close()
func InitRedis() (*redis.Client, error) {
	redisHost := getEnv("REDIS_HOST", "127.0.0.1")
	redisPort := getEnv("REDIS_PORT", "6379")
	redisPassword := getEnv("REDIS_PASSWORD", "")

	client := redis.NewClient(&redis.Options{
		Addr:     redisHost + ":" + redisPort,
		Password: redisPassword,
		DB:       0,
	})

	ctx := context.Background()
	_, err := client.Ping(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return client, nil
}

// CreateGame creates a new game object in Redis with TTL.
// The key is constructed as "game:{id}" where id is extracted from the game object.
//
// Usage:
//   game := Game{ID: "game-123", Status: "active"}
//   err := redis.CreateGame(ctx, redisClient, "game:123", game, 3600*time.Second)
func CreateGame(ctx context.Context, client *redis.Client, key string, game interface{}, ttl time.Duration) error {
	// Marshal game to JSON
	data, err := json.Marshal(game)
	if err != nil {
		return fmt.Errorf("failed to marshal game: %w", err)
	}

	// Store in Redis with TTL
	err = client.Set(ctx, key, data, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to store game in Redis: %w", err)
	}

	return nil
}

// GetGame retrieves a game object from Redis and unmarshals it into the target.
//
// Usage:
//   var game Game
//   err := redis.GetGame(ctx, redisClient, "game:123", &game)
//   if err != nil {
//       // Handle error (game not found or unmarshal error)
//   }
func GetGame(ctx context.Context, client *redis.Client, key string, target interface{}) error {
	data, err := client.Get(ctx, key).Result()
	if err == redis.Nil {
		return fmt.Errorf("game not found")
	}
	if err != nil {
		return fmt.Errorf("failed to get game from Redis: %w", err)
	}

	err = json.Unmarshal([]byte(data), target)
	if err != nil {
		return fmt.Errorf("failed to unmarshal game: %w", err)
	}

	return nil
}

// UpdateGame updates a game object in Redis with TTL.
//
// Usage:
//   game.Status = "completed"
//   err := redis.UpdateGame(ctx, redisClient, "game:123", game, 300*time.Second)
func UpdateGame(ctx context.Context, client *redis.Client, key string, game interface{}, ttl time.Duration) error {
	// Marshal game to JSON
	data, err := json.Marshal(game)
	if err != nil {
		return fmt.Errorf("failed to marshal game: %w", err)
	}

	// Update in Redis
	err = client.Set(ctx, key, data, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to update game in Redis: %w", err)
	}

	return nil
}

// DeleteGame removes a game from Redis.
//
// Usage:
//   err := redis.DeleteGame(ctx, redisClient, "game:123")
func DeleteGame(ctx context.Context, client *redis.Client, key string) error {
	err := client.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to delete game from Redis: %w", err)
	}

	return nil
}

// PublishEvent publishes an event to a Redis pub/sub channel.
// The event is marshaled to JSON before publishing.
//
// Usage:
//   event := map[string]interface{}{"type": "move", "position": 5}
//   err := redis.PublishEvent(ctx, redisClient, "game:123:events", event)
func PublishEvent(ctx context.Context, client *redis.Client, channel string, event interface{}) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = client.Publish(ctx, channel, string(data)).Err()
	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	return nil
}

// Subscribe subscribes to a Redis pub/sub channel and returns the subscription.
// The caller is responsible for closing the subscription when done.
//
// Usage:
//   pubsub := redis.Subscribe(ctx, redisClient, "game:123:events")
//   defer pubsub.Close()
//
//   for msg := range pubsub.Channel() {
//       log.Printf("Received: %s", msg.Payload)
//   }
func Subscribe(ctx context.Context, client *redis.Client, channel string) *redis.PubSub {
	return client.Subscribe(ctx, channel)
}

// getEnv retrieves an environment variable with a fallback default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
