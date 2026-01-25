# PubGames V3 - Shell Architecture

**Status**: 🟢 Tic-Tac-Toe Integration In Progress
**Repository**: https://github.com/achgithub/pub-games-v3
**Created**: January 21, 2026
**Last Updated**: January 25, 2026

📋 See [CLAUDE.md](./CLAUDE.md) for architecture decisions and [TODO.md](./TODO.md) for task list

---

## Vision

PubGames V3 introduces a **shell architecture** where the Identity Service acts as a persistent container for all gaming applications. This enables:

- Real-time challenge notifications across all apps
- Unified presence tracking
- Seamless game launching
- Consistent UI/UX

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Identity Shell (port 3001)                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [🎮 Lobby] [👤 Profile]          🔔 (1) [Logout]   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │                                                     │ │
│ │  <iframe src="http://pi:4001?userId=x&gameId=y">   │ │
│ │                                                     │ │
│ │    ┌─────────────────────────────────────────┐     │ │
│ │    │ Tic-Tac-Toe App (port 4001)             │     │ │
│ │    │ - Go backend serves API + static files  │     │ │
│ │    │ - React frontend                        │     │ │
│ │    │ - WebSocket for real-time moves         │     │ │
│ │    └─────────────────────────────────────────┘     │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key principle**: All apps embedded via **iframe only**. No React component imports in shell.

---

## Key Differences from V2

| Feature | V2 | V3 |
|---------|----|----|
| Navigation | App tiles → full redirect | Apps load within shell |
| Auth | Each app handles SSO | Shell handles auth once |
| Challenges | Not implemented | Real-time notifications |
| Presence | Not tracked | Always tracked |
| UI | Inconsistent across apps | Unified shell chrome |
| App serving | Dual ports (frontend + API) | **Single port per app** |
| App discovery | Hardcoded | **Dynamic registry** |

---

## Components

### Identity Shell
**Port**: 3001 (serves both frontend and API)
**Location**: `/identity-shell/`

**Purpose**:
- User authentication (bcrypt password hashing)
- App registry (`/api/apps`)
- Lobby system (presence + challenges)
- Real-time notifications (SSE)
- App embedding via iframe

### Mini-Apps (All iframe embedded)
**Pattern**: Single port serves frontend + API

| App | Port | Real-Time | Status |
|-----|------|-----------|--------|
| Tic-Tac-Toe | 4001 | WebSocket | In Progress |
| Smoke Test | 5010 | None | Working |
| Sweepstakes | 5020 | None | Planned |

---

## Project Structure

```
pub-games-v3/
├── identity-shell/
│   ├── backend/
│   │   ├── main.go         # HTTP server, auth, app registry
│   │   ├── lobby.go        # Lobby API handlers
│   │   ├── redis.go        # Redis operations
│   │   └── apps.json       # App registry config
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Shell.tsx
│   │       │   ├── Lobby.tsx
│   │       │   └── AppContainer.tsx  # iframe loader
│   │       └── hooks/
│   │           ├── useLobby.ts
│   │           └── useApps.ts        # fetches /api/apps
│   └── data/
│
├── games/
│   └── tic-tac-toe/
│       ├── backend/
│       │   ├── main.go         # Serves API + static files
│       │   ├── websocket.go    # WebSocket handlers
│       │   ├── game_logic.go
│       │   ├── redis.go
│       │   └── static/         # React build output
│       ├── frontend/
│       │   └── src/
│       │       ├── App.tsx
│       │       ├── components/
│       │       └── hooks/
│       └── database/
│           └── schema.sql
│
├── static-apps/
│   └── smoke-test/
│
├── scripts/
│
└── CLAUDE.md               # Architecture decisions
```

---

## Port Allocation

**Single port per app** - each app serves frontend + API together.

```
Identity Shell:
  3001  - Shell (frontend + API)

Interactive Games (WebSocket):
  4001  - Tic-Tac-Toe
  4011  - Dots (future)
  4021  - Chess (future)

Static Apps (no real-time):
  5010  - Smoke Test
  5020  - Sweepstakes
  5030  - Last Man Standing
```

---

## Development Phases

### Phase 1: Identity Shell ✅ COMPLETE
- [x] Shell UI with header navigation
- [x] Auth system (email/password with bcrypt)
- [x] Iframe embedding

### Phase 2: Lobby System ✅ COMPLETE
- [x] Presence tracking (Redis, 30s TTL)
- [x] Challenge system (send, accept, decline)
- [x] Server-Sent Events for real-time updates

### Phase 3: Game Integration ⬅️ **WE ARE HERE**
- [x] Dynamic app registry
- [x] Single-port app architecture
- [x] Tic-Tac-Toe backend (WebSocket, Redis, PostgreSQL)
- [x] Tic-Tac-Toe frontend
- [ ] Challenge → game flow integration
- [ ] End-to-end testing

### Phase 4: Additional Games
- [ ] Migrate Sweepstakes from V2
- [ ] Dots game
- [ ] Quiz app

---

## Getting Started

### Prerequisites
- Go 1.25+
- Node.js 18+
- PostgreSQL 13+ (port 5555)
- Redis 6+ (port 6379)

### Running the Shell
```bash
cd identity-shell/backend
go run *.go &

cd ../frontend
npm install && npm run build
# Access at http://localhost:3001
```

### Running Tic-Tac-Toe
```bash
cd games/tic-tac-toe/frontend
npm install && npm run build
cp -r build/* ../backend/static/

cd ../backend
go run *.go
# Serves on http://localhost:4001
```

---

## Design Principles

1. **Shell First**: Identity Shell is always the entry point
2. **Single Port**: Each app serves frontend + API from one port
3. **Iframe Only**: No React component imports across apps
4. **Dynamic Registry**: Apps discovered via `/api/apps`, not hardcoded
5. **Hybrid Data**: Redis for live state, PostgreSQL for history

---

## License

MIT
