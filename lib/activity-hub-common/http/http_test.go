package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestErrorJSON(t *testing.T) {
	w := httptest.NewRecorder()
	ErrorJSON(w, "test error", http.StatusBadRequest)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}
}

func TestSuccessJSON(t *testing.T) {
	w := httptest.NewRecorder()
	data := map[string]string{"status": "ok"}
	SuccessJSON(w, data, http.StatusOK)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}
}

// TODO: Add tests for ParseJSON
// TODO: Add tests for CORSMiddleware
// TODO: Add tests for LoggingMiddleware
