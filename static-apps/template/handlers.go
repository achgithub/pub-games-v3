package main

import (
	"encoding/json"
	"net/http"
	"time"
)

// HandleConfig returns app configuration
func HandleConfig(w http.ResponseWriter, r *http.Request) {
	config := Config{
		AppName: "PLACEHOLDER_APP_NAME",
		AppIcon: "PLACEHOLDER_ICON",
		Version: "1.0.0",
	}
	json.NewEncoder(w).Encode(config)
}

// HandleGetItems returns all items
func HandleGetItems(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT id, name, description, created_by, created_at
		FROM items
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []Item{}
	for rows.Next() {
		var item Item
		err := rows.Scan(&item.ID, &item.Name, &item.Description, &item.CreatedBy, &item.CreatedAt)
		if err != nil {
			continue
		}
		items = append(items, item)
	}

	json.NewEncoder(w).Encode(items)
}

// HandleCreateItem creates a new item
func HandleCreateItem(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Get user from query param
	email := r.URL.Query().Get("user")
	if email == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Insert item
	var item Item
	err := db.QueryRow(`
		INSERT INTO items (name, description, created_by, created_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, description, created_by, created_at
	`, req.Name, req.Description, email, time.Now()).
		Scan(&item.ID, &item.Name, &item.Description, &item.CreatedBy, &item.CreatedAt)

	if err != nil {
		http.Error(w, "Failed to create item", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(item)
}

// HandleGetStats returns admin statistics
func HandleGetStats(w http.ResponseWriter, r *http.Request) {
	var stats struct {
		TotalItems int `json:"total_items"`
		TotalUsers int `json:"total_users"`
	}

	db.QueryRow("SELECT COUNT(*) FROM items").Scan(&stats.TotalItems)
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)

	json.NewEncoder(w).Encode(stats)
}

// HandleHealth returns health status
func HandleHealth(w http.ResponseWriter, r *http.Request) {
	// Check database connection
	if err := db.Ping(); err != nil {
		http.Error(w, "Database unhealthy", http.StatusServiceUnavailable)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "ok",
		"app":       "PLACEHOLDER_APP_NAME",
		"timestamp": time.Now(),
	})
}
