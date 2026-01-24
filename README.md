# PubGames V3 - Shell Architecture

**Status**: 🟢 Lobby System Complete, Game Integration Pending
**Repository**: https://github.com/achgithub/pub-games-v3
**Created**: January 21, 2026
**Last Updated**: January 24, 2026

📋 See [SUMMARY.md](./SUMMARY.md) for detailed status and [TODO.md](./TODO.md) for task list

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
│ Identity Shell (Always Running)                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [🎮 Lobby] [👤 Profile]          🔔 (1) [Settings] │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │                                                      │ │
│ │              Embedded App Area                       │ │
│ │        (Static apps via iframe OR                   │ │
│ │         Interactive games as components)            │ │
│ │                                                      │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Key Differences from V2

| Feature | V2 | V3 |
|---------|----|----|
| Navigation | App tiles → full redirect | Apps load within shell |
| Auth | Each app handles SSO | Shell handles auth once |
| Challenges | Not implemented | Real-time notifications |
| Presence | Not tracked | Always tracked |
| UI | Inconsistent across apps | Unified shell + chrome |

---

## Components

### Identity Shell
**Port**: 3000 (frontend), 3001 (backend)
**Location**: `/identity-shell/`
**Purpose**:
- User authentication (bcrypt password hashing)
- App container/router (iframe + React components)
- Lobby system (presence + challenges)
- Real-time notifications (SSE)
- Presence management (Redis)

**Tech Stack**:
- Go 1.25 backend
- React + TypeScript frontend
- PostgreSQL (persistent data)
- Redis (live data, pub/sub)

### Static Apps (iframe embedded)
Examples: Sweepstakes, Last Man Standing (solo mode)
- Self-contained
- Loaded via iframe
- Minimal changes from V2

### Interactive Games (component embedded)
Examples: Tic-Tac-Toe, Chess, Checkers
- Lightweight (no auth, no navigation)
- Loaded as React components
- Designed for 2-player matches

---

## Project Structure

```
pub-games-v3/
├── identity-shell/          # Main shell application
│   ├── backend/            # Go API (lobby, auth, presence)
│   │   ├── main.go         # HTTP server, auth, routing
│   │   ├── lobby.go        # Lobby API handlers
│   │   └── redis.go        # Redis operations
│   ├── frontend/           # React + TypeScript shell UI
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Shell.tsx         # Main shell container
│   │   │   │   ├── Lobby.tsx         # Lobby UI
│   │   │   │   ├── ChallengeToast.tsx # Notification popup
│   │   │   │   └── AppContainer.tsx  # Game/app loader
│   │   │   ├── hooks/
│   │   │   │   └── useLobby.ts       # SSE, presence, challenges
│   │   │   └── types.ts              # TypeScript definitions
│   │   └── package.json
│   └── data/               # PostgreSQL migrations
│
├── games/
│   ├── tic-tac-toe/        # Interactive game prototype
│   │   ├── backend/
│   │   │   ├── main.go     # Game logic API
│   │   │   └── game.go     # Match management
│   │   ├── src/
│   │   │   ├── GameBoard.js
│   │   │   └── GameLogic.js
│   │   └── data/
│   │
│   └── game-template/      # Template for new games
│       ├── backend/
│       ├── frontend/
│       └── README.md
│
├── static-apps/            # Static apps (iframe-embedded)
│   ├── smoke-test/         # Template validation app (working)
│   │   ├── main.go         # Serves both frontend + API
│   │   ├── handlers.go     # API endpoints
│   │   ├── database.go     # PostgreSQL setup
│   │   ├── src/            # React frontend
│   │   └── public/
│   └── static-template/    # Template for new static apps
│
├── shared/                 # Shared utilities
│   ├── auth/              # Auth helpers
│   └── components/        # Shared React components
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── LOBBY-SYSTEM.md
│   └── GAME-TEMPLATE-GUIDE.md
│
├── scripts/
│   ├── start_all.sh
│   ├── stop_all.sh
│   └── dev.sh
│
└── README.md              # This file
```

---

## Port Allocation

```
3000  - Identity Shell Frontend
3001  - Identity Shell Backend

4000  - Tic-Tac-Toe Frontend (dev only, embedded in production)
4001  - Tic-Tac-Toe Backend

4010  - Chess Frontend
4011  - Chess Backend

5010  - Smoke Test Frontend (iframe)
5011  - Smoke Test Backend API

5020  - Static App Frontend (template pattern)
5021  - Static App Backend API

... etc
```

**Pattern**:
- Shell uses 3000-3099
- Interactive games use 4000-4999 (dev only, embedded as components)
- Static apps use 5000+ (iframe embedded, dual ports: frontend + API)

---

## Development Phases

### Phase 1: Identity Shell Prototype ✅ COMPLETE
- [x] Basic shell UI (header + content area)
- [x] Auth system (email/password with bcrypt)
- [x] App routing (load different apps)
- [x] Iframe embedding with full-height rendering
- [x] Static app template (smoke-test working)

### Phase 2: Lobby System ✅ COMPLETE
- [x] Redis + PostgreSQL hybrid architecture
- [x] Presence tracking (Redis, 30s TTL)
- [x] Challenge system (send, accept, decline, 60s expiration)
- [x] Server-Sent Events for real-time updates
- [x] Lobby UI (online users, challenges)
- [x] Challenge notifications (subtle toast)
- [x] Duplicate challenge prevention
- [x] Auto-expiration and cleanup

### Phase 3: Interactive Game Integration ⬅️ **WE ARE HERE**
- [ ] Connect challenge acceptance to game launch
- [ ] Pass challenge context to game
- [ ] Game state management (Redis)
- [ ] Match completion and result tracking
- [ ] Tic-Tac-Toe fully integrated

### Phase 4: Additional Games & Features
- [ ] Chess, Checkers, other games
- [ ] Spectator mode
- [ ] Game history and statistics
- [ ] User profiles and avatars

### Phase 5: Migration & Polish
- [ ] Migrate useful V2 apps
- [ ] Mobile UI optimization
- [ ] Complete documentation
- [ ] Production deployment

---

## Getting Started

### Prerequisites
- Go 1.25+
- Node.js 18+
- PostgreSQL 13+
- Redis 6+

### Development Setup
```bash
# Clone repository
git clone https://github.com/achgithub/pub-games-v3.git
cd pub-games-v3

# Setup database (see scripts/migrate_lobby.sh)
# Ensure PostgreSQL is running on port 5555
# Ensure Redis is running on port 6379

# Start Identity Shell (backend)
cd identity-shell/backend
go run *.go

# Build and serve frontend (production)
cd ../frontend
npm install
npm run build
# Backend serves the build/ folder on port 3001

# Access at http://localhost:3001
# Or run frontend dev server on http://localhost:3000
```

---

## Design Principles

1. **Shell First**: Identity Shell is always the entry point
2. **Minimal Games**: Interactive games should be lightweight (no auth, minimal chrome)
3. **Backward Compatible**: Static V2 apps can run in iframes
4. **Hybrid Data**: Redis for live/ephemeral, PostgreSQL for persistent
5. **Real-time**: Server-Sent Events for instant updates (WebSocket future consideration)
6. **Mobile Friendly**: Responsive design (touch optimization pending)

---

## Known Issues & Solutions

### ✅ Iframe Height Issue (FIXED)
**Problem**: Static apps appeared in small box instead of filling iframe.

**Solution**:
- Shell side: Use flexbox in `AppContainer.css` (not `position: relative`)
- App side: Set `html/body/root` to `height: 100%` with flexbox in `index.css`
- See commits: `b3227e8`, `7e32a2c`

### ✅ Static App Serving (FIXED)
**Problem**: Go backend only served API, frontend required separate `npm start`.

**Solution**:
- Modified `main.go` to run two HTTP servers (goroutine for API)
- Port 5010: serves React static files (build/ or public/)
- Port 5011: serves API endpoints
- See commit: `f125b08`

---

## Contributing

This is a prototype/experimental repository. Structure may change frequently during Phase 1.

---

## License

MIT

---

**Next Steps**: See `docs/ARCHITECTURE.md` for detailed design
