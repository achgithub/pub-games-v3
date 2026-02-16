package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/gorilla/mux"
)

func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"appName": "Quiz Player",
		"port":    4041,
	})
}

func handleGetActiveSessions(w http.ResponseWriter, r *http.Request) {
	rows, err := quizDB.Query(`
		SELECT id, name, mode, status, join_code, created_at
		FROM sessions
		WHERE status IN ('lobby', 'active')
		ORDER BY created_at DESC`)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	sessions := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var name, mode, status, joinCode string
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &mode, &status, &joinCode, &createdAt); err != nil {
			continue
		}
		sessions = append(sessions, map[string]interface{}{
			"id": id, "name": name, "mode": mode, "status": status,
			"joinCode": joinCode, "createdAt": createdAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"sessions": sessions})
}

func handleJoinSession(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var body struct {
		JoinCode string `json:"joinCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.JoinCode == "" {
		http.Error(w, `{"error":"joinCode required"}`, http.StatusBadRequest)
		return
	}

	var sessionID int
	var sessionName, mode, status string
	err := quizDB.QueryRow(`SELECT id, name, mode, status FROM sessions WHERE join_code = $1`, body.JoinCode).
		Scan(&sessionID, &sessionName, &mode, &status)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if status == "completed" {
		http.Error(w, `{"error":"quiz has ended"}`, http.StatusGone)
		return
	}

	// Upsert player record
	var playerID int
	err = quizDB.QueryRow(`
		INSERT INTO session_players (session_id, user_email, user_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (session_id, user_email) DO UPDATE SET user_name = EXCLUDED.user_name
		RETURNING id`,
		sessionID, user.Email, user.Name,
	).Scan(&playerID)
	if err != nil {
		http.Error(w, `{"error":"database error joining session"}`, http.StatusInternalServerError)
		return
	}

	// Get teams for this session
	teams, err := getSessionTeams(sessionID)
	if err != nil {
		http.Error(w, `{"error":"database error loading teams"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessionId":   sessionID,
		"sessionName": sessionName,
		"mode":        mode,
		"status":      status,
		"playerId":    playerID,
		"teams":       teams,
	})
}

func handleJoinTeam(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var body struct {
		SessionID int    `json:"sessionId"`
		TeamCode  string `json:"teamCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	var teamID int
	err := quizDB.QueryRow(`SELECT id FROM teams WHERE session_id = $1 AND join_code = $2`,
		body.SessionID, body.TeamCode).Scan(&teamID)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"team not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	_, err = quizDB.Exec(`
		UPDATE session_players SET team_id = $1
		WHERE session_id = $2 AND user_email = $3`,
		teamID, body.SessionID, user.Email,
	)
	if err != nil {
		http.Error(w, `{"error":"database error updating team"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"teamId": teamID})
}

func handleGetSessionState(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid session id"}`, http.StatusBadRequest)
		return
	}

	var s Session
	var startedAt, completedAt sql.NullTime
	err = quizDB.QueryRow(`SELECT id, pack_id, name, mode, status, join_code, created_at, started_at, completed_at FROM sessions WHERE id = $1`, sessionID).
		Scan(&s.ID, &s.PackID, &s.Name, &s.Mode, &s.Status, &s.JoinCode, &s.CreatedAt, &startedAt, &completedAt)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if startedAt.Valid {
		s.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		s.CompletedAt = &completedAt.Time
	}

	teams, _ := getSessionTeams(sessionID)

	// Get this player's record
	var player SessionPlayer
	var teamID sql.NullInt64
	err = quizDB.QueryRow(`SELECT id, session_id, user_email, COALESCE(user_name,''), team_id FROM session_players WHERE session_id = $1 AND user_email = $2`,
		sessionID, user.Email).Scan(&player.ID, &player.SessionID, &player.UserEmail, &player.UserName, &teamID)
	var myPlayer *SessionPlayer
	var myTeamID *int
	if err == nil {
		myPlayer = &player
		if teamID.Valid {
			v := int(teamID.Int64)
			myTeamID = &v
			myPlayer.TeamID = &v
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session":  s,
		"teams":    teams,
		"myTeamId": myTeamID,
		"myPlayer": myPlayer,
	})
}

func handleSubmitAnswer(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid session id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		RoundID    int    `json:"roundId"`
		QuestionID int    `json:"questionId"`
		AnswerText string `json:"answerText"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Get player record
	var playerID int
	var teamID sql.NullInt64
	err = quizDB.QueryRow(`SELECT id, team_id FROM session_players WHERE session_id = $1 AND user_email = $2`,
		sessionID, user.Email).Scan(&playerID, &teamID)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"not in this session"}`, http.StatusForbidden)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	var teamIDVal *int
	if teamID.Valid {
		v := int(teamID.Int64)
		teamIDVal = &v
	}

	var answerID int
	err = quizDB.QueryRow(`
		INSERT INTO answers (session_id, round_id, question_id, team_id, player_id, answer_text)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT DO NOTHING
		RETURNING id`,
		sessionID, body.RoundID, body.QuestionID,
		nullableIntVal(teamIDVal), playerID, body.AnswerText,
	).Scan(&answerID)
	if err != nil && err != sql.ErrNoRows {
		// Try update if already exists
		_, err = quizDB.Exec(`
			UPDATE answers SET answer_text = $1, submitted_at = NOW()
			WHERE session_id = $2 AND round_id = $3 AND question_id = $4 AND player_id = $5`,
			body.AnswerText, sessionID, body.RoundID, body.QuestionID, playerID,
		)
		if err != nil {
			http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "submitted"})
}

func handleSessionStream(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, "invalid session id", http.StatusBadRequest)
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

	// Send initial connected event
	fmt.Fprintf(w, "event: connected\ndata: {\"sessionId\":%d}\n\n", sessionID)
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

// --- Helpers ---

func getSessionTeams(sessionID int) ([]map[string]interface{}, error) {
	rows, err := quizDB.Query(`SELECT id, name, COALESCE(join_code,'') FROM teams WHERE session_id = $1 ORDER BY id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	teams := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var name, joinCode string
		if err := rows.Scan(&id, &name, &joinCode); err != nil {
			continue
		}
		teams = append(teams, map[string]interface{}{"id": id, "name": name, "joinCode": joinCode})
	}
	return teams, nil
}

func nullableIntVal(i *int) interface{} {
	if i == nil {
		return nil
	}
	return *i
}
