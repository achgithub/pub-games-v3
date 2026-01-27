package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// HandleConfig returns app configuration
func HandleConfig(w http.ResponseWriter, r *http.Request) {
	config := Config{
		AppName: "Leaderboard",
		AppIcon: "🏆",
		Version: "1.0.0",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// HandleReportResult - POST /api/result
// Called by games when a game ends
func HandleReportResult(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GameType   string `json:"gameType"`
		GameID     string `json:"gameId"`
		WinnerID   string `json:"winnerId"`
		WinnerName string `json:"winnerName"`
		LoserID    string `json:"loserId"`
		LoserName  string `json:"loserName"`
		IsDraw     bool   `json:"isDraw"`
		Score      string `json:"score"`
		Duration   int    `json:"duration"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.GameType == "" || req.GameID == "" {
		http.Error(w, "gameType and gameId are required", http.StatusBadRequest)
		return
	}

	// For non-draw games, winner is required
	if !req.IsDraw && req.WinnerID == "" {
		http.Error(w, "winnerId required for non-draw games", http.StatusBadRequest)
		return
	}

	// Insert result
	_, err := db.Exec(`
		INSERT INTO game_results (game_type, game_id, winner_id, winner_name, loser_id, loser_name, is_draw, score, duration, played_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (game_id) DO NOTHING
	`, req.GameType, req.GameID, req.WinnerID, req.WinnerName, req.LoserID, req.LoserName, req.IsDraw, req.Score, req.Duration, time.Now())

	if err != nil {
		log.Printf("Failed to insert game result: %v", err)
		http.Error(w, "Failed to save result", http.StatusInternalServerError)
		return
	}

	log.Printf("📊 Recorded result: %s game %s - Winner: %s", req.GameType, req.GameID, req.WinnerName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// HandleGetStandings - GET /api/standings/{gameType}
// Returns leaderboard for a specific game type
func HandleGetStandings(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameType := vars["gameType"]

	if gameType == "" {
		http.Error(w, "gameType is required", http.StatusBadRequest)
		return
	}

	// Query to calculate standings
	// Points: 3 for win, 1 for draw, 0 for loss
	rows, err := db.Query(`
		WITH player_stats AS (
			-- Get wins
			SELECT winner_id as player_id, winner_name as player_name,
				   COUNT(*) as wins, 0 as losses, 0 as draws
			FROM game_results
			WHERE game_type = $1 AND NOT is_draw AND winner_id IS NOT NULL
			GROUP BY winner_id, winner_name

			UNION ALL

			-- Get losses
			SELECT loser_id as player_id, loser_name as player_name,
				   0 as wins, COUNT(*) as losses, 0 as draws
			FROM game_results
			WHERE game_type = $1 AND NOT is_draw AND loser_id IS NOT NULL
			GROUP BY loser_id, loser_name

			UNION ALL

			-- Get draws (winner side)
			SELECT winner_id as player_id, winner_name as player_name,
				   0 as wins, 0 as losses, COUNT(*) as draws
			FROM game_results
			WHERE game_type = $1 AND is_draw AND winner_id IS NOT NULL
			GROUP BY winner_id, winner_name

			UNION ALL

			-- Get draws (loser side - in draws, both players are stored)
			SELECT loser_id as player_id, loser_name as player_name,
				   0 as wins, 0 as losses, COUNT(*) as draws
			FROM game_results
			WHERE game_type = $1 AND is_draw AND loser_id IS NOT NULL
			GROUP BY loser_id, loser_name
		)
		SELECT
			player_id,
			MAX(player_name) as player_name,
			SUM(wins) as wins,
			SUM(losses) as losses,
			SUM(draws) as draws,
			SUM(wins) + SUM(losses) + SUM(draws) as total_games,
			SUM(wins) * 3 + SUM(draws) as points
		FROM player_stats
		WHERE player_id IS NOT NULL AND player_id != ''
		GROUP BY player_id
		ORDER BY points DESC, wins DESC, total_games DESC
		LIMIT 50
	`, gameType)

	if err != nil {
		log.Printf("Failed to query standings: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	standings := []Standing{}
	rank := 1
	for rows.Next() {
		var s Standing
		var totalGames, points int
		err := rows.Scan(&s.PlayerID, &s.PlayerName, &s.Wins, &s.Losses, &s.Draws, &totalGames, &points)
		if err != nil {
			continue
		}
		s.Rank = rank
		s.TotalGames = totalGames
		s.Points = points
		if totalGames > 0 {
			s.WinRate = float64(s.Wins) / float64(totalGames) * 100
		}
		standings = append(standings, s)
		rank++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(standings)
}

// HandleGetAllStandings - GET /api/standings
// Returns standings for all game types
func HandleGetAllStandings(w http.ResponseWriter, r *http.Request) {
	// Get list of game types
	rows, err := db.Query(`SELECT DISTINCT game_type FROM game_results ORDER BY game_type`)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	gameTypes := []string{}
	for rows.Next() {
		var gt string
		rows.Scan(&gt)
		gameTypes = append(gameTypes, gt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"gameTypes": gameTypes,
	})
}

// HandleGetRecentGames - GET /api/recent/{gameType}
// Returns recent games for a game type
func HandleGetRecentGames(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameType := vars["gameType"]

	query := `
		SELECT id, game_type, game_id, winner_id, winner_name, loser_id, loser_name, is_draw, score, duration, played_at
		FROM game_results
	`
	args := []interface{}{}

	if gameType != "" && gameType != "all" {
		query += " WHERE game_type = $1"
		args = append(args, gameType)
	}

	query += " ORDER BY played_at DESC LIMIT 20"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Failed to query recent games: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []GameResult{}
	for rows.Next() {
		var r GameResult
		var winnerID, winnerName, loserID, loserName, score *string
		err := rows.Scan(&r.ID, &r.GameType, &r.GameID, &winnerID, &winnerName, &loserID, &loserName, &r.IsDraw, &score, &r.Duration, &r.PlayedAt)
		if err != nil {
			continue
		}
		if winnerID != nil {
			r.WinnerID = *winnerID
		}
		if winnerName != nil {
			r.WinnerName = *winnerName
		}
		if loserID != nil {
			r.LoserID = *loserID
		}
		if loserName != nil {
			r.LoserName = *loserName
		}
		if score != nil {
			r.Score = *score
		}
		results = append(results, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// HandleGetPlayerStats - GET /api/player/{playerId}
// Returns stats for a specific player across all games
func HandleGetPlayerStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playerID := vars["playerId"]

	if playerID == "" {
		http.Error(w, "playerId is required", http.StatusBadRequest)
		return
	}

	rows, err := db.Query(`
		SELECT game_type,
			   SUM(CASE WHEN winner_id = $1 AND NOT is_draw THEN 1 ELSE 0 END) as wins,
			   SUM(CASE WHEN loser_id = $1 AND NOT is_draw THEN 1 ELSE 0 END) as losses,
			   SUM(CASE WHEN (winner_id = $1 OR loser_id = $1) AND is_draw THEN 1 ELSE 0 END) as draws
		FROM game_results
		WHERE winner_id = $1 OR loser_id = $1
		GROUP BY game_type
	`, playerID)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	stats := []PlayerStats{}
	for rows.Next() {
		var s PlayerStats
		err := rows.Scan(&s.GameType, &s.Wins, &s.Losses, &s.Draws)
		if err != nil {
			continue
		}
		s.PlayerID = playerID
		s.TotalGames = s.Wins + s.Losses + s.Draws
		if s.TotalGames > 0 {
			s.WinRate = float64(s.Wins) / float64(s.TotalGames) * 100
		}
		stats = append(stats, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
