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

	r := mux.NewRouter()

	r.HandleFunc("/api/config", handleConfig).Methods("GET")

	// Auth required but any user can access
	api := r.PathPrefix("/api").Subrouter()
	api.Use(authlib.Middleware(identityDB))
	api.HandleFunc("/test-content", handleGetTestContent).Methods("GET")

	// Serve media from shared uploads directory
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Serve React frontend
	r.PathPrefix("/static/").Handler(http.FileServer(http.Dir("./static")))
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	port := config.GetEnv("PORT", "4061")
	log.Printf("Mobile Test starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
