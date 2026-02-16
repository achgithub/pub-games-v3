package main

import (
	"database/sql"
	"log"
	"net/http"

	authlib "github.com/achgithub/activity-hub-common/auth"
	"github.com/achgithub/activity-hub-common/config"
	"github.com/achgithub/activity-hub-common/database"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var (
	quizDB     *sql.DB
	identityDB *sql.DB
)

func main() {
	var err error
	identityDB, err = database.InitIdentityDatabase()
	if err != nil {
		log.Fatal("Failed to connect to identity database:", err)
	}
	defer identityDB.Close()

	quizDB, err = database.InitDatabaseByName("quiz_db")
	if err != nil {
		log.Fatal("Failed to connect to quiz database:", err)
	}
	defer quizDB.Close()

	initRedis()

	r := mux.NewRouter()

	// Public config
	r.HandleFunc("/api/config", handleConfig).Methods("GET")

	// Serve media uploaded by game-admin (shared uploads directory)
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Authenticated + role-checked routes
	api := r.PathPrefix("/api").Subrouter()
	api.Use(authlib.Middleware(identityDB))
	api.Use(requireQuizRole)

	// Pack listing for session creation
	api.HandleFunc("/packs", handleGetPacks).Methods("GET")

	// Session management
	api.HandleFunc("/sessions", handleCreateSession).Methods("POST")
	api.HandleFunc("/sessions/{id}", handleGetSession).Methods("GET")
	api.HandleFunc("/sessions/{id}/start", handleStartSession).Methods("POST")

	// Quiz control
	api.HandleFunc("/sessions/{id}/load-question", handleLoadQuestion).Methods("POST")
	api.HandleFunc("/sessions/{id}/reveal", handleRevealQuestion).Methods("POST")
	api.HandleFunc("/sessions/{id}/audio-play", handleAudioPlay).Methods("POST")
	api.HandleFunc("/sessions/{id}/close-answers", handleCloseAnswers).Methods("POST")
	api.HandleFunc("/sessions/{id}/start-timer", handleStartTimer).Methods("POST")

	// Marking
	api.HandleFunc("/sessions/{id}/answers/{questionId}", handleGetAnswers).Methods("GET")
	api.HandleFunc("/sessions/{id}/mark", handleMarkAnswer).Methods("POST")
	api.HandleFunc("/sessions/{id}/push-scores", handlePushScores).Methods("POST")

	// Session end
	api.HandleFunc("/sessions/{id}/end", handleEndSession).Methods("POST")

	// Lobby SSE for player join events (separate channel)
	r.Handle("/api/sessions/{id}/lobby-stream",
		authlib.SSEMiddleware(identityDB)(requireQuizRoleSSE(http.HandlerFunc(handleLobbyStream)))).Methods("GET")

	// Serve React frontend
	r.PathPrefix("/static/").Handler(http.FileServer(http.Dir("./static")))
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	port := config.GetEnv("PORT", "5080")
	log.Printf("Quiz Master starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}

func requireQuizRole(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := authlib.GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if !user.HasRole("quiz_master") && !user.HasRole("game_admin") && !user.HasRole("super_user") {
			http.Error(w, `{"error":"quiz_master role required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requireQuizRoleSSE(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := authlib.GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if !user.HasRole("quiz_master") && !user.HasRole("game_admin") && !user.HasRole("super_user") {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
