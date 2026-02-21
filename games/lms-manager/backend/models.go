package main

import "time"

// ManagedTeam represents a team in the manager's master data
type ManagedTeam struct {
	ID           int       `json:"id"`
	ManagerEmail string    `json:"managerEmail"`
	TeamName     string    `json:"teamName"`
	CreatedAt    time.Time `json:"createdAt"`
}

// ManagedPlayer represents a player in the manager's master data
type ManagedPlayer struct {
	ID             int       `json:"id"`
	ManagerEmail   string    `json:"managerEmail"`
	PlayerNickname string    `json:"playerNickname"`
	CreatedAt      time.Time `json:"createdAt"`
}

// ManagedGame represents a managed LMS game
type ManagedGame struct {
	ID           int       `json:"id"`
	ManagerEmail string    `json:"managerEmail"`
	GameName     string    `json:"gameName"`
	Status       string    `json:"status"` // active, completed
	WinnerNames  []string  `json:"winnerNames"`
	CreatedAt    time.Time `json:"createdAt"`
}

// ManagedGameTeam represents a team selected for a game
type ManagedGameTeam struct {
	ID       int    `json:"id"`
	GameID   int    `json:"gameId"`
	TeamName string `json:"teamName"`
}

// ManagedGamePlayer represents a player in a game
type ManagedGamePlayer struct {
	ID              int       `json:"id"`
	GameID          int       `json:"gameId"`
	PlayerNickname  string    `json:"playerNickname"`
	Status          string    `json:"status"` // active, eliminated, winner
	EliminatedRound *int      `json:"eliminatedRound,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}

// ManagedRound represents a round in a game
type ManagedRound struct {
	ID          int       `json:"id"`
	GameID      int       `json:"gameId"`
	RoundNumber int       `json:"roundNumber"`
	Status      string    `json:"status"` // open, closed
	CreatedAt   time.Time `json:"createdAt"`
}

// ManagedPick represents a player's pick in a round
type ManagedPick struct {
	ID             int       `json:"id"`
	GameID         int       `json:"gameId"`
	RoundID        int       `json:"roundId"`
	PlayerNickname string    `json:"playerNickname"`
	TeamName       string    `json:"teamName"`
	Result         *string   `json:"result,omitempty"` // NULL, win, lose
	CreatedAt      time.Time `json:"createdAt"`
}

// GameReport represents the full game state for reporting
type GameReport struct {
	GameID       int           `json:"gameId"`
	GameName     string        `json:"gameName"`
	ManagerEmail string        `json:"managerEmail"`
	Status       string        `json:"status"`
	WinnerNames  []string      `json:"winnerNames"`
	Rounds       []RoundReport `json:"rounds"`
}

// RoundReport represents a round's state for reporting
type RoundReport struct {
	RoundNumber    int           `json:"roundNumber"`
	Status         string        `json:"status"`
	ActivePlayers  int           `json:"activePlayers"`
	TeamSummary    []TeamSummary `json:"teamSummary"`
	EliminatedList []string      `json:"eliminatedList"`
}

// TeamSummary represents team selection counts (anonymous)
type TeamSummary struct {
	TeamName      string `json:"teamName"`
	Count         int    `json:"count"`
	ManagerPicked bool   `json:"managerPicked"` // ⭐ if manager picked this team
}

// Config holds app configuration
type Config struct {
	AppName string `json:"app_name"`
	AppIcon string `json:"app_icon"`
	Version string `json:"version"`
}
