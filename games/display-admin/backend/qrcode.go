package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/skip2/go-qrcode"
)

// handleGetDisplayQR generates and returns a QR code PNG for a display
func handleGetDisplayQR(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Fetch display token
	var token string
	err := db.QueryRow("SELECT token FROM displays WHERE id = $1", id).Scan(&token)
	if err == sql.ErrNoRows {
		respondError(w, "Display not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("❌ Error fetching display token: %v", err)
		respondError(w, "Failed to fetch display", http.StatusInternalServerError)
		return
	}

	// Build runtime URL
	host := getEnv("RUNTIME_HOST", "192.168.1.45")
	runtimePort := getEnv("RUNTIME_PORT", "5051")
	url := fmt.Sprintf("http://%s:%s?token=%s", host, runtimePort, token)

	// Generate QR code
	png, err := qrcode.Encode(url, qrcode.Medium, 256)
	if err != nil {
		log.Printf("❌ Error generating QR code: %v", err)
		respondError(w, "Failed to generate QR code", http.StatusInternalServerError)
		return
	}

	// Return PNG image
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"display-%s-qr.png\"", id))
	w.Write(png)

	log.Printf("✅ Generated QR code for display ID: %s", id)
}
