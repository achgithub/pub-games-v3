package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/gorilla/mux"
)

func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"appName": "Quiz Master",
		"port":    5080,
	})
}

func handleGetPacks(w http.ResponseWriter, r *http.Request) {
	rows, err := quizDB.Query(`
		SELECT p.id, p.name, COALESCE(p.description,''), COUNT(r.id) as round_count
		FROM quiz_packs p
		LEFT JOIN rounds r ON r.pack_id = p.id
		GROUP BY p.id ORDER BY p.id DESC`)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Pack struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		RoundCount  int    `json:"roundCount"`
	}
	packs := []Pack{}
	for rows.Next() {
		var p Pack
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.RoundCount); err != nil {
			continue
		}
		packs = append(packs, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"packs": packs})
}

func handleCreateSession(w http.ResponseWriter, r *http.Request) {
	user, ok := authlib.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var body struct {
		PackID int    `json:"packId"`
		Name   string `json:"name"`
		Mode   string `json:"mode"` // team | individual
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, `{"error":"name and packId required"}`, http.StatusBadRequest)
		return
	}
	if body.Mode == "" {
		body.Mode = "team"
	}

	joinCode, err := generateCode(6)
	if err != nil {
		http.Error(w, `{"error":"could not generate code"}`, http.StatusInternalServerError)
		return
	}

	var sessionID int
	err = quizDB.QueryRow(`
		INSERT INTO sessions (pack_id, name, mode, join_code, created_by)
		VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		body.PackID, body.Name, body.Mode, joinCode, user.Email,
	).Scan(&sessionID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// In team mode, create initial teams if desired. Return session info.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessionId": sessionID,
		"joinCode":  joinCode,
		"mode":      body.Mode,
	})
}

func handleGetSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var s Session
	var startedAt, completedAt sql.NullTime
	var createdBy sql.NullString
	err = quizDB.QueryRow(`
		SELECT id, pack_id, name, mode, status, join_code, COALESCE(created_by,''), created_at, started_at, completed_at
		FROM sessions WHERE id = $1`, sessionID).
		Scan(&s.ID, &s.PackID, &s.Name, &s.Mode, &s.Status, &s.JoinCode,
			&createdBy, &s.CreatedAt, &startedAt, &completedAt)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	s.CreatedBy = createdBy.String
	if startedAt.Valid {
		s.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		s.CompletedAt = &completedAt.Time
	}

	// Get players
	players, _ := getSessionPlayers(sessionID)

	// Get teams
	teams, _ := getSessionTeams(sessionID)

	// Get rounds with questions
	rounds, _ := getSessionRounds(s.PackID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session": s,
		"players": players,
		"teams":   teams,
		"rounds":  rounds,
	})
}

func handleStartSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	_, err = quizDB.Exec(`UPDATE sessions SET status='active', started_at=NOW() WHERE id=$1`, sessionID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// Notify players
	_ = publishEvent(sessionID, "quiz_started", map[string]interface{}{"sessionId": sessionID})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func handleLoadQuestion(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		RoundID        int `json:"roundId"`
		QuestionID     int `json:"questionId"`
		QuestionNumber int `json:"questionNumber"`
		RoundNumber    int `json:"roundNumber"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Fetch question details
	var text, qtype, imagePath, audioPath string
	var imageID, audioID sql.NullInt64
	err = quizDB.QueryRow(`
		SELECT q.text, q.type, q.image_id, q.audio_id,
		       COALESCE(img.file_path,''), COALESCE(aud.file_path,'')
		FROM questions q
		LEFT JOIN media_files img ON img.id = q.image_id
		LEFT JOIN media_files aud ON aud.id = q.audio_id
		WHERE q.id = $1`, body.QuestionID).
		Scan(&text, &qtype, &imageID, &audioID, &imagePath, &audioPath)
	if err != nil {
		http.Error(w, `{"error":"question not found"}`, http.StatusNotFound)
		return
	}

	// Get time limit from round
	var timeLimit sql.NullInt64
	quizDB.QueryRow(`SELECT time_limit_seconds FROM rounds WHERE id = $1`, body.RoundID).Scan(&timeLimit)

	payload := map[string]interface{}{
		"roundId":        body.RoundID,
		"questionId":     body.QuestionID,
		"questionNumber": body.QuestionNumber,
		"roundNumber":    body.RoundNumber,
		"questionText":   text,
		"imageUrl":       imagePath,
		"audioUrl":       audioPath,
		"timeLimit":      nil,
	}
	if timeLimit.Valid {
		payload["timeLimit"] = timeLimit.Int64
	}

	_ = publishEvent(sessionID, "question_precache", payload)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "loaded"})
}

func handleRevealQuestion(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		QuestionID int `json:"questionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	_ = publishEvent(sessionID, "question_reveal", map[string]interface{}{"questionId": body.QuestionID})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "revealed"})
}

func handleAudioPlay(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		AudioURL string `json:"audioUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	_ = publishEvent(sessionID, "audio_play", map[string]interface{}{"audioUrl": body.AudioURL})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "playing"})
}

func handleCloseAnswers(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		QuestionID int `json:"questionId"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	_ = publishEvent(sessionID, "answers_closed", map[string]interface{}{"questionId": body.QuestionID})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "closed"})
}

func handleStartTimer(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		QuestionID      int `json:"questionId"`
		DurationSeconds int `json:"durationSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	_ = publishEvent(sessionID, "timer_start", map[string]interface{}{
		"questionId":      body.QuestionID,
		"durationSeconds": body.DurationSeconds,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "timer_started"})
}

func handleGetAnswers(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}
	questionID, err := strconv.Atoi(mux.Vars(r)["questionId"])
	if err != nil {
		http.Error(w, `{"error":"invalid questionId"}`, http.StatusBadRequest)
		return
	}

	// Get correct answer for fuzzy matching
	var correctAnswer string
	quizDB.QueryRow(`SELECT answer FROM questions WHERE id = $1`, questionID).Scan(&correctAnswer)

	rows, err := quizDB.Query(`
		SELECT a.id, a.player_id, a.team_id, sp.user_email, COALESCE(sp.user_name,''),
		       COALESCE(t.name,''), COALESCE(a.answer_text,''), a.is_correct, a.points
		FROM answers a
		JOIN session_players sp ON sp.id = a.player_id
		LEFT JOIN teams t ON t.id = a.team_id
		WHERE a.session_id = $1 AND a.question_id = $2
		ORDER BY a.submitted_at`, sessionID, questionID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	answers := []AnswerWithLikely{}
	for rows.Next() {
		var a AnswerWithLikely
		var isCorrect sql.NullBool
		var teamID sql.NullInt64
		if err := rows.Scan(&a.ID, &a.PlayerID, &teamID, &a.PlayerEmail, &a.PlayerName,
			&a.TeamName, &a.AnswerText, &isCorrect, &a.Points); err != nil {
			continue
		}
		if teamID.Valid {
			v := int(teamID.Int64)
			a.TeamID = &v
		}
		if isCorrect.Valid {
			a.IsCorrect = &isCorrect.Bool
		}
		a.IsLikelyCorrect = isLikelyCorrect(a.AnswerText, correctAnswer)
		answers = append(answers, a)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"answers": answers, "correctAnswer": correctAnswer})
}

func handleMarkAnswer(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		AnswerID  int  `json:"answerId"`
		IsCorrect bool `json:"isCorrect"`
		Points    int  `json:"points"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if body.Points == 0 && body.IsCorrect {
		body.Points = 1
	}

	_, err = quizDB.Exec(`
		UPDATE answers SET is_correct=$1, points=$2, marked_at=NOW()
		WHERE id=$3 AND session_id=$4`,
		body.IsCorrect, body.Points, body.AnswerID, sessionID,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "marked"})
}

func handlePushScores(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		RoundID *int `json:"roundId"` // nil = overall scores
	}
	json.NewDecoder(r.Body).Decode(&body)

	// Calculate scores per team (or per player in individual mode)
	rows, err := quizDB.Query(`
		SELECT COALESCE(t.id, sp.id) as entity_id,
		       COALESCE(t.name, sp.user_name, sp.user_email) as entity_name,
		       COALESCE(SUM(a.points), 0) as total_points
		FROM session_players sp
		LEFT JOIN teams t ON t.id = sp.team_id
		LEFT JOIN answers a ON a.player_id = sp.id AND a.session_id = sp.session_id AND a.is_correct = TRUE
		WHERE sp.session_id = $1
		GROUP BY COALESCE(t.id, sp.id), COALESCE(t.name, sp.user_name, sp.user_email)
		ORDER BY total_points DESC`, sessionID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ScoreEntry struct {
		TeamID      int    `json:"teamId"`
		Name        string `json:"name"`
		Total       int    `json:"total"`
		RoundPoints int    `json:"roundPoints"`
	}

	scores := []ScoreEntry{}
	for rows.Next() {
		var s ScoreEntry
		if err := rows.Scan(&s.TeamID, &s.Name, &s.Total); err != nil {
			continue
		}
		scores = append(scores, s)
	}

	// Record the push
	var roundIDVal interface{} = nil
	if body.RoundID != nil {
		roundIDVal = *body.RoundID
	}
	quizDB.Exec(`INSERT INTO score_reveals (session_id, round_id) VALUES ($1, $2)`, sessionID, roundIDVal)

	// Publish to players and display
	_ = publishEvent(sessionID, "scores_revealed", map[string]interface{}{"scores": scores})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"scores": scores})
}

func handleEndSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	_, err = quizDB.Exec(`UPDATE sessions SET status='completed', completed_at=NOW() WHERE id=$1`, sessionID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	_ = publishEvent(sessionID, "quiz_ended", map[string]interface{}{"sessionId": sessionID})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ended"})
}

func handleLobbyStream(w http.ResponseWriter, r *http.Request) {
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

	fmt.Fprintf(w, "event: connected\ndata: {\"sessionId\":%d}\n\n", sessionID)
	flusher.Flush()

	pubsub, msgChan := subscribeToLobby(sessionID)
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

func getSessionPlayers(sessionID int) ([]Player, error) {
	rows, err := quizDB.Query(`
		SELECT sp.id, sp.user_email, COALESCE(sp.user_name,''), sp.team_id, COALESCE(t.name,'')
		FROM session_players sp
		LEFT JOIN teams t ON t.id = sp.team_id
		WHERE sp.session_id = $1 ORDER BY sp.joined_at`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	players := []Player{}
	for rows.Next() {
		var p Player
		var teamID sql.NullInt64
		if err := rows.Scan(&p.ID, &p.UserEmail, &p.UserName, &teamID, &p.TeamName); err != nil {
			continue
		}
		if teamID.Valid {
			v := int(teamID.Int64)
			p.TeamID = &v
		}
		players = append(players, p)
	}
	return players, nil
}

func getSessionTeams(sessionID int) ([]Team, error) {
	rows, err := quizDB.Query(`SELECT id, session_id, name, COALESCE(join_code,'') FROM teams WHERE session_id = $1 ORDER BY id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	teams := []Team{}
	for rows.Next() {
		var t Team
		if err := rows.Scan(&t.ID, &t.SessionID, &t.Name, &t.JoinCode); err != nil {
			continue
		}
		teams = append(teams, t)
	}
	return teams, nil
}

func getSessionRounds(packID int) ([]map[string]interface{}, error) {
	rows, err := quizDB.Query(`
		SELECT r.id, r.round_number, r.name, r.type, COALESCE(r.time_limit_seconds, 0),
		       COUNT(rq.id) as question_count
		FROM rounds r
		LEFT JOIN round_questions rq ON rq.round_id = r.id
		WHERE r.pack_id = $1
		GROUP BY r.id ORDER BY r.round_number`, packID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rounds := []map[string]interface{}{}
	for rows.Next() {
		var id, roundNum, timeLimit, qcount int
		var name, rtype string
		if err := rows.Scan(&id, &roundNum, &name, &rtype, &timeLimit, &qcount); err != nil {
			continue
		}
		// Fetch questions for this round
		qrows, _ := quizDB.Query(`
			SELECT rq.position, q.id, q.text, q.answer, q.type,
			       COALESCE(img.file_path,''), COALESCE(aud.file_path,'')
			FROM round_questions rq
			JOIN questions q ON q.id = rq.question_id
			LEFT JOIN media_files img ON img.id = q.image_id
			LEFT JOIN media_files aud ON aud.id = q.audio_id
			WHERE rq.round_id = $1 ORDER BY rq.position`, id)
		questions := []map[string]interface{}{}
		if qrows != nil {
			for qrows.Next() {
				var pos, qid int
				var text, answer, qtype, imgPath, audPath string
				if err := qrows.Scan(&pos, &qid, &text, &answer, &qtype, &imgPath, &audPath); err == nil {
					questions = append(questions, map[string]interface{}{
						"position": pos, "id": qid, "text": text, "answer": answer,
						"type": qtype, "imagePath": imgPath, "audioPath": audPath,
					})
				}
			}
			qrows.Close()
		}
		rounds = append(rounds, map[string]interface{}{
			"id": id, "roundNumber": roundNum, "name": name, "type": rtype,
			"timeLimitSeconds": timeLimit, "questionCount": qcount, "questions": questions,
		})
	}
	return rounds, nil
}

func generateCode(length int) (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, length)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		code[i] = charset[n.Int64()]
	}
	return string(code), nil
}

// isLikelyCorrect returns true if Levenshtein distance <= 2 (case/whitespace insensitive)
func isLikelyCorrect(submitted, correct string) bool {
	a := strings.TrimSpace(strings.ToLower(submitted))
	b := strings.TrimSpace(strings.ToLower(correct))
	if a == "" || b == "" {
		return false
	}
	return levenshtein(a, b) <= 2
}

func levenshtein(a, b string) int {
	ra := []rune(a)
	rb := []rune(b)
	la := utf8.RuneCountInString(a)
	lb := utf8.RuneCountInString(b)
	_ = ra
	_ = rb

	prev := make([]int, lb+1)
	for j := 0; j <= lb; j++ {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		curr := make([]int, lb+1)
		curr[0] = i
		for j := 1; j <= lb; j++ {
			cost := 1
			if []rune(a)[i-1] == []rune(b)[j-1] {
				cost = 0
			}
			curr[j] = min3(curr[j-1]+1, prev[j]+1, prev[j-1]+cost)
		}
		prev = curr
	}
	return prev[lb]
}

func min3(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}
