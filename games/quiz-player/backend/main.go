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

	// Authenticated routes
	api := r.PathPrefix("/api").Subrouter()
	api.Use(authlib.Middleware(identityDB))

	api.HandleFunc("/sessions/active", handleGetActiveSessions).Methods("GET")
	api.HandleFunc("/sessions/join", handleJoinSession).Methods("POST")
	api.HandleFunc("/sessions/join-team", handleJoinTeam).Methods("POST")
	api.HandleFunc("/sessions/{id}/state", handleGetSessionState).Methods("GET")
	api.HandleFunc("/sessions/{id}/answer", handleSubmitAnswer).Methods("POST")

	// SSE stream uses query-param auth
	r.Handle("/api/sessions/{id}/stream",
		authlib.SSEMiddleware(identityDB)(http.HandlerFunc(handleSessionStream))).Methods("GET")

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

	port := config.GetEnv("PORT", "4041")
	log.Printf("Quiz Player starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
