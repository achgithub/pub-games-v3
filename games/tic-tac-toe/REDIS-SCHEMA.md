# Tic-Tac-Toe Redis Schema

**Purpose**: Store live game state with automatic expiration

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

## Connection Tracking (Optional)

If we need to track active WebSocket connections in Redis:

```
Key: game:{gameId}:connections
Type: Set
TTL: 3600 seconds
Members: ["1", "2"]  # User IDs
```

**Operations:**
```redis
SADD game:{gameId}:connections {userId}
SREM game:{gameId}:connections {userId}
SMEMBERS game:{gameId}:connections
```

**Note**: V2 tracks connections in memory (ConnectionManager). We'll keep that pattern for now since WebSocket connections are ephemeral. Redis game state is the source of truth for game data, not connections.

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
```

### Player Makes Move
```
1. Client sends WebSocket message: {type: "move", position: 4}
2. Server validates move
3. Server updates Redis:
   HSET game:123 board ["X","","","","X","","","",""] currentTurn 2
4. Server broadcasts update via WebSocket to both players
5. Clients re-render board
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
4. Broadcast game_ended to both players
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

**V2 used SQLite for live state:**
```sql
-- V2: Games table stored everything
SELECT * FROM games WHERE status = 'active';
```

**V3 uses Redis for live state:**
```redis
# V3: Redis for active games
HGETALL game:123
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
- ✅ Horizontal scaling ready

---

**Next**: Implement Redis operations in `backend/redis.go`
