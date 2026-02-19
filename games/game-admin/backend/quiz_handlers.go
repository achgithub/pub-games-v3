package main

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/csv"
	"encoding/hex"
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

	// Buffer entire file for hashing
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, file); err != nil {
		http.Error(w, `{"error":"could not read file"}`, http.StatusInternalServerError)
		return
	}
	fileBytes := buf.Bytes()

	// Compute SHA-256 hash for deduplication
	hashBytes := sha256.Sum256(fileBytes)
	contentHash := hex.EncodeToString(hashBytes[:])

	type ClipInfo struct {
		ID    int    `json:"id"`
		Guid  string `json:"guid"`
		Label string `json:"label"`
	}
	type UploadResponse struct {
		ID           int      `json:"id"`
		Guid         string   `json:"guid"`
		Filename     string   `json:"filename"`
		OriginalName string   `json:"originalName"`
		Type         string   `json:"type"`
		FilePath     string   `json:"filePath"`
		SizeBytes    int64    `json:"sizeBytes"`
		Clip         ClipInfo `json:"clip"`
		Deduplicated bool     `json:"deduplicated"`
	}

	// Check for existing record with same hash
	var existingID int
	var existingGuid, existingFilePath string
	var existingSizeBytes int64
	err = quizDB.QueryRow(
		`SELECT id, guid::text, file_path, COALESCE(size_bytes, 0) FROM media_files WHERE content_hash = $1`,
		contentHash,
	).Scan(&existingID, &existingGuid, &existingFilePath, &existingSizeBytes)
	if err == nil {
		// Duplicate found — return existing record with its default clip
		var clip ClipInfo
		_ = quizDB.QueryRow(
			`SELECT id, guid::text, label FROM media_clips WHERE media_file_id = $1 ORDER BY id LIMIT 1`,
			existingID,
		).Scan(&clip.ID, &clip.Guid, &clip.Label)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(UploadResponse{
			ID:           existingID,
			Guid:         existingGuid,
			OriginalName: header.Filename,
			Type:         mediaType,
			FilePath:     existingFilePath,
			SizeBytes:    existingSizeBytes,
			Clip:         clip,
			Deduplicated: true,
		})
		return
	}
	if err != sql.ErrNoRows {
		log.Printf("media dedup query error: %v", err)
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// New file — write to disk
	subdir := filepath.Join(uploadsBase, mediaType+"s")
	if err := os.MkdirAll(subdir, 0755); err != nil {
		http.Error(w, `{"error":"could not create upload directory"}`, http.StatusInternalServerError)
		return
	}

	timestamp := time.Now().UnixMilli()
	storedName := fmt.Sprintf("%d-%s%s", timestamp, sanitizeFilename(strings.TrimSuffix(header.Filename, ext)), ext)
	destPath := filepath.Join(subdir, storedName)

	if err := os.WriteFile(destPath, fileBytes, 0644); err != nil {
		http.Error(w, `{"error":"could not save file"}`, http.StatusInternalServerError)
		return
	}

	urlPath := fmt.Sprintf("/uploads/quiz/%ss/%s", mediaType, storedName)
	label := strings.TrimSuffix(header.Filename, ext)

	// Insert media_file with hash, guid, label
	var fileID int
	var fileGuid string
	err = quizDB.QueryRow(
		`INSERT INTO media_files (filename, original_name, type, file_path, size_bytes, content_hash, label)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, guid::text`,
		storedName, header.Filename, mediaType, urlPath, header.Size, contentHash, label,
	).Scan(&fileID, &fileGuid)
	if err != nil {
		log.Printf("media insert error: %v", err)
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	// Auto-insert default clip
	var clip ClipInfo
	if err := quizDB.QueryRow(
		`INSERT INTO media_clips (media_file_id, label, audio_start_sec)
		 VALUES ($1, $2, 0) RETURNING id, guid::text, label`,
		fileID, label,
	).Scan(&clip.ID, &clip.Guid, &clip.Label); err != nil {
		log.Printf("clip auto-insert error: %v", err)
		// Not fatal — continue without clip info
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(UploadResponse{
		ID:           fileID,
		Guid:         fileGuid,
		Filename:     storedName,
		OriginalName: header.Filename,
		Type:         mediaType,
		FilePath:     urlPath,
		SizeBytes:    header.Size,
		Clip:         clip,
		Deduplicated: false,
	})
}

func handleGetQuizMedia(w http.ResponseWriter, r *http.Request) {
	mediaType := r.URL.Query().Get("type") // optional filter: image | audio

	query := `SELECT id, filename, original_name, type, file_path, size_bytes, created_at,
	                 guid::text, COALESCE(label, original_name) FROM media_files`
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
		Guid         string `json:"guid"`
		Label        string `json:"label"`
	}

	files := []MediaFile{}
	for rows.Next() {
		var f MediaFile
		var sizeBytes sql.NullInt64
		if err := rows.Scan(&f.ID, &f.Filename, &f.OriginalName, &f.Type, &f.FilePath,
			&sizeBytes, &f.CreatedAt, &f.Guid, &f.Label); err != nil {
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

// --- Clip handlers ---

func handleGetQuizClips(w http.ResponseWriter, r *http.Request) {
	mediaFileIDStr := r.URL.Query().Get("media_file_id")

	query := `
		SELECT mc.id, mc.guid::text, mc.media_file_id, mc.label,
		       mc.audio_start_sec, mc.audio_duration_sec,
		       mf.type, mf.filename, mf.file_path
		FROM media_clips mc
		JOIN media_files mf ON mf.id = mc.media_file_id`
	args := []interface{}{}
	if mediaFileIDStr != "" {
		if mfID, err := strconv.Atoi(mediaFileIDStr); err == nil {
			query += ` WHERE mc.media_file_id = $1`
			args = append(args, mfID)
		}
	}
	query += ` ORDER BY mc.id`

	rows, err := quizDB.Query(query, args...)
	if err != nil {
		log.Printf("get clips error: %v", err)
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Clip struct {
		ID               int      `json:"id"`
		Guid             string   `json:"guid"`
		MediaFileID      int      `json:"mediaFileId"`
		Label            string   `json:"label"`
		AudioStartSec    float64  `json:"audioStartSec"`
		AudioDurationSec *float64 `json:"audioDurationSec"`
		MediaType        string   `json:"mediaType"`
		Filename         string   `json:"filename"`
		FilePath         string   `json:"filePath"`
	}

	clips := []Clip{}
	for rows.Next() {
		var c Clip
		var dur sql.NullFloat64
		if err := rows.Scan(&c.ID, &c.Guid, &c.MediaFileID, &c.Label,
			&c.AudioStartSec, &dur, &c.MediaType, &c.Filename, &c.FilePath); err != nil {
			continue
		}
		if dur.Valid {
			c.AudioDurationSec = &dur.Float64
		}
		clips = append(clips, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"clips": clips})
}

func handleCreateQuizClip(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MediaFileID      int      `json:"mediaFileId"`
		Label            string   `json:"label"`
		AudioStartSec    float64  `json:"audioStartSec"`
		AudioDurationSec *float64 `json:"audioDurationSec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if body.Label == "" {
		http.Error(w, `{"error":"label required"}`, http.StatusBadRequest)
		return
	}

	var id int
	var guid string
	err := quizDB.QueryRow(
		`INSERT INTO media_clips (media_file_id, label, audio_start_sec, audio_duration_sec)
		 VALUES ($1, $2, $3, $4) RETURNING id, guid::text`,
		body.MediaFileID, body.Label, body.AudioStartSec, nullableFloat(body.AudioDurationSec),
	).Scan(&id, &guid)
	if err != nil {
		log.Printf("create clip error: %v", err)
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "guid": guid})
}

func handleUpdateQuizClip(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		Label            string   `json:"label"`
		AudioStartSec    float64  `json:"audioStartSec"`
		AudioDurationSec *float64 `json:"audioDurationSec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	_, err = quizDB.Exec(
		`UPDATE media_clips SET label=$1, audio_start_sec=$2, audio_duration_sec=$3 WHERE id=$4`,
		body.Label, body.AudioStartSec, nullableFloat(body.AudioDurationSec), id,
	)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func handleDeleteQuizClip(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"invalid id"}`, http.StatusBadRequest)
		return
	}

	// Block if any question references this clip
	var refCount int
	_ = quizDB.QueryRow(
		`SELECT COUNT(*) FROM questions WHERE image_clip_id = $1 OR audio_clip_id = $1`, id,
	).Scan(&refCount)
	if refCount > 0 {
		http.Error(w, `{"error":"clip is referenced by questions and cannot be deleted"}`, http.StatusConflict)
		return
	}

	_, err = quizDB.Exec(`DELETE FROM media_clips WHERE id = $1`, id)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

func handleExportClipsCSV(w http.ResponseWriter, r *http.Request) {
	rows, err := quizDB.Query(`
		SELECT mc.guid::text, mc.label, mf.type, mf.filename, mc.audio_start_sec, mc.audio_duration_sec
		FROM media_clips mc
		JOIN media_files mf ON mf.id = mc.media_file_id
		ORDER BY mf.type, mc.label`)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="quiz-clips.csv"`)

	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"guid", "label", "type", "filename", "audio_start_sec", "audio_duration_sec"})

	for rows.Next() {
		var guid, label, mType, filename string
		var audioStart float64
		var audioDuration sql.NullFloat64
		if err := rows.Scan(&guid, &label, &mType, &filename, &audioStart, &audioDuration); err != nil {
			continue
		}
		durStr := ""
		if audioDuration.Valid {
			durStr = strconv.FormatFloat(audioDuration.Float64, 'f', 2, 64)
		}
		_ = cw.Write([]string{
			guid, label, mType, filename,
			strconv.FormatFloat(audioStart, 'f', 2, 64),
			durStr,
		})
	}
	cw.Flush()
}

// --- Question handlers ---

func handleGetQuizQuestions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	qType := q.Get("type")
	category := q.Get("category")

	query := `
		SELECT q.id, q.guid::text, q.text, q.answer, COALESCE(q.category,''), q.difficulty, q.type,
		       q.image_id, q.audio_id, q.is_test_content, q.created_at,
		       COALESCE(img.file_path,''), COALESCE(aud.file_path,''),
		       q.requires_media, q.image_clip_id, q.audio_clip_id
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
		Guid          string `json:"guid"`
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
		RequiresMedia bool   `json:"requiresMedia"`
		ImageClipID   *int   `json:"imageClipId"`
		AudioClipID   *int   `json:"audioClipId"`
	}

	questions := []Question{}
	for rows.Next() {
		var q Question
		var imageID, audioID, imageClipID, audioClipID sql.NullInt64
		if err := rows.Scan(
			&q.ID, &q.Guid, &q.Text, &q.Answer, &q.Category, &q.Difficulty, &q.Type,
			&imageID, &audioID, &q.IsTestContent, &q.CreatedAt,
			&q.ImagePath, &q.AudioPath,
			&q.RequiresMedia, &imageClipID, &audioClipID,
		); err != nil {
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
		if imageClipID.Valid {
			v := int(imageClipID.Int64)
			q.ImageClipID = &v
		}
		if audioClipID.Valid {
			v := int(audioClipID.Int64)
			q.AudioClipID = &v
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
		ImageClipID   *int   `json:"imageClipId"`
		AudioClipID   *int   `json:"audioClipId"`
		RequiresMedia bool   `json:"requiresMedia"`
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

	// Resolve clip IDs → media_file IDs for backward compat
	imageID, audioID := resolveClipToFileIDs(body.ImageClipID, body.AudioClipID)
	// Fall back to direct imageId/audioId if no clip provided
	if imageID == nil {
		imageID = body.ImageID
	}
	if audioID == nil {
		audioID = body.AudioID
	}

	var id int
	err := quizDB.QueryRow(
		`INSERT INTO questions (text, answer, category, difficulty, type, image_id, audio_id,
		                        image_clip_id, audio_clip_id, requires_media, is_test_content)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
		body.Text, body.Answer, nullableStr(body.Category), body.Difficulty, body.Type,
		nullableInt(imageID), nullableInt(audioID),
		nullableInt(body.ImageClipID), nullableInt(body.AudioClipID),
		body.RequiresMedia, body.IsTestContent,
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
		ImageClipID   *int   `json:"imageClipId"`
		AudioClipID   *int   `json:"audioClipId"`
		RequiresMedia bool   `json:"requiresMedia"`
		IsTestContent bool   `json:"isTestContent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Resolve clip IDs → media_file IDs for backward compat
	imageID, audioID := resolveClipToFileIDs(body.ImageClipID, body.AudioClipID)
	if imageID == nil {
		imageID = body.ImageID
	}
	if audioID == nil {
		audioID = body.AudioID
	}

	_, err = quizDB.Exec(
		`UPDATE questions SET text=$1, answer=$2, category=$3, difficulty=$4, type=$5,
		 image_id=$6, audio_id=$7, image_clip_id=$8, audio_clip_id=$9,
		 requires_media=$10, is_test_content=$11 WHERE id=$12`,
		body.Text, body.Answer, nullableStr(body.Category), body.Difficulty, body.Type,
		nullableInt(imageID), nullableInt(audioID),
		nullableInt(body.ImageClipID), nullableInt(body.AudioClipID),
		body.RequiresMedia, body.IsTestContent, id,
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

// handleImportQuizQuestions imports questions from a CSV file upload.
// Required columns: text, answer
// Optional columns: category, difficulty, type, image_guid, audio_guid, requires_media
func handleImportQuizQuestions(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20) // 5MB CSV limit
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		http.Error(w, `{"error":"invalid form"}`, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"missing file field"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, `{"error":"invalid CSV"}`, http.StatusBadRequest)
		return
	}
	if len(records) < 2 {
		http.Error(w, `{"error":"CSV must have a header row and at least one data row"}`, http.StatusBadRequest)
		return
	}

	// Build column index map from header row
	colIdx := make(map[string]int)
	for i, col := range records[0] {
		colIdx[strings.ToLower(strings.TrimSpace(col))] = i
	}

	// Validate required columns
	for _, required := range []string{"text", "answer"} {
		if _, ok := colIdx[required]; !ok {
			http.Error(w, fmt.Sprintf(`{"error":"missing required column: %s"}`, required), http.StatusBadRequest)
			return
		}
	}

	type SkippedRow struct {
		Row    int    `json:"row"`
		Reason string `json:"reason"`
	}

	getCol := func(record []string, name string) string {
		idx, ok := colIdx[name]
		if !ok || idx >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[idx])
	}

	imported := 0
	var skipped []SkippedRow

	for i, record := range records[1:] {
		rowNum := i + 2 // 1-indexed, header = row 1

		text := getCol(record, "text")
		answer := getCol(record, "answer")
		if text == "" || answer == "" {
			skipped = append(skipped, SkippedRow{Row: rowNum, Reason: "text and answer required"})
			continue
		}

		category := getCol(record, "category")
		difficulty := getCol(record, "difficulty")
		if difficulty == "" {
			difficulty = "medium"
		}
		qType := getCol(record, "type")
		if qType == "" {
			qType = "text"
		}

		imageGuid := getCol(record, "image_guid")
		audioGuid := getCol(record, "audio_guid")
		requiresMediaStr := getCol(record, "requires_media")
		requiresMedia := requiresMediaStr == "true" || requiresMediaStr == "1"

		// Resolve image GUID → clip ID + file ID
		var imageClipID, imageID *int
		if imageGuid != "" {
			var clipID, mfID int
			err := quizDB.QueryRow(
				`SELECT mc.id, mc.media_file_id FROM media_clips mc WHERE mc.guid::text = $1`,
				imageGuid,
			).Scan(&clipID, &mfID)
			if err == sql.ErrNoRows {
				skipped = append(skipped, SkippedRow{Row: rowNum, Reason: fmt.Sprintf("image_guid not found: %s", imageGuid)})
				continue
			}
			if err != nil {
				skipped = append(skipped, SkippedRow{Row: rowNum, Reason: "database error resolving image_guid"})
				continue
			}
			imageClipID = &clipID
			imageID = &mfID
		}

		// Resolve audio GUID → clip ID + file ID
		var audioClipID, audioID *int
		if audioGuid != "" {
			var clipID, mfID int
			err := quizDB.QueryRow(
				`SELECT mc.id, mc.media_file_id FROM media_clips mc WHERE mc.guid::text = $1`,
				audioGuid,
			).Scan(&clipID, &mfID)
			if err == sql.ErrNoRows {
				skipped = append(skipped, SkippedRow{Row: rowNum, Reason: fmt.Sprintf("audio_guid not found: %s", audioGuid)})
				continue
			}
			if err != nil {
				skipped = append(skipped, SkippedRow{Row: rowNum, Reason: "database error resolving audio_guid"})
				continue
			}
			audioClipID = &clipID
			audioID = &mfID
		}

		_, err := quizDB.Exec(
			`INSERT INTO questions (text, answer, category, difficulty, type,
			                        image_id, audio_id, image_clip_id, audio_clip_id, requires_media)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			text, answer, nullableStr(category), difficulty, qType,
			nullableInt(imageID), nullableInt(audioID),
			nullableInt(imageClipID), nullableInt(audioClipID),
			requiresMedia,
		)
		if err != nil {
			skipped = append(skipped, SkippedRow{Row: rowNum, Reason: "database error: " + err.Error()})
			continue
		}
		imported++
	}

	if skipped == nil {
		skipped = []SkippedRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
	})
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

	// Check for questions that require media but have no clip assigned
	if len(body.QuestionIDs) > 0 {
		placeholders := make([]string, len(body.QuestionIDs))
		args := make([]interface{}, len(body.QuestionIDs))
		for i, qid := range body.QuestionIDs {
			placeholders[i] = fmt.Sprintf("$%d", i+1)
			args[i] = qid
		}
		var incompleteCount int
		_ = quizDB.QueryRow(
			`SELECT COUNT(*) FROM questions WHERE id IN (`+strings.Join(placeholders, ",")+`)
			 AND requires_media = true AND image_clip_id IS NULL AND audio_clip_id IS NULL`,
			args...,
		).Scan(&incompleteCount)
		if incompleteCount > 0 {
			http.Error(w,
				`{"error":"Question requires media before it can be added to a round"}`,
				http.StatusUnprocessableEntity)
			return
		}
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

func nullableFloat(f *float64) interface{} {
	if f == nil {
		return nil
	}
	return *f
}

// resolveClipToFileIDs looks up media_file_id for each clip ID (for backward compat with image_id/audio_id).
// Returns nil for either if the corresponding clip ID is nil.
func resolveClipToFileIDs(imageClipID, audioClipID *int) (imageID, audioID *int) {
	if imageClipID != nil {
		var mfID int
		if err := quizDB.QueryRow(`SELECT media_file_id FROM media_clips WHERE id = $1`, *imageClipID).Scan(&mfID); err == nil {
			imageID = &mfID
		}
	}
	if audioClipID != nil {
		var mfID int
		if err := quizDB.QueryRow(`SELECT media_file_id FROM media_clips WHERE id = $1`, *audioClipID).Scan(&mfID); err == nil {
			audioID = &mfID
		}
	}
	return
}
