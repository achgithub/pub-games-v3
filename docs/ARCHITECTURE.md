# Architecture Overview

## System Overview

Multi-app platform for pub-based games and activities. Microservices architecture with each mini-app owning its own data.

## Service Structure

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

### Components

**Identity Shell** (port 3001)
- Core identity service
- User authentication and management
- Hosts mini-apps via iframe embedding
- Coordinates cross-app features (challenges, leaderboards)
- Dynamic app discovery via registry

**Mini-Apps** (ports 4001+)
- Independent games/activities (tic-tac-toe, dots, quizzes, etc.)
- Each app is a standalone service
- Own database (enables independent deployments)
- Own frontend and backend
- Single port per app (serves both API and UI)

## Mini-App Architecture

Each mini-app follows this structure:

```
games/{app-name}/
├── backend/
│   ├── main.go          # Entry point, serves API + static files
│   ├── handlers.go      # HTTP handlers
│   ├── game.go          # Game logic
│   ├── redis.go         # Redis operations (if needed)
│   ├── static/          # React build output (copied from frontend/build)
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── index.tsx    # Entry point
│   │   ├── App.tsx      # Main component
│   │   └── ...
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
└── database/
    └── schema.sql       # PostgreSQL schema (if needed)
```

### Single Port Design

Each app runs on a single port and serves:
- **API endpoints** at `/api/*`
- **Static frontend** at `/` (React build output)
- **Real-time streams** at `/api/game/{id}/stream` (SSE)

**Benefits:**
- One process per app
- No CORS issues (frontend and API same origin)
- Independent scaling and updates
- Simple deployment

See [ARCHITECTURE-DECISIONS.md](./ARCHITECTURE-DECISIONS.md#single-port-per-app) for rationale.

## App Registry

Apps are registered in `identity-shell/backend/apps.json`:

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

**Dynamic discovery:**
- Shell fetches apps via `GET /api/apps`
- No hardcoded app list in shell code
- Adding new apps requires NO shell rebuild

See [ARCHITECTURE-DECISIONS.md](./ARCHITECTURE-DECISIONS.md#app-registry) for design rationale.

## Shell ↔ App Communication

**Shell → App:** URL query parameters
```
http://pi:4001?userId=alice@test.com&userName=Alice&gameId=ABC123
```

**App → Shell:** postMessage API (future)
```javascript
window.parent.postMessage({ type: 'GAME_COMPLETE', winner: 'alice' }, '*');
```

See [FRONTEND.md](./FRONTEND.md#url-parameters) for parameter specifications.

## Challengeable Games

When a user clicks "Challenge" on another player:
1. Shell identifies challengeable apps from registry (`category: "game"`, `realtime: "sse"`)
2. User selects a game (auto-selected if only one option)
3. User configures game options (fetched from `/api/config`)
4. Shell creates challenge via game backend
5. Challenged user accepts/declines
6. On accept, shell calls game's `/api/game` to create game instance
7. Both users redirected to game with `gameId` parameter

See [reference/CHALLENGE-FLOW.md](./reference/CHALLENGE-FLOW.md) for detailed flow.

## Data Flow Example: Turn-Based Game

```
Player 1 Browser              Game Backend                Player 2 Browser
     |                              |                              |
     |------ POST /api/move ------->|                              |
     |                              |                              |
     |                              |--- Redis: Update state ----->|
     |                              |                              |
     |                              |--- Redis pub: "game:123" --->|
     |                              |                              |
     |<----- SSE: game update ------|                              |
     |                              |                              |
     |                              |------ SSE: game update ----->|
     |                              |                              |
```

1. Player 1 makes a move (HTTP POST)
2. Backend validates and updates Redis
3. Backend publishes to Redis pub/sub channel
4. All SSE listeners receive update
5. Both players' UIs refresh

See [REALTIME.md](./REALTIME.md) for communication patterns.

## Port Allocation

| Service | Port | Purpose |
|---------|------|---------|
| Identity Shell | 3001 | Main shell (backend) |
| Identity Shell UI | 3000 | Shell frontend (dev only) |
| Tic-Tac-Toe | 4001 | Game: Tic-Tac-Toe |
| Dots & Boxes | 4011 | Game: Dots & Boxes |
| Quiz | 4021 | App: Quiz system |
| *Future apps* | 4000+ | Games and activities |

## Future: Cross-Pub Federation

Vision for multi-pub play:

- **Central cloud instance** - PostgreSQL + Redis on VPS
- **Pi becomes client** - Connects to cloud for federated features
- **Local-first design** - Pi works offline, federation bolts on later
- **Gradual rollout** - Build everything to work on single Pi first

Example: Two pubs running the same quiz, live federated leaderboard.

See [ARCHITECTURE-DECISIONS.md](./ARCHITECTURE-DECISIONS.md#federation-strategy) for approach.
