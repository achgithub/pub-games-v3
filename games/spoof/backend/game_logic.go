package main

import (
	"database/sql"
	"log"
)

// StartNextRound prepares the game for the next round
func StartNextRound(game *SpoofGame) {
	game.CurrentRound++
	game.Status = "coin_selection"

	// Reset player states for new round
	for i := range game.Players {
		p := &game.Players[i]
		if p.IsEliminated {
			continue
		}

		// Reduce coins if they were the winner of last round
		if game.RoundData != nil && game.RoundData.WinnerThisRound == p.ID {
			p.CoinsRemaining--
			log.Printf("Player %s won last round, now has %d coins remaining", p.Name, p.CoinsRemaining)
		}

		// Reset round-specific flags
		p.HasSelected = false
		p.HasGuessed = false
		p.Guess = 0
		p.CoinsInHand = 0
	}

	// Create new round data
	activePlayers := game.GetActivePlayers()
	game.RoundData = &RoundData{
		RoundNumber:         game.CurrentRound,
		GuessingPlayerIndex: 0,
		GuessesThisRound:    make(map[string]int),
		UsedGuesses:         []int{},
	}

	// Record last round's result to database
	if game.CurrentRound > 1 {
		winner := sql.NullString{String: game.RoundData.WinnerThisRound, Valid: game.RoundData.WinnerThisRound != ""}
		eliminated := sql.NullString{String: game.RoundData.EliminatedThisRound, Valid: game.RoundData.EliminatedThisRound != ""}

		if err := RecordRoundResult(game.ID, game.CurrentRound-1, winner, eliminated, game.RoundData.TotalCoins); err != nil {
			log.Printf("Failed to record round result: %v", err)
		}
	}

	log.Printf("Started round %d with %d active players", game.CurrentRound, len(activePlayers))
}

// CheckGameRules validates game rules and player states
func CheckGameRules(game *SpoofGame) error {
	activePlayers := game.GetActivePlayers()

	// Game must have at least 2 active players
	if len(activePlayers) < 2 {
		// Only 1 player left - they win
		if len(activePlayers) == 1 {
			game.Status = "finished"
			game.WinnerID = activePlayers[0].ID
			UpdateGameInDB(game)
		}
		return nil
	}

	// Each player must have 0-3 coins remaining
	for _, p := range activePlayers {
		if p.CoinsRemaining < 0 || p.CoinsRemaining > 3 {
			log.Printf("Warning: Player %s has invalid coins remaining: %d", p.Name, p.CoinsRemaining)
		}
	}

	return nil
}

// GetMaxPossibleGuess calculates the maximum possible guess for current round
func GetMaxPossibleGuess(game *SpoofGame) int {
	activePlayers := game.GetActivePlayers()
	maxCoins := 0

	for _, p := range activePlayers {
		maxCoins += p.CoinsRemaining
	}

	return maxCoins
}

// GetMinPossibleGuess returns the minimum possible guess (always 0)
func GetMinPossibleGuess() int {
	return 0
}

// IsGuessAvailable checks if a guess number is still available
func IsGuessAvailable(game *SpoofGame, guess int) bool {
	for _, used := range game.RoundData.UsedGuesses {
		if used == guess {
			return false
		}
	}
	return true
}
