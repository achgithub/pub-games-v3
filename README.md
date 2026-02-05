# PubGames V3 - Shell Architecture

**Status**: 🟢 Core Games, Season Scheduler & Display System Complete
**Repository**: https://github.com/achgithub/pub-games-v3
**Created**: January 21, 2026
**Last Updated**: February 5, 2026

📋 **Documentation**: [CLAUDE.md](./CLAUDE.md) (index) | [QUICKSTART.md](./QUICKSTART.md) | [TODO.md](./TODO.md) | [docs/](./docs/)

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
│ │    │ - SSE for real-time updates             │     │ │
│ │    │ - HTTP POST for moves                   │     │ │
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

**Competitive Games**:
| App | Port | Real-Time | Status |
|-----|------|-----------|--------|
| Tic-Tac-Toe | 4001 | SSE + HTTP | ✅ Working |
| Dots & Boxes | 4011 | SSE + HTTP | ✅ Working |

**Utilities & Admin Tools**:
| App | Port | Real-Time | Status |
|-----|------|-----------|--------|
| Leaderboard | 5030 | None | ✅ Working |
| Season Scheduler | 5040 | None | ✅ Working |
| Display Admin | 5050 | None | ✅ Working |
| Display Runtime | 5051 | Auto-refresh | ✅ Working |
| Smoke Test | 5010 | None | ✅ Working |
| Sweepstakes | 5020 | None | ⏳ Legacy |

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
│       │   ├── handlers.go     # SSE stream + HTTP endpoints
│       │   ├── game_logic.go
│       │   ├── redis.go        # Redis + pub/sub
│       │   └── static/         # React build output
│       ├── frontend/
│       │   └── src/
│       │       ├── App.tsx
│       │       ├── components/
│       │       └── hooks/
│       │           └── useGameSocket.ts  # SSE + HTTP client
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

Competitive Games (Turn-based, SSE + HTTP):
  4001  - Tic-Tac-Toe
  4011  - Dots & Boxes
  4021  - Chess (future)

Admin Tools & Utilities (No real-time):
  5010  - Smoke Test
  5020  - Sweepstakes (legacy)
  5030  - Leaderboard
  5040  - Season Scheduler (schedule management)
  5050  - Display Admin (TV content management)
  5051  - Display Runtime (TV slideshow app)
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

### Phase 3: Tic-Tac-Toe ✅ COMPLETE
- [x] Dynamic app registry
- [x] Single-port app architecture
- [x] Tic-Tac-Toe backend (SSE + HTTP, Redis, PostgreSQL)
- [x] Tic-Tac-Toe frontend
- [x] Real-time game play working (tested multi-browser, iOS Safari)
- [x] Forfeit and claim-win functionality

### Phase 4: Challenge Integration ✅ COMPLETE
- [x] Challenge → game flow integration
- [x] Game result reporting to shell
- [x] End-to-end challenge-to-game testing
- [x] Dynamic game selection in challenges
- [x] Challenge options forwarded to game backends

### Phase 5: Season Scheduler ✅ COMPLETE
- [x] Round-robin schedule generation (no duplicate matchups)
- [x] Conflict detection (visual highlighting)
- [x] Manual adjustments (reorder individual/bulk matches)
- [x] Exclusion weeks (free, special, catchup) with proper displacement
- [x] Holiday detection (UK Bank Holidays)
- [x] Save and export functionality
- [x] PostgreSQL persistence with 30-day auto-cleanup

### Phase 6: Display System ✅ COMPLETE
- [x] Display Admin backend (Go, PostgreSQL, QR codes)
- [x] Display Admin frontend (TypeScript React)
- [x] Content management (images, URLs, announcements, leaderboard, schedule)
- [x] Playlist management (ordered sequences with durations)
- [x] Display management (token generation, QR codes)
- [x] Scheduling system (date/time/day filters, priority)
- [x] Display Runtime backend (static file server)
- [x] Display Runtime frontend (token auth, auto-rotation, fullscreen)
- [x] All 6 content types supported
- [x] Safari compatibility fixes
- [x] Service script integration
- [x] Seed script for testing (2 TVs with realistic content)

### Phase 7: Additional Games ⬅️ **WE ARE HERE**
- [ ] Migrate Sweepstakes from V2
- [ ] Hangman game
- [ ] Quiz app

---

## Getting Started

### Prerequisites
- Go 1.25+
- Node.js 18+
- PostgreSQL 13+ (port 5555)
- Redis 6+ (port 6379)

### Quick Start (Recommended)

Use the automated service scripts:

```bash
# Start all services (auto-builds frontends if needed)
./start_services.sh

# Check status
./status_services.sh

# Stop all services
./stop_services.sh

# View logs
tail -f logs/<service>.log
```

The start script will:
- Check if frontends need rebuilding
- Build frontends automatically if source changed
- Start all backends on correct ports
- Show access URLs when complete

### Manual Start (Individual Apps)

**Identity Shell**:
```bash
cd identity-shell/backend
go run *.go &
# Access at http://localhost:3001
```

**Tic-Tac-Toe**:
```bash
cd games/tic-tac-toe/frontend
npm install && npm run build
cp -r build/* ../backend/static/

cd ../backend
go run *.go
# Serves on http://localhost:4001
```

**Display System**:
```bash
# Display Admin (management UI)
cd games/display-admin/backend
./seed-displays.sh  # Optional: create 2 test TVs with content
go run *.go         # Port 5050

# Display Runtime (TV app)
cd games/display-runtime/backend
go run *.go         # Port 5051
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
