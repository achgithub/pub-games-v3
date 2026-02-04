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
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// handleGetContent returns all content items (with optional type filtering)
func handleGetContent(w http.ResponseWriter, r *http.Request) {
	contentType := r.URL.Query().Get("type")

	query := `
		SELECT id, title, content_type, duration_seconds, file_path, url,
		       text_content, bg_color, text_color, is_active, created_by,
		       created_at, updated_at
		FROM content_items
		WHERE 1=1
	`
	args := []interface{}{}

	if contentType != "" {
		query += " AND content_type = $1"
		args = append(args, contentType)
	}

	query += " ORDER BY created_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("❌ Error querying content: %v", err)
		respondError(w, "Failed to fetch content", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	content := []ContentItem{}
	for rows.Next() {
		var c ContentItem
		var filePath, url, textContent, bgColor, textColor, createdBy sql.NullString

		err := rows.Scan(&c.ID, &c.Title, &c.ContentType, &c.DurationSeconds,
			&filePath, &url, &textContent, &bgColor, &textColor,
			&c.IsActive, &createdBy, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			log.Printf("❌ Error scanning content: %v", err)
			continue
		}

		c.FilePath = filePath.String
		c.URL = url.String
		c.TextContent = textContent.String
		c.BgColor = bgColor.String
		c.TextColor = textColor.String
		c.CreatedBy = createdBy.String

		content = append(content, c)
	}

	respondJSON(w, APIResponse{Success: true, Data: content})
}

// handleCreateContent creates a new content item
func handleCreateContent(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req ContentItem
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validation
	if req.Title == "" {
		respondError(w, "Title is required", http.StatusBadRequest)
		return
	}

	validTypes := []string{"image", "url", "social_feed", "leaderboard", "schedule", "announcement"}
	isValidType := false
	for _, t := range validTypes {
		if req.ContentType == t {
			isValidType = true
			break
		}
	}
	if !isValidType {
		respondError(w, "Invalid content_type", http.StatusBadRequest)
		return
	}

	if req.DurationSeconds <= 0 {
		req.DurationSeconds = 10 // Default duration
	}

	var content ContentItem
	var filePath, url, textContent, bgColor, textColor, createdBy sql.NullString
	err := db.QueryRow(`
		INSERT INTO content_items (title, content_type, duration_seconds, file_path, url,
		                           text_content, bg_color, text_color, created_by, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
		RETURNING id, title, content_type, duration_seconds, file_path, url,
		          text_content, bg_color, text_color, is_active, created_by,
		          created_at, updated_at
	`, req.Title, req.ContentType, req.DurationSeconds, nullString(req.FilePath),
		nullString(req.URL), nullString(req.TextContent), nullString(req.BgColor),
		nullString(req.TextColor), user.Email).Scan(
		&content.ID, &content.Title, &content.ContentType, &content.DurationSeconds,
		&filePath, &url, &textContent, &bgColor,
		&textColor, &content.IsActive, &createdBy,
		&content.CreatedAt, &content.UpdatedAt,
	)

	if err != nil {
		log.Printf("❌ Error creating content: %v", err)
		respondError(w, "Failed to create content", http.StatusInternalServerError)
		return
	}

	content.FilePath = filePath.String
	content.URL = url.String
	content.TextContent = textContent.String
	content.BgColor = bgColor.String
	content.TextColor = textColor.String
	content.CreatedBy = createdBy.String

	log.Printf("✅ Created content: %s (type: %s) by %s", content.Title, content.ContentType, user.Email)
	respondJSON(w, APIResponse{Success: true, Data: content})
}

// handleUploadImage handles image file upload
func handleUploadImage(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse multipart form (10MB max)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		respondError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		respondError(w, "Image file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		respondError(w, "File must be an image", http.StatusBadRequest)
		return
	}

	// Get form fields
	title := r.FormValue("title")
	if title == "" {
		title = header.Filename
	}

	durationSeconds := 10 // Default
	if d := r.FormValue("duration_seconds"); d != "" {
		fmt.Sscanf(d, "%d", &durationSeconds)
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%d-%s%s", time.Now().Unix(), uuid.New().String()[:8], ext)
	filePath := filepath.Join("./uploads", filename)

	// Ensure uploads directory exists
	if err := os.MkdirAll("./uploads", 0755); err != nil {
		log.Printf("❌ Error creating uploads directory: %v", err)
		respondError(w, "Failed to create uploads directory", http.StatusInternalServerError)
		return
	}

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("❌ Error creating file: %v", err)
		respondError(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		log.Printf("❌ Error writing file: %v", err)
		respondError(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Store relative path for serving
	relPath := "/uploads/" + filename

	// Create content item in database
	var content ContentItem
	err = db.QueryRow(`
		INSERT INTO content_items (title, content_type, duration_seconds, file_path, created_by, is_active)
		VALUES ($1, 'image', $2, $3, $4, true)
		RETURNING id, title, content_type, duration_seconds, file_path, url,
		          text_content, bg_color, text_color, is_active, created_by,
		          created_at, updated_at
	`, title, durationSeconds, relPath, user.Email).Scan(
		&content.ID, &content.Title, &content.ContentType, &content.DurationSeconds,
		&content.FilePath, &content.URL, &content.TextContent, &content.BgColor,
		&content.TextColor, &content.IsActive, &content.CreatedBy,
		&content.CreatedAt, &content.UpdatedAt,
	)

	if err != nil {
		log.Printf("❌ Error creating content record: %v", err)
		os.Remove(filePath) // Clean up uploaded file
		respondError(w, "Failed to create content record", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Uploaded image: %s (%s) by %s", filename, title, user.Email)
	respondJSON(w, APIResponse{Success: true, Data: content})
}

// handleGetContentItem returns a single content item
func handleGetContentItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var c ContentItem
	var filePath, url, textContent, bgColor, textColor, createdBy sql.NullString

	err := db.QueryRow(`
		SELECT id, title, content_type, duration_seconds, file_path, url,
		       text_content, bg_color, text_color, is_active, created_by,
		       created_at, updated_at
		FROM content_items
		WHERE id = $1
	`, id).Scan(&c.ID, &c.Title, &c.ContentType, &c.DurationSeconds,
		&filePath, &url, &textContent, &bgColor, &textColor,
		&c.IsActive, &createdBy, &c.CreatedAt, &c.UpdatedAt)

	if err == sql.ErrNoRows {
		respondError(w, "Content not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error fetching content: %v", err)
		respondError(w, "Failed to fetch content", http.StatusInternalServerError)
		return
	}

	c.FilePath = filePath.String
	c.URL = url.String
	c.TextContent = textContent.String
	c.BgColor = bgColor.String
	c.TextColor = textColor.String
	c.CreatedBy = createdBy.String

	respondJSON(w, APIResponse{Success: true, Data: c})
}

// handleUpdateContent updates an existing content item
func handleUpdateContent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req ContentItem
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update with COALESCE to keep existing values if not provided
	var content ContentItem
	var filePath, url, textContent, bgColor, textColor, createdBy sql.NullString

	err := db.QueryRow(`
		UPDATE content_items
		SET title = COALESCE(NULLIF($1, ''), title),
		    duration_seconds = COALESCE(NULLIF($2, 0), duration_seconds),
		    file_path = COALESCE(NULLIF($3, ''), file_path),
		    url = COALESCE(NULLIF($4, ''), url),
		    text_content = COALESCE(NULLIF($5, ''), text_content),
		    bg_color = COALESCE(NULLIF($6, ''), bg_color),
		    text_color = COALESCE(NULLIF($7, ''), text_color),
		    is_active = COALESCE($8, is_active),
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $9
		RETURNING id, title, content_type, duration_seconds, file_path, url,
		          text_content, bg_color, text_color, is_active, created_by,
		          created_at, updated_at
	`, req.Title, req.DurationSeconds, req.FilePath, req.URL, req.TextContent,
		req.BgColor, req.TextColor, &req.IsActive, id).Scan(
		&content.ID, &content.Title, &content.ContentType, &content.DurationSeconds,
		&filePath, &url, &textContent, &bgColor, &textColor,
		&content.IsActive, &createdBy, &content.CreatedAt, &content.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		respondError(w, "Content not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error updating content: %v", err)
		respondError(w, "Failed to update content", http.StatusInternalServerError)
		return
	}

	content.FilePath = filePath.String
	content.URL = url.String
	content.TextContent = textContent.String
	content.BgColor = bgColor.String
	content.TextColor = textColor.String
	content.CreatedBy = createdBy.String

	log.Printf("✅ Updated content: %s", content.Title)
	respondJSON(w, APIResponse{Success: true, Data: content})
}

// handleDeleteContent deletes a content item
func handleDeleteContent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Get file path before deleting (to clean up uploaded file)
	var filePath sql.NullString
	db.QueryRow("SELECT file_path FROM content_items WHERE id = $1", id).Scan(&filePath)

	result, err := db.Exec("DELETE FROM content_items WHERE id = $1", id)
	if err != nil {
		log.Printf("❌ Error deleting content: %v", err)
		respondError(w, "Failed to delete content", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, "Content not found", http.StatusNotFound)
		return
	}

	// Clean up uploaded file if it exists
	if filePath.Valid && filePath.String != "" {
		// Convert relative path to filesystem path
		fsPath := strings.TrimPrefix(filePath.String, "/uploads/")
		fsPath = filepath.Join("./uploads", fsPath)
		if err := os.Remove(fsPath); err != nil {
			log.Printf("⚠️  Warning: Could not delete file: %s", fsPath)
		}
	}

	log.Printf("✅ Deleted content ID: %s", id)
	respondJSON(w, APIResponse{Success: true, Data: map[string]string{"message": "Content deleted"}})
}

// nullString converts empty string to NULL for database
func nullString(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}
