# Architecture Decision Records (ADRs)

This document captures key architectural decisions and the reasoning behind them.

---

## ADR-001: Single Port Per App

**Date:** 2024
**Status:** Accepted

### Context

Mini-apps need to serve both a frontend (React) and backend (Go API). Two approaches:
1. Separate ports (frontend on 3000, backend on 4000)
2. Single port (backend serves both API and static files)

### Decision

Each mini-app runs on a **single port** and serves:
- API endpoints at `/api/*`
- Static frontend at `/` (React build output)
- Real-time streams at `/api/game/{id}/stream`

### Consequences

**Positive:**
- Simpler deployment (one process per app)
- No CORS configuration needed
- Single entry point for debugging
- Independent scaling (each app is isolated)
- Adding new apps requires NO shell rebuilds

**Negative:**
- Backend must handle static file serving
- Frontend build output must be copied to backend `static/` directory
- Requires build step coordination

**Implementation:**
```go
// main.go
http.HandleFunc("/api/", handleAPI)
http.Handle("/", http.FileServer(http.Dir("./static")))
```

**Build process:**
```bash
cd frontend && npm run build
cp -r build/* ../backend/static/
cd ../backend && go run *.go
```

---

## ADR-002: Iframe Embedding (Not React Component Imports)

**Date:** 2024
**Status:** Accepted

### Context

Mini-apps need to be embedded in the identity shell. Two approaches:
1. Import mini-app React components into shell
2. Embed mini-apps via iframe

### Decision

Use **iframe embedding** exclusively. Shell loads apps via:
```html
<iframe src="http://pi:4001?userId=alice@test.com&gameId=ABC123" />
```

### Consequences

**Positive:**
- Zero coupling between shell and apps
- Apps can be written in any framework
- Independent deployments (no shell rebuild when app changes)
- Independent dependencies (no version conflicts)
- Apps can be developed/tested standalone
- Security isolation between apps

**Negative:**
- Slightly more complex communication (postMessage instead of props)
- Cannot share React state directly
- Iframe overhead (minimal in practice)

**Alternative considered:** Import mini-app React components into shell. Rejected because:
- Requires shell rebuild on every app change
- Creates dependency version conflicts
- Couples apps to shell's React version
- Prevents apps from using different frameworks

---

## ADR-003: Dynamic App Registry (apps.json)

**Date:** 2024
**Status:** Accepted

### Context

Shell needs to know which apps are available. Two approaches:
1. Hardcode app list in shell code
2. Dynamic registry via `apps.json` served from API

### Decision

Use **dynamic registry** at `identity-shell/backend/apps.json`:

```json
{
  "apps": [
    {
      "id": "tic-tac-toe",
      "name": "Tic-Tac-Toe",
      "icon": "⭕",
      "type": "iframe",
      "url": "http://{host}:4001",
      "backendPort": 4001,
      "category": "game",
      "realtime": "sse"
    }
  ]
}
```

Shell fetches via `GET /api/apps`.

### Consequences

**Positive:**
- Adding new apps requires NO shell code changes
- Apps can be enabled/disabled without code changes
- Registry serves as single source of truth
- Easy to add metadata (icons, categories, capabilities)

**Negative:**
- Requires API call on shell load (minimal overhead)
- Configuration is centralized (not distributed)

**Implementation note:** Registry is read-only at runtime. Apps added by editing `apps.json` and restarting shell backend (Go process).

---

## ADR-004: Challengeable Games Auto-Discovery

**Date:** 2024
**Status:** Accepted

### Context

Challenge modal needs to show available games. Two approaches:
1. Hardcode game list in ChallengeModal component
2. Auto-discover from app registry

### Decision

**Auto-discover** challengeable games from registry based on criteria:
- `category: "game"`
- `realtime: "sse"` or `"websocket"`
- `backendPort` defined

### Consequences

**Positive:**
- New games automatically appear in challenge modal
- No frontend code changes when adding games
- Single source of truth (registry)
- Gracefully handles single-game case (auto-selects)

**Negative:**
- Requires registry schema compliance
- Cannot easily exclude specific games from challenges (would need `challengeable: false` flag)

---

## ADR-005: PostgreSQL + Redis Hybrid

**Date:** 2024
**Status:** Accepted

### Context

Apps need to store both persistent data (user accounts, game history) and ephemeral real-time state (current game board, active players). Two approaches:
1. PostgreSQL only (slower for real-time writes)
2. PostgreSQL + Redis hybrid

### Decision

Use **PostgreSQL + Redis hybrid**:

**PostgreSQL** - System of record, persistent data:
- User accounts/identity
- Game history and results
- Persistent leaderboards
- Configuration

**Redis** - Live/ephemeral data:
- Real-time game state
- Live leaderboards during events
- Pub/sub for instant updates
- Session state

**Simple rule:** If it's live and ephemeral, Redis. If it needs to survive a restart, PostgreSQL.

### Consequences

**Positive:**
- Fast real-time updates (Redis in-memory)
- Reliable persistence (PostgreSQL ACID)
- Efficient pub/sub (Redis)
- Appropriate tool for each use case

**Negative:**
- Two systems to maintain
- Complexity of synchronization (when needed)
- Potential data inconsistency if not careful

See [DATABASE.md](./DATABASE.md) for detailed usage patterns.

---

## ADR-006: SSE Over WebSocket (for turn-based games)

**Date:** 2024
**Status:** Accepted

### Context

Turn-based games need real-time updates. Options:
1. WebSocket (bidirectional)
2. SSE + HTTP (unidirectional + request/response)
3. Polling

### Decision

Prefer **SSE + HTTP** for turn-based games:
- **SSE** for server → client updates (game state changes)
- **HTTP POST** for client → server actions (make a move)

### Consequences

**Positive:**
- Better iOS Safari compatibility (WebSocket issues on Safari)
- Simpler debugging (SSE is just HTTP)
- Automatic reconnection
- Works with HTTP/2 multiplexing
- Easier to monitor/log

**Negative:**
- Unidirectional only (but that's fine for this use case)
- Slightly more latency than WebSocket (negligible for turn-based)

**When to use WebSocket instead:**
- Real-time action games (require <50ms latency)
- Bidirectional streaming needed
- Complex binary protocols

**Implementation pattern:**
```go
// SSE endpoint
http.HandleFunc("/api/game/{id}/stream", handleGameStream)

// Action endpoint
http.HandleFunc("/api/game/{id}/move", handleGameMove)
```

See [REALTIME.md](./REALTIME.md) for detailed patterns.

---

## ADR-007: Federation Strategy (Local-First)

**Date:** 2024
**Status:** Proposed

### Context

Future goal: Cross-pub games (quiz spanning multiple locations). Two approaches:
1. Build federation first, then local apps
2. Build local apps first, add federation later

### Decision

**Local-first approach:**
1. Build everything to work on a single Pi
2. Each Pi is fully self-sufficient
3. Add federation as optional layer later

### Rationale

**Benefits:**
- Simpler initial development
- Each pub can operate independently (offline resilient)
- No cloud dependency for basic functionality
- Federation becomes a feature, not a requirement

**Federation architecture (future):**
```
┌─────────────────┐         ┌─────────────────┐
│   Pub A (Pi)    │         │   Pub B (Pi)    │
│  Local games    │         │  Local games    │
│  Local players  │         │  Local players  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │      ┌─────────────┐      │
         └─────>│  Cloud VPS  │<─────┘
                │ PostgreSQL  │
                │   Redis     │
                │ Federation  │
                └─────────────┘
```

**Implementation approach:**
- Pi remains authoritative for local games
- Cloud instance coordinates cross-pub features
- Apps detect federation capability and adapt
- Graceful degradation (works without federation)

**Status:** Proposed (not yet implemented)

---

## ADR-008: Dynamic Challenge Options

**Date:** 2024
**Status:** Accepted

### Context

Games need custom configuration (grid size, difficulty, etc.). Two approaches:
1. Hardcode options in shell's ChallengeModal
2. Games define options via `/api/config` endpoint

### Decision

**Dynamic options** via game's `/api/config`:

```go
// Game backend
config := map[string]interface{}{
    "appId": "dots",
    "gameOptions": []map[string]interface{}{
        {
            "id":      "gridSize",
            "type":    "select",
            "label":   "Grid Size",
            "default": "4x4",
            "options": []map[string]interface{}{
                {"value": "4x4", "label": "Small (4x4)"},
                {"value": "6x6", "label": "Medium (6x6)"},
            },
        },
    },
}
```

**Flow:**
1. ChallengeModal calls game's `/api/config` → gets options schema
2. User configures → `{gridSize: "6x9"}`
3. Shell forwards ALL options to game's `/api/game` on accept
4. Game parses options it needs

### Consequences

**Positive:**
- Zero shell code changes for new game options
- Games own their configuration
- Type-safe schema (dropdowns, checkboxes, etc.)
- Shell just forwards (doesn't need to understand)

**Negative:**
- Requires API call to fetch config
- Games must implement `/api/config` endpoint

**Key principle:** Shell forwards ALL options automatically. Games read what they need.
