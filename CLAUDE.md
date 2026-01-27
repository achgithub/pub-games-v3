# Pub Games v3 - Project Configuration

## Overview
Multi-app platform for pub-based games and activities. Microservices architecture with each mini-app owning its own data.

## Architecture

### Service Structure
- **Identity Shell** - Core identity service, hosts mini-apps
- **Mini-apps** - Independent games/activities (tic-tac-toe, quizzes, etc.)
- Each mini-app has its own database - enables independent deployments

### Mini-App Architecture (Single Port per App)

**Key Decision:** Each mini-app is a **standalone service** that serves both its API and frontend from a single port. The shell embeds apps via **iframe only** - no React component imports.

**Why single port:**
- Simpler deployment (one process per app)
- No CORS issues (frontend and API same origin)
- Independent scaling and updates
- Adding new apps requires NO shell rebuilds

**How it works:**
```
┌─────────────────────────────────────────┐
│ Identity Shell (port 3001)              │
│ ┌─────────────────────────────────────┐ │
│ │ iframe src="http://pi:4001?userId=x"│ │
│ │                                     │ │
│ │   Tic-Tac-Toe (port 4001)          │ │
│ │   - Go backend serves /api/*       │ │
│ │   - Go backend serves React build  │ │
│ │   - SSE at /api/game/{id}/stream   │ │
│ │   - HTTP POST for moves            │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**App structure:**
```
games/tic-tac-toe/
├── backend/
│   ├── main.go          # Serves API + static files
│   ├── static/          # React build output
│   └── ...
├── frontend/
│   ├── src/             # React source
│   ├── public/
│   └── package.json
└── database/
    └── schema.sql
```

**Build process:**
```bash
cd frontend && npm run build
cp -r build/* ../backend/static/
cd ../backend && go run *.go  # Serves everything on one port
```

### App Registry

**Dynamic app discovery** - Shell fetches available apps from API, no hardcoding.

**Registry file:** `identity-shell/backend/apps.json`
```json
{
  "apps": [
    {
      "id": "tic-tac-toe",
      "name": "Tic-Tac-Toe",
      "icon": "⭕",
      "type": "iframe",
      "url": "http://{host}:4001",
      "category": "game",
      "realtime": "websocket"
    }
  ]
}
```

**Shell fetches:** `GET /api/apps` → returns registry
**Shell embeds:** `<iframe src="http://pi:4001?userId=x&gameId=y" />`

**Adding a new app:**
1. Create the app (backend + frontend)
2. Add entry to `apps.json`
3. Done - no shell rebuild needed

### Shell → App URL Parameters

**IMPORTANT:** The shell passes user context to apps via URL query parameters. All apps MUST use these exact parameter names:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `userId` | Yes | User's email address (e.g., `alice@test.com`) |
| `userName` | Yes | User's display name |
| `gameId` | No | Game/session ID (for challenge-based games) |
| `admin` | No | `"true"` if user is admin |

**Example URL:** `http://pi:4001?userId=alice@test.com&userName=Alice&gameId=ABC123`

**Frontend code to read params:**
```javascript
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId');      // Required
const userName = params.get('userName');  // Required
const gameId = params.get('gameId');      // Optional
const isAdmin = params.get('admin') === 'true';  // Optional
```

**If `userId` is missing**, the app should show an error: "This app must be accessed through the Identity Shell."

### Database Architecture

**PostgreSQL** - System of record, persistent data:
- User accounts/identity
- Quiz content (questions, media references)
- Game history and results (after game ends)
- Persistent leaderboards (all-time stats)
- Configuration and templates
- Static app data (sweepstakes picks, LMS selections)

**Redis** - Live/ephemeral data:
- Real-time game state (tic-tac-toe board, active turns)
- Live leaderboards during quiz (sorted sets)
- Answer submission bursts (30+ writes in seconds)
- Active session state (current question, timer, who's answered)
- Pub/sub for instant updates (player made a move, scores updated)
- Game state persistence (survives server crashes with TTL)

**Simple rule:** If it's live and ephemeral, Redis. If it needs to survive a restart, PostgreSQL.

### Real-Time Communication Patterns

**SSE + HTTP** - Preferred for turn-based games:
- **Use for:** Turn-based games (tic-tac-toe, dots, chess)
- **Why:** Better iOS Safari compatibility, simpler debugging
- **Pattern:** SSE for server → client updates, HTTP POST for client → server actions
- **With Redis:** Redis pub/sub broadcasts to all SSE listeners
- **Example:** Tic-tac-toe uses this pattern

**Server-Sent Events (SSE) only** - One-way broadcasts:
- **Use for:** Quizzes, display systems, leaderboards
- **Why:** Simpler than WebSocket, efficient for one-to-many
- **Pattern:** Server pushes updates via SSE
- **With Redis:** Redis pub/sub → SSE stream to clients

**Polling/No Real-Time** - Static apps:
- **Use for:** Sweepstakes, Last Man Standing, pick-and-wait apps
- **Why:** No real-time updates needed
- **Pattern:** PostgreSQL only, optional periodic polling
- **Simple:** User makes picks, waits for results

### Game Patterns

| Game Type | Speed | Real-Time | Storage | Notes |
|-----------|-------|-----------|---------|-------|
| Tic-tac-toe | Turn-based | SSE + HTTP | Redis + PostgreSQL | SSE for updates, HTTP POST for moves |
| Dots | Turn-based | SSE + HTTP | Redis + PostgreSQL | Same pattern as tic-tac-toe |
| Chess (future) | Turn-based | SSE + HTTP | Redis + PostgreSQL | Same pattern as tic-tac-toe |
| Quiz (30+ players) | Broadcast | SSE | Redis + PostgreSQL | SSE for questions/leaderboard, HTTP POST for answers |
| Sweepstakes | Static | None/Polling | PostgreSQL only | Pick-and-wait, no real-time needed |
| Last Man Standing | Static | None/Polling | PostgreSQL only | Pick-and-wait, optional SSE for "results ready" |

### Future: Cross-Pub Federation
- Central cloud instance (PostgreSQL + Redis on VPS)
- Pi becomes a client of cloud services for federated features
- Pi remains self-sufficient for local play (works offline)
- Local-first: build everything to work on single Pi, federation bolts on later

## Deployment
- **Mac**: Code editing, Git operations, Claude Code
- **Pi**: Go builds, npm, PostgreSQL, Redis, running services
- See global CLAUDE.md for workflow details
