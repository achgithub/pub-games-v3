package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

const (
	maxImageSize = 10 << 20 // 10 MB
	maxAudioSize = 20 << 20 // 20 MB
	uploadsBase  = "./uploads/quiz"
)

// --- Media handlers ---

func handleQuizMediaUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAudioSize)
	if err := r.ParseMultipartForm(maxAudioSize); err != nil {
		http.Error(w, `{"error":"file too large or invalid form"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"missing file field"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	mediaType := ""
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp":
		mediaType = "image"
		if header.Size > maxImageSize {
			http.Error(w, `{"error":"image exceeds 10MB limit"}`, http.StatusBadRequest)
			return
		}
	case ".mp3", ".ogg", ".wav", ".m4a":
		mediaType = "audio"
	default:
		http.Error(w, `{"error":"unsupported file type"}`, http.StatusBadRequest)
		return
	}

	subdir := filepath.Join(uploadsBase, mediaType+"s")
	if err := os.MkdirAll(subdir, 0755); err != nil {
		http.Error(w, `{"error":"could not create upload directory"}`, http.StatusInternalServerError)
		return
	}

	timestamp := time.Now().UnixMilli()
	storedName := fmt.Sprintf("%d-%s%s", timestamp, sanitizeFilename(strings.TrimSuffix(header.Filename, ext)), ext)
	destPath := filepath.Join(subdir, storedName)

	dest, err := os.Create(destPath)
	if err != nil {
		http.Error(w, `{"error":"could not save file"}`, http.StatusInternalServerError)
		return
	}
	defer dest.Close()

	if _, err := io.Copy(dest, file); err != nil {
		http.Error(w, `{"error":"could not write file"}`, http.StatusInternalServerError)
		return
	}

	urlPath := fmt.Sprintf("/uploads/quiz/%ss/%s", mediaType, storedName)

	var id int
	err = quizDB.QueryRow(
		`INSERT INTO media_files (filename, original_name, type, file_path, size_bytes)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		storedName, header.Filename, mediaType, urlPath, header.Size,
	).Scan(&id)
	if err != nil {
		log.Printf("media insert error: %v", err)
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":           id,
		"filename":     storedName,
		"originalName": header.Filename,
		"type":         mediaType,
		"filePath":     urlPath,
		"sizeBytes":    header.Size,
	})
}

func handleGetQuizMedia(w http.ResponseWriter, r *http.Request) {
	mediaType := r.URL.Query().Get("type") // optional filter: image | audio

	query := `SELECT id, filename, original_name, type, file_path, size_bytes, created_at FROM media_files`
	args := []interface{}{}
	if mediaType == "image" || mediaType == "audio" {
		query += ` WHERE type = $1`
		args = append(args, mediaType)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := quizDB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type MediaFile struct {
		ID           int    `json:"id"`
		Filename     string `json:"filename"`
		OriginalName string `json:"originalName"`
		Type         string `json:"type"`
		FilePath     string `json:"filePath"`
		SizeBytes    int64  `json:"sizeBytes"`
		CreatedAt    string `json:"createdAt"`
	}

	files := []MediaFile{}
	for rows.Next() {
		var f MediaFile
		var sizeBytes sql.NullInt64
		if err := rows.Scan(&f.ID, &f.Filename, &f.OriginalName, &f.Type, &f.FilePath, &sizeBytes, &f.CreatedAt); err != nil {
			continue
		}
		f.SizeBytes = sizeBytes.Int64
		files = append(files, f)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"files": files})
}

func handleDeleteQuizMedia(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var filePath string
	err = quizDB.QueryRow(`SELECT file_path FROM media_files WHERE id = $1`, id).Scan(&filePath)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// Remove file from disk (path is relative to backend: ./uploads/... → strip leading /)
	diskPath := "." + filePath
	_ = os.Remove(diskPath)

	_, err = quizDB.Exec(`DELETE FROM media_files WHERE id = $1`, id)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// --- Question handlers ---

func handleGetQuizQuestions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	qType := q.Get("type")
	category := q.Get("category")

	query := `
		SELECT q.id, q.text, q.answer, COALESCE(q.category,''), q.difficulty, q.type,
		       q.image_id, q.audio_id, q.is_test_content, q.created_at,
		       COALESCE(img.file_path,''), COALESCE(aud.file_path,'')
		FROM questions q
		LEFT JOIN media_files img ON img.id = q.image_id
		LEFT JOIN media_files aud ON aud.id = q.audio_id
		WHERE 1=1`
	args := []interface{}{}
	idx := 1
	if qType != "" {
		query += fmt.Sprintf(" AND q.type = $%d", idx)
		args = append(args, qType)
		idx++
	}
	if category != "" {
		query += fmt.Sprintf(" AND q.category = $%d", idx)
		args = append(args, category)
		idx++
	}
	query += " ORDER BY q.id DESC"

	rows, err := quizDB.Query(query, args...)
	if err != nil {
		log.Printf("questions query error: %v", err)
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Question struct {
		ID            int    `json:"id"`
		Text          string `json:"text"`
		Answer        string `json:"answer"`
		Category      string `json:"category"`
		Difficulty    string `json:"difficulty"`
		Type          string `json:"type"`
		ImageID       *int   `json:"imageId"`
		AudioID       *int   `json:"audioId"`
		IsTestContent bool   `json:"isTestContent"`
		CreatedAt     string `json:"createdAt"`
		ImagePath     string `json:"imagePath"`
		AudioPath     string `json:"audioPath"`
	}

	questions := []Question{}
	for rows.Next() {
		var q Question
		var imageID, audioID sql.NullInt64
		if err := rows.Scan(&q.ID, &q.Text, &q.Answer, &q.Category, &q.Difficulty, &q.Type,
			&imageID, &audioID, &q.IsTestContent, &q.CreatedAt,
			&q.ImagePath, &q.AudioPath); err != nil {
			continue
		}
		if imageID.Valid {
			v := int(imageID.Int64)
			q.ImageID = &v
		}
		if audioID.Valid {
			v := int(audioID.Int64)
			q.AudioID = &v
		}
		questions = append(questions, q)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"questions": questions})
}

func handleCreateQuizQuestion(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Text          string `json:"text"`
		Answer        string `json:"answer"`
		Category      string `json:"category"`
		Difficulty    string `json:"difficulty"`
		Type          string `json:"type"`
		ImageID       *int   `json:"imageId"`
		AudioID       *int   `json:"audioId"`
		IsTestContent bool   `json:"isTestContent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if body.Text == "" || body.Answer == "" {
		http.Error(w, `{"error":"text and answer required"}`, http.StatusBadRequest)
		return
	}
	if body.Type == "" {
		body.Type = "text"
	}
	if body.Difficulty == "" {
		body.Difficulty = "medium"
	}

	var id int
	err := quizDB.QueryRow(
		`INSERT INTO questions (text, answer, category, difficulty, type, image_id, audio_id, is_test_content)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		body.Text, body.Answer, nullableStr(body.Category), body.Difficulty,
		body.Type, nullableInt(body.ImageID), nullableInt(body.AudioID), body.IsTestContent,
	).Scan(&id)
	if err != nil {
		log.Printf("create question error: %v", err)
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id})
}

func handleUpdateQuizQuestion(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		Text          string `json:"text"`
		Answer        string `json:"answer"`
		Category      string `json:"category"`
		Difficulty    string `json:"difficulty"`
		Type          string `json:"type"`
		ImageID       *int   `json:"imageId"`
		AudioID       *int   `json:"audioId"`
		IsTestContent bool   `json:"isTestContent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	_, err = quizDB.Exec(
		`UPDATE questions SET text=$1, answer=$2, category=$3, difficulty=$4, type=$5,
		 image_id=$6, audio_id=$7, is_test_content=$8 WHERE id=$9`,
		body.Text, body.Answer, nullableStr(body.Category), body.Difficulty,
		body.Type, nullableInt(body.ImageID), nullableInt(body.AudioID), body.IsTestContent, id,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func handleDeleteQuizQuestion(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	_, err = quizDB.Exec(`DELETE FROM questions WHERE id = $1`, id)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// --- Pack handlers ---

func handleGetQuizPacks(w http.ResponseWriter, r *http.Request) {
	rows, err := quizDB.Query(`
		SELECT p.id, p.name, COALESCE(p.description,''), COALESCE(p.created_by,''), p.created_at,
		       COUNT(r.id) as round_count
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
		CreatedBy   string `json:"createdBy"`
		CreatedAt   string `json:"createdAt"`
		RoundCount  int    `json:"roundCount"`
	}

	packs := []Pack{}
	for rows.Next() {
		var p Pack
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedBy, &p.CreatedAt, &p.RoundCount); err != nil {
			continue
		}
		packs = append(packs, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"packs": packs})
}

func handleCreateQuizPack(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		CreatedBy   string `json:"createdBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, `{"error":"name required"}`, http.StatusBadRequest)
		return
	}

	var id int
	err := quizDB.QueryRow(
		`INSERT INTO quiz_packs (name, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
		body.Name, nullableStr(body.Description), nullableStr(body.CreatedBy),
	).Scan(&id)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id})
}

func handleDeleteQuizPack(w http.ResponseWriter, r *http.Request) {
	packID, err := strconv.Atoi(mux.Vars(r)["packId"])
	if err != nil {
		http.Error(w, `{"error":"invalid packId"}`, http.StatusBadRequest)
		return
	}

	_, err = quizDB.Exec(`DELETE FROM quiz_packs WHERE id = $1`, packID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// --- Round handlers ---

func handleGetPackRounds(w http.ResponseWriter, r *http.Request) {
	packID, err := strconv.Atoi(mux.Vars(r)["packId"])
	if err != nil {
		http.Error(w, `{"error":"invalid packId"}`, http.StatusBadRequest)
		return
	}

	rows, err := quizDB.Query(`
		SELECT r.id, r.round_number, r.name, r.type, COALESCE(r.time_limit_seconds, 0),
		       COUNT(rq.id) as question_count
		FROM rounds r
		LEFT JOIN round_questions rq ON rq.round_id = r.id
		WHERE r.pack_id = $1
		GROUP BY r.id ORDER BY r.round_number`, packID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Round struct {
		ID               int    `json:"id"`
		RoundNumber      int    `json:"roundNumber"`
		Name             string `json:"name"`
		Type             string `json:"type"`
		TimeLimitSeconds int    `json:"timeLimitSeconds"`
		QuestionCount    int    `json:"questionCount"`
	}

	rounds := []Round{}
	for rows.Next() {
		var rd Round
		if err := rows.Scan(&rd.ID, &rd.RoundNumber, &rd.Name, &rd.Type, &rd.TimeLimitSeconds, &rd.QuestionCount); err != nil {
			continue
		}
		rounds = append(rounds, rd)
	}

	// Also fetch questions for each round
	type RoundWithQuestions struct {
		Round
		Questions []map[string]interface{} `json:"questions"`
	}
	result := []RoundWithQuestions{}
	for _, rd := range rounds {
		qrows, err := quizDB.Query(`
			SELECT rq.position, q.id, q.text, q.answer, q.type,
			       COALESCE(img.file_path,''), COALESCE(aud.file_path,'')
			FROM round_questions rq
			JOIN questions q ON q.id = rq.question_id
			LEFT JOIN media_files img ON img.id = q.image_id
			LEFT JOIN media_files aud ON aud.id = q.audio_id
			WHERE rq.round_id = $1
			ORDER BY rq.position`, rd.ID)
		questions := []map[string]interface{}{}
		if err == nil {
			for qrows.Next() {
				var pos, qid int
				var text, answer, qtype, imgPath, audPath string
				if err := qrows.Scan(&pos, &qid, &text, &answer, &qtype, &imgPath, &audPath); err == nil {
					questions = append(questions, map[string]interface{}{
						"position":  pos,
						"id":        qid,
						"text":      text,
						"answer":    answer,
						"type":      qtype,
						"imagePath": imgPath,
						"audioPath": audPath,
					})
				}
			}
			qrows.Close()
		}
		result = append(result, RoundWithQuestions{Round: rd, Questions: questions})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"rounds": result})
}

func handleCreatePackRound(w http.ResponseWriter, r *http.Request) {
	packID, err := strconv.Atoi(mux.Vars(r)["packId"])
	if err != nil {
		http.Error(w, `{"error":"invalid packId"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		RoundNumber      int    `json:"roundNumber"`
		Name             string `json:"name"`
		Type             string `json:"type"`
		TimeLimitSeconds *int   `json:"timeLimitSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if body.Name == "" || body.Type == "" {
		http.Error(w, `{"error":"name and type required"}`, http.StatusBadRequest)
		return
	}

	var id int
	err = quizDB.QueryRow(
		`INSERT INTO rounds (pack_id, round_number, name, type, time_limit_seconds)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		packID, body.RoundNumber, body.Name, body.Type, nullableInt(body.TimeLimitSeconds),
	).Scan(&id)
	if err != nil {
		log.Printf("create round error: %v", err)
		http.Error(w, `{"error":"database error (round number may be duplicate)"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id})
}

func handleDeletePackRound(w http.ResponseWriter, r *http.Request) {
	roundID, err := strconv.Atoi(mux.Vars(r)["roundId"])
	if err != nil {
		http.Error(w, `{"error":"invalid roundId"}`, http.StatusBadRequest)
		return
	}

	_, err = quizDB.Exec(`DELETE FROM rounds WHERE id = $1`, roundID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

func handleSetRoundQuestions(w http.ResponseWriter, r *http.Request) {
	roundID, err := strconv.Atoi(mux.Vars(r)["roundId"])
	if err != nil {
		http.Error(w, `{"error":"invalid roundId"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		QuestionIDs []int `json:"questionIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	tx, err := quizDB.Begin()
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM round_questions WHERE round_id = $1`, roundID); err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	for pos, qid := range body.QuestionIDs {
		if _, err := tx.Exec(
			`INSERT INTO round_questions (round_id, question_id, position) VALUES ($1, $2, $3)`,
			roundID, qid, pos+1,
		); err != nil {
			http.Error(w, `{"error":"database error inserting question"}`, http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"updated": len(body.QuestionIDs)})
}

// --- Helpers ---

func sanitizeFilename(name string) string {
	// Replace non-alphanumeric (except dash/underscore) with underscore
	var b strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	result := b.String()
	if len(result) > 40 {
		result = result[:40]
	}
	return result
}

func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullableInt(i *int) interface{} {
	if i == nil {
		return nil
	}
	return *i
}
