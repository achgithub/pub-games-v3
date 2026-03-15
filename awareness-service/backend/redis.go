package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

func InitializeRedis(addr string) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		DB:           0,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Println("Connected to Redis successfully")
	return client
}

// SetUserPresence sets or updates a user's presence
func SetUserPresence(ctx context.Context, client *redis.Client, userId, displayName, status, app, session, platform string) error {
	key := "presence:user:" + userId

	presence := map[string]interface{}{
		"userId":         userId,
		"displayName":    displayName,
		"status":         status,
		"currentApp":     app,
		"currentSession": session,
		"lastSeen":       time.Now().Unix(),
		"platform":       platform,
	}

	// Set hash with TTL
	if err := client.HSet(ctx, key, presence).Err(); err != nil {
		return err
	}

	if err := client.Expire(ctx, key, PresenceTTL).Err(); err != nil {
		return err
	}

	// Publish update event
	event := PresenceStreamEvent{
		Type: EventPresenceUpdate,
		User: PresenceUpdate{
			UserID:         userId,
			DisplayName:    displayName,
			Status:         status,
			CurrentApp:     app,
			CurrentSession: session,
			LastSeen:       time.Now().Unix(),
		},
	}

	eventData, _ := json.Marshal(event)
	client.Publish(ctx, "presence:updates", eventData)
	client.Publish(ctx, "presence:user:"+userId, eventData)

	return nil
}

// GetUserPresence retrieves a user's presence
func GetUserPresence(ctx context.Context, client *redis.Client, userId string) (*UserPresence, error) {
	key := "presence:user:" + userId

	data, err := client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		// User not in cache, return offline
		return &UserPresence{
			UserID:     userId,
			Status:     StatusOffline,
			LastSeen:   time.Now().Unix(),
		}, nil
	}

	presence := &UserPresence{
		UserID:         data["userId"],
		DisplayName:    data["displayName"],
		Status:         data["status"],
		CurrentApp:     data["currentApp"],
		CurrentSession: data["currentSession"],
		Platform:       data["platform"],
	}

	// Parse lastSeen as int64
	if lastSeen, ok := data["lastSeen"]; ok {
		var ts int64
		json.Unmarshal([]byte(lastSeen), &ts)
		presence.LastSeen = ts
	}

	return presence, nil
}

// GetAllPresence retrieves all online users
func GetAllPresence(ctx context.Context, client *redis.Client) ([]UserPresence, map[string]int, error) {
	// Scan for all presence keys
	var users []UserPresence
	statusCounts := map[string]int{
		StatusOnline:       0,
		StatusInGame:       0,
		StatusAway:         0,
		StatusOffline:      0,
		StatusDoNotDisturb: 0,
	}

	iter := client.Scan(ctx, 0, "presence:user:*", 0).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		data, err := client.HGetAll(ctx, key).Result()
		if err != nil {
			log.Printf("Error reading presence key %s: %v", key, err)
			continue
		}

		if len(data) == 0 {
			continue
		}

		presence := UserPresence{
			UserID:         data["userId"],
			DisplayName:    data["displayName"],
			Status:         data["status"],
			CurrentApp:     data["currentApp"],
			CurrentSession: data["currentSession"],
			Platform:       data["platform"],
		}

		if lastSeen, ok := data["lastSeen"]; ok {
			var ts int64
			json.Unmarshal([]byte(lastSeen), &ts)
			presence.LastSeen = ts
		}

		users = append(users, presence)
		statusCounts[presence.Status]++
	}

	if err := iter.Err(); err != nil {
		return nil, nil, err
	}

	return users, statusCounts, nil
}

// JoinSession adds a user to a session
func JoinSession(ctx context.Context, client *redis.Client, appId, sessionId, userId string) error {
	key := "session:app:" + appId + ":" + sessionId

	if err := client.HSet(ctx, key, userId, time.Now().Unix()).Err(); err != nil {
		return err
	}

	if err := client.Expire(ctx, key, SessionTTL).Err(); err != nil {
		return err
	}

	// Publish join event
	event := SessionStreamEvent{
		Type:   EventParticipantJoined,
		UserID: userId,
	}

	eventData, _ := json.Marshal(event)
	client.Publish(ctx, "session:app:"+appId+":"+sessionId, eventData)

	return nil
}

// LeaveSession removes a user from a session and sets grace period
func LeaveSession(ctx context.Context, client *redis.Client, appId, sessionId, userId string) error {
	key := "session:app:" + appId + ":" + sessionId

	// Remove from active participants
	if err := client.HDel(ctx, key, userId).Err(); err != nil {
		return err
	}

	// Set grace period (reconnection window)
	graceKey := "session:grace:" + appId + ":" + sessionId + ":" + userId
	if err := client.Set(ctx, graceKey, time.Now().Unix(), GracePeriodTTL).Err(); err != nil {
		return err
	}

	// Publish leave event with grace period
	event := SessionStreamEvent{
		Type:        EventParticipantLeft,
		UserID:      userId,
		GracePeriod: int(GracePeriodTTL.Seconds()),
	}

	eventData, _ := json.Marshal(event)
	client.Publish(ctx, "session:app:"+appId+":"+sessionId, eventData)

	return nil
}

// ReconnectSession handles a user reconnecting during grace period
func ReconnectSession(ctx context.Context, client *redis.Client, appId, sessionId, userId string) (bool, error) {
	graceKey := "session:grace:" + appId + ":" + sessionId + ":" + userId

	// Check if grace period still exists
	exists, err := client.Exists(ctx, graceKey).Result()
	if err != nil {
		return false, err
	}

	wasInGrace := exists == 1

	if wasInGrace {
		// Cancel grace period and rejoin
		if err := client.Del(ctx, graceKey).Err(); err != nil {
			return false, err
		}
	}

	// Rejoin session
	if err := JoinSession(ctx, client, appId, sessionId, userId); err != nil {
		return false, err
	}

	// Publish reconnect event
	event := SessionStreamEvent{
		Type:             EventParticipantReconnected,
		UserID:           userId,
		WasInGracePeriod: wasInGrace,
	}

	eventData, _ := json.Marshal(event)
	client.Publish(ctx, "session:app:"+appId+":"+sessionId, eventData)

	return wasInGrace, nil
}

// GetSessionParticipants retrieves all participants in a session
func GetSessionParticipants(ctx context.Context, client *redis.Client, appId, sessionId string) ([]SessionParticipant, error) {
	key := "session:app:" + appId + ":" + sessionId

	data, err := client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var participants []SessionParticipant
	for userId, joinedAtStr := range data {
		var joinedAt int64
		json.Unmarshal([]byte(joinedAtStr), &joinedAt)

		// Get user presence to include status
		presence, _ := GetUserPresence(ctx, client, userId)
		status := StatusOffline
		if presence != nil {
			status = presence.Status
		}

		participants = append(participants, SessionParticipant{
			UserID:   userId,
			JoinedAt: joinedAt,
			Status:   status,
		})
	}

	return participants, nil
}

// CancelGracePeriod marks a grace period as expired (user won't reconnect)
func CancelGracePeriod(ctx context.Context, client *redis.Client, appId, sessionId, userId string) error {
	graceKey := "session:grace:" + appId + ":" + sessionId + ":" + userId

	if err := client.Del(ctx, graceKey).Err(); err != nil {
		return err
	}

	// Publish grace expiry event
	event := SessionStreamEvent{
		Type:            EventGracePeriodExpired,
		UserID:          userId,
		CanClaimSession: true,
	}

	eventData, _ := json.Marshal(event)
	client.Publish(ctx, "session:app:"+appId+":"+sessionId, eventData)

	return nil
}

// GetOnlineUserCount returns count of online users
func GetOnlineUserCount(ctx context.Context, client *redis.Client) (int, error) {
	count, err := client.DBSize(ctx).Result()
	if err != nil {
		return 0, err
	}

	// Rough estimate - count presence keys
	iter := client.Scan(ctx, 0, "presence:user:*", 0).Iterator()
	var total int
	for iter.Next(ctx) {
		total++
	}

	if err := iter.Err(); err != nil {
		return 0, err
	}

	return total, nil
}
