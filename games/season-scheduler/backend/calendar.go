package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// BankHolidayResponse represents the UK Bank Holidays API response
type BankHolidayResponse struct {
	EnglandAndWales struct {
		Division string  `json:"division"`
		Events   []Event `json:"events"`
	} `json:"england-and-wales"`
}

// Event represents a single holiday event
type Event struct {
	Title   string `json:"title"`
	Date    string `json:"date"`
	Notes   string `json:"notes"`
	Bunting bool   `json:"bunting"`
}

// Holiday represents a processed holiday
type Holiday struct {
	Date  time.Time `json:"date"`
	Title string    `json:"title"`
	Notes string    `json:"notes"`
}

const ukBankHolidaysAPI = "https://www.gov.uk/bank-holidays.json"

// FetchUKBankHolidays fetches UK bank holidays from the government API
func FetchUKBankHolidays() ([]Holiday, error) {
	resp, err := http.Get(ukBankHolidaysAPI)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch bank holidays: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bank holidays API returned status %d", resp.StatusCode)
	}

	var apiResp BankHolidayResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode bank holidays: %w", err)
	}

	var holidays []Holiday
	for _, event := range apiResp.EnglandAndWales.Events {
		date, err := time.Parse("2006-01-02", event.Date)
		if err != nil {
			continue // Skip malformed dates
		}

		holidays = append(holidays, Holiday{
			Date:  date,
			Title: event.Title,
			Notes: event.Notes,
		})
	}

	return holidays, nil
}

// FilterHolidaysInRange filters holidays within a date range
func FilterHolidaysInRange(holidays []Holiday, start, end time.Time) []Holiday {
	var filtered []Holiday
	for _, h := range holidays {
		if (h.Date.After(start) || h.Date.Equal(start)) && (h.Date.Before(end) || h.Date.Equal(end)) {
			filtered = append(filtered, h)
		}
	}
	return filtered
}

// CheckNearbyHolidays checks if a date is within 10 days of any holiday
func CheckNearbyHolidays(date time.Time, holidays []Holiday) *Holiday {
	for _, h := range holidays {
		daysDiff := int(h.Date.Sub(date).Hours() / 24)
		if daysDiff >= -10 && daysDiff <= 10 {
			return &h
		}
	}
	return nil
}

// GenerateDates generates all dates for a given day of week within a range
func GenerateDates(dayOfWeek string, start, end time.Time) ([]time.Time, error) {
	// Map day names to time.Weekday
	dayMap := map[string]time.Weekday{
		"monday":    time.Monday,
		"tuesday":   time.Tuesday,
		"wednesday": time.Wednesday,
		"thursday":  time.Thursday,
		"friday":    time.Friday,
		"saturday":  time.Saturday,
		"sunday":    time.Sunday,
	}

	targetDay, ok := dayMap[dayOfWeek]
	if !ok {
		return nil, fmt.Errorf("invalid day of week: %s", dayOfWeek)
	}

	var dates []time.Time

	// Find first occurrence of target day
	current := start
	for current.Weekday() != targetDay {
		current = current.AddDate(0, 0, 1)
		if current.After(end) {
			return dates, nil // No dates found
		}
	}

	// Add all occurrences
	for !current.After(end) {
		dates = append(dates, current)
		current = current.AddDate(0, 0, 7) // Add one week
	}

	return dates, nil
}
