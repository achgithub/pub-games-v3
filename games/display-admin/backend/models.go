package main

import "time"

// Display represents a physical TV/screen
type Display struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Location    string    `json:"location"`
	Description string    `json:"description"`
	Token       string    `json:"token"` // UUID for TV identification
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

// ContentItem represents a piece of displayable content
type ContentItem struct {
	ID              int       `json:"id"`
	Title           string    `json:"title"`
	ContentType     string    `json:"content_type"` // image, url, social_feed, leaderboard, schedule, announcement
	DurationSeconds int       `json:"duration_seconds"`
	FilePath        string    `json:"file_path,omitempty"`        // For image
	URL             string    `json:"url,omitempty"`              // For url, social_feed, leaderboard, schedule
	TextContent     string    `json:"text_content,omitempty"`     // For announcement
	BgColor         string    `json:"bg_color,omitempty"`         // For announcement
	TextColor       string    `json:"text_color,omitempty"`       // For announcement
	IsActive        bool      `json:"is_active"`
	CreatedBy       string    `json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Playlist represents an ordered sequence of content
type Playlist struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PlaylistItem links content to playlists with ordering
type PlaylistItem struct {
	ID               int `json:"id"`
	PlaylistID       int `json:"playlist_id"`
	ContentItemID    int `json:"content_item_id"`
	DisplayOrder     int `json:"display_order"`
	OverrideDuration *int `json:"override_duration,omitempty"` // Optional override
	CreatedAt        time.Time `json:"created_at"`
}

// PlaylistWithContent includes full content item details
type PlaylistWithContent struct {
	Playlist
	Items []ContentItem `json:"items"`
}

// DisplayAssignment assigns playlists to displays with scheduling
type DisplayAssignment struct {
	ID          int        `json:"id"`
	DisplayID   int        `json:"display_id"`
	PlaylistID  int        `json:"playlist_id"`
	Priority    int        `json:"priority"`
	StartDate   *time.Time `json:"start_date,omitempty"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	StartTime   *string    `json:"start_time,omitempty"` // HH:MM:SS format
	EndTime     *string    `json:"end_time,omitempty"`   // HH:MM:SS format
	DaysOfWeek  *string    `json:"days_of_week,omitempty"` // "Mon,Tue,Wed" format
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// DisplayAssignmentWithDetails includes display and playlist names
type DisplayAssignmentWithDetails struct {
	DisplayAssignment
	DisplayName  string `json:"display_name"`
	PlaylistName string `json:"playlist_name"`
}

// APIResponse is a generic response wrapper
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
