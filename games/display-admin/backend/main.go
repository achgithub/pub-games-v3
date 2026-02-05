package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

const (
	APP_NAME     = "Display Admin"
	BACKEND_PORT = "5050"
)

func main() {
	log.Printf("📺 %s Backend Starting", APP_NAME)

	// Initialize databases
	if err := InitDatabases(); err != nil {
		log.Fatal("Failed to initialize databases:", err)
	}
	defer db.Close()
	defer identityDB.Close()

	// Setup router
	r := mux.NewRouter()

	// Health check (public)
	r.HandleFunc("/api/health", handleHealth).Methods("GET")

	// All endpoints require admin authentication
	// Display Management
	r.HandleFunc("/api/displays", AuthMiddleware(AdminMiddleware(handleGetDisplays))).Methods("GET")
	r.HandleFunc("/api/displays", AuthMiddleware(AdminMiddleware(handleCreateDisplay))).Methods("POST")
	r.HandleFunc("/api/displays/{id}", AuthMiddleware(AdminMiddleware(handleGetDisplay))).Methods("GET")
	r.HandleFunc("/api/displays/{id}", AuthMiddleware(AdminMiddleware(handleUpdateDisplay))).Methods("PUT")
	r.HandleFunc("/api/displays/{id}", AuthMiddleware(AdminMiddleware(handleDeleteDisplay))).Methods("DELETE")
	r.HandleFunc("/api/displays/{id}/qr", AuthMiddleware(AdminMiddleware(handleGetDisplayQR))).Methods("GET")
	r.HandleFunc("/api/displays/{id}/url", AuthMiddleware(AdminMiddleware(handleGetDisplayURL))).Methods("GET")
	r.HandleFunc("/api/displays/{id}/current-playlist", AuthMiddleware(AdminMiddleware(handleGetDisplayCurrentPlaylist))).Methods("GET")

	// Content Management
	r.HandleFunc("/api/content", AuthMiddleware(AdminMiddleware(handleGetContent))).Methods("GET")
	r.HandleFunc("/api/content", AuthMiddleware(AdminMiddleware(handleCreateContent))).Methods("POST")
	r.HandleFunc("/api/content/upload-image", AuthMiddleware(AdminMiddleware(handleUploadImage))).Methods("POST")
	r.HandleFunc("/api/content/{id}", AuthMiddleware(AdminMiddleware(handleGetContentItem))).Methods("GET")
	r.HandleFunc("/api/content/{id}", AuthMiddleware(AdminMiddleware(handleUpdateContent))).Methods("PUT")
	r.HandleFunc("/api/content/{id}", AuthMiddleware(AdminMiddleware(handleDeleteContent))).Methods("DELETE")

	// Playlist Management
	r.HandleFunc("/api/playlists", AuthMiddleware(AdminMiddleware(handleGetPlaylists))).Methods("GET")
	r.HandleFunc("/api/playlists", AuthMiddleware(AdminMiddleware(handleCreatePlaylist))).Methods("POST")
	r.HandleFunc("/api/playlists/{id}", AuthMiddleware(AdminMiddleware(handleGetPlaylist))).Methods("GET")
	r.HandleFunc("/api/playlists/{id}", AuthMiddleware(AdminMiddleware(handleUpdatePlaylist))).Methods("PUT")
	r.HandleFunc("/api/playlists/{id}", AuthMiddleware(AdminMiddleware(handleDeletePlaylist))).Methods("DELETE")
	r.HandleFunc("/api/playlists/{id}/items", AuthMiddleware(AdminMiddleware(handleAddPlaylistItem))).Methods("POST")
	r.HandleFunc("/api/playlists/{id}/items/{itemId}", AuthMiddleware(AdminMiddleware(handleUpdatePlaylistItem))).Methods("PUT")
	r.HandleFunc("/api/playlists/{id}/items/{itemId}", AuthMiddleware(AdminMiddleware(handleRemovePlaylistItem))).Methods("DELETE")
	r.HandleFunc("/api/playlists/{id}/reorder", AuthMiddleware(AdminMiddleware(handleReorderPlaylist))).Methods("POST")

	// Display Assignments
	r.HandleFunc("/api/assignments", AuthMiddleware(AdminMiddleware(handleGetAssignments))).Methods("GET")
	r.HandleFunc("/api/assignments", AuthMiddleware(AdminMiddleware(handleCreateAssignment))).Methods("POST")
	r.HandleFunc("/api/assignments/display/{displayId}", AuthMiddleware(AdminMiddleware(handleGetDisplayAssignments))).Methods("GET")
	r.HandleFunc("/api/assignments/{id}", AuthMiddleware(AdminMiddleware(handleGetAssignment))).Methods("GET")
	r.HandleFunc("/api/assignments/{id}", AuthMiddleware(AdminMiddleware(handleUpdateAssignment))).Methods("PUT")
	r.HandleFunc("/api/assignments/{id}", AuthMiddleware(AdminMiddleware(handleDeleteAssignment))).Methods("DELETE")

	// Preview (playlist preview requires auth, display preview is public for TVs)
	r.HandleFunc("/api/preview/playlist/{id}", AuthMiddleware(AdminMiddleware(handlePreviewPlaylist))).Methods("GET")
	r.HandleFunc("/api/preview/display/{id}", handlePreviewDisplay).Methods("GET")

	// Display Runtime API (consumed by TVs - no authentication)
	r.HandleFunc("/api/display/by-token/{token}", handleGetDisplayByToken).Methods("GET")

	// Serve uploaded images
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Serve static frontend files (React build output)
	staticDir := getEnv("STATIC_DIR", "./static")
	r.PathPrefix("/").Handler(spaHandler{staticPath: staticDir, indexPath: "index.html"})

	// CORS configuration
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)

	// Start server
	port := getEnv("BACKEND_PORT", BACKEND_PORT)
	log.Printf("🚀 %s backend listening on :%s", APP_NAME, port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

// handleHealth - Health check endpoint
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"display-admin"}`))
}

// getEnv gets environment variable with fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// spaHandler serves a single-page application
type spaHandler struct {
	staticPath string
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Get the absolute path to prevent directory traversal
	path := r.URL.Path

	// Prepend the static directory
	fullPath := h.staticPath + path

	// Check if file exists
	_, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		// File doesn't exist, serve index.html for SPA routing
		http.ServeFile(w, r, h.staticPath+"/"+h.indexPath)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// File exists, serve it
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

// respondJSON sends a JSON response
func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// respondError sends an error JSON response
func respondError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(APIResponse{
		Success: false,
		Error:   message,
	})
}

// All handler functions are implemented in separate files:
// - displays.go: Display CRUD + token generation + QR codes
// - qrcode.go: QR code generation
// - content.go: Content CRUD + image upload
// - playlists.go: Playlist CRUD + reordering
// - assignments.go: Assignment CRUD + scheduling
// - preview.go: Preview logic + active playlist determination
