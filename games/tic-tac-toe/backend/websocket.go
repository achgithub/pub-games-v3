package main

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

const (
	// Grace period before notifying opponent of disconnect
	disconnectGracePeriod = 15 * time.Second
	// Time opponent must wait before claiming win
	claimWinDelay = 15 * time.Second
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// GameHub manages all active game connections
type GameHub struct {
	rooms map[string]*GameRoom
	mu    sync.RWMutex
}

// GameRoom manages connections for a single game
type GameRoom struct {
	gameID           string
	connections      map[string]*PlayerConnection // key: playerID (email)
	disconnectTimers map[string]*time.Timer       // pending disconnect notifications
	disconnectedAt   map[string]time.Time         // when player disconnected (for claim win timing)
	mu               sync.RWMutex
}

// PlayerConnection represents a connected player
type PlayerConnection struct {
	playerID string
	conn     *websocket.Conn
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
		gameID:           gameID,
		connections:      make(map[string]*PlayerConnection),
		disconnectTimers: make(map[string]*time.Timer),
		disconnectedAt:   make(map[string]time.Time),
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
	}
}

// removeConnection removes a player connection
func (r *GameRoom) removeConnection(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.connections, playerID)
}

// hasConnection checks if a player already has a connection
func (r *GameRoom) hasConnection(playerID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.connections[playerID]
	return exists
}

// connectionCount returns the number of connected players
func (r *GameRoom) connectionCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.connections)
}

// broadcast sends a message to all connected players
func (r *GameRoom) broadcast(msg *WSMessage) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, pc := range r.connections {
		if err := pc.conn.WriteJSON(msg); err != nil {
			log.Printf("Error sending to player %s: %v", pc.playerID, err)
		}
	}
}

// sendTo sends a message to a specific player
func (r *GameRoom) sendTo(playerID string, msg *WSMessage) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if pc, exists := r.connections[playerID]; exists {
		return pc.conn.WriteJSON(msg)
	}
	return nil
}

// notifyOthers sends a message to all players except the sender
func (r *GameRoom) notifyOthers(senderID string, msg *WSMessage) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for playerID, pc := range r.connections {
		if playerID != senderID {
			if err := pc.conn.WriteJSON(msg); err != nil {
				log.Printf("Error sending to player %s: %v", playerID, err)
			}
		}
	}
}

// getOpponentID returns the other player's ID
func (r *GameRoom) getOpponentID(playerID string, game *Game) string {
	if playerID == game.Player1ID {
		return game.Player2ID
	}
	return game.Player1ID
}

// startDisconnectTimer starts a grace period timer for a disconnecting player
func (r *GameRoom) startDisconnectTimer(playerID string, game *Game) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Cancel any existing timer
	if timer, exists := r.disconnectTimers[playerID]; exists {
		timer.Stop()
	}

	opponentID := r.getOpponentID(playerID, game)

	// Start grace period timer
	r.disconnectTimers[playerID] = time.AfterFunc(disconnectGracePeriod, func() {
		r.mu.Lock()
		// Record when disconnect notification was sent (for claim win timing)
		r.disconnectedAt[playerID] = time.Now()
		delete(r.disconnectTimers, playerID)
		r.mu.Unlock()

		log.Printf("⏰ Grace period expired for %s, notifying opponent", playerID)

		// Notify opponent that player disconnected
		r.sendTo(opponentID, &WSMessage{
			Type: "opponent_disconnected",
			Payload: map[string]interface{}{
				"claimWinAfter": claimWinDelay.Seconds(),
			},
		})
	})

	log.Printf("⏳ Started %v disconnect grace period for %s", disconnectGracePeriod, playerID)
}

// cancelDisconnectTimer cancels a pending disconnect notification (player reconnected)
func (r *GameRoom) cancelDisconnectTimer(playerID string, game *Game) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check if there was a pending timer
	if timer, exists := r.disconnectTimers[playerID]; exists {
		timer.Stop()
		delete(r.disconnectTimers, playerID)
		log.Printf("✅ Cancelled disconnect timer for %s (reconnected during grace period)", playerID)
		return true
	}

	// Check if opponent was already notified of disconnect
	if _, wasDisconnected := r.disconnectedAt[playerID]; wasDisconnected {
		delete(r.disconnectedAt, playerID)
		log.Printf("✅ Player %s reconnected after disconnect notification", playerID)
		return true
	}

	return false
}

// canClaimWin checks if enough time has passed for opponent to claim win
func (r *GameRoom) canClaimWin(disconnectedPlayerID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	disconnectTime, exists := r.disconnectedAt[disconnectedPlayerID]
	if !exists {
		return false
	}

	return time.Since(disconnectTime) >= claimWinDelay
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

	log.Printf("🔌 WebSocket connection attempt: game=%s, user=%s", gameID, userID)

	// Validate game exists in Redis
	game, err := GetGame(gameID)
	if err != nil {
		log.Printf("❌ WebSocket: Game not found in Redis: %s", gameID)
		http.Error(w, "Game not found", http.StatusNotFound)
		return
	}

	// Check if game is already completed
	if game.Status == GameStatusCompleted {
		log.Printf("❌ WebSocket: Game %s is already completed", gameID)
		http.Error(w, "Game is already completed", http.StatusBadRequest)
		return
	}

	// Validate user is a player in this game
	if userID != game.Player1ID && userID != game.Player2ID {
		log.Printf("❌ WebSocket: User %s is not a player in game %s", userID, gameID)
		http.Error(w, "Not a player in this game", http.StatusForbidden)
		return
	}

	// Get or create room
	room := hub.getOrCreateRoom(gameID)

	// Check if this is a reconnection
	wasReconnecting := room.cancelDisconnectTimer(userID, game)

	// Check if user already has an active connection (prevent multiple tabs)
	// But allow if they're reconnecting
	if room.hasConnection(userID) && !wasReconnecting {
		log.Printf("⚠️ WebSocket: User %s already connected to game %s", userID, gameID)
		http.Error(w, "Already connected in another tab", http.StatusConflict)
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Register connection
	room.addConnection(userID, conn)

	// Handle disconnect with grace period
	defer func() {
		log.Printf("🔌 WebSocket disconnecting: game=%s, user=%s", gameID, userID)
		room.removeConnection(userID)

		// Check if game is still active before starting disconnect timer
		currentGame, err := GetGame(gameID)
		if err != nil || currentGame.Status == GameStatusCompleted {
			// Game ended, no need for disconnect handling
			if room.connectionCount() == 0 {
				hub.removeRoom(gameID)
				log.Printf("🗑️ Cleaned up room for completed game %s", gameID)
			}
			return
		}

		// Start grace period timer instead of immediate notification
		room.startDisconnectTimer(userID, currentGame)

		// Clean up room if empty after a delay
		time.AfterFunc(disconnectGracePeriod+claimWinDelay+time.Minute, func() {
			if room.connectionCount() == 0 {
				hub.removeRoom(gameID)
				log.Printf("🗑️ Cleaned up empty room for game %s", gameID)
			}
		})
	}()

	log.Printf("✅ WebSocket upgraded: game=%s, user=%s, reconnecting=%v", gameID, userID, wasReconnecting)

	// Notify opponent if this is a reconnection after they were notified
	if wasReconnecting {
		room.notifyOthers(userID, &WSMessage{
			Type: "opponent_reconnected",
		})
	}

	// Perform bidirectional handshake (v2 pattern)
	// Flow: Client PING -> Server PONG -> Client ACK -> Server READY with game state
	if !performHandshake(conn, gameID, userID) {
		log.Printf("❌ Handshake failed: game=%s, user=%s", gameID, userID)
		return
	}

	log.Printf("✅ Handshake complete: game=%s, user=%s", gameID, userID)

	// Start the game connection handler (message loop + keepalive)
	handleGameConnection(conn, room, gameID, userID)
}

// performHandshake conducts the bidirectional handshake
// Flow: Client PING -> Server PONG -> Client ACK -> Server READY with game state
func performHandshake(conn *websocket.Conn, gameID, userID string) bool {
	// 1. Wait for client PING (5 second timeout)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var msg WSMessage
	if err := conn.ReadJSON(&msg); err != nil {
		log.Printf("❌ Handshake: Failed to read PING from %s: %v", userID, err)
		return false
	}
	if msg.Type != "ping" {
		log.Printf("❌ Handshake: Expected PING, got %s from %s", msg.Type, userID)
		return false
	}
	log.Printf("📨 Handshake: Received PING from %s", userID)

	// 2. Send PONG
	if err := conn.WriteJSON(&WSMessage{Type: "pong"}); err != nil {
		log.Printf("❌ Handshake: Failed to send PONG to %s: %v", userID, err)
		return false
	}
	log.Printf("📤 Handshake: Sent PONG to %s", userID)

	// 3. Wait for client ACK (5 second timeout)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if err := conn.ReadJSON(&msg); err != nil {
		log.Printf("❌ Handshake: Failed to read ACK from %s: %v", userID, err)
		return false
	}
	if msg.Type != "ack" {
		log.Printf("❌ Handshake: Expected ACK, got %s from %s", msg.Type, userID)
		return false
	}
	log.Printf("📨 Handshake: Received ACK from %s", userID)

	// 4. Fetch current game state
	game, err := GetGame(gameID)
	if err != nil {
		log.Printf("❌ Handshake: Failed to fetch game state: %v", err)
		return false
	}

	// 5. Send READY with game state
	if err := conn.WriteJSON(&WSMessage{
		Type:    "ready",
		Payload: game,
	}); err != nil {
		log.Printf("❌ Handshake: Failed to send READY to %s: %v", userID, err)
		return false
	}
	log.Printf("📤 Handshake: Sent READY with game state to %s", userID)

	// Reset read deadline for normal operation
	conn.SetReadDeadline(time.Time{})

	return true
}

// handleGameConnection maintains the WebSocket connection with keepalive
func handleGameConnection(conn *websocket.Conn, room *GameRoom, gameID, userID string) {
	// Set up ping/pong for connection health monitoring
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Start ping ticker to keep connection alive
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	done := make(chan struct{})

	// Read messages in goroutine
	go func() {
		defer close(done)
		for {
			var msg WSMessage
			if err := conn.ReadJSON(&msg); err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				return
			}

			// Handle message types
			switch msg.Type {
			case "move":
				handleWebSocketMove(room, userID, gameID, msg.Payload)

			case "ping":
				// Client requesting game state refresh
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

			case "forfeit":
				// Player intentionally leaving - opponent wins
				handleForfeit(room, userID, gameID)

			case "claim_win":
				// Player claiming win after opponent disconnect
				handleClaimWin(room, userID, gameID)

			default:
				log.Printf("Unknown message type from %s: %s", userID, msg.Type)
			}
		}
	}()

	// Keep connection alive with pings
	for {
		select {
		case <-done:
			return

		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Ping failed for %s: %v", userID, err)
				return
			}
		}
	}
}

// handleForfeit processes a forfeit (intentional leave)
func handleForfeit(room *GameRoom, playerID, gameID string) {
	game, err := GetGame(gameID)
	if err != nil {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Game not found"},
		})
		return
	}

	if game.Status == GameStatusCompleted {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Game already ended"},
		})
		return
	}

	// Determine winner (opponent of the forfeiting player)
	var winnerID string
	if playerID == game.Player1ID {
		winnerID = game.Player2ID
	} else {
		winnerID = game.Player1ID
	}

	log.Printf("🏳️ Player %s forfeited game %s, winner: %s", playerID, gameID, winnerID)

	// Update game state
	game.Status = GameStatusCompleted
	game.WinnerID = &winnerID
	now := time.Now().Unix()
	game.CompletedAt = &now

	// Save to Redis
	if err := UpdateGame(game); err != nil {
		log.Printf("Failed to update game after forfeit: %v", err)
		return
	}

	// Save to PostgreSQL and update stats
	if err := SaveCompletedGame(game); err != nil {
		log.Printf("Warning: Failed to save forfeited game to PostgreSQL: %v", err)
	}

	// Update player stats
	player1Won := winnerID == game.Player1ID
	player2Won := winnerID == game.Player2ID

	UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, false, 0)
	UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, false, 0)

	// Notify both players
	room.broadcast(&WSMessage{
		Type: "game_ended",
		Payload: map[string]interface{}{
			"game":    game,
			"message": "Opponent forfeited",
			"reason":  "forfeit",
		},
	})
}

// handleClaimWin processes a claim win after opponent disconnect
func handleClaimWin(room *GameRoom, playerID, gameID string) {
	game, err := GetGame(gameID)
	if err != nil {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Game not found"},
		})
		return
	}

	if game.Status == GameStatusCompleted {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Game already ended"},
		})
		return
	}

	// Get opponent ID
	opponentID := room.getOpponentID(playerID, game)

	// Check if opponent is actually disconnected and enough time has passed
	if !room.canClaimWin(opponentID) {
		room.sendTo(playerID, &WSMessage{
			Type:    "error",
			Payload: map[string]string{"message": "Cannot claim win yet - opponent may still reconnect"},
		})
		return
	}

	log.Printf("🏆 Player %s claiming win after %s disconnected in game %s", playerID, opponentID, gameID)

	// Update game state
	game.Status = GameStatusCompleted
	game.WinnerID = &playerID
	now := time.Now().Unix()
	game.CompletedAt = &now

	// Save to Redis
	if err := UpdateGame(game); err != nil {
		log.Printf("Failed to update game after claim win: %v", err)
		return
	}

	// Save to PostgreSQL and update stats
	if err := SaveCompletedGame(game); err != nil {
		log.Printf("Warning: Failed to save claimed game to PostgreSQL: %v", err)
	}

	// Update player stats
	player1Won := playerID == game.Player1ID
	player2Won := playerID == game.Player2ID

	UpdatePlayerStats(game.Player1ID, game.Player1Name, player1Won, player2Won, false, 0)
	UpdatePlayerStats(game.Player2ID, game.Player2Name, player2Won, player1Won, false, 0)

	// Notify claiming player
	room.sendTo(playerID, &WSMessage{
		Type: "game_ended",
		Payload: map[string]interface{}{
			"game":    game,
			"message": "You won - opponent disconnected",
			"reason":  "disconnect",
		},
	})
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
