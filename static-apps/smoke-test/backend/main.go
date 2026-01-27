package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var db *sql.DB

const (
	APP_NAME     = "Smoke Test"
	BACKEND_PORT = "5010"
)

func main() {
	log.Printf("🧪 %s Backend Starting", APP_NAME)

	// Initialize database
	var err error
	db, err = InitDatabase()
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}
	defer db.Close()
	log.Println("✅ Connected to PostgreSQL")

	// Setup router
	r := mux.NewRouter()

	// API endpoints
	r.HandleFunc("/api/health", handleHealth).Methods("GET")
	r.HandleFunc("/api/config", HandleConfig).Methods("GET")

	// User sync endpoint (called by shell when user first accesses app)
	r.HandleFunc("/api/sync-user", HandleUserSync).Methods("POST")

	// Protected endpoints (require user query param from shell)
	r.HandleFunc("/api/items", AuthMiddleware(HandleGetItems)).Methods("GET")
	r.HandleFunc("/api/items", AuthMiddleware(HandleCreateItem)).Methods("POST")

	// Admin endpoints
	r.HandleFunc("/api/admin/stats", AdminMiddleware(HandleGetStats)).Methods("GET")

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
	w.Write([]byte(`{"status":"ok","service":"smoke-test"}`))
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
