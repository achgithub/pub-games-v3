package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"appName": "Quiz Display",
		"port":    5081,
	})
}

func handleGetDisplaySession(w http.ResponseWriter, r *http.Request) {
	code := mux.Vars(r)["code"]

	var id, packID int
	var name, mode, status string
	var createdAt time.Time
	err := quizDB.QueryRow(`
		SELECT id, pack_id, name, mode, status, created_at
		FROM sessions WHERE join_code = $1`, code).
		Scan(&id, &packID, &name, &mode, &status, &createdAt)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// Get pack name
	var packName string
	quizDB.QueryRow(`SELECT name FROM quiz_packs WHERE id = $1`, packID).Scan(&packName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessionId":  id,
		"name":       name,
		"packName":   packName,
		"mode":       mode,
		"status":     status,
		"createdAt":  createdAt,
	})
}

func handleDisplayStream(w http.ResponseWriter, r *http.Request) {
	code := mux.Vars(r)["code"]

	// Look up session ID from code
	var sessionID int
	err := quizDB.QueryRow(`SELECT id FROM sessions WHERE join_code = $1`, code).Scan(&sessionID)
	if err == sql.ErrNoRows {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "event: connected\ndata: {\"sessionId\":%d,\"code\":\"%s\"}\n\n", sessionID, code)
	flusher.Flush()

	pubsub, msgChan := subscribeToSession(sessionID)
	defer pubsub.Close()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-msgChan:
			fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, "event: ping\ndata: {}\n\n")
			flusher.Flush()
		}
	}
}
