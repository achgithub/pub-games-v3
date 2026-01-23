package main

import (
	"database/sql"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var db *sql.DB

func main() {
	var err error

	// Initialize database
	db, err = InitDatabase()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Setup router
	r := mux.NewRouter()

	// Public endpoints
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/health", HandleHealth).Methods("GET")
	api.HandleFunc("/config", HandleConfig).Methods("GET")

	// User sync endpoint (called by shell when user first accesses app)
	api.HandleFunc("/sync-user", HandleUserSync).Methods("POST")

	// Protected endpoints (require user query param from shell)
	api.HandleFunc("/items", AuthMiddleware(HandleGetItems)).Methods("GET")
	api.HandleFunc("/items", AuthMiddleware(HandleCreateItem)).Methods("POST")

	// Admin endpoints
	api.HandleFunc("/admin/stats", AdminMiddleware(HandleGetStats)).Methods("GET")

	// Get frontend and backend ports from environment
	frontendPort := getEnv("FRONTEND_PORT", "5010")
	backendPort := getEnv("BACKEND_PORT", "5011")

	// Get hostname for CORS (auto-detect network IP if not set)
	hostname := getHostname()

	// CORS configuration - Allow requests from frontend and shell
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{
			"http://localhost:" + frontendPort,
			"http://" + hostname + ":" + frontendPort,
			"http://localhost:3000", // Identity Shell
			"http://" + hostname + ":3000",
		}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)

	// Start server
	log.Printf("🎮 Smoke Test Backend")
	log.Printf("📍 Listening on port %s", backendPort)
	log.Printf("🌐 CORS enabled for: localhost:%s, %s:%s, localhost:3000, %s:3000",
		frontendPort, hostname, frontendPort, hostname)
	log.Fatal(http.ListenAndServe(":"+backendPort, corsHandler(r)))
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getHostname auto-detects the primary network IP address
func getHostname() string {
	// Check environment variable first
	if hostname := os.Getenv("HOSTNAME"); hostname != "" {
		return hostname
	}

	// Try to detect network IP
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		log.Printf("⚠️  Failed to detect network IP, using localhost: %v", err)
		return "localhost"
	}

	// Find first non-loopback IPv4 address
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				ip := ipnet.IP.String()
				log.Printf("🌐 Auto-detected network IP: %s", ip)
				return ip
			}
		}
	}

	log.Printf("⚠️  No network IP detected, using localhost")
	return "localhost"
}
