package main

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// Broadcaster manages SSE subscriptions and broadcasts events
type Broadcaster struct {
	mu      sync.RWMutex
	clients map[string]map[chan SSEMessage]bool // [channelID][client] = true
}

// SSEMessage represents a message sent over SSE
type SSEMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

// NewBroadcaster creates a new broadcaster
func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		clients: make(map[string]map[chan SSEMessage]bool),
	}
}

// Subscribe registers a client for a channel
func (b *Broadcaster) Subscribe(ctx context.Context, channelID string) <-chan SSEMessage {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.clients[channelID] == nil {
		b.clients[channelID] = make(map[chan SSEMessage]bool)
	}

	ch := make(chan SSEMessage, 100) // Buffered channel
	b.clients[channelID][ch] = true

	// Cleanup when context is done
	go func() {
		<-ctx.Done()
		b.Unsubscribe(channelID, ch)
	}()

	return ch
}

// Unsubscribe removes a client from a channel
func (b *Broadcaster) Unsubscribe(channelID string, ch chan SSEMessage) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if clients, ok := b.clients[channelID]; ok {
		if _, exists := clients[ch]; exists {
			delete(clients, ch)
			close(ch)
		}

		// Remove channel if empty
		if len(clients) == 0 {
			delete(b.clients, channelID)
		}
	}
}

// Publish sends a message to all subscribers of a channel
func (b *Broadcaster) Publish(channelID string, event string, data interface{}) {
	b.mu.RLock()
	clients := b.clients[channelID]
	b.mu.RUnlock()

	msg := SSEMessage{
		Event: event,
		Data:  data,
	}

	// Send to all clients, drop if full
	for ch := range clients {
		select {
		case ch <- msg:
		default:
			// Channel full, drop message
		}
	}
}

// EncodeSSE encodes a message in SSE format
func EncodeSSE(event string, data interface{}) (string, error) {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	// SSE format: event: {name}\ndata: {json}\n\n
	return fmt.Sprintf("event: %s\ndata: %s\n\n", event, string(dataBytes)), nil
}
