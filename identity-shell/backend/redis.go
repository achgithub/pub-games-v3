package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
)

var redisClient *redis.Client
var ctx = context.Background()

// InitRedis initializes the Redis connection
func InitRedis() error {
	redisClient = redis.NewClient(&redis.Options{
		Addr:     getEnv("REDIS_HOST", "127.0.0.1") + ":" + getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       0,
	})

	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return nil
}

// SetUserPresence updates a user's presence in Redis with 30s TTL
func SetUserPresence(email, name, status, currentApp string) error {
	key := fmt.Sprintf("user:presence:%s", email)
	presence := map[string]interface{}{
		"email":       email,
		"displayName": name,
		"status":      status,
		"currentApp":  currentApp,
		"lastSeen":    time.Now().Unix(),
	}

	data, err := json.Marshal(presence)
	if err != nil {
		return fmt.Errorf("failed to marshal presence: %w", err)
	}

	if err := redisClient.Set(ctx, key, data, 30*time.Second).Err(); err != nil {
		return err
	}

	// Notify all users about presence change
	redisClient.Publish(ctx, "presence:updates", "presence_update")

	return nil
}

// GetOnlineUsers retrieves all currently online users from Redis
func GetOnlineUsers() ([]UserPresence, error) {
	keys, err := redisClient.Keys(ctx, "user:presence:*").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get presence keys: %w", err)
	}

	users := []UserPresence{}
	for _, key := range keys {
		data, err := redisClient.Get(ctx, key).Result()
		if err != nil {
			continue // Key expired between Keys() and Get()
		}

		var presence UserPresence
		if err := json.Unmarshal([]byte(data), &presence); err != nil {
			continue
		}
		users = append(users, presence)
	}

	return users, nil
}

// RemoveUserPresence removes a user's presence from Redis
func RemoveUserPresence(email string) error {
	key := fmt.Sprintf("user:presence:%s", email)
	if err := redisClient.Del(ctx, key).Err(); err != nil {
		return err
	}

	// Notify all users about presence change
	redisClient.Publish(ctx, "presence:updates", "presence_update")

	return nil
}

// IsUserOnline checks if a specific user is currently online
func IsUserOnline(email string) (bool, error) {
	key := fmt.Sprintf("user:presence:%s", email)
	exists, err := redisClient.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return exists > 0, nil
}

// HasPendingChallengeBetween checks if there's already a pending challenge between two users (in either direction)
func HasPendingChallengeBetween(user1, user2 string) (bool, error) {
	// Check user1's received challenges for any from user2
	receivedKey := fmt.Sprintf("user:challenges:received:%s", user1)
	receivedIDs, err := redisClient.LRange(ctx, receivedKey, 0, -1).Result()
	if err == nil {
		for _, id := range receivedIDs {
			challengeKey := fmt.Sprintf("challenge:%s", id)
			data, err := redisClient.Get(ctx, challengeKey).Result()
			if err != nil {
				continue
			}
			var challenge Challenge
			if err := json.Unmarshal([]byte(data), &challenge); err != nil {
				continue
			}
			if challenge.FromUser == user2 && challenge.Status == "pending" {
				return true, nil
			}
		}
	}

	// Check user1's sent challenges for any to user2
	sentKey := fmt.Sprintf("user:challenges:sent:%s", user1)
	sentIDs, err := redisClient.LRange(ctx, sentKey, 0, -1).Result()
	if err == nil {
		for _, id := range sentIDs {
			challengeKey := fmt.Sprintf("challenge:%s", id)
			data, err := redisClient.Get(ctx, challengeKey).Result()
			if err != nil {
				continue
			}
			var challenge Challenge
			if err := json.Unmarshal([]byte(data), &challenge); err != nil {
				continue
			}
			if challenge.ToUser == user2 && challenge.Status == "pending" {
				return true, nil
			}
		}
	}

	return false, nil
}

// CreateChallenge creates a new challenge in Redis with 60s TTL
func CreateChallenge(fromUser, toUser, appID string, options map[string]interface{}) (string, error) {
	// Check if there's already a pending challenge between these users
	hasPending, err := HasPendingChallengeBetween(fromUser, toUser)
	if err != nil {
		return "", fmt.Errorf("failed to check for pending challenges: %w", err)
	}
	if hasPending {
		return "", fmt.Errorf("there is already a pending challenge between these users")
	}

	challengeID := fmt.Sprintf("%d-%s", time.Now().UnixNano(), fromUser)
	key := fmt.Sprintf("challenge:%s", challengeID)

	challenge := map[string]interface{}{
		"id":        challengeID,
		"fromUser":  fromUser,
		"toUser":    toUser,
		"appId":     appID,
		"status":    "pending",
		"createdAt": time.Now().Unix(),
		"expiresAt": time.Now().Add(60 * time.Second).Unix(),
		"options":   options,
	}

	data, err := json.Marshal(challenge)
	if err != nil {
		return "", fmt.Errorf("failed to marshal challenge: %w", err)
	}

	// Store challenge with 60s TTL
	if err := redisClient.Set(ctx, key, data, 60*time.Second).Err(); err != nil {
		return "", fmt.Errorf("failed to store challenge: %w", err)
	}

	// Add to recipient's challenge queue
	recipientQueueKey := fmt.Sprintf("user:challenges:received:%s", toUser)
	if err := redisClient.LPush(ctx, recipientQueueKey, challengeID).Err(); err != nil {
		return "", fmt.Errorf("failed to add to recipient queue: %w", err)
	}
	redisClient.Expire(ctx, recipientQueueKey, 5*time.Minute)

	// Add to sender's challenge queue
	senderQueueKey := fmt.Sprintf("user:challenges:sent:%s", fromUser)
	if err := redisClient.LPush(ctx, senderQueueKey, challengeID).Err(); err != nil {
		return "", fmt.Errorf("failed to add to sender queue: %w", err)
	}
	redisClient.Expire(ctx, senderQueueKey, 5*time.Minute)

	// Publish notification to recipient
	channel := fmt.Sprintf("user:%s", toUser)
	if err := redisClient.Publish(ctx, channel, "challenge_received").Err(); err != nil {
		return challengeID, fmt.Errorf("challenge created but notification failed: %w", err)
	}

	return challengeID, nil
}

// CreateMultiChallenge creates a new multi-player challenge in Redis with 120s TTL
func CreateMultiChallenge(initiatorID string, playerIDs []string, appID string, minPlayers, maxPlayers int, options map[string]interface{}) (string, error) {
	challengeID := fmt.Sprintf("%d-%s", time.Now().UnixNano(), initiatorID)
	key := fmt.Sprintf("challenge:%s", challengeID)

	challenge := map[string]interface{}{
		"id":          challengeID,
		"initiatorId": initiatorID,
		"playerIds":   playerIDs,
		"accepted":    []string{},       // Empty array initially
		"appId":       appID,
		"minPlayers":  minPlayers,
		"maxPlayers":  maxPlayers,
		"status":      "pending",
		"createdAt":   time.Now().Unix(),
		"expiresAt":   time.Now().Add(120 * time.Second).Unix(), // Longer TTL for multi-player
		"options":     options,
	}

	data, err := json.Marshal(challenge)
	if err != nil {
		return "", fmt.Errorf("failed to marshal challenge: %w", err)
	}

	// Store challenge with 120s TTL
	if err := redisClient.Set(ctx, key, data, 120*time.Second).Err(); err != nil {
		return "", fmt.Errorf("failed to store challenge: %w", err)
	}

	// Add to each player's challenge queue (except initiator)
	for _, playerID := range playerIDs {
		if playerID == initiatorID {
			continue // Don't send to self
		}

		recipientQueueKey := fmt.Sprintf("user:challenges:received:%s", playerID)
		if err := redisClient.LPush(ctx, recipientQueueKey, challengeID).Err(); err != nil {
			return "", fmt.Errorf("failed to add to recipient queue: %w", err)
		}
		redisClient.Expire(ctx, recipientQueueKey, 5*time.Minute)

		// Publish notification to each player
		channel := fmt.Sprintf("user:%s", playerID)
		if err := redisClient.Publish(ctx, channel, "challenge_received").Err(); err != nil {
			log.Printf("Failed to notify player %s: %v", playerID, err)
		}
	}

	// Add to initiator's sent challenges queue
	senderQueueKey := fmt.Sprintf("user:challenges:sent:%s", initiatorID)
	if err := redisClient.LPush(ctx, senderQueueKey, challengeID).Err(); err != nil {
		return "", fmt.Errorf("failed to add to sender queue: %w", err)
	}
	redisClient.Expire(ctx, senderQueueKey, 5*time.Minute)

	log.Printf("✅ Multi-player challenge %s created for %d players", challengeID, len(playerIDs))

	return challengeID, nil
}

// GetUserChallenges retrieves all active challenges received by a user
func GetUserChallenges(email string) ([]Challenge, error) {
	queueKey := fmt.Sprintf("user:challenges:received:%s", email)
	return getChallengesFromQueue(queueKey)
}

// GetSentChallenges retrieves all active challenges sent by a user
func GetSentChallenges(email string) ([]Challenge, error) {
	queueKey := fmt.Sprintf("user:challenges:sent:%s", email)
	challenges, err := getChallengesFromQueue(queueKey)
	if err != nil {
		return nil, err
	}

	// Filter out challenges where recipient is offline >5s
	validChallenges := []Challenge{}
	for _, challenge := range challenges {
		online, err := IsUserOnline(challenge.ToUser)
		if err == nil && online {
			validChallenges = append(validChallenges, challenge)
		} else {
			// Recipient offline, remove from sender's queue
			redisClient.LRem(ctx, queueKey, 1, challenge.ID)
		}
	}

	return validChallenges, nil
}

// getChallengesFromQueue is a helper to fetch challenges from a queue
func getChallengesFromQueue(queueKey string) ([]Challenge, error) {
	challengeIDs, err := redisClient.LRange(ctx, queueKey, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get challenge queue: %w", err)
	}

	challenges := []Challenge{}
	for _, id := range challengeIDs {
		key := fmt.Sprintf("challenge:%s", id)
		data, err := redisClient.Get(ctx, key).Result()
		if err != nil {
			// Challenge expired, remove from queue
			redisClient.LRem(ctx, queueKey, 1, id)
			continue
		}

		var challenge Challenge
		if err := json.Unmarshal([]byte(data), &challenge); err != nil {
			continue
		}
		challenges = append(challenges, challenge)
	}

	return challenges, nil
}

// UpdateChallengeStatus updates a challenge's status and notifies the challenger
func UpdateChallengeStatus(challengeID, status string) error {
	key := fmt.Sprintf("challenge:%s", challengeID)

	// Get current challenge
	data, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("challenge not found or expired")
	}

	var challenge map[string]interface{}
	if err := json.Unmarshal([]byte(data), &challenge); err != nil {
		return fmt.Errorf("failed to parse challenge: %w", err)
	}

	// Update status
	challenge["status"] = status
	challenge["respondedAt"] = time.Now().Unix()

	newData, err := json.Marshal(challenge)
	if err != nil {
		return fmt.Errorf("failed to marshal updated challenge: %w", err)
	}

	// If accepted/rejected, set shorter TTL (5s for notification, then cleanup)
	ttl := 5 * time.Second
	if err := redisClient.Set(ctx, key, newData, ttl).Err(); err != nil {
		return fmt.Errorf("failed to update challenge: %w", err)
	}

	// Remove from both sender and recipient queues
	toUser := challenge["toUser"].(string)
	fromUser := challenge["fromUser"].(string)

	recipientQueueKey := fmt.Sprintf("user:challenges:received:%s", toUser)
	senderQueueKey := fmt.Sprintf("user:challenges:sent:%s", fromUser)

	redisClient.LRem(ctx, recipientQueueKey, 1, challengeID)
	redisClient.LRem(ctx, senderQueueKey, 1, challengeID)

	// Notify challenger
	channel := fmt.Sprintf("user:%s", fromUser)
	if err := redisClient.Publish(ctx, channel, status).Err(); err != nil {
		return fmt.Errorf("challenge updated but notification failed: %w", err)
	}

	return nil
}

// SubscribeToUserEvents creates a Redis pub/sub subscription for user notifications
func SubscribeToUserEvents(email string) *redis.PubSub {
	userChannel := fmt.Sprintf("user:%s", email)
	// Subscribe to both user-specific channel and global presence updates
	return redisClient.Subscribe(ctx, userChannel, "presence:updates")
}

// GetChallenge retrieves a challenge by ID from Redis
func GetChallenge(challengeID string) (*Challenge, error) {
	key := fmt.Sprintf("challenge:%s", challengeID)
	data, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("challenge not found or expired")
	}

	var challenge Challenge
	if err := json.Unmarshal([]byte(data), &challenge); err != nil {
		return nil, fmt.Errorf("failed to parse challenge: %w", err)
	}

	return &challenge, nil
}

// GetUserPresence retrieves a user's presence info from Redis
func GetUserPresence(email string) (*UserPresence, error) {
	key := fmt.Sprintf("user:presence:%s", email)
	data, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("user not found or offline")
	}

	var presence UserPresence
	if err := json.Unmarshal([]byte(data), &presence); err != nil {
		return nil, fmt.Errorf("failed to parse presence: %w", err)
	}

	return &presence, nil
}

// PublishGameStarted notifies a user that a game has started
func PublishGameStarted(email, appID, gameID string) error {
	channel := fmt.Sprintf("user:%s", email)
	payload := fmt.Sprintf("game_started:%s:%s", appID, gameID)
	return redisClient.Publish(ctx, channel, payload).Err()
}

// AcceptMultiPlayerChallenge adds a player to the accepted list
// Returns: (readyToStart, error)
func AcceptMultiPlayerChallenge(challengeID, acceptingUser string) (bool, error) {
	key := fmt.Sprintf("challenge:%s", challengeID)

	// Get current challenge
	data, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("challenge not found or expired")
	}

	var challengeData map[string]interface{}
	if err := json.Unmarshal([]byte(data), &challengeData); err != nil {
		return false, fmt.Errorf("failed to parse challenge: %w", err)
	}

	// Convert accepted array
	acceptedRaw, _ := challengeData["accepted"].([]interface{})
	accepted := []string{}
	for _, a := range acceptedRaw {
		if aStr, ok := a.(string); ok {
			accepted = append(accepted, aStr)
		}
	}

	// Check if user already accepted
	for _, a := range accepted {
		if a == acceptingUser {
			return false, fmt.Errorf("user has already accepted this challenge")
		}
	}

	// Add to accepted list
	accepted = append(accepted, acceptingUser)
	challengeData["accepted"] = accepted

	minPlayers := int(challengeData["minPlayers"].(float64))

	// Check if we have enough players to start
	readyToStart := len(accepted) >= minPlayers

	if readyToStart {
		challengeData["status"] = "ready"
	}

	// Update challenge in Redis
	newData, err := json.Marshal(challengeData)
	if err != nil {
		return false, fmt.Errorf("failed to marshal updated challenge: %w", err)
	}

	// Keep longer TTL if still waiting, shorter if ready
	ttl := 120 * time.Second
	if readyToStart {
		ttl = 30 * time.Second // Give time for game creation
	}

	if err := redisClient.Set(ctx, key, newData, ttl).Err(); err != nil {
		return false, fmt.Errorf("failed to update challenge: %w", err)
	}

	return readyToStart, nil
}

// PublishChallengeUpdate notifies the initiator about challenge acceptance progress
func PublishChallengeUpdate(challenge *Challenge) error {
	channel := fmt.Sprintf("user:%s", challenge.InitiatorID)
	payload := fmt.Sprintf("challenge_update:%s", challenge.ID)
	return redisClient.Publish(ctx, channel, payload).Err()
}
