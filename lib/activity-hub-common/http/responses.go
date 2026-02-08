package http

import (
	"encoding/json"
	"log"
	"net/http"
)

// SuccessJSON writes a successful JSON response with the given status code.
//
// Usage:
//   response := GameResponse{ID: "game-123", Status: "created"}
//   http.SuccessJSON(w, response, http.StatusCreated)
func SuccessJSON(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("❌ Failed to encode JSON response: %v", err)
	}
}

// ErrorJSON writes an error JSON response with the given status code.
//
// Usage:
//   http.ErrorJSON(w, "Invalid game ID", http.StatusBadRequest)
func ErrorJSON(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := map[string]string{
		"error": message,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("❌ Failed to encode error JSON: %v", err)
	}
}

// ParseJSON parses a JSON request body into the target struct.
// Returns an error if parsing fails.
//
// Usage:
//   var req CreateGameRequest
//   if err := http.ParseJSON(r, &req); err != nil {
//       http.ErrorJSON(w, "Invalid request", http.StatusBadRequest)
//       return
//   }
func ParseJSON(r *http.Request, target interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}
