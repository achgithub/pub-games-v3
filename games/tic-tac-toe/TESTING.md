# Tic-Tac-Toe Testing

## Overview

This document describes how to test the tic-tac-toe backend.

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

### WebSocket Test

```bash
# Use wscat or similar WebSocket client
wscat -c "ws://localhost:4001/api/ws/game/$GAME_ID?userId=alice@test.com"

# Send ack to mark ready
{"type": "ack"}

# Send move
{"type": "move", "payload": {"position": 4}}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/game/{gameId}` | Get game state |
| POST | `/api/game` | Create new game |
| POST | `/api/move` | Make a move |
| GET | `/api/stats/{userId}` | Get player stats (userId is email) |
| WS | `/api/ws/game/{gameId}?userId={email}` | WebSocket connection |

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
- [x] Making moves via HTTP
- [x] Turn validation
- [x] Win detection
- [x] Game completion
- [x] Player stats update

### WebSocket Tests
- [x] Connection with userId
- [x] Ack/ready handshake
- [x] Move via WebSocket
- [x] Broadcast to both players
- [x] Disconnect notification

### TODO
- [ ] Draw detection
- [ ] Series games (first-to-3, etc.)
- [ ] All win patterns
- [ ] Reconnection handling
