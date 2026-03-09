package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/achgithub/activity-hub-common/auth"
	"github.com/gorilla/mux"
)

// respondJSON sends a JSON response
func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// handleCreatePuzzle creates a new puzzle (admin only)
// POST /api/puzzles
func handleCreatePuzzle(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check admin role
	if !user.IsAdmin && !user.HasRole("game_admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Difficulty   string    `json:"difficulty"`
		PuzzleGrid   [][]int   `json:"puzzleGrid"`
		SolutionGrid [][]int   `json:"solutionGrid"`
		PuzzleNumber int       `json:"puzzleNumber"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate puzzle has single solution
	valid, err := ValidatePuzzle(req.PuzzleGrid)
	if err != nil || !valid {
		http.Error(w, "Puzzle must have exactly one solution", http.StatusBadRequest)
		return
	}

	// Count clues
	clueCount := countClues(req.PuzzleGrid)

	// Insert into database
	puzzleJSON, _ := json.Marshal(req.PuzzleGrid)
	solutionJSON, _ := json.Marshal(req.SolutionGrid)

	var id int
	err = db.QueryRow(`
		INSERT INTO puzzles (puzzle_number, difficulty, puzzle_grid, solution_grid, clue_count, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, req.PuzzleNumber, req.Difficulty, puzzleJSON, solutionJSON, clueCount, user.Email).Scan(&id)

	if err != nil {
		log.Printf("Error creating puzzle: %v", err)
		http.Error(w, "Failed to create puzzle", http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]interface{}{
		"success": true,
		"id":      id,
		"number":  req.PuzzleNumber,
	})
}

// handleGeneratePuzzle generates a new puzzle using the generator (admin only)
// POST /api/puzzles/generate
func handleGeneratePuzzle(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check admin role
	if !user.IsAdmin && !user.HasRole("game_admin") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Difficulty string `json:"difficulty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Generate puzzle using generator.go
	puzzle, solution, err := GeneratePuzzle(Difficulty(req.Difficulty))
	if err != nil {
		log.Printf("Error generating puzzle: %v", err)
		http.Error(w, "Failed to generate puzzle", http.StatusInternalServerError)
		return
	}

	// Get next available puzzle number
	var maxNumber int
	db.QueryRow("SELECT COALESCE(MAX(puzzle_number), 0) FROM puzzles").Scan(&maxNumber)
	nextNumber := maxNumber + 1

	// Save to database
	clueCount := countClues(puzzle)
	puzzleJSON, _ := json.Marshal(puzzle)
	solutionJSON, _ := json.Marshal(solution)

	var id int
	err = db.QueryRow(`
		INSERT INTO puzzles (puzzle_number, difficulty, puzzle_grid, solution_grid, clue_count, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, nextNumber, req.Difficulty, puzzleJSON, solutionJSON, clueCount, user.Email).Scan(&id)

	if err != nil {
		log.Printf("Error saving generated puzzle: %v", err)
		http.Error(w, "Failed to save puzzle", http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]interface{}{
		"success":      true,
		"id":           id,
		"puzzleNumber": nextNumber,
		"puzzle":       puzzle,
		"solution":     solution,
	})
}

// handleListPuzzles returns a list of puzzles (public)
// GET /api/puzzles?difficulty=easy
func handleListPuzzles(w http.ResponseWriter, r *http.Request) {
	difficulty := r.URL.Query().Get("difficulty")

	query := "SELECT id, puzzle_number, difficulty, clue_count, created_at FROM puzzles"
	var args []interface{}

	if difficulty != "" {
		query += " WHERE difficulty = $1"
		args = append(args, difficulty)
	}

	query += " ORDER BY puzzle_number DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Error listing puzzles: %v", err)
		http.Error(w, "Failed to load puzzles", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	puzzles := []map[string]interface{}{}
	for rows.Next() {
		var id, puzzleNumber, clueCount int
		var difficulty string
		var createdAt string

		rows.Scan(&id, &puzzleNumber, &difficulty, &clueCount, &createdAt)
		puzzles = append(puzzles, map[string]interface{}{
			"id":           id,
			"puzzleNumber": puzzleNumber,
			"difficulty":   difficulty,
			"clueCount":    clueCount,
			"createdAt":    createdAt,
		})
	}

	respondJSON(w, map[string]interface{}{
		"puzzles": puzzles,
	})
}

// handleGetPuzzle returns a specific puzzle (public)
// GET /api/puzzles/:id
func handleGetPuzzle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	puzzleID := vars["id"]

	var id, puzzleNumber, clueCount int
	var difficulty string
	var puzzleGridJSON, solutionGridJSON []byte

	err := db.QueryRow(`
		SELECT id, puzzle_number, difficulty, puzzle_grid, solution_grid, clue_count
		FROM puzzles WHERE id = $1
	`, puzzleID).Scan(&id, &puzzleNumber, &difficulty, &puzzleGridJSON, &solutionGridJSON, &clueCount)

	if err == sql.ErrNoRows {
		http.Error(w, "Puzzle not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Error getting puzzle: %v", err)
		http.Error(w, "Failed to load puzzle", http.StatusInternalServerError)
		return
	}

	var puzzleGrid, solutionGrid [][]int
	json.Unmarshal(puzzleGridJSON, &puzzleGrid)
	json.Unmarshal(solutionGridJSON, &solutionGrid)

	respondJSON(w, map[string]interface{}{
		"id":           id,
		"puzzleNumber": puzzleNumber,
		"difficulty":   difficulty,
		"puzzleGrid":   puzzleGrid,
		"solutionGrid": solutionGrid,
		"clueCount":    clueCount,
	})
}

// handleSaveProgress saves user progress for a puzzle (authenticated)
// POST /api/progress
func handleSaveProgress(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		PuzzleID     int                `json:"puzzleId"`
		CurrentState [][]int            `json:"currentState"`
		Notes        map[string][]int   `json:"notes"`
		Completed    bool               `json:"completed"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	stateJSON, _ := json.Marshal(req.CurrentState)
	notesJSON, _ := json.Marshal(req.Notes)

	var query string
	var args []interface{}

	if req.Completed {
		query = `
			INSERT INTO game_progress (user_id, puzzle_id, current_state, notes, completed, completed_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (user_id, puzzle_id) DO UPDATE
			SET current_state = $3, notes = $4, completed = $5, completed_at = NOW(), last_accessed = NOW()
		`
		args = []interface{}{user.Email, req.PuzzleID, stateJSON, notesJSON, req.Completed}
	} else {
		query = `
			INSERT INTO game_progress (user_id, puzzle_id, current_state, notes, completed)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id, puzzle_id) DO UPDATE
			SET current_state = $3, notes = $4, completed = $5, last_accessed = NOW()
		`
		args = []interface{}{user.Email, req.PuzzleID, stateJSON, notesJSON, req.Completed}
	}

	_, err := db.Exec(query, args...)
	if err != nil {
		log.Printf("Error saving progress: %v", err)
		http.Error(w, "Failed to save progress", http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]interface{}{"success": true})
}

// handleGetProgress gets user progress (authenticated)
// GET /api/progress?puzzleId=5
func handleGetProgress(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	puzzleID := r.URL.Query().Get("puzzleId")

	if puzzleID != "" {
		// Get specific puzzle progress
		var stateJSON, notesJSON []byte
		var completed bool
		var startedAt, lastAccessed, completedAt sql.NullString

		err := db.QueryRow(`
			SELECT current_state, notes, completed, started_at, last_accessed, completed_at
			FROM game_progress
			WHERE user_id = $1 AND puzzle_id = $2
		`, user.Email, puzzleID).Scan(&stateJSON, &notesJSON, &completed, &startedAt, &lastAccessed, &completedAt)

		if err == sql.ErrNoRows {
			respondJSON(w, map[string]interface{}{"progress": nil})
			return
		}
		if err != nil {
			log.Printf("Error getting progress: %v", err)
			http.Error(w, "Failed to load progress", http.StatusInternalServerError)
			return
		}

		var currentState [][]int
		var notes map[string][]int
		json.Unmarshal(stateJSON, &currentState)
		if len(notesJSON) > 0 {
			json.Unmarshal(notesJSON, &notes)
		}

		result := map[string]interface{}{
			"currentState": currentState,
			"notes":        notes,
			"completed":    completed,
		}

		if startedAt.Valid {
			result["startedAt"] = startedAt.String
		}
		if lastAccessed.Valid {
			result["lastAccessed"] = lastAccessed.String
		}
		if completedAt.Valid {
			result["completedAt"] = completedAt.String
		}

		respondJSON(w, result)
	} else {
		// Get all user progress (for library view)
		rows, err := db.Query(`
			SELECT puzzle_id, completed, started_at, last_accessed
			FROM game_progress
			WHERE user_id = $1
		`, user.Email)

		if err != nil {
			log.Printf("Error getting all progress: %v", err)
			http.Error(w, "Failed to load progress", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		progress := []map[string]interface{}{}
		for rows.Next() {
			var puzzleID int
			var completed bool
			var startedAt, lastAccessed string

			rows.Scan(&puzzleID, &completed, &startedAt, &lastAccessed)
			progress = append(progress, map[string]interface{}{
				"puzzleId":     puzzleID,
				"completed":    completed,
				"startedAt":    startedAt,
				"lastAccessed": lastAccessed,
			})
		}

		respondJSON(w, map[string]interface{}{"progress": progress})
	}
}

// cleanupStaleProgress removes progress older than 28 days (incomplete only)
func cleanupStaleProgress() {
	result, err := db.Exec(`
		DELETE FROM game_progress
		WHERE completed = FALSE
		AND last_accessed < NOW() - INTERVAL '28 days'
	`)

	if err != nil {
		log.Printf("Error cleaning up stale progress: %v", err)
		return
	}

	count, _ := result.RowsAffected()
	if count > 0 {
		log.Printf("Cleaned up %d stale game progress records", count)
	}
}
