package main

import "time"

// checkWinner checks if there's a winner on the board
// Returns: winnerSymbol ("X" or "O"), isWinner (true/false), isDraw (true/false)
func checkWinner(board []string) (string, bool, bool) {
	// Winning combinations (indices)
	winPatterns := [][]int{
		{0, 1, 2}, // Top row
		{3, 4, 5}, // Middle row
		{6, 7, 8}, // Bottom row
		{0, 3, 6}, // Left column
		{1, 4, 7}, // Middle column
		{2, 5, 8}, // Right column
		{0, 4, 8}, // Diagonal top-left to bottom-right
		{2, 4, 6}, // Diagonal top-right to bottom-left
	}

	// Check each winning pattern
	for _, pattern := range winPatterns {
		a, b, c := pattern[0], pattern[1], pattern[2]

		if board[a] != "" && board[a] == board[b] && board[b] == board[c] {
			// We have a winner!
			return board[a], true, false
		}
	}

	// Check for draw (board full, no winner)
	isDraw := true
	for _, cell := range board {
		if cell == "" {
			isDraw = false
			break
		}
	}

	return "", false, isDraw
}

// validateMove checks if a move is valid
func validateMove(game *Game, playerID int, position int) error {
	// Check if game is active
	if game.Status != GameStatusActive {
		return &GameError{Code: 400, Message: "Game is not active"}
	}

	// Check if it's the player's turn
	if (game.CurrentTurn == 1 && playerID != game.Player1ID) ||
		(game.CurrentTurn == 2 && playerID != game.Player2ID) {
		return &GameError{Code: 400, Message: "Not your turn"}
	}

	// Check if position is valid (0-8)
	if position < 0 || position > 8 {
		return &GameError{Code: 400, Message: "Invalid position"}
	}

	// Check if cell is empty
	if game.Board[position] != "" {
		return &GameError{Code: 400, Message: "Cell already occupied"}
	}

	return nil
}

// applyMove applies a move to the game board
func applyMove(game *Game, playerID int, position int) (*Game, error) {
	// Validate the move
	if err := validateMove(game, playerID, position); err != nil {
		return nil, err
	}

	// Determine symbol
	symbol := game.Player1Symbol
	if playerID == game.Player2ID {
		symbol = game.Player2Symbol
	}

	// Apply move
	game.Board[position] = symbol

	// Switch turn
	if game.CurrentTurn == 1 {
		game.CurrentTurn = 2
	} else {
		game.CurrentTurn = 1
	}

	// Update last move time
	game.LastMoveAt = getCurrentTimestamp()

	return game, nil
}

// processGameResult checks for win/draw and updates game state
// Returns: gameEnded (bool), message (string)
func processGameResult(game *Game) (bool, string) {
	winnerSymbol, hasWinner, isDraw := checkWinner(game.Board)

	if hasWinner {
		// Update scores
		if winnerSymbol == game.Player1Symbol {
			game.Player1Score++
		} else {
			game.Player2Score++
		}

		// Check if series is complete
		if game.Player1Score >= game.FirstTo {
			// Player 1 wins the series
			game.Status = GameStatusCompleted
			game.WinnerID = &game.Player1ID
			now := getCurrentTimestamp()
			game.CompletedAt = &now
			return true, "Player 1 wins the series!"
		} else if game.Player2Score >= game.FirstTo {
			// Player 2 wins the series
			game.Status = GameStatusCompleted
			game.WinnerID = &game.Player2ID
			now := getCurrentTimestamp()
			game.CompletedAt = &now
			return true, "Player 2 wins the series!"
		} else {
			// Round won, continue series
			game.CurrentRound++
			game.Board = []string{"", "", "", "", "", "", "", "", ""}
			game.CurrentTurn = 1 // Reset to player 1
			return false, "Round won! Next round starting..."
		}
	}

	if isDraw {
		// Round is a draw
		game.CurrentRound++
		game.Board = []string{"", "", "", "", "", "", "", "", ""}
		game.CurrentTurn = 1 // Reset to player 1
		return false, "Round is a draw! Next round starting..."
	}

	// Game continues
	return false, ""
}

// GameError represents a game logic error
type GameError struct {
	Code    int
	Message string
}

func (e *GameError) Error() string {
	return e.Message
}

// getCurrentTimestamp returns current Unix timestamp
func getCurrentTimestamp() int64 {
	return time.Now().Unix()
}
