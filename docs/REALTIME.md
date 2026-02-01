# Real-Time Communication Patterns

## Overview

This project uses **Server-Sent Events (SSE)** as the primary real-time communication method, with HTTP POST for client actions.

## Communication Patterns

### SSE + HTTP (Preferred for Turn-Based Games)

**Best for:** Turn-based games (tic-tac-toe, dots, chess)

**Pattern:**
- **SSE** for server → client updates (game state changes)
- **HTTP POST** for client → server actions (make a move)

**Why:**
- Better iOS Safari compatibility
- Simpler debugging (SSE is just HTTP)
- Automatic reconnection
- Works with HTTP/2 multiplexing
- Easier to monitor/log

**Example: Tic-Tac-Toe**
```
Client 1                Backend                Client 2
   |                       |                       |
   |--- POST /api/move --->|                       |
   |                       |                       |
   |                       |--- Redis update ----->|
   |                       |                       |
   |                       |--- Pub: "game:123" -->|
   |                       |                       |
   |<-- SSE: game state ---|                       |
   |                       |                       |
   |                       |--- SSE: game state -->|
```

### SSE Only (One-Way Broadcast)

**Best for:** Quizzes, leaderboards, display systems

**Pattern:**
- **SSE** for server → client updates only
- **HTTP POST** for actions (submit answer, admin controls)

**Why:**
- Simple one-to-many broadcasting
- No need for bidirectional communication
- Efficient for high player counts (30+ users)

**Example: Quiz**
```
Admin                  Backend                Players (30+)
  |                       |                       |
  |--- POST /api/start -->|                       |
  |                       |                       |
  |                       |------ SSE: Q1 ------->|
  |                       |                       |
  |                       |<-- POST /api/answer --|
  |                       |                       |
  |                       |--- SSE: leaderboard ->|
```

### Polling/No Real-Time (Static Apps)

**Best for:** Sweepstakes, Last Man Standing, pick-and-wait apps

**Pattern:**
- **HTTP POST** for submitting picks
- **HTTP GET** for checking results (optional polling)
- No real-time updates during event

**Why:**
- No real-time requirements
- Simple implementation
- PostgreSQL only (no Redis needed)

**Example: Sweepstakes**
```
Client                 Backend
  |                       |
  |--- POST /api/pick --->|
  |                       |
  |<-- 200 OK ------------|
  |                       |
  |... wait for results ...|
  |                       |
  |--- GET /api/results ->|
  |                       |
  |<-- Results ------------|
```

## SSE Implementation

### Backend (Go)

**Basic SSE handler:**

```go
func handleGameStream(w http.ResponseWriter, r *http.Request) {
    gameID := extractGameID(r)

    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("Access-Control-Allow-Origin", "*")

    // Get flusher
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming not supported", http.StatusInternalServerError)
        return
    }

    // Send initial state
    state, _ := getGameState(gameID)
    data, _ := json.Marshal(state)
    fmt.Fprintf(w, "data: %s\n\n", data)
    flusher.Flush()

    // Subscribe to Redis pub/sub
    pubsub := rdb.Subscribe(ctx, "game:"+gameID)
    defer pubsub.Close()

    ch := pubsub.Channel()

    // Listen for updates
    for {
        select {
        case msg := <-ch:
            fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
            flusher.Flush()
        case <-r.Context().Done():
            // Client disconnected
            log.Printf("Client disconnected from game %s", gameID)
            return
        }
    }
}
```

### Redis Pub/Sub Integration

**Publisher (when game state changes):**

```go
func broadcastGameUpdate(gameID string, state GameState) error {
    // 1. Update Redis state
    data, _ := json.Marshal(state)
    err := rdb.Set(ctx, "game:"+gameID, data, 24*time.Hour).Err()
    if err != nil {
        return err
    }

    // 2. Publish to all SSE listeners
    return rdb.Publish(ctx, "game:"+gameID, data).Err()
}
```

**Usage in move handler:**

```go
func handleGameMove(w http.ResponseWriter, r *http.Request) {
    gameID := extractGameID(r)

    var move Move
    json.NewDecoder(r.Body).Decode(&move)

    // Apply move
    state, err := applyMove(gameID, move)
    if err != nil {
        respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
        return
    }

    // Broadcast to all connected clients
    broadcastGameUpdate(gameID, state)

    respondJSON(w, http.StatusOK, state)
}
```

### Frontend (React)

**Basic SSE client:**

```typescript
import { useEffect, useState } from 'react';

function Game({ gameId }: { gameId: string }) {
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource(`/api/game/${gameId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setState(data);
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [gameId]);

  if (!state) return <div>Loading...</div>;

  return <div>{/* Render game state */}</div>;
}
```

**With reconnection logic:**

```typescript
useEffect(() => {
  let eventSource: EventSource | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = () => {
    eventSource = new EventSource(`/api/game/${gameId}/stream`);

    eventSource.onopen = () => {
      console.log('[SSE] Connected');
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setState(data);
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Error:', error);
      eventSource?.close();

      // Reconnect after 3 seconds
      reconnectTimer = setTimeout(() => {
        console.log('[SSE] Reconnecting...');
        connect();
      }, 3000);
    };
  };

  connect();

  return () => {
    eventSource?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}, [gameId]);
```

## HTTP POST for Actions

### Backend handler

```go
func handleGameMove(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    gameID := extractGameID(r)

    var move Move
    if err := json.NewDecoder(r.Body).Decode(&move); err != nil {
        respondJSON(w, http.StatusBadRequest, map[string]string{
            "error": "Invalid request body",
        })
        return
    }

    // Validate
    if err := validateMove(gameID, move); err != nil {
        respondJSON(w, http.StatusBadRequest, map[string]string{
            "error": err.Error(),
        })
        return
    }

    // Apply
    state, err := applyMove(gameID, move)
    if err != nil {
        respondJSON(w, http.StatusInternalServerError, map[string]string{
            "error": "Failed to apply move",
        })
        return
    }

    // Broadcast (triggers SSE updates)
    broadcastGameUpdate(gameID, state)

    respondJSON(w, http.StatusOK, state)
}
```

### Frontend action

```typescript
async function makeMove(row: number, col: number) {
  try {
    const response = await fetch(`/api/game/${gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, col }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to make move');
    }

    // State update comes via SSE, not from this response
  } catch (error) {
    console.error('Move failed:', error);
    setError(error.message);
  }
}
```

## Game Patterns Reference

| Game Type | Pattern | SSE | HTTP | Redis | PostgreSQL |
|-----------|---------|-----|------|-------|------------|
| Tic-tac-toe | SSE + HTTP | ✅ | POST moves | Game state | Final result |
| Dots | SSE + HTTP | ✅ | POST moves | Game state | Final result |
| Chess | SSE + HTTP | ✅ | POST moves | Game state | Final result |
| Quiz | SSE + HTTP | ✅ | POST answers | Leaderboard | Questions, Results |
| Sweepstakes | No real-time | ❌ | POST picks | ❌ | Picks, Results |
| Last Man Standing | Polling | Optional | POST picks | ❌ | Picks, Results |

## SSE vs WebSocket Decision Matrix

| Factor | SSE | WebSocket |
|--------|-----|-----------|
| Browser support | Excellent | Good |
| iOS Safari | ✅ Reliable | ⚠️ Issues reported |
| Complexity | Simple | More complex |
| Debugging | Easy (HTTP) | Harder (binary frames) |
| Direction | Server → Client | Bidirectional |
| Reconnection | Automatic | Manual |
| Use case | Updates, events | Real-time chat, gaming |

**When to use WebSocket instead of SSE:**
- Real-time action games (<50ms latency required)
- Bidirectional streaming needed
- Binary protocol required
- Complex message negotiation

**For this project:** SSE is preferred for all current use cases.

## Common Patterns

### Pattern 1: Game State Updates

```go
// Move handler
func handleMove(w http.ResponseWriter, r *http.Request) {
    // 1. Validate move
    // 2. Update Redis state
    // 3. Publish to Redis channel
    // 4. Return success (SSE sends actual state)

    move := parseMove(r)
    state := applyMove(gameID, move)

    // This triggers SSE updates to all clients
    rdb.Publish(ctx, "game:"+gameID, state)

    respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```

### Pattern 2: Quiz Questions

```go
// Admin triggers next question
func handleNextQuestion(w http.ResponseWriter, r *http.Request) {
    quizID := extractQuizID(r)

    question := getNextQuestion(quizID)

    // Broadcast to all players via SSE
    data, _ := json.Marshal(question)
    rdb.Publish(ctx, "quiz:"+quizID, data)

    respondJSON(w, http.StatusOK, question)
}
```

### Pattern 3: Leaderboard Updates

```go
// Answer submission updates leaderboard
func handleAnswer(w http.ResponseWriter, r *http.Request) {
    var answer Answer
    json.NewDecoder(r.Body).Decode(&answer)

    // Update Redis sorted set
    score := calculateScore(answer)
    rdb.ZAdd(ctx, "leaderboard:"+quizID, &redis.Z{
        Score:  float64(score),
        Member: answer.PlayerID,
    })

    // Broadcast updated leaderboard
    leaderboard := getTopPlayers(quizID, 10)
    data, _ := json.Marshal(leaderboard)
    rdb.Publish(ctx, "leaderboard:"+quizID, data)

    respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```

## Performance Tips

### SSE

- Keep messages small (< 1KB)
- Send only changed data, not full state (when possible)
- Use compression for large messages
- Monitor active connections (`/debug/vars` in Go)

### Redis Pub/Sub

- One channel per game/session
- Clean up channels when game ends
- Use pattern subscriptions carefully (can be slow)

### Connection Management

```go
// Track active SSE connections
var activeConnections sync.Map

func handleGameStream(w http.ResponseWriter, r *http.Request) {
    gameID := extractGameID(r)

    // Register connection
    activeConnections.Store(gameID, time.Now())

    defer func() {
        // Unregister on disconnect
        activeConnections.Delete(gameID)
        log.Printf("Active connections: %d", countActive())
    }()

    // ... rest of handler
}

func countActive() int {
    count := 0
    activeConnections.Range(func(_, _ interface{}) bool {
        count++
        return true
    })
    return count
}
```

## Debugging

### Backend logging

```go
log.Printf("[SSE] Client connected to game %s", gameID)
log.Printf("[SSE] Sending update: %s", data)
log.Printf("[SSE] Client disconnected from game %s", gameID)
```

### Frontend logging

```typescript
eventSource.onopen = () => {
  console.log('[SSE] Connected to game', gameId);
};

eventSource.onmessage = (event) => {
  console.log('[SSE] Received:', event.data);
};

eventSource.onerror = (error) => {
  console.error('[SSE] Error:', error);
};
```

### Redis monitoring

```bash
# On Pi - monitor pub/sub activity
redis-cli
> PUBSUB CHANNELS
> PUBSUB NUMSUB game:ABC123
```

### Network inspection

- Browser DevTools → Network tab
- Filter by "EventStream"
- Check SSE connection stays open
- Verify messages are received

## Common Issues

### Issue: SSE disconnects frequently

**Cause:** Load balancer or proxy timeout

**Fix:** Send periodic keep-alive:

```go
ticker := time.NewTicker(30 * time.Second)
defer ticker.Stop()

for {
    select {
    case <-ticker.C:
        fmt.Fprintf(w, ": keepalive\n\n")
        flusher.Flush()
    case msg := <-ch:
        fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
        flusher.Flush()
    }
}
```

### Issue: SSE doesn't work on iOS Safari

**Cause:** Usually missing headers or incorrect content-type

**Fix:** Ensure correct headers:

```go
w.Header().Set("Content-Type", "text/event-stream")
w.Header().Set("Cache-Control", "no-cache")
w.Header().Set("Connection", "keep-alive")
```

### Issue: Multiple SSE connections per client

**Cause:** React strict mode in development (mounts twice)

**Fix:** Use cleanup function:

```typescript
useEffect(() => {
  const eventSource = new EventSource(url);
  return () => eventSource.close(); // Cleanup
}, [url]);
```

## Reference Implementation

Check tic-tac-toe for complete example:
- `games/tic-tac-toe/backend/handlers.go` - SSE server
- `games/tic-tac-toe/frontend/src/App.tsx` - SSE client
- `games/tic-tac-toe/backend/redis.go` - Pub/sub integration
