package main

import (
	"errors"
	"math/rand"
	"time"
)

type Difficulty string

const (
	Easy   Difficulty = "easy"
	Medium Difficulty = "medium"
	Hard   Difficulty = "hard"
)

// GeneratePuzzle creates a valid Sudoku puzzle with single solution
func GeneratePuzzle(difficulty Difficulty) (puzzle [][]int, solution [][]int, err error) {
	// Seed random number generator
	rand.Seed(time.Now().UnixNano())

	// Generate a complete valid grid (solution)
	solution = generateCompleteSolution()
	if solution == nil {
		return nil, nil, errors.New("failed to generate solution")
	}

	// Determine number of clues based on difficulty
	var targetClues int
	switch difficulty {
	case Easy:
		targetClues = 45 // 45-50 clues for easy
	case Medium:
		targetClues = 35 // 30-40 clues for medium
	case Hard:
		targetClues = 25 // 17-30 clues for hard
	default:
		return nil, nil, errors.New("invalid difficulty")
	}

	// Create puzzle by removing cells from solution
	puzzle = deepCopy(solution)
	puzzle, err = removeCellsToTarget(puzzle, targetClues)
	if err != nil {
		return nil, nil, err
	}

	return puzzle, solution, nil
}

// generateCompleteSolution creates a valid filled Sudoku grid
func generateCompleteSolution() [][]int {
	grid := make([][]int, 9)
	for i := range grid {
		grid[i] = make([]int, 9)
	}

	// Fill diagonal 3x3 boxes first (they're independent)
	for box := 0; box < 3; box++ {
		fillBox(grid, box*3, box*3)
	}

	// Solve the rest using backtracking
	if solveSudoku(grid) {
		return grid
	}

	return nil
}

// fillBox fills a 3x3 box with random valid numbers
func fillBox(grid [][]int, row, col int) {
	nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9}
	rand.Shuffle(len(nums), func(i, j int) {
		nums[i], nums[j] = nums[j], nums[i]
	})

	idx := 0
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			grid[row+i][col+j] = nums[idx]
			idx++
		}
	}
}

// solveSudoku solves a Sudoku puzzle using backtracking
func solveSudoku(grid [][]int) bool {
	row, col, found := findEmpty(grid)
	if !found {
		return true // Puzzle solved
	}

	// Try numbers 1-9
	nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9}
	rand.Shuffle(len(nums), func(i, j int) {
		nums[i], nums[j] = nums[j], nums[i]
	})

	for _, num := range nums {
		if isValid(grid, row, col, num) {
			grid[row][col] = num

			if solveSudoku(grid) {
				return true
			}

			grid[row][col] = 0 // Backtrack
		}
	}

	return false
}

// findEmpty finds the next empty cell in the grid
func findEmpty(grid [][]int) (int, int, bool) {
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if grid[i][j] == 0 {
				return i, j, true
			}
		}
	}
	return 0, 0, false
}

// isValid checks if a number can be placed at the given position
func isValid(grid [][]int, row, col, num int) bool {
	// Check row
	for j := 0; j < 9; j++ {
		if grid[row][j] == num {
			return false
		}
	}

	// Check column
	for i := 0; i < 9; i++ {
		if grid[i][col] == num {
			return false
		}
	}

	// Check 3x3 box
	boxRow, boxCol := (row/3)*3, (col/3)*3
	for i := boxRow; i < boxRow+3; i++ {
		for j := boxCol; j < boxCol+3; j++ {
			if grid[i][j] == num {
				return false
			}
		}
	}

	return true
}

// removeCellsToTarget removes cells from a solved grid to create a puzzle
func removeCellsToTarget(grid [][]int, targetClues int) ([][]int, error) {
	totalCells := 81
	cellsToRemove := totalCells - targetClues

	// Create list of all positions
	positions := make([][2]int, 0, totalCells)
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			positions = append(positions, [2]int{i, j})
		}
	}

	// Shuffle positions for random removal
	rand.Shuffle(len(positions), func(i, j int) {
		positions[i], positions[j] = positions[j], positions[i]
	})

	removed := 0
	for _, pos := range positions {
		if removed >= cellsToRemove {
			break
		}

		row, col := pos[0], pos[1]
		backup := grid[row][col]
		grid[row][col] = 0

		// Check if puzzle still has unique solution
		if hasUniqueSolution(grid) {
			removed++
		} else {
			// Restore the cell if it creates multiple solutions
			grid[row][col] = backup
		}
	}

	return grid, nil
}

// hasUniqueSolution checks if a puzzle has exactly one solution
func hasUniqueSolution(grid [][]int) bool {
	gridCopy := deepCopy(grid)
	count := countSolutions(gridCopy, 0)
	return count == 1
}

// countSolutions counts the number of solutions (stops at 2 for efficiency)
func countSolutions(grid [][]int, count int) int {
	if count > 1 {
		return count // Early exit if multiple solutions found
	}

	row, col, found := findEmpty(grid)
	if !found {
		return count + 1 // Found a solution
	}

	for num := 1; num <= 9; num++ {
		if isValid(grid, row, col, num) {
			grid[row][col] = num
			count = countSolutions(grid, count)
			grid[row][col] = 0 // Backtrack

			if count > 1 {
				return count // Early exit
			}
		}
	}

	return count
}

// ValidatePuzzle ensures puzzle has exactly one solution
func ValidatePuzzle(puzzle [][]int) (bool, error) {
	if puzzle == nil || len(puzzle) != 9 {
		return false, errors.New("invalid puzzle dimensions")
	}

	for _, row := range puzzle {
		if len(row) != 9 {
			return false, errors.New("invalid puzzle dimensions")
		}
	}

	// Check if puzzle has at least 17 clues (minimum for unique solution)
	clues := countClues(puzzle)
	if clues < 17 {
		return false, errors.New("puzzle must have at least 17 clues")
	}

	// Check for unique solution
	return hasUniqueSolution(puzzle), nil
}

// countClues counts the number of filled cells
func countClues(grid [][]int) int {
	count := 0
	for i := 0; i < 9; i++ {
		for j := 0; j < 9; j++ {
			if grid[i][j] != 0 {
				count++
			}
		}
	}
	return count
}

// deepCopy creates a deep copy of a 9x9 grid
func deepCopy(src [][]int) [][]int {
	dst := make([][]int, 9)
	for i := range src {
		dst[i] = make([]int, 9)
		copy(dst[i], src[i])
	}
	return dst
}
