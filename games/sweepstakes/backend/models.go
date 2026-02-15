package main

import "time"

type Competition struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // knockout or race
	Status      string    `json:"status"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type Entry struct {
	ID            int       `json:"id"`
	CompetitionID int       `json:"competition_id"`
	Name          string    `json:"name"`
	Number        *int      `json:"number"`
	Seed          *int      `json:"seed"`
	Status        string    `json:"status"`
	Position      *int      `json:"position"`
	CreatedAt     time.Time `json:"created_at"`
}

type Draw struct {
	ID            int       `json:"id"`
	UserID        string    `json:"user_id"`
	CompetitionID int       `json:"competition_id"`
	EntryID       int       `json:"entry_id"`
	DrawnAt       time.Time `json:"drawn_at"`
	EntryName     string    `json:"entry_name"`
	UserName      string    `json:"user_name"`
}
