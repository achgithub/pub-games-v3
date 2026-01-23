# PubGames V3 - Shell Architecture

**Status**: 🚧 Prototype Phase
**Repository**: https://github.com/achgithub/pub-games-v3
**Created**: January 21, 2026

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
- User authentication
- App container/router
- Lobby system
- Challenge notifications
- Presence management

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
│   │   ├── main.go
│   │   ├── lobby.go
│   │   ├── auth.go
│   │   └── models.go
│   ├── frontend/           # React shell UI
│   │   ├── src/
│   │   │   ├── Shell.js    # Main shell component
│   │   │   ├── Lobby.js    # Lobby/presence UI
│   │   │   ├── AppContainer.js  # Iframe/component loader
│   │   │   └── hooks/
│   │   │       ├── useLobby.js
│   │   │       └── usePresence.js
│   │   └── package.json
│   └── data/               # SQLite database
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

### Phase 1: Identity Shell Prototype ⬅️ **WE ARE HERE**
- [x] Basic shell UI (header + content area)
- [x] Auth system (login/logout)
- [x] App routing (load different apps)
- [x] Iframe embedding with full-height rendering
- [x] Static app template (smoke-test)
- [ ] Simple presence tracking

### Phase 2: Lobby System
- [ ] Database schema (presence, challenges)
- [ ] Lobby API endpoints
- [ ] Long-polling for real-time updates
- [ ] Lobby UI (online users, challenges)

### Phase 3: Interactive Game Template
- [ ] Create game template structure
- [ ] Build Tic-Tac-Toe prototype
- [ ] Challenge → Game flow
- [ ] Match state management

### Phase 4: Migration & Polish
- [ ] Migrate useful V2 apps
- [ ] Mobile UI optimization
- [ ] Documentation
- [ ] Deploy to Raspberry Pi

---

## Getting Started

### Prerequisites
- Go 1.21+
- Node.js 18+
- SQLite3

### Development Setup
```bash
# Clone repository
git clone https://github.com/achgithub/pub-games-v3.git
cd pub-games-v3

# Start Identity Shell (backend)
cd identity-shell/backend
go run *.go

# Start Identity Shell (frontend)
cd identity-shell/frontend
npm install
npm start

# Access at http://localhost:3000
```

---

## Design Principles

1. **Shell First**: Identity Shell is always the entry point
2. **Minimal Games**: Interactive games should be lightweight (no auth, minimal chrome)
3. **Backward Compatible**: Static V2 apps can run in iframes
4. **Mobile Friendly**: Responsive design, touch-friendly
5. **Real-time**: Long-polling for notifications (WebSocket later)

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
