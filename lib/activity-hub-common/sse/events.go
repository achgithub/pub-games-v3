package sse

import (
	"encoding/json"
	"fmt"
)

// Event represents a Server-Sent Event.
type Event struct {
	// Type is the event type (e.g., "move", "game_update", "player_joined")
	Type string `json:"type"`

	// Data is the event payload (will be JSON-encoded)
	Data interface{} `json:"data,omitempty"`
}

// FormatSSE formats an Event as an SSE message string.
// Returns a string in the format:
//   event: {type}
//   data: {json}
//
// Usage:
//   event := sse.Event{Type: "move", Data: map[string]int{"position": 5}}
//   formatted := sse.FormatSSE(event)
//   fmt.Fprintf(w, "%s\n\n", formatted)
func FormatSSE(event Event) string {
	data, err := json.Marshal(event.Data)
	if err != nil {
		data = []byte("{}")
	}

	return fmt.Sprintf("event: %s\ndata: %s", event.Type, string(data))
}
