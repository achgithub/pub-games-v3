package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

// handleGetConfig returns app configuration
func handleGetConfig(w http.ResponseWriter, r *http.Request) {
	config := map[string]interface{}{
		"appName": APP_NAME,
		"sports":  []string{"darts", "pool", "crib"},
		"features": map[string]bool{
			"teamManagement":    true,
			"holidayDetection":  true,
			"scheduleGeneration": true,
			"manualReordering":  true,
			"downloadSchedule":  true,
			"emailSchedule":     false, // Not implemented yet
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// handleGetTeams returns all teams for a user and sport
func handleGetTeams(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	sport := r.URL.Query().Get("sport")

	if userID == "" || sport == "" {
		http.Error(w, "userId and sport are required", http.StatusBadRequest)
		return
	}

	teams, err := GetTeams(userID, sport)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

// handleAddTeam adds a new team
func handleAddTeam(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID string `json:"userId"`
		Sport  string `json:"sport"`
		Name   string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserID == "" || req.Sport == "" || req.Name == "" {
		http.Error(w, "userId, sport, and name are required", http.StatusBadRequest)
		return
	}

	team, err := AddTeam(req.UserID, req.Sport, req.Name)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			http.Error(w, "Team name already exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(team)
}

// handleDeleteTeam deletes a team
func handleDeleteTeam(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	teamID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	userID := r.URL.Query().Get("userId")
	if userID == "" {
		http.Error(w, "userId is required", http.StatusBadRequest)
		return
	}

	if err := DeleteTeam(teamID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleGetHolidays fetches UK bank holidays
func handleGetHolidays(w http.ResponseWriter, r *http.Request) {
	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")

	if startStr == "" || endStr == "" {
		http.Error(w, "start and end dates are required", http.StatusBadRequest)
		return
	}

	start, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		http.Error(w, "Invalid start date format", http.StatusBadRequest)
		return
	}

	end, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		http.Error(w, "Invalid end date format", http.StatusBadRequest)
		return
	}

	holidays, err := FetchUKBankHolidays()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch holidays: %v", err), http.StatusInternalServerError)
		return
	}

	filtered := FilterHolidaysInRange(holidays, start, end)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(filtered)
}

// handleValidateDates checks which dates have nearby holidays
func handleValidateDates(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Dates []string `json:"dates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	holidays, err := FetchUKBankHolidays()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	type DateValidation struct {
		Date    string   `json:"date"`
		Holiday *Holiday `json:"holiday"`
	}

	var validations []DateValidation
	for _, dateStr := range req.Dates {
		date, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		nearbyHolidays := CheckNearbyHolidays(date, holidays, 10)
		var holiday *Holiday
		if len(nearbyHolidays) > 0 {
			holiday = &nearbyHolidays[0]
		}
		validations = append(validations, DateValidation{
			Date:    dateStr,
			Holiday: holiday,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(validations)
}

// handleGenerateSchedule generates a new schedule
func handleGenerateSchedule(w http.ResponseWriter, r *http.Request) {
	var req ScheduleRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	response, err := GenerateSchedule(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleValidateSchedule validates schedule parameters
func handleValidateSchedule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Teams []string    `json:"teams"`
		Dates []time.Time `json:"dates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := ValidateSchedule(req.Teams, req.Dates)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": false,
			"error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid": true,
	})
}

// handleReorderMatches reorders matches in a schedule
func handleReorderMatches(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Matches   []Match `json:"matches"`
		FromIndex int     `json:"fromIndex"`
		ToIndex   int     `json:"toIndex"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	reordered := ReorderMatches(req.Matches, req.FromIndex, req.ToIndex)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reordered)
}

// handleSaveSchedule saves a confirmed schedule
func handleSaveSchedule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Schedule Schedule       `json:"schedule"`
		Matches  []Match        `json:"matches"`
		Dates    []ScheduleDate `json:"dates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := SaveSchedule(&req.Schedule, req.Matches, req.Dates); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req.Schedule)
}

// handleGetSchedules returns all schedules for a user
func handleGetSchedules(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		http.Error(w, "userId is required", http.StatusBadRequest)
		return
	}

	schedules, err := GetSchedules(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(schedules)
}

// handleGetSchedule returns a specific schedule with all matches
func handleGetSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	scheduleID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid schedule ID", http.StatusBadRequest)
		return
	}

	userID := r.URL.Query().Get("userId")
	if userID == "" {
		http.Error(w, "userId is required", http.StatusBadRequest)
		return
	}

	schedule, err := GetSchedule(scheduleID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(schedule)
}

// handleDownloadSchedule generates a CSV download
func handleDownloadSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	scheduleID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid schedule ID", http.StatusBadRequest)
		return
	}

	userID := r.URL.Query().Get("userId")
	if userID == "" {
		http.Error(w, "userId is required", http.StatusBadRequest)
		return
	}

	schedule, err := GetSchedule(scheduleID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate CSV
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s_v%d.csv\"", schedule.Name, schedule.Version))

	csvWriter := csv.NewWriter(w)
	defer csvWriter.Flush()

	// Write header
	csvWriter.Write([]string{"Date", "Home Team", "Away Team"})

	// Write matches
	for _, match := range schedule.Matches {
		awayTeam := "BYE"
		if match.AwayTeam != nil {
			awayTeam = *match.AwayTeam
		}

		csvWriter.Write([]string{
			match.MatchDate.Format("2006-01-02"),
			match.HomeTeam,
			awayTeam,
		})
	}
}

// handleEmailSchedule sends schedule via email (placeholder)
func handleEmailSchedule(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement email sending
	http.Error(w, "Email functionality not yet implemented", http.StatusNotImplemented)
}
