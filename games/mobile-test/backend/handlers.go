package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

func handlePing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":   true,
		"time": time.Now().UnixMilli(),
	})
}

func handleTestSSE(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	for n := 1; n <= 3; n++ {
		time.Sleep(300 * time.Millisecond)
		data, _ := json.Marshal(map[string]int{"n": n, "total": 3})
		fmt.Fprintf(w, "event: ping\ndata: %s\n\n", data)
		flusher.Flush()
	}

	fmt.Fprintf(w, "event: done\ndata: {}\n\n")
	flusher.Flush()
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"appName": "Mobile Test",
		"port":    4061,
	})
}

func handleGetTestContent(w http.ResponseWriter, r *http.Request) {
	type TestQuestion struct {
		ID        int    `json:"id"`
		Text      string `json:"text"`
		Answer    string `json:"answer"`
		Type      string `json:"type"`
		ImagePath string `json:"imagePath"`
		AudioPath string `json:"audioPath"`
	}

	result := map[string]*TestQuestion{
		"text":    nil,
		"picture": nil,
		"music":   nil,
	}

	rows, err := quizDB.Query(`
		SELECT q.id, q.text, q.answer, q.type,
		       COALESCE(img.file_path,''), COALESCE(aud.file_path,'')
		FROM questions q
		LEFT JOIN media_files img ON img.id = q.image_id
		LEFT JOIN media_files aud ON aud.id = q.audio_id
		WHERE q.is_test_content = TRUE
		LIMIT 10`)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var q TestQuestion
		var imageID, audioID sql.NullInt64
		var imagePath, audioPath string
		if err := rows.Scan(&q.ID, &q.Text, &q.Answer, &q.Type, &imagePath, &audioPath); err != nil {
			_ = imageID
			_ = audioID
			continue
		}
		q.ImagePath = imagePath
		q.AudioPath = audioPath

		switch q.Type {
		case "text":
			if result["text"] == nil {
				result["text"] = &q
			}
		case "picture":
			if result["picture"] == nil {
				result["picture"] = &q
			}
		case "music":
			if result["music"] == nil {
				result["music"] = &q
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
