package main

import (
	"fmt"
	"time"
)

// ExcludedDateRequest represents an excluded date with metadata
type ExcludedDateRequest struct {
	Date  string `json:"date"`
	Type  string `json:"type"`  // "catchup", "free", "special"
	Notes string `json:"notes"` // For special events
}

// ScheduleRequest represents a request to generate a schedule
type ScheduleRequest struct {
	UserID       string                 `json:"userId"`
	Sport        string                 `json:"sport"`
	Teams        []string               `json:"teams"`
	DayOfWeek    string                 `json:"dayOfWeek"`
	SeasonStart  string                 `json:"seasonStart"`  // Date string in YYYY-MM-DD format
	SeasonEnd    string                 `json:"seasonEnd"`    // Date string in YYYY-MM-DD format
	ExcludeDates []ExcludedDateRequest `json:"excludeDates"` // Array of excluded dates with metadata
}

// ScheduleResponse represents the generated schedule
type ScheduleResponse struct {
	Rows         []ScheduleRow `json:"rows"`
	RequiredDates int          `json:"requiredDates"`
	Status       string        `json:"status"` // "ok", "too_few_dates", "too_many_dates"
	Message      string        `json:"message"`
}

// ScheduleRow represents a single week/date in the schedule
type ScheduleRow struct {
	Date           time.Time `json:"date"`
	RowType        string    `json:"rowType"` // "match", "catchup", "free", "special", "bye"
	HomeTeam       string    `json:"homeTeam,omitempty"`
	AwayTeam       *string   `json:"awayTeam,omitempty"`   // NULL for bye weeks
	Notes          string    `json:"notes,omitempty"`      // For special events
	RowOrder       int       `json:"rowOrder"`             // Order in schedule
	HolidayWarning string    `json:"holidayWarning,omitempty"` // Warning if near UK bank holiday
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

	// Parse excluded dates with metadata
	excludeMap := make(map[string]ExcludedDateRequest)
	for _, excluded := range req.ExcludeDates {
		if excluded.Date == "" {
			continue
		}
		excludeMap[excluded.Date] = excluded
	}

	// Generate ALL dates in the season (not filtered)
	allDates, err := GenerateDates(req.DayOfWeek, seasonStart, seasonEnd)
	if err != nil {
		return nil, fmt.Errorf("failed to generate dates: %w", err)
	}

	// Count available (non-excluded) dates for match generation
	var availableDates []time.Time
	for _, d := range allDates {
		dateStr := d.Format("2006-01-02")
		if _, isExcluded := excludeMap[dateStr]; !isExcluded {
			availableDates = append(availableDates, d)
		}
	}

	// Calculate required matches
	numTeams := len(req.Teams)
	if numTeams < 2 {
		return nil, fmt.Errorf("need at least 2 teams")
	}

	// Handle odd number of teams
	hasbye := numTeams%2 == 1
	adjustedTeams := numTeams
	if hasbye {
		adjustedTeams++ // Add phantom team for bye
	}

	// Each team plays every other team twice (home and away)
	totalRounds := (adjustedTeams - 1) * 2
	requiredDates := totalRounds

	// Validate date count
	status := "ok"
	message := ""
	if len(availableDates) < requiredDates {
		status = "too_few_dates"
		message = fmt.Sprintf("Need %d dates but only %d available (after exclusions). Need %d more dates.",
			requiredDates, len(availableDates), requiredDates-len(availableDates))
	} else if len(availableDates) > requiredDates {
		spareDates := len(availableDates) - requiredDates
		status = "ok"
		message = fmt.Sprintf("Schedule generated successfully. %d spare week(s) assigned as Free Week.",
			spareDates)
	}

	// Generate matches using round-robin algorithm for available dates
	var matches []Match
	if len(availableDates) >= requiredDates {
		fmt.Printf("DEBUG: Generating schedule with %d teams, %d dates, hasbye=%v\n", len(req.Teams), requiredDates, hasbye)
		matches = generateRoundRobin(req.Teams, availableDates[:requiredDates], hasbye)
		fmt.Printf("DEBUG: Generated %d matches\n", len(matches))
	} else if status == "too_few_dates" {
		// Generate partial schedule
		matches = generateRoundRobin(req.Teams, availableDates, hasbye)
	}

	// Fetch UK bank holidays for warning checks
	holidays, err := FetchUKBankHolidays()
	if err != nil {
		// Non-critical - just log and continue without holiday warnings
		fmt.Printf("Warning: Failed to fetch UK holidays: %v\n", err)
	}

	// Filter holidays to season range
	var seasonHolidays []Holiday
	if holidays != nil {
		seasonHolidays = FilterHolidaysInRange(holidays, seasonStart, seasonEnd)
	}

	// Group matches by date for easier lookup
	matchesByDate := make(map[string][]Match)
	for _, match := range matches {
		dateStr := match.MatchDate.Format("2006-01-02")
		matchesByDate[dateStr] = append(matchesByDate[dateStr], match)
	}

	// Create ScheduleRow for each date in season
	var rows []ScheduleRow
	rowOrder := 0

	for _, date := range allDates {
		dateStr := date.Format("2006-01-02")

		// Check for nearby holidays (within 7 days)
		var holidayWarning string
		if len(seasonHolidays) > 0 {
			nearby := CheckNearbyHolidays(date, seasonHolidays, 7)
			if len(nearby) > 0 {
				// Build warning message
				holidayWarning = fmt.Sprintf("⚠️ Near %s (%s)", nearby[0].Title, nearby[0].Date.Format("Jan 2"))
			}
		}

		// Check if this date is excluded
		if excluded, isExcluded := excludeMap[dateStr]; isExcluded {
			rows = append(rows, ScheduleRow{
				Date:           date,
				RowType:        excluded.Type,
				Notes:          excluded.Notes,
				RowOrder:       rowOrder,
				HolidayWarning: holidayWarning,
			})
			rowOrder++
			continue
		}

		// Check if we have matches for this date
		if dateMatches, hasMatches := matchesByDate[dateStr]; hasMatches {
			// Add a row for each match on this date
			for _, match := range dateMatches {
				rows = append(rows, ScheduleRow{
					Date:           date,
					RowType:        "match",
					HomeTeam:       match.HomeTeam,
					AwayTeam:       match.AwayTeam,
					RowOrder:       rowOrder,
					HolidayWarning: holidayWarning,
				})
				rowOrder++
			}
		} else {
			// This is a spare week - mark as free
			rows = append(rows, ScheduleRow{
				Date:           date,
				RowType:        "free",
				Notes:          "Free Week",
				RowOrder:       rowOrder,
				HolidayWarning: holidayWarning,
			})
			rowOrder++
		}
	}

	fmt.Printf("DEBUG: Created %d total rows from %d dates\n", len(rows), len(allDates))

	// Validate schedule - check every team plays every other team twice
	validationErrors := validateScheduleBalance(req.Teams, matches)
	if len(validationErrors) > 0 {
		fmt.Printf("WARNING: Schedule validation errors:\n")
		for _, err := range validationErrors {
			fmt.Printf("  - %s\n", err)
		}
		if message != "" {
			message += "\n\n"
		}
		message += "⚠️ Validation warnings:\n" + validationErrors[0]
		if len(validationErrors) > 1 {
			message += fmt.Sprintf("\n(+%d more warnings)", len(validationErrors)-1)
		}
	}

	return &ScheduleResponse{
		Rows:          rows,
		RequiredDates: requiredDates,
		Status:        status,
		Message:       message,
	}, nil
}

// validateScheduleBalance checks that every team plays every other team exactly twice (once home, once away)
func validateScheduleBalance(teams []string, matches []Match) []string {
	var errors []string

	// Track home and away games for each pairing
	homeGames := make(map[string]map[string]int) // homeGames[team1][team2] = count
	awayGames := make(map[string]map[string]int) // awayGames[team1][team2] = count

	for _, team := range teams {
		homeGames[team] = make(map[string]int)
		awayGames[team] = make(map[string]int)
	}

	// Count games
	for _, match := range matches {
		if match.AwayTeam == nil {
			// Bye week - skip
			continue
		}

		homeGames[match.HomeTeam][*match.AwayTeam]++
		awayGames[*match.AwayTeam][match.HomeTeam]++
	}

	// Validate each pairing
	for i, team1 := range teams {
		for j, team2 := range teams {
			if i >= j {
				continue // Skip self and duplicates
			}

			// Check team1 home vs team2 away
			homeCount := homeGames[team1][team2]
			awayCount := awayGames[team1][team2]

			if homeCount != 1 {
				errors = append(errors, fmt.Sprintf("%s should play home vs %s exactly once, but plays %d times", team1, team2, homeCount))
			}
			if awayCount != 1 {
				errors = append(errors, fmt.Sprintf("%s should play away vs %s exactly once, but plays %d times", team1, team2, awayCount))
			}
		}
	}

	return errors
}

// generateRoundRobin creates a balanced round-robin schedule
// Uses standard round-robin algorithm with home/away alternation
// Each team plays every other team exactly twice: once home, once away
// All matches in a round happen on the same date
func generateRoundRobin(teams []string, dates []time.Time, hasBye bool) []Match {
	fmt.Printf("DEBUG generateRoundRobin: teams=%d, dates=%d, hasBye=%v\n", len(teams), len(dates), hasBye)
	numTeams := len(teams)
	if hasBye {
		numTeams++ // Add phantom team
	}
	fmt.Printf("DEBUG: numTeams=%d, will generate %d rounds\n", numTeams, (numTeams-1)*2)

	// Create team rotation array (fix team 0, rotate others)
	teamRotation := make([]int, numTeams)
	for i := range teamRotation {
		teamRotation[i] = i
	}

	// Track each team's last home/away status (true = was home last)
	lastWasHome := make(map[int]bool)

	// Structure: rounds[roundNum] = [][2]int (array of pairings [home, away])
	var firstRoundRobin [][][2]int

	// Generate first round-robin (numTeams-1 rounds)
	// This creates all unique pairings with home/away assignments
	for round := 0; round < numTeams-1; round++ {
		var roundPairings [][2]int

		// Each round has numTeams/2 matches
		for i := 0; i < numTeams/2; i++ {
			team1 := teamRotation[i]
			team2 := teamRotation[numTeams-1-i]

			// Decide who is home based on alternation preference
			home, away := team1, team2

			// Check if we should swap based on last game
			team1WasHome, team1Played := lastWasHome[team1]
			team2WasHome, team2Played := lastWasHome[team2]

			if team1Played && team2Played {
				// Both teams played before - prefer to alternate
				if team1WasHome && !team2WasHome {
					home, away = team2, team1 // Swap so team1 is away, team2 is home
				} else if !team1WasHome && team2WasHome {
					home, away = team1, team2 // Keep as-is
				} else {
					// Both were same, use round parity for variety
					if round%2 == 1 {
						home, away = team2, team1
					}
				}
			} else if team1Played {
				// Only team1 played before - give them opposite
				if team1WasHome {
					home, away = team2, team1 // team1 away
				} else {
					home, away = team1, team2 // team1 home
				}
			} else if team2Played {
				// Only team2 played before - give them opposite
				if team2WasHome {
					home, away = team1, team2 // team2 away
				} else {
					home, away = team2, team1 // team2 home
				}
			} else {
				// Neither played before - use round parity
				if round%2 == 1 {
					home, away = team2, team1
				}
			}

			roundPairings = append(roundPairings, [2]int{home, away})
			lastWasHome[home] = true
			lastWasHome[away] = false
		}

		firstRoundRobin = append(firstRoundRobin, roundPairings)

		// Rotate teams (except team 0 which stays fixed)
		if round < numTeams-2 {
			lastTeam := teamRotation[numTeams-1]
			for i := numTeams - 1; i > 1; i-- {
				teamRotation[i] = teamRotation[i-1]
			}
			teamRotation[1] = lastTeam
		}
	}

	// Generate second round-robin by reversing home/away from first round-robin
	// This ensures every pairing appears exactly once as home and once as away
	var secondRoundRobin [][][2]int
	for _, roundPairings := range firstRoundRobin {
		var reversedPairings [][2]int
		for _, pair := range roundPairings {
			// Swap home and away
			reversedPairings = append(reversedPairings, [2]int{pair[1], pair[0]})
		}
		secondRoundRobin = append(secondRoundRobin, reversedPairings)
	}

	// Combine both round-robins
	var rounds [][][2]int
	rounds = append(rounds, firstRoundRobin...)
	rounds = append(rounds, secondRoundRobin...)

	// Convert rounds to matches with dates
	// All matches in a round share the same date
	fmt.Printf("DEBUG: Generated %d rounds total\n", len(rounds))
	var matches []Match
	matchOrder := 0

	for roundNum, roundPairings := range rounds {
		if roundNum >= len(dates) {
			fmt.Printf("DEBUG: Breaking at roundNum=%d, len(dates)=%d\n", roundNum, len(dates))
			break // Run out of dates
		}

		roundDate := dates[roundNum]
		fmt.Printf("DEBUG: Round %d has %d pairings on %s\n", roundNum, len(roundPairings), roundDate.Format("2006-01-02"))

		for _, pair := range roundPairings {
			homeIdx := pair[0]
			awayIdx := pair[1]

			// Skip if either team is the phantom bye team
			if hasBye && (homeIdx >= len(teams) || awayIdx >= len(teams)) {
				if homeIdx < len(teams) {
					// Home team has a bye week
					matches = append(matches, Match{
						MatchDate:  roundDate,
						HomeTeam:   teams[homeIdx],
						AwayTeam:   nil, // Bye week
						MatchOrder: matchOrder,
					})
					matchOrder++
				} else if awayIdx < len(teams) {
					// Away team has a bye week
					matches = append(matches, Match{
						MatchDate:  roundDate,
						HomeTeam:   teams[awayIdx],
						AwayTeam:   nil, // Bye week
						MatchOrder: matchOrder,
					})
					matchOrder++
				}
				continue
			}

			// Normal match
			awayTeam := teams[awayIdx]
			matches = append(matches, Match{
				MatchDate:  roundDate,
				HomeTeam:   teams[homeIdx],
				AwayTeam:   &awayTeam,
				MatchOrder: matchOrder,
			})
			matchOrder++
		}
	}

	fmt.Printf("DEBUG: Returning %d matches\n", len(matches))
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
