package main

import (
	"context"
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

func subscribeToSession(sessionID int) (*redis.PubSub, <-chan *redis.Message) {
	ctx := context.Background()
	pubsub := redisClient.Subscribe(ctx, sessionChannel(sessionID))
	ch := pubsub.Channel()
	return pubsub, ch
}
