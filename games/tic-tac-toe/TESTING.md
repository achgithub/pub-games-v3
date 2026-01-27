# Tic-Tac-Toe Testing

## Overview

This document describes how to test the tic-tac-toe backend using SSE + HTTP.

## Prerequisites

1. PostgreSQL running on port 5555
2. Redis running on port 6379
3. Database setup complete (`./database/setup.sh`)
4. Backend running (`go run *.go` in `backend/`)
5. `jq` installed for JSON formatting (optional)

## Running Tests

### Quick Manual Test

```bash
# Health check
curl http://localhost:4001/api/health

# Get stats (empty for new user)
curl http://localhost:4001/api/stats/alice@test.com
```

### Create a Game

```bash
curl -X POST http://localhost:4001/api/game \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "test-challenge",
    "player1Id": "alice@test.com",
    "player1Name": "Alice",
    "player2Id": "bob@test.com",
    "player2Name": "Bob",
    "mode": "normal",
    "moveTimeLimit": 0,
    "firstTo": 1
  }' | jq
```

### Make Moves

```bash
# Get game ID from create response, then:
GAME_ID="your-game-id"

# Alice (X) moves to center
curl -X POST http://localhost:4001/api/move \
  -H "Content-Type: application/json" \
  -d "{\"gameId\": \"$GAME_ID\", \"playerId\": \"alice@test.com\", \"position\": 4}" | jq

# Bob (O) moves to corner
curl -X POST http://localhost:4001/api/move \
  -H "Content-Type: application/json" \
  -d "{\"gameId\": \"$GAME_ID\", \"playerId\": \"bob@test.com\", \"position\": 0}" | jq
```

### SSE Stream Test

```bash
# Connect to SSE stream (use -N to disable buffering)
curl -N "http://localhost:4001/api/game/$GAME_ID/stream?userId=alice@test.com"

# You should see:
# data: {"type":"connected","payload":{...}}
# data: {"type":"game_state","payload":{...}}
#
# And then updates as moves are made via /api/move
```

### Forfeit Test

```bash
# Forfeit a game
curl -X POST "http://localhost:4001/api/game/$GAME_ID/forfeit" \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice@test.com"}' | jq
```

### Claim Win (Opponent Disconnected)

```bash
# After opponent disconnects for 15+ seconds
curl -X POST "http://localhost:4001/api/game/$GAME_ID/claim-win" \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice@test.com"}' | jq
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/game/{gameId}` | Get game state |
| POST | `/api/game` | Create new game |
| POST | `/api/move` | Make a move |
| POST | `/api/game/{gameId}/forfeit` | Forfeit game |
| POST | `/api/game/{gameId}/claim-win` | Claim win if opponent disconnected |
| GET | `/api/stats/{userId}` | Get player stats (userId is email) |
| GET | `/api/game/{gameId}/stream?userId={email}` | SSE stream for real-time updates |

## SSE Event Types

| Event Type | Description |
|------------|-------------|
| `connected` | Initial connection confirmation |
| `game_state` | Full game state (sent on connect and after moves) |
| `opponent_connected` | Opponent joined the game |
| `opponent_disconnected` | Opponent left (15s timeout to reconnect) |
| `game_ended` | Game completed (win/draw/forfeit) |
| `error` | Error message |

## User IDs

User IDs are **email addresses** (strings), not numeric IDs:

```json
{
  "player1Id": "alice@test.com",
  "player2Id": "bob@test.com"
}
```

## Test Coverage

### Currently Tested
- [x] Health endpoint
- [x] Game creation
- [x] Making moves via HTTP POST
- [x] Turn validation
- [x] Win detection
- [x] Draw detection
- [x] Game completion
- [x] Player stats update
- [x] SSE stream connection
- [x] Real-time move updates via SSE
- [x] Opponent connection/disconnection events
- [x] Forfeit functionality
- [x] Claim-win functionality

### Browser Testing
- [x] Chrome (desktop)
- [x] Safari (desktop)
- [x] iOS Safari (mobile)
- [x] Multiple browser tabs simultaneously

### Connection Handling
- [x] 15-second disconnection timeout
- [x] Reconnection restores game state
- [x] Redis pub/sub message delivery
- [x] Connection tracking in Redis

## Multi-Player Test Scenario

1. Open two terminal windows or browser tabs
2. Create a game
3. Connect both players to SSE stream:
   ```bash
   # Terminal 1 (Alice)
   curl -N "http://localhost:4001/api/game/$GAME_ID/stream?userId=alice@test.com"

   # Terminal 2 (Bob)
   curl -N "http://localhost:4001/api/game/$GAME_ID/stream?userId=bob@test.com"
   ```
4. Make moves in a third terminal:
   ```bash
   # Alice moves
   curl -X POST http://localhost:4001/api/move \
     -H "Content-Type: application/json" \
     -d "{\"gameId\": \"$GAME_ID\", \"playerId\": \"alice@test.com\", \"position\": 4}"
   ```
5. Both SSE streams should receive the `game_state` update
6. Continue alternating moves until game ends
