package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// GameHub manages all active game connections
type GameHub struct {
	rooms map[string]*GameRoom
	mu    sync.RWMutex
}

// GameRoom manages connections for a single game
type GameRoom struct {
	gameID      string
	connections map[string]*PlayerConnection // key: playerID (email)
	readyCount  int
	mu          sync.RWMutex
}

// PlayerConnection represents a connected player
type PlayerConnection struct {
	playerID string
	conn     *websocket.Conn
	ready    bool
}

// Global hub instance
var hub = &GameHub{
	rooms: make(map[string]*GameRoom),
}

// getOrCreateRoom gets existing room or creates new one
func (h *GameHub) getOrCreateRoom(gameID string) *GameRoom {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, exists := h.rooms[gameID]; exists {
		return room
	}

	room := &GameRoom{
		gameID:      gameID,
		connections: make(map[string]*PlayerConnection),
	}
	h.rooms[gameID] = room
	return room
}

// removeRoom removes a room when empty
func (h *GameHub) removeRoom(gameID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms, gameID)
}

// getRoom gets a room if it exists
func (h *GameHub) getRoom(gameID string) *GameRoom {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.rooms[gameID]
}

// addConnection adds a player connection to the room
func (r *GameRoom) addConnection(playerID string, conn *websocket.Conn) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.connections[playerID] = &PlayerConnection{
		playerID: playerID,
		conn:     conn,
		ready:    false,
	}
}

// removeConnection removes a player connection
func (r *GameRoom) removeConnection(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.connections, playerID)
}

// markReady marks a player as ready
func (r *GameRoom) markReady(playerID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if conn, exists := r.connections[playerID]; exists && !conn.ready {
		conn.ready = true
		r.readyCount++
	}
	return r.readyCount >= 2
}

// broadcast sends a message to all connected players
func (r *GameRoom) broadcast(msg *WSMessage) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling broadcast message: %v", err)
		return
	}

	for _, pc := range r.connections {
		if err := pc.conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("Error sending to player %s: %v", pc.playerID, err)
		}
	}
}

// sendTo sends a message to a specific player
func (r *GameRoom) sendTo(playerID string, msg *WSMessage) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if pc, exists := r.connections[playerID]; exists {
		data, err := json.Marshal(msg)
		if err != nil {
			log.Printf("Error marshaling message: %v", err)
			return
		}
		if err := pc.conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("Error sending to player %s: %v", playerID, err)
		}
	}
}

// notifyOthers sends a message to all players except the sender
func (r *GameRoom) notifyOthers(senderID string, msg *WSMessage) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	for playerID, pc := range r.connections {
		if playerID != senderID {
			if err := pc.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("Error sending to player %s: %v", playerID, err)
			}
		}
	}
}

// gameWebSocketHandler handles WebSocket connections for a game
func gameWebSocketHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameId"]
	userID := r.URL.Query().Get("userId")

	if gameID == "" || userID == "" {
		http.Error(w, "Missing gameId or userId", http.StatusBadRequest)
		return
	}

	// Validate game exists in Redis
	game, err := GetGame(gameID)
	if err != nil {
		log.Printf("WebSocket: Game not found: %s", gameID)
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Validate user is a player in this game
	if userID != game.Player1ID && userID != game.Player2ID {
		log.Printf("WebSocket: User %s is not a player in game %s", userID, gameID)
		http.Error(w, "Not a player in this game", http.StatusForbidden)
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	log.Printf("🔌 WebSocket connected: game=%s, user=%s", gameID, userID)

	// Get or create room and add connection
	room := hub.getOrCreateRoom(gameID)
	room.addConnection(userID, conn)

	// Send initial game state (pong message)
	room.sendTo(userID, &WSMessage{
		Type:    "pong",
		Payload: game,
	})

	// Handle disconnect
	defer func() {
		log.Printf("🔌 WebSocket disconnected: game=%s, user=%s", gameID, userID)
		room.removeConnection(userID)

		// Notify other player of disconnect
		room.notifyOthers(userID, &WSMessage{
			Type: "opponent_disconnected",
		})

		// Check if room is empty
		room.mu.RLock()
		isEmpty := len(room.connections) == 0
		room.mu.RUnlock()

		if isEmpty {
			hub.removeRoom(gameID)
		}
	}()

	// Read loop
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse message
		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Failed to parse WebSocket message: %v", err)
			room.sendTo(userID, &WSMessage{
				Type:    "error",
				Payload: map[string]string{"message": "Invalid message format"},
			})
			continue
		}

		// Handle message types
		switch msg.Type {
		case "ping":
			// Refresh game state and respond with pong
			game, err := GetGame(gameID)
			if err != nil {
				room.sendTo(userID, &WSMessage{
					Type:    "error",
					Payload: map[string]string{"message": "Game not found"},
				})
				continue
			}
			room.sendTo(userID, &WSMessage{
				Type:    "pong",
				Payload: game,
			})

		case "ack":
			// Player acknowledges connection, mark as ready
			allReady := room.markReady(userID)
			log.Printf("📍 Player %s acknowledged, allReady=%v", userID, allReady)

			if allReady {
				// Both players ready, broadcast ready message
				room.broadcast(&WSMessage{
					Type: "ready",
				})
				log.Printf("✅ Both players ready in game %s", gameID)
			}

		case "move":
			// Handle move
			handleWebSocketMove(room, userID, gameID, msg.Payload)

		default:
			log.Printf("Unknown message type: %s", msg.Type)
			room.sendTo(userID, &WSMessage{
				Type:    "error",
				Payload: map[string]string{"message": "Unknown message type"},
			})
		}
	}
}

// handleWebSocketMove processes a move received via WebSocket
func handleWebSocketMove(room *GameRoom, playerID string, gameID string, payload interface{}) {
	// Parse position from payload
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Invalid move payload"},
		})
		return
	}

	positionFloat, ok := payloadMap["position"].(float64)
	if !ok {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Missing position in move"},
		})
		return
	}
	position := int(positionFloat)

	// Get current game state
	game, err := GetGame(gameID)
	if err != nil {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Game not found"},
		})
		return
	}

	// Apply move using game logic
	game, err = applyMove(game, playerID, position)
	if err != nil {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": err.Error()},
		})
		return
	}

	// Check for win/draw
	gameEnded, message := processGameResult(game)

	// Update game in Redis
	if err := UpdateGame(game); err != nil {
		log.Printf("Failed to update game in Redis: %v", err)
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Failed to update game"},
		})
		return
	}

	log.Printf("🎮 Move: game=%s, player=%s, position=%d, gameEnded=%v", gameID, playerID, position, gameEnded)

	// Broadcast update to all players
	if gameEnded {
		// Save to PostgreSQL and update stats
		if err := SaveCompletedGame(game); err != nil {
			log.Printf("Warning: Failed to save completed game to PostgreSQL: %v", err)
		}

		// Update player stats
		player1Won := game.WinnerID != nil && *game.WinnerID == game.Player1ID
		player2Won := game.WinnerID != nil && *game.WinnerID == game.Player2ID
		isDraw := game.WinnerID == nil

		UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, isDraw, 0)
		UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, isDraw, 0)

		// Broadcast game_ended with final state
		room.broadcast(&WSMessage{
			Type: "game_ended",
			Payload: map[string]interface{}{
				"game":    game,
				"message": message,
			},
		})
	} else {
		// Broadcast move_update
		room.broadcast(&WSMessage{
			Type: "move_update",
			Payload: map[string]interface{}{
				"game":    game,
				"message": message,
			},
		})
	}
}

// broadcastGameUpdate sends game state to all connected players
func broadcastGameUpdate(gameID string, game *Game) {
	room := hub.getRoom(gameID)
	if room == nil {
		log.Printf("📢 No WebSocket room for game %s", gameID)
		return
	}

	room.broadcast(&WSMessage{
		Type:    "move_update",
		Payload: game,
	})
}

// broadcastGameEnded notifies players that game has ended
func broadcastGameEnded(gameID string, game *Game) {
	room := hub.getRoom(gameID)
	if room == nil {
		log.Printf("📢 No WebSocket room for game %s", gameID)
		return
	}

	room.broadcast(&WSMessage{
		Type:    "game_ended",
		Payload: game,
	})
}
