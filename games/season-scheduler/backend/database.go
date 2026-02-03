package main

import (
	"database/sql"
	"fmt"
	"time"
)

// InitDatabase initializes the PostgreSQL connection
func InitDatabase() (*sql.DB, error) {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5555")
	dbUser := getEnv("DB_USER", "pubgames")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := getEnv("DB_NAME", "season_scheduler_db")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// InitIdentityDatabase initializes connection to the identity database (for authentication)
func InitIdentityDatabase() (*sql.DB, error) {
	dbHost := getEnv("IDENTITY_DB_HOST", "127.0.0.1")
	dbPort := getEnv("IDENTITY_DB_PORT", "5555")
	dbUser := getEnv("IDENTITY_DB_USER", "pubgames")
	dbPass := getEnv("IDENTITY_DB_PASS", "pubgames")
	dbName := getEnv("IDENTITY_DB_NAME", "pubgames")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	identityDB, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open identity database: %w", err)
	}

	if err := identityDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping identity database: %w", err)
	}

	return identityDB, nil
}

// Team represents a pub team
type Team struct {
	ID        int       `json:"id"`
	UserID    string    `json:"userId"`
	Sport     string    `json:"sport"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// Schedule represents a saved schedule
type Schedule struct {
	ID          int       `json:"id"`
	UserID      string    `json:"userId"`
	Sport       string    `json:"sport"`
	Name        string    `json:"name"`
	Version     int       `json:"version"`
	DayOfWeek   string    `json:"dayOfWeek"`
	SeasonStart time.Time `json:"seasonStart"`
	SeasonEnd   time.Time `json:"seasonEnd"`
	CreatedAt   time.Time `json:"createdAt"`
	Matches     []Match   `json:"matches,omitempty"`
}

// Match represents a single match
type Match struct {
	ID         int       `json:"id"`
	ScheduleID int       `json:"scheduleId"`
	MatchDate  time.Time `json:"matchDate"`
	HomeTeam   string    `json:"homeTeam"`
	AwayTeam   *string   `json:"awayTeam"` // NULL for bye weeks
	MatchOrder int       `json:"matchOrder"`
	CreatedAt  time.Time `json:"createdAt"`
}

// ScheduleDate represents metadata about a specific date
type ScheduleDate struct {
	ID         int       `json:"id"`
	ScheduleID int       `json:"scheduleId"`
	MatchDate  time.Time `json:"matchDate"`
	DateType   string    `json:"dateType"` // normal, catchup, free, special, bye
	Notes      *string   `json:"notes"`
}

// GetTeams retrieves all teams for a user and sport
func GetTeams(userID, sport string) ([]Team, error) {
	query := `
		SELECT id, user_id, sport, name, created_at
		FROM teams
		WHERE user_id = $1 AND sport = $2
		ORDER BY name
	`

	rows, err := db.Query(query, userID, sport)
	if err != nil {
		return nil, fmt.Errorf("failed to query teams: %w", err)
	}
	defer rows.Close()

	var teams []Team
	for rows.Next() {
		var t Team
		if err := rows.Scan(&t.ID, &t.UserID, &t.Sport, &t.Name, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan team: %w", err)
		}
		teams = append(teams, t)
	}

	return teams, nil
}

// AddTeam adds a new team
func AddTeam(userID, sport, name string) (*Team, error) {
	query := `
		INSERT INTO teams (user_id, sport, name)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, sport, name, created_at
	`

	var t Team
	err := db.QueryRow(query, userID, sport, name).Scan(
		&t.ID, &t.UserID, &t.Sport, &t.Name, &t.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to add team: %w", err)
	}

	return &t, nil
}

// DeleteTeam removes a team
func DeleteTeam(teamID int, userID string) error {
	query := `DELETE FROM teams WHERE id = $1 AND user_id = $2`
	result, err := db.Exec(query, teamID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete team: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("team not found or unauthorized")
	}

	return nil
}

// SaveSchedule saves a complete schedule with all matches
func SaveSchedule(sched *Schedule, matches []Match, dates []ScheduleDate) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert schedule
	schedQuery := `
		INSERT INTO schedules (user_id, sport, name, version, day_of_week, season_start, season_end)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	err = tx.QueryRow(
		schedQuery,
		sched.UserID,
		sched.Sport,
		sched.Name,
		sched.Version,
		sched.DayOfWeek,
		sched.SeasonStart,
		sched.SeasonEnd,
	).Scan(&sched.ID, &sched.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert schedule: %w", err)
	}

	// Insert matches
	matchQuery := `
		INSERT INTO schedule_matches (schedule_id, match_date, home_team, away_team, match_order)
		VALUES ($1, $2, $3, $4, $5)
	`
	for _, match := range matches {
		_, err := tx.Exec(matchQuery, sched.ID, match.MatchDate, match.HomeTeam, match.AwayTeam, match.MatchOrder)
		if err != nil {
			return fmt.Errorf("failed to insert match: %w", err)
		}
	}

	// Insert date metadata
	dateQuery := `
		INSERT INTO schedule_dates (schedule_id, match_date, date_type, notes)
		VALUES ($1, $2, $3, $4)
	`
	for _, date := range dates {
		_, err := tx.Exec(dateQuery, sched.ID, date.MatchDate, date.DateType, date.Notes)
		if err != nil {
			return fmt.Errorf("failed to insert schedule date: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetSchedules retrieves all schedules for a user
func GetSchedules(userID string) ([]Schedule, error) {
	query := `
		SELECT id, user_id, sport, name, version, day_of_week, season_start, season_end, created_at
		FROM schedules
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query schedules: %w", err)
	}
	defer rows.Close()

	var schedules []Schedule
	for rows.Next() {
		var s Schedule
		if err := rows.Scan(&s.ID, &s.UserID, &s.Sport, &s.Name, &s.Version, &s.DayOfWeek, &s.SeasonStart, &s.SeasonEnd, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan schedule: %w", err)
		}
		schedules = append(schedules, s)
	}

	return schedules, nil
}

// GetSchedule retrieves a complete schedule with all matches
func GetSchedule(scheduleID int, userID string) (*Schedule, error) {
	// Get schedule
	schedQuery := `
		SELECT id, user_id, sport, name, version, day_of_week, season_start, season_end, created_at
		FROM schedules
		WHERE id = $1 AND user_id = $2
	`

	var s Schedule
	err := db.QueryRow(schedQuery, scheduleID, userID).Scan(
		&s.ID, &s.UserID, &s.Sport, &s.Name, &s.Version, &s.DayOfWeek, &s.SeasonStart, &s.SeasonEnd, &s.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("schedule not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query schedule: %w", err)
	}

	// Get matches
	matchQuery := `
		SELECT id, schedule_id, match_date, home_team, away_team, match_order, created_at
		FROM schedule_matches
		WHERE schedule_id = $1
		ORDER BY match_order
	`

	rows, err := db.Query(matchQuery, scheduleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query matches: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var m Match
		if err := rows.Scan(&m.ID, &m.ScheduleID, &m.MatchDate, &m.HomeTeam, &m.AwayTeam, &m.MatchOrder, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan match: %w", err)
		}
		s.Matches = append(s.Matches, m)
	}

	return &s, nil
}

// CleanupOldSchedules removes schedules older than 30 days
func CleanupOldSchedules() error {
	query := `DELETE FROM schedules WHERE created_at < NOW() - INTERVAL '30 days'`
	result, err := db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to cleanup old schedules: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rows > 0 {
		fmt.Printf("Cleaned up %d old schedules\n", rows)
	}

	return nil
}
