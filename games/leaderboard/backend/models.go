package main

import "time"

// GameResult represents the outcome of a completed game
type GameResult struct {
	ID         int       `json:"id"`
	GameType   string    `json:"gameType"`   // e.g., "tic-tac-toe", "dots"
	GameID     string    `json:"gameId"`     // The specific game instance ID
	WinnerID   string    `json:"winnerId"`   // Email of winner (empty if draw)
	WinnerName string    `json:"winnerName"`
	LoserID    string    `json:"loserId"`    // Email of loser (empty if draw)
	LoserName  string    `json:"loserName"`
	IsDraw     bool      `json:"isDraw"`
	Score      string    `json:"score"`      // e.g., "3-2" for first-to-3
	Duration   int       `json:"duration"`   // Game duration in seconds
	PlayedAt   time.Time `json:"playedAt"`
}

// PlayerStats represents a player's stats for a specific game type
type PlayerStats struct {
	PlayerID   string  `json:"playerId"`
	PlayerName string  `json:"playerName"`
	GameType   string  `json:"gameType"`
	Wins       int     `json:"wins"`
	Losses     int     `json:"losses"`
	Draws      int     `json:"draws"`
	TotalGames int     `json:"totalGames"`
	WinRate    float64 `json:"winRate"`
}

// Standing represents a player's position in the leaderboard
type Standing struct {
	Rank       int     `json:"rank"`
	PlayerID   string  `json:"playerId"`
	PlayerName string  `json:"playerName"`
	Wins       int     `json:"wins"`
	Losses     int     `json:"losses"`
	Draws      int     `json:"draws"`
	TotalGames int     `json:"totalGames"`
	WinRate    float64 `json:"winRate"`
	Points     int     `json:"points"` // 3 for win, 1 for draw, 0 for loss
}

// Config holds app configuration
type Config struct {
	AppName string `json:"app_name"`
	AppIcon string `json:"app_icon"`
	Version string `json:"version"`
}
