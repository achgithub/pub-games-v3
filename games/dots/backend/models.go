package main

// GameStatus represents the current state of a game
type GameStatus string

const (
	GameStatusWaiting   GameStatus = "waiting"   // Waiting for players
	GameStatusActive    GameStatus = "active"    // Game in progress
	GameStatusCompleted GameStatus = "completed" // Game finished
	GameStatusAbandoned GameStatus = "abandoned" // Player disconnected
)

// Line represents a line on the dots grid
// Lines are identified by their position and orientation
type Line struct {
	Row         int  `json:"row"`         // Row index
	Col         int  `json:"col"`         // Column index
	Horizontal  bool `json:"horizontal"`  // true = horizontal, false = vertical
	DrawnBy     int  `json:"drawnBy"`     // 0 = not drawn, 1 = player1, 2 = player2
}

// Box represents a completed box on the grid
type Box struct {
	Row      int `json:"row"`      // Row of the box (0-indexed)
	Col      int `json:"col"`      // Column of the box (0-indexed)
	OwnedBy  int `json:"ownedBy"`  // 0 = not complete, 1 = player1, 2 = player2
}

// Game represents a dots-and-boxes game
type Game struct {
	ID            string     `json:"id"`
	ChallengeID   string     `json:"challengeId"`
	Player1ID     string     `json:"player1Id"`
	Player1Name   string     `json:"player1Name"`
	Player2ID     string     `json:"player2Id"`
	Player2Name   string     `json:"player2Name"`
	GridSize      int        `json:"gridSize"`      // Deprecated: use GridWidth/GridHeight. Kept for backward compat
	GridWidth     int        `json:"gridWidth"`     // Number of dots horizontally (columns)
	GridHeight    int        `json:"gridHeight"`    // Number of dots vertically (rows)
	Lines         []Line     `json:"lines"`         // All lines on the grid
	Boxes         []Box      `json:"boxes"`         // All boxes on the grid
	CurrentTurn   int        `json:"currentTurn"`   // 1 or 2
	Player1Score  int        `json:"player1Score"`  // Number of boxes owned
	Player2Score  int        `json:"player2Score"`
	Status        GameStatus `json:"status"`
	WinnerID      *string    `json:"winnerId"`
	LastMoveAt    int64      `json:"lastMoveAt"`
	CreatedAt     int64      `json:"createdAt"`
	CompletedAt   *int64     `json:"completedAt"`
}

// MoveRequest represents a request to draw a line
type MoveRequest struct {
	GameID     string `json:"gameId"`
	PlayerID   string `json:"playerId"`
	Row        int    `json:"row"`
	Col        int    `json:"col"`
	Horizontal bool   `json:"horizontal"`
}

// Config holds app configuration
type Config struct {
	AppName string `json:"app_name"`
	AppIcon string `json:"app_icon"`
	Version string `json:"version"`
}

// SSE message types
// Client -> Server: "move" (via HTTP POST)
// Server -> Client: "connected", "game_state", "opponent_connected", "opponent_disconnected", "game_ended", "error"
