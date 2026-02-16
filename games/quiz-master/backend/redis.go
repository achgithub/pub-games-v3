package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/go-redis/redis/v8"
)

var redisClient *redis.Client

func initRedis() {
	redisClient = redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:6379",
	})
	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis not available: %v", err)
	}
}

func sessionChannel(sessionID int) string {
	return fmt.Sprintf("quiz:session:%d:events", sessionID)
}

func lobbyChannel(sessionID int) string {
	return fmt.Sprintf("quiz:session:%d:lobby", sessionID)
}

func publishEvent(sessionID int, eventType string, payload interface{}) error {
	ctx := context.Background()
	data, err := json.Marshal(map[string]interface{}{
		"type":    eventType,
		"payload": payload,
	})
	if err != nil {
		return err
	}
	return redisClient.Publish(ctx, sessionChannel(sessionID), string(data)).Err()
}

func publishLobbyEvent(sessionID int, eventType string, payload interface{}) error {
	ctx := context.Background()
	data, err := json.Marshal(map[string]interface{}{
		"type":    eventType,
		"payload": payload,
	})
	if err != nil {
		return err
	}
	return redisClient.Publish(ctx, lobbyChannel(sessionID), string(data)).Err()
}

func subscribeToLobby(sessionID int) (*redis.PubSub, <-chan *redis.Message) {
	ctx := context.Background()
	pubsub := redisClient.Subscribe(ctx, lobbyChannel(sessionID))
	ch := pubsub.Channel()
	return pubsub, ch
}
