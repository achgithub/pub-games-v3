package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/achgithub/activity-hub-common/config"
	"github.com/achgithub/activity-hub-common/database"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

var db *sql.DB

const APP_NAME = "Tic-Tac-Toe"

func main() {
	log.Printf("🎮 %s Backend Starting", APP_NAME)

	// Initialize Redis
	if err := InitRedis(); err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}
	log.Println("✅ Connected to Redis")

	// Initialize app database
	var err error
	db, err = database.InitDatabase("tictactoe")
	if err != nil {
		log.Fatal("Failed to connect to app database:", err)
	}
	defer db.Close()

	// Initialize identity database (for authentication)
	identityDB, err := database.InitIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()

	// Build per-route middleware
	authMiddleware := authlib.Middleware(identityDB)
	sseMiddleware := authlib.SSEMiddleware(identityDB)

	// Setup router
	r := mux.NewRouter()

	// Public endpoints
	r.HandleFunc("/api/health", handleHealth).Methods("GET")
	r.HandleFunc("/api/config", handleGetConfig).Methods("GET")

	// SSE endpoint uses query-param auth (EventSource limitation)
	r.Handle("/api/game/{gameId}/stream",
		sseMiddleware(http.HandlerFunc(handleGameStream))).Methods("GET")

	// Authenticated endpoints
	r.Handle("/api/game/{gameId}", authMiddleware(http.HandlerFunc(handleGetGame))).Methods("GET")
	r.Handle("/api/game", authMiddleware(http.HandlerFunc(handleCreateGame))).Methods("POST")
	r.Handle("/api/move", authMiddleware(http.HandlerFunc(handleMakeMove))).Methods("POST")
	r.Handle("/api/game/{gameId}/forfeit", authMiddleware(http.HandlerFunc(handleForfeitHTTP))).Methods("POST")
	r.Handle("/api/game/{gameId}/claim-win", authMiddleware(http.HandlerFunc(handleClaimWinHTTP))).Methods("POST")
	r.Handle("/api/stats/{userId}", authMiddleware(http.HandlerFunc(handleGetStats))).Methods("GET")

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

	port := config.GetEnv("PORT", "4001")
	log.Printf("🚀 %s backend listening on :%s", APP_NAME, port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"tic-tac-toe"}`))
}

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
	path := r.URL.Path
	fullPath := h.staticPath + path

	_, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		http.ServeFile(w, r, h.staticPath+"/"+h.indexPath)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}
