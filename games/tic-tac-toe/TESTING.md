# Tic-Tac-Toe Testing

## Overview

This document describes how to test the tic-tac-toe backend. We're building up a suite of automated tests that can be run on the Pi.

## Prerequisites

1. PostgreSQL running on port 5555
2. Redis running
3. Database setup complete (`./database/setup.sh`)
4. Backend running (`go run *.go` in `backend/`)
5. `jq` installed for JSON formatting (optional but recommended)

## Running Tests

### Quick Manual Test

```bash
# Health check
curl http://localhost:4001/api/health

# Get stats (empty for new user)
curl http://localhost:4001/api/stats/1
```

### Automated Test Scripts

All test scripts are in the `tests/` directory.

```bash
cd ~/pub-games-v3/games/tic-tac-toe/tests
chmod +x *.sh

# Run basic game test
./test_basic_game.sh
```

## Test Scripts

| Script | Description |
|--------|-------------|
| `test_basic_game.sh` | Creates a game, plays to completion (Alice wins), verifies stats |

## Test Coverage

### Currently Tested
- [x] Health endpoint
- [x] Game creation
- [x] Making moves
- [x] Turn validation (implicit)
- [x] Win detection (top row)
- [x] Game completion
- [x] Player stats update

### TODO - Future Tests
- [ ] Draw detection
- [ ] Invalid move rejection (occupied cell)
- [ ] Wrong turn rejection
- [ ] Series games (first-to-3, first-to-5)
- [ ] All win patterns (rows, columns, diagonals)
- [ ] Game retrieval by ID
- [ ] Redis state persistence
- [ ] PostgreSQL game history

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/game/{gameId}` | Get game state |
| POST | `/api/game` | Create new game |
| POST | `/api/move` | Make a move |
| GET | `/api/stats/{userId}` | Get player stats |
| WS | `/api/ws/game/{gameId}` | WebSocket (not yet implemented) |

## Adding New Tests

1. Create a new script in `tests/` following the naming convention `test_*.sh`
2. Include 1-second sleeps between API calls for readability
3. Use `jq` for JSON formatting
4. Echo clear descriptions of what's being tested
5. Update this document with the new test

## Running All Tests

```bash
# Run all test scripts (to be created)
cd ~/pub-games-v3/games/tic-tac-toe/tests
for test in test_*.sh; do
  echo "Running $test..."
  ./$test
  echo ""
done
```
