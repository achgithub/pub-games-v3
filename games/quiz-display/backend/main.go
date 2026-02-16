package main

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/achgithub/activity-hub-common/config"
	"github.com/achgithub/activity-hub-common/database"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var quizDB *sql.DB

func main() {
	var err error
	quizDB, err = database.InitDatabaseByName("quiz_db")
	if err != nil {
		log.Fatal("Failed to connect to quiz database:", err)
	}
	defer quizDB.Close()

	initRedis()

	r := mux.NewRouter()

	// No auth — session code in URL is sufficient for display
	r.HandleFunc("/api/config", handleConfig).Methods("GET")
	r.HandleFunc("/api/display/session/{code}", handleGetDisplaySession).Methods("GET")
	r.HandleFunc("/api/display/stream/{code}", handleDisplayStream).Methods("GET")

	// Serve shared media uploads (same directory as game-admin)
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Serve React frontend
	r.PathPrefix("/static/").Handler(http.FileServer(http.Dir("./static")))
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type"}),
	)

	port := config.GetEnv("PORT", "5081")
	log.Printf("Quiz Display starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, corsHandler(r)))
}
