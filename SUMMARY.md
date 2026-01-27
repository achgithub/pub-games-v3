# PubGames V3 - Current Status Summary

**Last Updated**: January 27, 2026

## What's Working

### Identity Shell (Complete)
- ✅ React frontend with persistent shell UI
- ✅ User authentication (email + password with bcrypt)
- ✅ Dynamic app registry (`/api/apps`)
- ✅ Iframe embedding for all apps

### Lobby System (Complete)
- ✅ Real-time presence tracking (Redis-backed, 30s TTL)
- ✅ Challenge system (send, accept, decline, 60s expiration)
- ✅ Server-Sent Events for instant updates
- ✅ Challenge notifications (toast popup)

### Tic-Tac-Toe (Complete)
- ✅ Backend with SSE + HTTP (refactored from WebSocket for iOS Safari compatibility)
- ✅ Redis for live game state + pub/sub for real-time updates
- ✅ PostgreSQL for game history
- ✅ React frontend with EventSource + fetch
- ✅ Forfeit and claim-win functionality
- ✅ Connection tracking with 15-second timeout
- ✅ Tested on multiple browsers including iOS Safari

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript |
| Backend | Go 1.25 |
| Persistent Data | PostgreSQL (port 5555) |
| Live Data | Redis (port 6379) |
| Shell Real-Time | Server-Sent Events |
| Game Real-Time | SSE + HTTP (better mobile compatibility) |

## Architecture

### Single Port Per App
Every mini-app serves **frontend + API from one port**:

```
Identity Shell (3001) ──iframe──> Tic-Tac-Toe (4001)
                      ──iframe──> Smoke Test (5010)
                      ──iframe──> Sweepstakes (5020)
```

**Benefits:**
- No CORS issues
- Simple deployment (one process per app)
- Adding apps requires NO shell rebuild

### Dynamic App Registry
Shell fetches apps from `/api/apps` instead of hardcoding:

```json
{
  "apps": [
    {"id": "tic-tac-toe", "url": "http://{host}:4001", "type": "iframe"}
  ]
}
```

### Real-Time Patterns

| App Type | Pattern | Example |
|----------|---------|---------|
| Turn-based games | SSE + HTTP | Tic-Tac-Toe, Chess, Dots |
| Broadcast apps | SSE | Quiz leaderboard, Displays |
| Static apps | None/Polling | Sweepstakes, LMS |

**Note**: We chose SSE + HTTP over WebSocket for better iOS Safari compatibility and simpler debugging.

## Port Allocation

```
3001  - Identity Shell (frontend + API)
4001  - Tic-Tac-Toe
5010  - Smoke Test
5020  - Sweepstakes (planned)
5555  - PostgreSQL
6379  - Redis
```

## Current Phase

**Phase 5: Additional Games**

- [x] Dynamic app registry
- [x] Single-port architecture
- [x] Tic-Tac-Toe backend (SSE + HTTP)
- [x] Tic-Tac-Toe frontend (EventSource + fetch)
- [x] Real-time gameplay tested and working
- [x] Challenge → game flow integration (accept launches game)
- [ ] Game result reporting to shell
- [ ] Migrate Sweepstakes
- [ ] Migrate Last Man Standing

## Known Limitations

1. No game result reporting to shell
2. Basic auth only (no OAuth)
3. Single-device sessions

## File Structure

```
pub-games-v3/
├── identity-shell/
│   ├── backend/         # Go server + apps.json
│   └── frontend/        # React shell UI
├── games/
│   └── tic-tac-toe/
│       ├── backend/     # Go + SSE + HTTP + static/
│       │   ├── main.go
│       │   ├── handlers.go      # SSE stream + HTTP endpoints
│       │   ├── redis.go         # Redis + pub/sub
│       │   └── game_logic.go
│       └── frontend/    # React game UI (EventSource + fetch)
├── static-apps/
│   └── smoke-test/
├── CLAUDE.md            # Architecture decisions
├── README.md            # Project overview
└── TODO.md              # Task list
```
