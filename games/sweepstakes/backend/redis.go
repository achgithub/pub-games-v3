package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

var redisClient *redis.Client

// InitRedis initializes Redis connection
func InitRedis() error {
	redisHost := getEnv("REDIS_HOST", "127.0.0.1")
	redisPort := getEnv("REDIS_PORT", "6379")

	redisClient = redis.NewClient(&redis.Options{
		Addr: redisHost + ":" + redisPort,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := redisClient.Ping(ctx).Result()
	return err
}

// AcquireSelectionLock acquires a lock for a user in a competition
func AcquireSelectionLock(competitionID int, userID string, userName string) (bool, error) {
	ctx := context.Background()
	lockKey := fmt.Sprintf("lock:comp:%d", competitionID)

	// Try to set the lock with NX (only if doesn't exist) and EX (expiry of 2 minutes)
	lock := SelectionLock{
		CompetitionID: competitionID,
		UserID:        userID,
		UserName:      userName,
		LockedAt:      time.Now(),
	}

	lockJSON, err := json.Marshal(lock)
	if err != nil {
		return false, err
	}

	// Check if lock exists
	val, err := redisClient.Get(ctx, lockKey).Result()
	if err == nil {
		// Lock exists, check if it belongs to same user
		var existingLock SelectionLock
		if err := json.Unmarshal([]byte(val), &existingLock); err == nil && existingLock.UserID == userID {
			// Refresh the lock
			redisClient.Expire(ctx, lockKey, 2*time.Minute)
			return true, nil
		}
		// Lock belongs to different user
		return false, nil
	} else if err != redis.Nil {
		return false, err
	}

	// Try to acquire lock
	ok, err := redisClient.SetNX(ctx, lockKey, lockJSON, 2*time.Minute).Result()
	return ok, err
}

// ReleaseSelectionLock releases a lock for a user in a competition
func ReleaseSelectionLock(competitionID int, userID string) error {
	ctx := context.Background()
	lockKey := fmt.Sprintf("lock:comp:%d", competitionID)

	// Check if this user owns the lock
	val, err := redisClient.Get(ctx, lockKey).Result()
	if err != nil {
		return nil // Lock doesn't exist
	}

	var lock SelectionLock
	if err := json.Unmarshal([]byte(val), &lock); err == nil && lock.UserID == userID {
		redisClient.Del(ctx, lockKey)
	}

	return nil
}

// CheckSelectionLock checks if a competition is locked
func CheckSelectionLock(competitionID int, userID string) (*SelectionLock, error) {
	ctx := context.Background()
	lockKey := fmt.Sprintf("lock:comp:%d", competitionID)

	val, err := redisClient.Get(ctx, lockKey).Result()
	if err == redis.Nil {
		return nil, nil // No lock
	} else if err != nil {
		return nil, err
	}

	var lock SelectionLock
	if err := json.Unmarshal([]byte(val), &lock); err != nil {
		return nil, err
	}

	return &lock, nil
}

// GetSelectionLock returns lock details if it exists
func GetSelectionLock(competitionID int) (*SelectionLock, error) {
	ctx := context.Background()
	lockKey := fmt.Sprintf("lock:comp:%d", competitionID)

	val, err := redisClient.Get(ctx, lockKey).Result()
	if err == redis.Nil {
		return nil, nil // No lock
	} else if err != nil {
		return nil, err
	}

	var lock SelectionLock
	if err := json.Unmarshal([]byte(val), &lock); err != nil {
		return nil, err
	}

	return &lock, nil
}
