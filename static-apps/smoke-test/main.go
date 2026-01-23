package main

import (
	"database/sql"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"

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

	// Get frontend and backend ports from environment
	frontendPort := getEnv("FRONTEND_PORT", "5010")
	backendPort := getEnv("BACKEND_PORT", "5011")

	// Get hostname for CORS (auto-detect network IP if not set)
	hostname := getHostname()

	// Setup API router
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

	// Start backend API server
	go func() {
		log.Printf("🎮 Smoke Test Backend API")
		log.Printf("📍 API listening on port %s", backendPort)
		log.Printf("🌐 CORS enabled for: localhost:%s, %s:%s, localhost:3000, %s:3000",
			frontendPort, hostname, frontendPort, hostname)
		if err := http.ListenAndServe(":"+backendPort, corsHandler(r)); err != nil {
			log.Fatal("Backend API server error:", err)
		}
	}()

	// Setup frontend static file server
	frontendRouter := mux.NewRouter()

	// Try to serve from build folder (production) or public folder (development)
	buildDir := "./build"
	publicDir := "./public"

	var staticDir string
	if _, err := os.Stat(buildDir); err == nil {
		staticDir = buildDir
		log.Printf("📦 Serving production build from %s", buildDir)
	} else if _, err := os.Stat(publicDir); err == nil {
		staticDir = publicDir
		log.Printf("⚠️  No build folder found, serving from %s (development mode)", publicDir)
		log.Printf("   Run 'npm run build' to create a production build")
	} else {
		log.Fatal("❌ Neither build/ nor public/ directory found. Run 'npm install && npm run build' first.")
	}

	// Serve static files
	frontendRouter.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(staticDir, r.URL.Path)

		// Check if file exists
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// File doesn't exist, serve index.html (for React Router)
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}

		// Serve the file
		http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
	})

	// Start frontend server
	log.Printf("🌐 Smoke Test Frontend")
	log.Printf("📍 Frontend listening on port %s", frontendPort)
	log.Printf("🔗 Access at: http://localhost:%s or http://%s:%s", frontendPort, hostname, frontendPort)
	log.Fatal(http.ListenAndServe(":"+frontendPort, frontendRouter))
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
