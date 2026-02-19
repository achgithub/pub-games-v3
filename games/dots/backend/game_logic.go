package main

import "time"

// InitializeGame sets up a new game with the given grid dimensions
func InitializeGame(game *Game) {
	width := game.GridWidth
	height := game.GridHeight

	// Fall back to GridSize for backward compatibility
	if width < 2 && game.GridSize >= 2 {
		width = game.GridSize
	}
	if height < 2 && game.GridSize >= 2 {
		height = game.GridSize
	}

	// Apply defaults
	if width < 2 {
		width = 4
	}
	if height < 2 {
		height = 4
	}

	game.GridWidth = width
	game.GridHeight = height
	game.GridSize = width // Keep for backward compat (use width as legacy value)

	// Initialize horizontal lines
	// For a grid of W x H dots, there are H rows of (W-1) horizontal lines
	lines := []Line{}

	// Horizontal lines: H rows, W-1 columns each
	for row := 0; row < height; row++ {
		for col := 0; col < width-1; col++ {
			lines = append(lines, Line{
				Row:        row,
				Col:        col,
				Horizontal: true,
				DrawnBy:    0,
			})
		}
	}

	// Vertical lines: H-1 rows, W columns each
	for row := 0; row < height-1; row++ {
		for col := 0; col < width; col++ {
			lines = append(lines, Line{
				Row:        row,
				Col:        col,
				Horizontal: false,
				DrawnBy:    0,
			})
		}
	}

	game.Lines = lines

	// Initialize boxes: (H-1) x (W-1) grid
	boxes := []Box{}
	for row := 0; row < height-1; row++ {
		for col := 0; col < width-1; col++ {
			boxes = append(boxes, Box{
				Row:     row,
				Col:     col,
				OwnedBy: 0,
			})
		}
	}
	game.Boxes = boxes

	game.CurrentTurn = 1
	game.Player1Score = 0
	game.Player2Score = 0
	game.Status = GameStatusActive
}

// findLineIndex finds the index of a line in the lines array
func findLineIndex(lines []Line, row, col int, horizontal bool) int {
	for i, line := range lines {
		if line.Row == row && line.Col == col && line.Horizontal == horizontal {
			return i
		}
	}
	return -1
}

// MakeMove processes a move and returns (boxesCompleted, gameEnded, message)
func MakeMove(game *Game, playerNum int, row, col int, horizontal bool) (int, bool, string) {
	// Find the line
	lineIdx := findLineIndex(game.Lines, row, col, horizontal)
	if lineIdx == -1 {
		return 0, false, "Invalid line position"
	}

	// Check if already drawn
	if game.Lines[lineIdx].DrawnBy != 0 {
		return 0, false, "Line already drawn"
	}

	// Draw the line
	game.Lines[lineIdx].DrawnBy = playerNum
	game.LastMoveAt = time.Now().Unix()

	// Check if any boxes were completed
	boxesCompleted := checkCompletedBoxes(game, row, col, horizontal, playerNum)

	// Update score
	if playerNum == 1 {
		game.Player1Score += boxesCompleted
	} else {
		game.Player2Score += boxesCompleted
	}

	// Check if game is over (all boxes filled)
	totalBoxes := (game.GridWidth - 1) * (game.GridHeight - 1)
	filledBoxes := game.Player1Score + game.Player2Score

	if filledBoxes >= totalBoxes {
		// Game over
		game.Status = GameStatusCompleted
		now := time.Now().Unix()
		game.CompletedAt = &now

		if game.Player1Score > game.Player2Score {
			game.WinnerID = &game.Player1ID
			return boxesCompleted, true, game.Player1Name + " wins!"
		} else if game.Player2Score > game.Player1Score {
			game.WinnerID = &game.Player2ID
			return boxesCompleted, true, game.Player2Name + " wins!"
		} else {
			// Draw - no winner
			return boxesCompleted, true, "It's a draw!"
		}
	}

	// If boxes were completed, player gets another turn
	if boxesCompleted > 0 {
		return boxesCompleted, false, "Box completed! Go again!"
	}

	// Switch turns
	if game.CurrentTurn == 1 {
		game.CurrentTurn = 2
	} else {
		game.CurrentTurn = 1
	}

	return 0, false, ""
}

// checkCompletedBoxes checks if drawing a line completed any boxes
func checkCompletedBoxes(game *Game, row, col int, horizontal bool, playerNum int) int {
	completed := 0
	width := game.GridWidth
	height := game.GridHeight

	if horizontal {
		// A horizontal line can complete boxes above and below it
		// Box above: row-1, col (if row > 0)
		if row > 0 {
			if checkBox(game, row-1, col, playerNum) {
				completed++
			}
		}
		// Box below: row, col (if row < height-1)
		if row < height-1 {
			if checkBox(game, row, col, playerNum) {
				completed++
			}
		}
	} else {
		// A vertical line can complete boxes to the left and right
		// Box to left: row, col-1 (if col > 0)
		if col > 0 {
			if checkBox(game, row, col-1, playerNum) {
				completed++
			}
		}
		// Box to right: row, col (if col < width-1)
		if col < width-1 {
			if checkBox(game, row, col, playerNum) {
				completed++
			}
		}
	}

	return completed
}

// checkBox checks if a box is now complete and marks it if so
func checkBox(game *Game, boxRow, boxCol int, playerNum int) bool {
	// A box needs 4 lines:
	// Top: horizontal line at (boxRow, boxCol)
	// Bottom: horizontal line at (boxRow+1, boxCol)
	// Left: vertical line at (boxRow, boxCol)
	// Right: vertical line at (boxRow, boxCol+1)

	topIdx := findLineIndex(game.Lines, boxRow, boxCol, true)
	bottomIdx := findLineIndex(game.Lines, boxRow+1, boxCol, true)
	leftIdx := findLineIndex(game.Lines, boxRow, boxCol, false)
	rightIdx := findLineIndex(game.Lines, boxRow, boxCol+1, false)

	if topIdx == -1 || bottomIdx == -1 || leftIdx == -1 || rightIdx == -1 {
		return false
	}

	// Check if all 4 lines are drawn
	if game.Lines[topIdx].DrawnBy != 0 &&
		game.Lines[bottomIdx].DrawnBy != 0 &&
		game.Lines[leftIdx].DrawnBy != 0 &&
		game.Lines[rightIdx].DrawnBy != 0 {

		// Find the box and check if it's not already owned
		for i := range game.Boxes {
			if game.Boxes[i].Row == boxRow && game.Boxes[i].Col == boxCol {
				if game.Boxes[i].OwnedBy == 0 {
					game.Boxes[i].OwnedBy = playerNum
					return true
				}
				return false
			}
		}
	}

	return false
}

// ValidateMove checks if a move is valid
func ValidateMove(game *Game, playerID string, row, col int, horizontal bool) (int, string) {
	// Check game status
	if game.Status != GameStatusActive {
		return 0, "Game is not active"
	}

	// Determine player number
	playerNum := 0
	if playerID == game.Player1ID {
		playerNum = 1
	} else if playerID == game.Player2ID {
		playerNum = 2
	} else {
		return 0, "Not a player in this game"
	}

	// Check if it's this player's turn
	if game.CurrentTurn != playerNum {
		return 0, "Not your turn"
	}

	// Validate line position
	width := game.GridWidth
	height := game.GridHeight
	if horizontal {
		// Horizontal lines: row 0 to height-1, col 0 to width-2
		if row < 0 || row >= height || col < 0 || col >= width-1 {
			return 0, "Invalid line position"
		}
	} else {
		// Vertical lines: row 0 to height-2, col 0 to width-1
		if row < 0 || row >= height-1 || col < 0 || col >= width {
			return 0, "Invalid line position"
		}
	}

	// Check if line is already drawn
	lineIdx := findLineIndex(game.Lines, row, col, horizontal)
	if lineIdx == -1 {
		return 0, "Invalid line position"
	}
	if game.Lines[lineIdx].DrawnBy != 0 {
		return 0, "Line already drawn"
	}

	return playerNum, ""
}
