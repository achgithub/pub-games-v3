# Interactive Game Template - Proposal

**Created**: January 24, 2026
**Purpose**: Define template structure for fast-paced interactive games (Tic-Tac-Toe, Dots, etc.)

---

## Key Differences: Static vs Interactive

| Aspect | Static Apps | Interactive Games |
|--------|-------------|-------------------|
| **Embedding** | iframe | React component in shell |
| **Ports** | 5000+ (frontend + API) | 4000+ (backend only) |
| **Auth** | URL params from shell | User context from shell state |
| **Real-Time** | None/Polling | WebSocket |
| **Storage** | PostgreSQL only | Redis (live) + PostgreSQL (history) |
| **CSS** | Shared + app-specific | Shared + game-specific |
| **Examples** | Sweepstakes, LMS | Tic-Tac-Toe, Dots |

---

## Proposed Directory Structure

```
pub-games-v3/
├── games/
│   ├── game-template/                    # Reusable template
│   │   ├── backend/
│   │   │   ├── main.go                   # HTTP + WebSocket server
│   │   │   ├── websocket.go              # WebSocket handlers (generic)
│   │   │   ├── game_logic.go             # Game rules (placeholder)
│   │   │   ├── redis.go                  # Redis operations
│   │   │   ├── database.go               # PostgreSQL operations
│   │   │   ├── models.go                 # Data structures
│   │   │   └── go.mod
│   │   ├── frontend/
│   │   │   └── src/
│   │   │       ├── components/
│   │   │       │   ├── GameBoard.tsx     # Placeholder board
│   │   │       │   └── GameContainer.tsx # Game wrapper
│   │   │       ├── hooks/
│   │   │       │   └── useGameSocket.ts  # WebSocket hook (generic)
│   │   │       └── styles/
│   │   │           └── game.css          # Game-specific styles
│   │   └── README.md                     # Template usage guide
│   │
│   ├── tic-tac-toe/                      # Actual game (from template)
│   │   ├── backend/
│   │   │   ├── main.go
│   │   │   ├── websocket.go              # Copied from V2, adapted
│   │   │   ├── game_logic.go             # Tic-tac-toe rules
│   │   │   ├── redis.go                  # Game state ops
│   │   │   ├── database.go               # History/stats
│   │   │   ├── models.go                 # Game, Move, Stats structs
│   │   │   └── go.mod
│   │   ├── frontend/
│   │   │   └── src/
│   │   │       ├── components/
│   │   │       │   ├── TicTacToeBoard.tsx   # 3x3 grid
│   │   │       │   ├── GameView.tsx          # Game UI
│   │   │       │   └── index.ts              # Exports
│   │   │       ├── hooks/
│   │   │       │   └── useGameSocket.ts      # WebSocket hook
│   │   │       └── styles/
│   │   │           └── tictactoe.css         # TTT-specific styles
│   │   └── README.md
│   │
│   └── dots/                             # Future game (from template)
│       └── ...                           # Same structure
│
└── identity-shell/
    ├── backend/
    │   └── static/
    │       ├── pubgames.css              # Shared platform CSS
    │       └── games/
    │           ├── tictactoe.css         # TTT game-specific CSS
    │           └── dots.css              # Dots game-specific CSS
    │
    └── frontend/
        └── src/
            └── components/
                ├── games/
                │   ├── TicTacToe.tsx     # Wrapper that loads TTT components
                │   └── Dots.tsx          # Future
                └── AppContainer.tsx      # Routes to games
```

---

## CSS Strategy for Interactive Games

### Shared CSS (`identity-shell/backend/static/pubgames.css`)

**Platform-wide patterns:**
- Layout structure
- Buttons, badges, forms
- Typography
- Common game UI elements:
  - `.game-container` - Game wrapper
  - `.game-board` - Generic board container
  - `.game-cell` - Generic cell/square
  - `.game-status` - Status bar
  - `.game-controls` - Control buttons

### Game-Specific CSS (`identity-shell/backend/static/games/{game}.css`)

**Tic-Tac-Toe specific:**
- `.ttt-grid` - 3x3 grid layout
- `.ttt-cell` - Square styling (X/O display)
- `.ttt-winning-line` - Win animation
- `.ttt-score-board` - Series score display

**Dots specific:**
- `.dots-grid` - Dots and boxes grid
- `.dots-line` - Line drawing
- `.dots-box` - Completed box
- `.dots-score` - Score display

### Loading Strategy

**In each game component:**
```typescript
// TicTacToe.tsx
useEffect(() => {
  // Load game-specific CSS dynamically
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `http://${window.location.hostname}:3001/static/games/tictactoe.css`;
  document.head.appendChild(link);

  return () => {
    document.head.removeChild(link);
  };
}, []);
```

---

## Backend Template Structure

### main.go (Generic)
```go
package main

import (
    "log"
    "net/http"
    "github.com/gorilla/mux"
    "github.com/gorilla/handlers"
)

const (
    BACKEND_PORT = "4001"  // TTT: 4001, Dots: 4011, etc.
    APP_NAME     = "Tic-Tac-Toe"
)

func main() {
    // Initialize Redis
    if err := InitRedis(); err != nil {
        log.Fatal("Redis init failed:", err)
    }

    // Initialize PostgreSQL
    if err := InitDatabase(); err != nil {
        log.Fatal("Database init failed:", err)
    }

    r := mux.NewRouter()

    // WebSocket endpoint
    r.HandleFunc("/api/ws/game/{gameId}", gameWebSocketHandler)

    // HTTP endpoints
    r.HandleFunc("/api/game/{gameId}", getGameHandler).Methods("GET")
    r.HandleFunc("/api/move", makeMoveHandler).Methods("POST")
    r.HandleFunc("/api/stats/{userId}", getStatsHandler).Methods("GET")

    // CORS
    corsHandler := handlers.CORS(
        handlers.AllowedOrigins([]string{"*"}),
        handlers.AllowedMethods([]string{"GET", "POST", "OPTIONS"}),
        handlers.AllowedHeaders([]string{"Content-Type"}),
    )

    log.Printf("%s backend starting on :%s", APP_NAME, BACKEND_PORT)
    log.Fatal(http.ListenAndServe(":"+BACKEND_PORT, corsHandler(r)))
}
```

### websocket.go (Generic - Reusable!)
```go
// Generic WebSocket connection manager
// Works for any turn-based game
// Specific game logic in game_logic.go
```

### game_logic.go (Game-Specific)
```go
// Tic-Tac-Toe: checkWinner(), validateMove()
// Dots: checkBoxComplete(), validateLine()
// Each game implements its own logic
```

### redis.go (Generic with game-specific schemas)
```go
// Generic operations: GetGame, SaveGame, UpdateGame
// Each game defines its own Redis schema
```

---

## Frontend Template Structure

### useGameSocket.ts (Generic Hook - Reusable!)
```typescript
// Generic WebSocket hook for any game
// Handles connection, messages, reconnection
// Game-specific logic passed as callbacks

export function useGameSocket(gameId: string, userId: number) {
    const [game, setGame] = useState<any>(null);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    // Generic WebSocket connection logic
    // Bidirectional handshake (PING→PONG→ACK→READY)
    // Reconnection logic
    // Message routing

    return { game, connected, makeMove, disconnect };
}
```

### GameBoard.tsx (Game-Specific)
```typescript
// Tic-Tac-Toe: 3x3 grid, X/O display
// Dots: Grid with dots and lines
// Each game has its own board UI
```

---

## Integration with Identity Shell

### Shell registers games:
```typescript
// identity-shell/frontend/src/components/Shell.tsx

const APPS: AppDefinition[] = [
  {
    id: 'tic-tac-toe',
    name: 'Tic-Tac-Toe',
    icon: '⭕',
    type: 'interactive',
    component: 'TicTacToe',  // Load as component
    backend: 'http://hostname:4001'
  },
  {
    id: 'dots',
    name: 'Dots & Boxes',
    icon: '⬚',
    type: 'interactive',
    component: 'Dots',
    backend: 'http://hostname:4011'
  }
];
```

### AppContainer routes to game:
```typescript
// AppContainer.tsx
if (app.type === 'interactive') {
  // Load game component dynamically
  const GameComponent = loadGameComponent(app.component);
  return <GameComponent gameId={gameId} user={user} />;
}
```

---

## Database Schemas

### Redis (Live Games)
```
game:{gameId} = {
  id, challengeId,
  player1: {id, name},
  player2: {id, name},
  gameState: { ... game-specific },
  status, createdAt, lastMoveAt
}
TTL: 1 hour
```

### PostgreSQL (History)
```sql
-- Generic games table (all games)
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  game_type VARCHAR(50),  -- 'tic-tac-toe', 'dots'
  challenge_id INTEGER REFERENCES challenges(id),
  player1_id INTEGER,
  player2_id INTEGER,
  winner_id INTEGER,
  status VARCHAR(20),
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Game-specific moves tables
CREATE TABLE ttt_moves (...);
CREATE TABLE dots_moves (...);

-- Player stats per game
CREATE TABLE game_stats (
  user_id INTEGER,
  game_type VARCHAR(50),
  games_played INTEGER,
  games_won INTEGER,
  ...
);
```

---

## Template Creation Script

```bash
#!/bin/bash
# scripts/new_interactive_game.sh

NAME=$1       # e.g., "dots"
PORT=$2       # e.g., 4011
ICON=$3       # e.g., "⬚"

echo "Creating interactive game: $NAME"
echo "Backend port: $PORT"

# Copy template
cp -r games/game-template games/$NAME

# Replace placeholders
find games/$NAME -type f -exec sed -i "s/{{GAME_NAME}}/$NAME/g" {} +
find games/$NAME -type f -exec sed -i "s/{{BACKEND_PORT}}/$PORT/g" {} +

# Create database schema
echo "CREATE DATABASE ${NAME}_db;" | psql -U pubgames

echo "✅ Game template created: games/$NAME"
echo "Next steps:"
echo "1. Implement game logic in backend/game_logic.go"
echo "2. Design game board in frontend/components/GameBoard.tsx"
echo "3. Add game-specific CSS to identity-shell/backend/static/games/${NAME}.css"
```

---

## Benefits of This Approach

### Reusability
- ✅ WebSocket code written once, used by all games
- ✅ useGameSocket hook generic and reusable
- ✅ Backend structure consistent across games

### Maintainability
- ✅ Clear separation: generic vs game-specific
- ✅ CSS segregation prevents conflicts
- ✅ Each game is independent microservice

### Speed
- ✅ New game from template in minutes
- ✅ Copy and adapt, not write from scratch
- ✅ Proven patterns from tic-tac-toe

### Scalability
- ✅ Each game has own port
- ✅ Independent deployment
- ✅ Can scale games separately

---

## Questions to Answer

1. **Do we create the template first, then tic-tac-toe from it?**
   - OR: Build tic-tac-toe first, then extract template?

2. **CSS loading: Dynamic (useEffect) or static (index.html)?**
   - Dynamic: More flexible, CSS only when game loaded
   - Static: Simpler, all game CSS loaded upfront

3. **Component organization in shell:**
   - Option A: All game components in `identity-shell/frontend/src/components/games/`
   - Option B: Games export components, shell imports them

4. **Database naming:**
   - Separate DB per game (`tictactoe_db`, `dots_db`)
   - OR: Shared `games_db` with `game_type` column?

---

## Recommendation

**Approach**: Build Tic-Tac-Toe first (from V2), then extract template

**Why:**
1. V2 tic-tac-toe already works
2. We'll learn what's truly generic vs specific
3. Template will be based on real working code
4. Faster to get first game working

**Process:**
1. Build tic-tac-toe (this iteration)
2. Get it fully integrated and working
3. Extract generic parts to `game-template/`
4. Document template usage
5. Use template for Dots (validate it works)
6. Refine template based on Dots experience

**CSS:** Dynamic loading (useEffect) - cleaner separation

**Database:** Shared `pubgames` DB, `game_type` column - simpler

---

**Ready to proceed with this structure?**
