package main

import "time"

// GameMode represents the type of game
type GameMode string

const (
	GameModeNormal GameMode = "normal" // No time limit per move
	GameModeTimed  GameMode = "timed"  // Time limit per move
)

// GameStatus represents the current state of a game
type GameStatus string

const (
	GameStatusActive    GameStatus = "active"    // Game in progress
	GameStatusCompleted GameStatus = "completed" // Game finished
	GameStatusAbandoned GameStatus = "abandoned" // Player disconnected/timeout
)

// Game represents a tic-tac-toe game session
type Game struct {
	ID            string     `json:"id"`
	ChallengeID   string     `json:"challengeId,omitempty"`
	Player1ID     int        `json:"player1Id"`
	Player1Name   string     `json:"player1Name"`
	Player1Symbol string     `json:"player1Symbol"` // "X" or "O"
	Player2ID     int        `json:"player2Id"`
	Player2Name   string     `json:"player2Name"`
	Player2Symbol string     `json:"player2Symbol"` // "X" or "O"
	Board         []string   `json:"board"`         // Array of 9 cells
	CurrentTurn   int        `json:"currentTurn"`   // 1 or 2 (player number)
	Status        GameStatus `json:"status"`
	Mode          GameMode   `json:"mode"`
	MoveTimeLimit int        `json:"moveTimeLimit"` // Seconds (0 = unlimited)
	FirstTo       int        `json:"firstTo"`       // First to X wins (1,2,3,5,10,20)
	Player1Score  int        `json:"player1Score"`  // Wins in this series
	Player2Score  int        `json:"player2Score"`  // Wins in this series
	CurrentRound  int        `json:"currentRound"`  // Which round in the series
	WinnerID      *int       `json:"winnerId"`      // NULL during play
	LastMoveAt    int64      `json:"lastMoveAt"`    // Unix timestamp
	CreatedAt     int64      `json:"createdAt"`     // Unix timestamp
	CompletedAt   *int64     `json:"completedAt,omitempty"`
}

// Move represents a single move in a game
type Move struct {
	GameID     string `json:"gameId"`
	PlayerID   int    `json:"playerId"`
	Position   int    `json:"position"`   // 0-8
	Symbol     string `json:"symbol"`     // "X" or "O"
	MoveNumber int    `json:"moveNumber"` // 1, 2, 3, etc.
}

// MoveRequest represents a move request from client
type MoveRequest struct {
	GameID   string `json:"gameId"`
	PlayerID int    `json:"playerId"`
	Position int    `json:"position"` // 0-8
}

// PlayerStats represents player statistics
type PlayerStats struct {
	UserID         int     `json:"userId"`
	UserName       string  `json:"userName"`
	GamesPlayed    int     `json:"gamesPlayed"`
	GamesWon       int     `json:"gamesWon"`
	GamesLost      int     `json:"gamesLost"`
	GamesDraw      int     `json:"gamesDraw"`
	TotalMoves     int     `json:"totalMoves"`
	FastestWinMove *int    `json:"fastestWinMove,omitempty"`
	WinRate        float64 `json:"winRate"`
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// Message types:
// Client -> Server: "ping", "ack", "move"
// Server -> Client: "pong", "ready", "move_update", "game_ended", "opponent_disconnected", "error"

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
	Details string `json:"details,omitempty"`
}
