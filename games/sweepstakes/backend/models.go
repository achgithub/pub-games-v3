package main

import "time"

type Competition struct {
	ID              int        `json:"id"`
	Name            string     `json:"name"`
	Type            string     `json:"type"` // knockout or race
	Status          string     `json:"status"`
	StartDate       *time.Time `json:"start_date"`
	EndDate         *time.Time `json:"end_date"`
	Description     string     `json:"description"`
	SelectionMode   string     `json:"selection_mode"`
	BlindBoxInterval int        `json:"blind_box_interval"`
	CreatedAt       time.Time  `json:"created_at"`
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

type SelectionLock struct {
	CompetitionID int       `json:"competition_id"`
	UserID        string    `json:"user_id"`
	UserName      string    `json:"user_name"`
	LockedAt      time.Time `json:"locked_at"`
}

type Config struct {
	AppID        string                   `json:"appId"`
	GameOptions []map[string]interface{} `json:"gameOptions"`
}
