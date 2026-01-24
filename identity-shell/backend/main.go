package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func main() {
	var err error

	// Get database connection string from environment or use default
	dbHost := getEnv("DB_HOST", "127.0.0.1") // Use TCP/IP for password auth
	dbPort := getEnv("DB_PORT", "5555")      // Pi uses port 5555
	dbUser := getEnv("DB_USER", "pubgames")
	dbPass := getEnv("DB_PASS", "pubgames")
	dbName := getEnv("DB_NAME", "pubgames")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	// Initialize database
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("✅ Connected to PostgreSQL database")

	// Initialize Redis
	if err := InitRedis(); err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}

	log.Println("✅ Connected to Redis")

	// Setup router
	r := mux.NewRouter()

	// Static files (shared CSS for all apps)
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", handleHealth).Methods("GET")
	api.HandleFunc("/login", handleLogin).Methods("POST")
	api.HandleFunc("/validate", handleValidate).Methods("POST")

	// Lobby endpoints
	lobby := r.PathPrefix("/api/lobby").Subrouter()
	lobby.HandleFunc("/presence", HandleGetPresence).Methods("GET")
	lobby.HandleFunc("/presence", HandleUpdatePresence).Methods("POST")
	lobby.HandleFunc("/presence/remove", HandleRemovePresence).Methods("POST")
	lobby.HandleFunc("/challenges", HandleGetChallenges).Methods("GET")
	lobby.HandleFunc("/challenge", HandleSendChallenge).Methods("POST")
	lobby.HandleFunc("/challenge/accept", HandleAcceptChallenge).Methods("POST")
	lobby.HandleFunc("/challenge/reject", HandleRejectChallenge).Methods("POST")
	lobby.HandleFunc("/stream", HandleLobbyStream).Methods("GET")

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

	// Query user from database
	var user struct {
		Email    string
		Name     string
		CodeHash string
	}

	err := db.QueryRow("SELECT email, name, code_hash FROM users WHERE email = $1", req.Email).
		Scan(&user.Email, &user.Name, &user.CodeHash)

	if err == sql.ErrNoRows {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	} else if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Verify password using bcrypt
	if err := bcrypt.CompareHashAndPassword([]byte(user.CodeHash), []byte(req.Code)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate simple demo token
	token := "demo-token-" + user.Email

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   token,
		"user": map[string]string{
			"email": user.Email,
			"name":  user.Name,
		},
	})
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

// getEnv gets environment variable with fallback to default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
