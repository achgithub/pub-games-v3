package main

import "time"

// Group contains teams (e.g., "Premier League 25/26")
type Group struct {
	ID           int       `json:"id"`
	ManagerEmail string    `json:"managerEmail"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Team belongs to a group
type Team struct {
	ID        int       `json:"id"`
	GroupID   int       `json:"groupId"`
	Name      string    `json:"name"`
	Rank      int       `json:"rank"` // for auto-allocation (lower = stronger)
	CreatedAt time.Time `json:"createdAt"`
}

// Player in the manager's pool (reusable across games)
type Player struct {
	ID           int       `json:"id"`
	ManagerEmail string    `json:"managerEmail"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Game references a group and has assigned participants
type Game struct {
	ID           int       `json:"id"`
	ManagerEmail string    `json:"managerEmail"`
	Name         string    `json:"name"`
	GroupID      int       `json:"groupId"`
	Status       string    `json:"status"` // 'active', 'completed'
	WinnerName   *string   `json:"winnerName,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Participant in a game
type Participant struct {
	ID                int       `json:"id"`
	GameID            int       `json:"gameId"`
	PlayerName        string    `json:"playerName"`
	IsActive          bool      `json:"isActive"`
	EliminatedInRound *int      `json:"eliminatedInRound,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
}

// Round in a game
type Round struct {
	ID          int       `json:"id"`
	GameID      int       `json:"gameId"`
	RoundNumber int       `json:"roundNumber"`
	Status      string    `json:"status"` // 'open', 'closed'
	CreatedAt   time.Time `json:"createdAt"`
}

// Pick for a round
type Pick struct {
	ID           int       `json:"id"`
	GameID       int       `json:"gameId"`
	RoundID      int       `json:"roundId"`
	PlayerName   string    `json:"playerName"`
	TeamID       *int      `json:"teamId,omitempty"`
	Result       *string   `json:"result,omitempty"` // 'win', 'loss', 'draw', 'postponed'
	AutoAssigned bool      `json:"autoAssigned"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Request/Response types

type CreateGroupRequest struct {
	Name string `json:"name"`
}

type CreateTeamRequest struct {
	Name string `json:"name"`
	Rank int    `json:"rank"`
}

type UpdateTeamRequest struct {
	Name string `json:"name"`
	Rank int    `json:"rank"`
}

type CreatePlayerRequest struct {
	Name string `json:"name"`
}

type CreateGameRequest struct {
	Name         string   `json:"name"`
	GroupID      int      `json:"groupId"`
	PlayerNames  []string `json:"playerNames"`
}

type SavePicksRequest struct {
	Picks []struct {
		PlayerName string `json:"playerName"`
		TeamID     int    `json:"teamId"`
	} `json:"picks"`
}

type SaveResultsRequest struct {
	Results []struct {
		PickID int    `json:"pickId"`
		Result string `json:"result"` // 'win', 'loss', 'draw', 'postponed'
	} `json:"results"`
}

// Extended types with joined data

type GroupWithTeamCount struct {
	Group
	TeamCount int `json:"teamCount"`
}

type GameWithDetails struct {
	Game
	GroupName        string `json:"groupName"`
	ParticipantCount int    `json:"participantCount"`
	CurrentRound     int    `json:"currentRound"`
}

type PickWithTeamName struct {
	Pick
	TeamName string `json:"teamName"`
}

type ParticipantStatus struct {
	PlayerName        string  `json:"playerName"`
	IsActive          bool    `json:"isActive"`
	EliminatedInRound *int    `json:"eliminatedInRound,omitempty"`
	EliminationReason *string `json:"eliminationReason,omitempty"`
}
