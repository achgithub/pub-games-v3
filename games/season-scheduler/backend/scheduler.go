package main

import (
	"fmt"
	"time"
)

// ScheduleRequest represents a request to generate a schedule
type ScheduleRequest struct {
	UserID       string   `json:"userId"`
	Sport        string   `json:"sport"`
	Teams        []string `json:"teams"`
	DayOfWeek    string   `json:"dayOfWeek"`
	SeasonStart  string   `json:"seasonStart"`  // Date string in YYYY-MM-DD format
	SeasonEnd    string   `json:"seasonEnd"`    // Date string in YYYY-MM-DD format
	ExcludeDates []string `json:"excludeDates"` // Array of date strings in YYYY-MM-DD format
}

// ScheduleResponse represents the generated schedule
type ScheduleResponse struct {
	Matches      []Match    `json:"matches"`
	AvailableDates []time.Time `json:"availableDates"`
	RequiredDates int       `json:"requiredDates"`
	Status       string    `json:"status"` // "ok", "too_few_dates", "too_many_dates"
	Message      string    `json:"message"`
}

// GenerateSchedule creates a balanced home/away schedule
func GenerateSchedule(req ScheduleRequest) (*ScheduleResponse, error) {
	// Parse date strings
	seasonStart, err := time.Parse("2006-01-02", req.SeasonStart)
	if err != nil {
		return nil, fmt.Errorf("invalid season start date: %w", err)
	}

	seasonEnd, err := time.Parse("2006-01-02", req.SeasonEnd)
	if err != nil {
		return nil, fmt.Errorf("invalid season end date: %w", err)
	}

	// Parse excluded dates
	var excludeDates []time.Time
	for _, dateStr := range req.ExcludeDates {
		if dateStr == "" {
			continue
		}
		date, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			return nil, fmt.Errorf("invalid exclude date %s: %w", dateStr, err)
		}
		excludeDates = append(excludeDates, date)
	}

	// Generate all possible dates
	allDates, err := GenerateDates(req.DayOfWeek, seasonStart, seasonEnd)
	if err != nil {
		return nil, fmt.Errorf("failed to generate dates: %w", err)
	}

	// Filter out excluded dates
	availableDates := filterExcludedDates(allDates, excludeDates)

	// Calculate required matches
	numTeams := len(req.Teams)
	if numTeams < 2 {
		return nil, fmt.Errorf("need at least 2 teams")
	}

	// Handle odd number of teams
	hasbye := numTeams%2 == 1
	if hasbye {
		numTeams++ // Add phantom team for bye
	}

	// Each team plays every other team twice (home and away)
	totalRounds := (numTeams - 1) * 2 // Each team plays all others twice
	requiredDates := totalRounds

	// Validate date count
	status := "ok"
	message := ""
	if len(availableDates) < requiredDates {
		status = "too_few_dates"
		message = fmt.Sprintf("Need %d dates but only %d available. Need %d more dates.",
			requiredDates, len(availableDates), requiredDates-len(availableDates))
	} else if len(availableDates) > requiredDates {
		status = "too_many_dates"
		message = fmt.Sprintf("Have %d dates but only need %d. %d extra dates.",
			len(availableDates), requiredDates, len(availableDates)-requiredDates)
	}

	// Generate matches using round-robin algorithm
	matches := generateRoundRobin(req.Teams, availableDates[:min(len(availableDates), requiredDates)], hasbye)

	return &ScheduleResponse{
		Matches:        matches,
		AvailableDates: availableDates,
		RequiredDates:  requiredDates,
		Status:         status,
		Message:        message,
	}, nil
}

// generateRoundRobin creates a balanced round-robin schedule
// Teams play each other twice - once in first half, once in second half
func generateRoundRobin(teams []string, dates []time.Time, hasBye bool) []Match {
	numTeams := len(teams)
	if hasBye {
		numTeams++ // Add phantom team
	}

	// Round-robin rotation algorithm
	// Fix one team (team 0), rotate others
	var allPairings [][2]int

	// First half of season - each team plays all others once
	for round := 0; round < numTeams-1; round++ {
		for i := 0; i < numTeams/2; i++ {
			home := i
			away := numTeams - 1 - i

			if round > 0 {
				if home != 0 {
					home = (home + round - 1) % (numTeams - 1) + 1
				}
				if away != 0 {
					away = (away + round - 1) % (numTeams - 1) + 1
				}
			}

			allPairings = append(allPairings, [2]int{home, away})
		}
	}

	// Second half of season - reverse home/away
	firstHalfPairings := make([][2]int, len(allPairings))
	copy(firstHalfPairings, allPairings)

	for _, pair := range firstHalfPairings {
		// Reverse home and away
		allPairings = append(allPairings, [2]int{pair[1], pair[0]})
	}

	// Convert pairings to matches with dates
	var matches []Match
	dateIndex := 0

	for i, pair := range allPairings {
		if dateIndex >= len(dates) {
			break // Run out of dates
		}

		homeIdx := pair[0]
		awayIdx := pair[1]

		// Skip if either team is the phantom bye team
		if hasBye && (homeIdx >= len(teams) || awayIdx >= len(teams)) {
			if homeIdx < len(teams) {
				// Home team has a bye week
				matches = append(matches, Match{
					MatchDate:  dates[dateIndex],
					HomeTeam:   teams[homeIdx],
					AwayTeam:   nil, // Bye week
					MatchOrder: i,
				})
			} else if awayIdx < len(teams) {
				// Away team has a bye week
				matches = append(matches, Match{
					MatchDate:  dates[dateIndex],
					HomeTeam:   teams[awayIdx],
					AwayTeam:   nil, // Bye week
					MatchOrder: i,
				})
			}
			dateIndex++
			continue
		}

		// Normal match
		awayTeam := teams[awayIdx]
		matches = append(matches, Match{
			MatchDate:  dates[dateIndex],
			HomeTeam:   teams[homeIdx],
			AwayTeam:   &awayTeam,
			MatchOrder: i,
		})
		dateIndex++
	}

	return matches
}

// filterExcludedDates removes excluded dates from available dates
func filterExcludedDates(allDates, excludeDates []time.Time) []time.Time {
	excludeMap := make(map[string]bool)
	for _, d := range excludeDates {
		excludeMap[d.Format("2006-01-02")] = true
	}

	var filtered []time.Time
	for _, d := range allDates {
		if !excludeMap[d.Format("2006-01-02")] {
			filtered = append(filtered, d)
		}
	}
	return filtered
}

// ReorderMatches updates the match order based on user input
func ReorderMatches(matches []Match, fromIndex, toIndex int) []Match {
	if fromIndex < 0 || fromIndex >= len(matches) || toIndex < 0 || toIndex >= len(matches) {
		return matches // Invalid indices
	}

	// Remove match from original position
	match := matches[fromIndex]
	matches = append(matches[:fromIndex], matches[fromIndex+1:]...)

	// Insert at new position
	result := make([]Match, 0, len(matches)+1)
	result = append(result, matches[:toIndex]...)
	result = append(result, match)
	result = append(result, matches[toIndex:]...)

	// Update match_order for all matches
	for i := range result {
		result[i].MatchOrder = i
	}

	return result
}

// ValidateSchedule checks if schedule logic is sound
func ValidateSchedule(teams []string, dates []time.Time) error {
	numTeams := len(teams)
	if numTeams < 2 {
		return fmt.Errorf("need at least 2 teams")
	}

	hasBye := numTeams%2 == 1
	adjustedTeams := numTeams
	if hasBye {
		adjustedTeams++
	}

	requiredDates := (adjustedTeams - 1) * 2
	if len(dates) != requiredDates {
		return fmt.Errorf("date count mismatch: need %d, have %d", requiredDates, len(dates))
	}

	return nil
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
