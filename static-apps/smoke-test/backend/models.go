package main

import "time"

// User represents a user reference (mirrors identity-shell users)
type User struct {
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	IsAdmin   bool      `json:"is_admin"`
	CreatedAt time.Time `json:"created_at"`
}

// Item represents a sample data item
type Item struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

// Config represents app configuration
type Config struct {
	AppName string `json:"app_name"`
	AppIcon string `json:"app_icon"`
	Version string `json:"version"`
}
