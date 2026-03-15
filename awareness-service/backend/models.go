package main

import "time"

// UserPresence represents a user's current presence status
type UserPresence struct {
	UserID       string    `json:"userId"`
	DisplayName  string    `json:"displayName"`
	Status       string    `json:"status"` // online, in_game, away, offline
	CurrentApp   string    `json:"currentApp"`
	CurrentSession string  `json:"currentSession"`
	LastSeen     int64     `json:"lastSeen"`
	Platform     string    `json:"platform"` // web, ios, android
}

// PresenceUpdate represents a presence change event
type PresenceUpdate struct {
	UserID         string    `json:"userId"`
	DisplayName    string    `json:"displayName"`
	Status         string    `json:"status"`
	CurrentApp     string    `json:"currentApp"`
	CurrentSession string    `json:"currentSession"`
	LastSeen       int64     `json:"lastSeen"`
}

// AllPresenceResponse represents all online users
type AllPresenceResponse struct {
	Users    []UserPresence `json:"users"`
	Total    int            `json:"total"`
	ByStatus map[string]int `json:"byStatus"`
}

// HeartbeatRequest is the payload for heartbeat
type HeartbeatRequest struct {
	UserID         string `json:"userId"`
	DisplayName    string `json:"displayName"`
	Status         string `json:"status"`
	CurrentApp     string `json:"currentApp"`
	CurrentSession string `json:"currentSession"`
	Platform       string `json:"platform"`
}

// HeartbeatResponse is the response to heartbeat
type HeartbeatResponse struct {
	Success bool `json:"success"`
	TTL     int  `json:"ttl"`
}

// StatusUpdateRequest is the payload for status updates
type StatusUpdateRequest struct {
	UserID         string `json:"userId"`
	Status         string `json:"status"`
	CurrentApp     string `json:"currentApp"`
	CurrentSession string `json:"currentSession"`
}

// SessionJoinRequest is the payload for joining a session
type SessionJoinRequest struct {
	UserID    string `json:"userId"`
	AppID     string `json:"appId"`
	SessionID string `json:"sessionId"`
}

// SessionLeaveRequest is the payload for leaving a session
type SessionLeaveRequest struct {
	UserID    string `json:"userId"`
	AppID     string `json:"appId"`
	SessionID string `json:"sessionId"`
}

// SessionParticipant represents a participant in a session
type SessionParticipant struct {
	UserID    string `json:"userId"`
	JoinedAt  int64  `json:"joinedAt"`
	Status    string `json:"status"`
}

// SessionResponse represents a session's participants
type SessionResponse struct {
	Success      bool                   `json:"success"`
	SessionID    string                 `json:"sessionId"`
	AppID        string                 `json:"appId"`
	Participants []SessionParticipant   `json:"participants"`
	Count        int                    `json:"count"`
}

// SSE Events
type SSEEvent struct {
	Event string      `json:"-"`
	Data  interface{} `json:"data"`
}

// PresenceStreamEvent represents an event in the presence stream
type PresenceStreamEvent struct {
	Type   string         `json:"type"` // presence_update, user_online, user_offline
	User   PresenceUpdate `json:"user"`
	Status map[string]int `json:"byStatus,omitempty"`
}

// SessionStreamEvent represents an event in the session stream
type SessionStreamEvent struct {
	Type              string    `json:"type"` // participant_joined, participant_left, participant_reconnected, grace_period_expired
	UserID            string    `json:"userId"`
	WasInGracePeriod  bool      `json:"wasInGracePeriod,omitempty"`
	CanClaimSession   bool      `json:"canClaimSession,omitempty"`
	GracePeriod       int       `json:"gracePeriod,omitempty"`
}

// PresenceEvent for database logging
type PresenceEvent struct {
	ID        int       `db:"id"`
	UserID    string    `db:"user_id"`
	EventType string    `db:"event_type"`
	AppID     *string   `db:"app_id"`
	SessionID *string   `db:"session_id"`
	Timestamp time.Time `db:"timestamp"`
}

// SessionEvent for database logging
type SessionEvent struct {
	ID        int       `db:"id"`
	SessionID string    `db:"session_id"`
	AppID     string    `db:"app_id"`
	UserID    string    `db:"user_id"`
	EventType string    `db:"event_type"`
	Timestamp time.Time `db:"timestamp"`
}

// Constants for status values
const (
	StatusOnline     = "online"
	StatusInGame     = "in_game"
	StatusAway       = "away"
	StatusOffline    = "offline"
	StatusDoNotDisturb = "do_not_disturb"
)

// Constants for TTLs
const (
	PresenceTTL       = 45 * time.Second    // How long presence persists without heartbeat
	HeartbeatInterval = 20 * time.Second    // Client should heartbeat this often
	GracePeriodTTL    = 30 * time.Second    // Reconnection window
	SessionTTL        = 1 * time.Hour       // How long a session persists
)

// Constants for events
const (
	EventPresenceUpdate = "presence_update"
	EventUserOnline     = "user_online"
	EventUserOffline    = "user_offline"
	EventParticipantJoined = "participant_joined"
	EventParticipantLeft   = "participant_left"
	EventParticipantReconnected = "participant_reconnected"
	EventGracePeriodExpired = "grace_period_expired"
)
