package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

func main() {
	var err error

	// Initialize database
	db, err = sql.Open("sqlite3", "../data/identity.db")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	// Create tables
	if err := initDatabase(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Setup router
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", handleHealth).Methods("GET")
	api.HandleFunc("/login", handleLogin).Methods("POST")
	api.HandleFunc("/validate", handleValidate).Methods("POST")

	// CORS configuration - Allow requests from frontend on local network
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	// Start server
	log.Println("Identity Shell Backend starting on :3001")
	log.Fatal(http.ListenAndServe(":3001", corsHandler(r)))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"service": "identity-shell",
		"timestamp": time.Now(),
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// For prototype, accept any email with code "123456"
	if req.Code == "123456" {
		token := "demo-token-" + req.Email // Simple demo token

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"token":   token,
			"user": map[string]string{
				"email": req.Email,
				"name":  req.Email, // Use email as name for now
			},
		})
		return
	}

	http.Error(w, "Invalid credentials", http.StatusUnauthorized)
}

func handleValidate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// For prototype, validate any demo token
	if len(req.Token) > 11 && req.Token[:11] == "demo-token-" {
		email := req.Token[11:]
		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": true,
			"user": map[string]string{
				"email": email,
				"name":  email,
			},
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid": false,
	})
}

func initDatabase() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		email TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		code_hash TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS user_presence (
		email TEXT PRIMARY KEY,
		display_name TEXT NOT NULL,
		status TEXT NOT NULL CHECK(status IN ('online', 'in_game', 'away')),
		current_app TEXT,
		last_seen TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status);
	CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON user_presence(last_seen);
	`

	_, err := db.Exec(schema)
	return err
}
