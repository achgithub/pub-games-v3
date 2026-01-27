# Tic-Tac-Toe Redis Schema

**Purpose**: Store live game state with automatic expiration, plus pub/sub for SSE real-time updates

**Last Updated**: January 27, 2026

---

## Data Structures

### Game State
```
Key: game:{gameId}
Type: Hash
TTL: 3600 seconds (1 hour)
```

**Fields:**
```json
{
  "id": "12345",
  "challengeId": "challenge-id-from-lobby",
  "player1Id": 1,
  "player1Name": "Alice",
  "player1Symbol": "X",
  "player2Id": 2,
  "player2Name": "Bob",
  "player2Symbol": "O",
  "board": ["","","","","","","","",""],
  "currentTurn": 1,
  "status": "active",
  "mode": "normal",
  "moveTimeLimit": 0,
  "firstTo": 3,
  "player1Score": 0,
  "player2Score": 0,
  "currentRound": 1,
  "winnerId": null,
  "lastMoveAt": 1706112000,
  "createdAt": 1706111000
}
```

**Status values:**
- `active` - Game in progress
- `completed` - Game finished
- `abandoned` - Player disconnected/timeout

---

## Redis Operations

### Create Game
```redis
HSET game:{gameId} id {gameId} ...all fields...
EXPIRE game:{gameId} 3600
```

### Get Game
```redis
HGETALL game:{gameId}
```

### Update Board (Make Move)
```redis
HSET game:{gameId} board {newBoardJSON} currentTurn {nextPlayer} lastMoveAt {timestamp}
```

### Update Score (After Round)
```redis
HSET game:{gameId} player1Score {newScore} player2Score {newScore} currentRound {round}
```

### Complete Game
```redis
HSET game:{gameId} status "completed" winnerId {winnerId} completedAt {timestamp}
EXPIRE game:{gameId} 300  # Keep for 5 minutes for post-game view
```

### Delete Game (Cleanup)
```redis
DEL game:{gameId}
```

---

## Connection Tracking

Track active SSE connections in Redis (enables multi-server scaling):

```
Key: game:{gameId}:connections
Type: Hash
TTL: 3600 seconds
Fields: {userId}: {timestamp}
```

**Operations:**
```redis
# Player connects
HSET game:{gameId}:connections {userId} {timestamp}

# Player disconnects
HDEL game:{gameId}:connections {userId}

# Check if player connected
HGET game:{gameId}:connections {userId}

# Get all connected players
HGETALL game:{gameId}:connections
```

**Timeout Logic:**
- Connections are tracked with timestamps
- A player is considered "disconnected" if their timestamp is >15 seconds old
- Background cleanup or on-demand checks validate connection freshness

---

## Pub/Sub for Real-Time Updates

SSE streams subscribe to Redis pub/sub channels to receive game updates:

```
Channel: game:{gameId}:updates
Message Format: JSON
```

**Message Types:**
```json
{"type": "game_state", "payload": {...game state...}}
{"type": "opponent_connected", "payload": {"userId": "...", "name": "..."}}
{"type": "opponent_disconnected", "payload": {"userId": "..."}}
{"type": "game_ended", "payload": {...final state...}}
```

**Operations:**
```redis
# Publish update to all listeners
PUBLISH game:{gameId}:updates {jsonMessage}

# Subscribe (done in Go code, one goroutine per SSE connection)
SUBSCRIBE game:{gameId}:updates
```

**Flow:**
1. Player makes move via HTTP POST `/api/move`
2. Server updates game state in Redis hash
3. Server publishes `game_state` to `game:{gameId}:updates` channel
4. All SSE connections subscribed to that channel receive the update
5. SSE streams forward the update to connected clients

**Benefits:**
- Multiple server instances can handle SSE connections
- All clients get updates regardless of which server they're connected to
- Decouples HTTP move handling from SSE streaming

---

## Board Representation

**Array of 9 cells:**
```
Board indices:
0 | 1 | 2
---------
3 | 4 | 5
---------
6 | 7 | 8
```

**Values:**
- `""` - Empty
- `"X"` - Player 1 (typically)
- `"O"` - Player 2 (typically)

**Stored as JSON string:**
```json
["X","","O","","X","","","","O"]
```

---

## Expiration Strategy

**Active Games:**
- TTL: 3600 seconds (1 hour)
- Covers typical game duration + idle time
- Auto-cleanup if abandoned

**Completed Games:**
- TTL: 300 seconds (5 minutes)
- Allows post-game view/rematch
- Then auto-deleted (history in PostgreSQL)

**On Server Restart:**
- Active games persist in Redis
- Players can reconnect and resume
- WebSocket connections re-establish

---

## Example Flows

### Challenge Accepted → Game Created
```
1. Identity shell creates challenge in Redis/PostgreSQL
2. Both players accept → Identity shell calls tic-tac-toe API
3. Tic-tac-toe creates game in Redis:
   HSET game:123 id 123 challengeId abc player1Id 1 ...
   EXPIRE game:123 3600
4. Navigate both players to /app/tic-tac-toe?gameId=123
5. Players connect to SSE stream: GET /api/game/123/stream?userId=...
```

### Player Connects (SSE)
```
1. Client opens EventSource to /api/game/{gameId}/stream?userId={email}
2. Server creates Redis pub/sub subscription for game:{gameId}:updates
3. Server updates connection tracking:
   HSET game:123:connections alice@test.com {timestamp}
4. Server sends initial game state via SSE
5. Server notifies opponent via pub/sub:
   PUBLISH game:123:updates {"type":"opponent_connected",...}
```

### Player Makes Move
```
1. Client sends HTTP POST to /api/move with {gameId, playerId, position}
2. Server validates move (correct turn, valid position)
3. Server updates Redis:
   HSET game:123 board ["X","","","","X","","","",""] currentTurn 2
4. Server publishes update via pub/sub:
   PUBLISH game:123:updates {"type":"game_state","payload":{...}}
5. All SSE connections receive update and forward to clients
6. Clients re-render board
```

### Game Completes (Round)
```
1. Server detects win
2. Server updates Redis:
   HSET game:123 player1Score 1 currentRound 2 board ["","","","","","","","",""]
3. If series complete (firstTo reached):
   - HSET game:123 status "completed" winnerId 1
   - Save to PostgreSQL games table
   - EXPIRE game:123 300 (5 min for post-game view)
4. Server publishes:
   PUBLISH game:123:updates {"type":"game_ended","payload":{...}}
```

### Player Disconnects
```
1. SSE connection closes (client closes tab, network drops)
2. Server removes from connection tracking:
   HDEL game:123:connections alice@test.com
3. Server publishes disconnect notification:
   PUBLISH game:123:updates {"type":"opponent_disconnected",...}
4. Remaining player sees "Opponent disconnected" message
5. After 15 seconds, remaining player can claim win
```

### Abandoned Game Cleanup
```
1. Game inactive for 1 hour
2. Redis auto-expires: DEL game:123
3. No manual cleanup needed
4. If important, save to PostgreSQL before expiration
```

---

## Migration from V2

**V2 used SQLite for live state + WebSocket:**
```sql
-- V2: Games table stored everything
SELECT * FROM games WHERE status = 'active';
-- WebSocket connections tracked in memory
```

**V3 uses Redis for live state + SSE + pub/sub:**
```redis
# V3: Redis for active games
HGETALL game:123

# V3: Pub/sub for real-time updates
PUBLISH game:123:updates {...}
```

**V3 PostgreSQL for history:**
```sql
-- V3: PostgreSQL only for completed games
SELECT * FROM games WHERE status = 'completed';
```

**Benefits:**
- ✅ Faster reads/writes for moves
- ✅ Automatic cleanup (TTL)
- ✅ Survives server restarts
- ✅ Horizontal scaling ready (Redis pub/sub)
- ✅ Better iOS Safari support (SSE over WebSocket)
- ✅ Simpler debugging (HTTP + SSE vs WebSocket)

---

## Implementation

Redis operations are implemented in `backend/redis.go`:
- `SaveGameToRedis()` - Store game state
- `GetGameFromRedis()` - Retrieve game state
- `DeleteGameFromRedis()` - Remove game
- `PublishGameUpdate()` - Send update via pub/sub
- `SubscribeToGame()` - Listen for updates (used by SSE handler)
- `TrackConnection()` / `RemoveConnection()` - Connection tracking
- `GetConnectedPlayers()` - Check who's connected
