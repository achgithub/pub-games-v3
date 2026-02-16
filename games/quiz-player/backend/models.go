package main

import "time"

type Session struct {
	ID          int        `json:"id"`
	PackID      int        `json:"packId"`
	Name        string     `json:"name"`
	Mode        string     `json:"mode"` // team | individual
	Status      string     `json:"status"` // lobby | active | completed
	JoinCode    string     `json:"joinCode"`
	CreatedAt   time.Time  `json:"createdAt"`
	StartedAt   *time.Time `json:"startedAt"`
	CompletedAt *time.Time `json:"completedAt"`
}

type Team struct {
	ID        int    `json:"id"`
	SessionID int    `json:"sessionId"`
	Name      string `json:"name"`
	JoinCode  string `json:"joinCode"`
}

type SessionPlayer struct {
	ID        int    `json:"id"`
	SessionID int    `json:"sessionId"`
	UserEmail string `json:"userEmail"`
	UserName  string `json:"userName"`
	TeamID    *int   `json:"teamId"`
}

type SessionState struct {
	Session  Session  `json:"session"`
	Teams    []Team   `json:"teams"`
	MyTeamID *int     `json:"myTeamId"`
	MyPlayer *SessionPlayer `json:"myPlayer"`
}

type SSEEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}
