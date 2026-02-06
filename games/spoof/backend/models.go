package main

import (
	"time"
)

// PlayerInfo represents a player in the game
type PlayerInfo struct {
	ID              string `json:"id"`              // User email
	Name            string `json:"name"`            // Display name
	CoinsInHand     int    `json:"coinsInHand"`     // 0-3, hidden from others until reveal
	HasSelected     bool   `json:"hasSelected"`     // Has chosen their coins
	HasGuessed      bool   `json:"hasGuessed"`      // Has made a guess
	Guess           int    `json:"guess,omitempty"` // Their guess (0-18 for 6 players)
	IsEliminated    bool   `json:"isEliminated"`    // Out of the game
	Order           int    `json:"order"`           // Turn order (0-based)
	CoinsRemaining  int    `json:"coinsRemaining"`  // How many coins they have left (starts at 3)
}

// RoundData represents the current round state
type RoundData struct {
	RoundNumber         int            `json:"roundNumber"`
	GuessingPlayerIndex int            `json:"guessingPlayerIndex"` // Index of player whose turn it is to guess
	GuessesThisRound    map[string]int `json:"guessesThisRound"`    // playerID -> guess
	UsedGuesses         []int          `json:"usedGuesses"`         // Guesses already made this round
	TotalCoins          int            `json:"totalCoins,omitempty"`// Revealed at end of round
	WinnerThisRound     string         `json:"winnerThisRound,omitempty"` // Player who guessed correctly
	EliminatedThisRound string         `json:"eliminatedThisRound,omitempty"` // Player eliminated this round
}

// SpoofGame represents a complete game state
type SpoofGame struct {
	ID            string        `json:"id"`
	ChallengeID   string        `json:"challengeId"`
	Players       []PlayerInfo  `json:"players"`
	Status        string        `json:"status"` // "coin_selection", "guessing", "reveal", "finished"
	CurrentRound  int           `json:"currentRound"`
	RoundData     *RoundData    `json:"roundData,omitempty"`
	EliminatedIDs []string      `json:"eliminatedIds"`
	WinnerID      string        `json:"winnerId,omitempty"`
	StartedAt     int64         `json:"startedAt"`
	UpdatedAt     int64         `json:"updatedAt"`
}

// PlayerView returns a sanitized view of the game for a specific player
// (hides other players' coin counts during play)
func (g *SpoofGame) PlayerView(playerID string) map[string]interface{} {
	sanitizedPlayers := make([]map[string]interface{}, len(g.Players))

	for i, p := range g.Players {
		playerData := map[string]interface{}{
			"id":             p.ID,
			"name":           p.Name,
			"hasSelected":    p.HasSelected,
			"hasGuessed":     p.HasGuessed,
			"isEliminated":   p.IsEliminated,
			"order":          p.Order,
			"coinsRemaining": p.CoinsRemaining,
		}

		// Show guess if they've guessed
		if p.HasGuessed {
			playerData["guess"] = p.Guess
		}

		// Only show coins if it's the reveal phase or it's their own view
		if g.Status == "reveal" || g.Status == "finished" || p.ID == playerID {
			playerData["coinsInHand"] = p.CoinsInHand
		}

		sanitizedPlayers[i] = playerData
	}

	result := map[string]interface{}{
		"id":            g.ID,
		"challengeId":   g.ChallengeID,
		"players":       sanitizedPlayers,
		"status":        g.Status,
		"currentRound":  g.CurrentRound,
		"eliminatedIds": g.EliminatedIDs,
		"startedAt":     g.StartedAt,
		"updatedAt":     g.UpdatedAt,
	}

	if g.RoundData != nil {
		result["roundData"] = g.RoundData
	}

	if g.WinnerID != "" {
		result["winnerId"] = g.WinnerID
	}

	return result
}

// GetPlayer finds a player by ID
func (g *SpoofGame) GetPlayer(playerID string) *PlayerInfo {
	for i := range g.Players {
		if g.Players[i].ID == playerID {
			return &g.Players[i]
		}
	}
	return nil
}

// GetActivePlayers returns players who are not eliminated
func (g *SpoofGame) GetActivePlayers() []PlayerInfo {
	active := []PlayerInfo{}
	for _, p := range g.Players {
		if !p.IsEliminated {
			active = append(active, p)
		}
	}
	return active
}

// GetCurrentGuessingPlayer returns the player whose turn it is to guess
func (g *SpoofGame) GetCurrentGuessingPlayer() *PlayerInfo {
	if g.RoundData == nil {
		return nil
	}

	activePlayers := g.GetActivePlayers()
	if len(activePlayers) == 0 {
		return nil
	}

	// Find the current player in active players
	currentIndex := g.RoundData.GuessingPlayerIndex % len(activePlayers)
	return &activePlayers[currentIndex]
}

// AllPlayersSelected checks if all active players have selected their coins
func (g *SpoofGame) AllPlayersSelected() bool {
	activePlayers := g.GetActivePlayers()
	for _, p := range activePlayers {
		if !p.HasSelected {
			return false
		}
	}
	return true
}

// AllPlayersGuessed checks if all active players have made their guess
func (g *SpoofGame) AllPlayersGuessed() bool {
	activePlayers := g.GetActivePlayers()
	for _, p := range activePlayers {
		if !p.HasGuessed {
			return false
		}
	}
	return true
}

// CalculateTotalCoins sums all coins in play this round
func (g *SpoofGame) CalculateTotalCoins() int {
	total := 0
	for _, p := range g.Players {
		if !p.IsEliminated {
			total += p.CoinsInHand
		}
	}
	return total
}

// FindWinner determines if anyone guessed correctly
func (g *SpoofGame) FindWinner() *PlayerInfo {
	if g.RoundData == nil {
		return nil
	}

	totalCoins := g.CalculateTotalCoins()

	for i := range g.Players {
		p := &g.Players[i]
		if !p.IsEliminated && p.HasGuessed && p.Guess == totalCoins {
			return p
		}
	}
	return nil
}

// CreateGameRequest represents the request to create a new game
type CreateGameRequest struct {
	ChallengeID string                   `json:"challengeId"`
	Players     []map[string]interface{} `json:"players"`
	InitiatorID string                   `json:"initiatorId"`
}

// SelectCoinsRequest represents a player selecting their coins
type SelectCoinsRequest struct {
	GameID      string `json:"gameId"`
	PlayerID    string `json:"playerId"`
	CoinsInHand int    `json:"coinsInHand"` // 0-3
}

// MakeGuessRequest represents a player making a guess
type MakeGuessRequest struct {
	GameID   string `json:"gameId"`
	PlayerID string `json:"playerId"`
	Guess    int    `json:"guess"` // 0 to (numPlayers * 3)
}

// GameResponse is the standard API response
type GameResponse struct {
	Success bool        `json:"success"`
	GameID  string      `json:"gameId,omitempty"`
	Game    interface{} `json:"game,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// Helper function to create a new game
func NewSpoofGame(challengeID string, players []PlayerInfo) *SpoofGame {
	now := time.Now().Unix()

	game := &SpoofGame{
		ID:           generateGameID(),
		ChallengeID:  challengeID,
		Players:      players,
		Status:       "coin_selection",
		CurrentRound: 1,
		StartedAt:    now,
		UpdatedAt:    now,
		RoundData: &RoundData{
			RoundNumber:         1,
			GuessingPlayerIndex: 0,
			GuessesThisRound:    make(map[string]int),
			UsedGuesses:         []int{},
		},
	}

	return game
}
