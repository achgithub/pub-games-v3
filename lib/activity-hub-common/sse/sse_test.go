package sse

import (
	"testing"
)

func TestFormatSSE(t *testing.T) {
	event := Event{
		Type: "test",
		Data: map[string]string{"message": "hello"},
	}

	formatted := FormatSSE(event)

	if formatted == "" {
		t.Error("Expected formatted SSE string, got empty")
	}

	// Should contain event type
	if len(formatted) < 10 {
		t.Errorf("Expected formatted SSE string, got: %s", formatted)
	}
}

// Integration tests (require Redis)
// Run with: go test -tags=integration ./...

// TODO: Add integration tests for HandleStream
