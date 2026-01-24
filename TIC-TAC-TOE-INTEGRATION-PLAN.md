# Tic-Tac-Toe V2 → V3 Integration Plan

**Created**: January 24, 2026

## Overview

Migrate the working tic-tac-toe game from pubgames-v2 into pub-games-v3, integrating it with the new lobby/challenge system.

---

## V2 Architecture Analysis

### What V2 Has

**Backend (Go)**:
- WebSocket real-time game updates
- SQLite database for games, moves, stats
- Own lobby system with online users tracking
- Own challenge system
- Game modes: normal (no time limit) vs timed (per-move timeout)
- Series support: first-to-1, 2, 3, 5, 10, or 20 wins
- Rematch functionality
- Disconnect detection and notifications

**Frontend (React)**:
- `GameBoard.jsx` - The actual tic-tac-toe board
- `GameView.jsx` - Game container with state management
- `Lobby.jsx` - Online users and challenge UI
- `ChallengeModal.jsx` - Challenge settings popup
- `RematchModal.jsx` - Rematch after game
- `StatsView.jsx` - Player statistics
- WebSocket hooks for real-time updates
- Bidirectional handshake (PING→PONG→ACK→READY)

**Key Features**:
- Real-time board updates via WebSocket
- Turn validation and game logic
- Win/loss/draw detection
- Move time limits (optional)
- Session timeout tracking
- Disconnect handling
- Player statistics

### What V2's Lobby Does (Already in V3)

V2's lobby features that are now handled by V3 identity shell:
- ❌ User authentication (V3: identity shell handles this)
- ❌ Online users tracking (V3: Redis presence system)
- ❌ Challenge creation (V3: lobby challenge system)
- ❌ Challenge accept/decline (V3: lobby handles this)

---

## V3 Integration Strategy

### Phase 1: Extract Game Core ✅ HIGH PRIORITY

**Goal**: Extract just the game logic, board, and WebSocket sync

**What to Keep from V2**:
- `GameBoard.jsx` - Board UI component
- `websocket.go` - WebSocket connection management
- Game logic (win detection, turn validation)
- Board state management
- Move validation
- Real-time sync between players

**What to Remove from V2**:
- `Lobby.jsx` - V3 lobby handles this
- `ChallengeModal.jsx` - V3 lobby handles challenge settings
- Own auth system - V3 identity shell handles auth
- Own online users tracking - V3 Redis presence
- SQLite `online_users` table - V3 Redis

**What to Migrate**:
- SQLite `games` table → **Hybrid**:
  - Redis: Live game state (active games only)
  - PostgreSQL: Game history and completed games
- SQLite `moves` table → PostgreSQL (for history/replay)
- SQLite `player_stats` → PostgreSQL

### Phase 2: Connect to V3 Challenge Flow

**When user accepts challenge in V3 lobby**:

1. V3 lobby backend creates game in Redis:
   ```redis
   SET game:{gameId} {
     id: gameId,
     challengeId: challengeId,
     player1: {id, name, symbol: "X"},
     player2: {id, name, symbol: "O"},
     board: ["","","","","","","","",""],
     currentTurn: 1,
     status: "active",
     createdAt: timestamp,
     settings: {mode, timeLimit, firstTo}
   }
   TTL game:{gameId} 3600  # 1 hour
   ```

2. Both players navigate to `/app/tic-tac-toe?gameId={gameId}`

3. Tic-tac-toe frontend:
   - Receives gameId from URL param
   - Connects WebSocket: `/api/games/tic-tac-toe/ws/{gameId}`
   - Fetches game state from Redis
   - Renders board

4. Game progresses with WebSocket sync

5. On completion:
   - Update Redis challenge status
   - Save game result to PostgreSQL
   - Clean up Redis game state (or keep with short TTL)

### Phase 3: Backend Architecture

**New Directory Structure**:
```
pub-games-v3/
├── identity-shell/          # Existing
│   ├── backend/             # Existing lobby API
│   └── frontend/            # Existing shell
│
├── games/
│   └── tic-tac-toe/
│       ├── backend/
│       │   ├── main.go          # HTTP server
│       │   ├── websocket.go     # WebSocket handlers (from V2)
│       │   ├── game_logic.go    # Win detection, validation
│       │   ├── redis.go         # Live game state ops
│       │   └── database.go      # PostgreSQL for history
│       └── frontend/
│           └── src/
│               ├── GameBoard.jsx    # From V2
│               ├── GameView.jsx     # Adapted from V2
│               └── hooks/
│                   └── useGameSocket.js  # WebSocket hook
```

**Backend Port**: 4001 (backend API + WebSocket)
**Frontend**: Embedded as React component in identity shell

### Phase 4: Data Schema

**Redis (Live Games)**:
```redis
# Active game state
game:{gameId} = {
  id, challengeId,
  player1: {id, name, symbol},
  player2: {id, name, symbol},
  board: [9 cells],
  currentTurn: 1 or 2,
  status: "active" | "completed",
  winnerId: null | int,
  mode, timeLimit, firstTo,
  player1Score, player2Score, currentRound,
  lastMoveAt, createdAt
}
TTL: 1 hour (clean up abandoned games)

# WebSocket connection tracking
game:{gameId}:connections = {
  player1Id: true,
  player2Id: true
}
```

**PostgreSQL (History)**:
```sql
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER REFERENCES challenges(id),
  player1_id INTEGER NOT NULL,
  player1_name VARCHAR(100),
  player2_id INTEGER NOT NULL,
  player2_name VARCHAR(100),
  mode VARCHAR(20),  -- normal, timed
  status VARCHAR(20), -- completed, abandoned
  winner_id INTEGER,
  move_time_limit INTEGER,
  first_to INTEGER,
  player1_score INTEGER,
  player2_score INTEGER,
  total_rounds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE game_moves (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER NOT NULL,
  position INTEGER NOT NULL,  -- 0-8
  symbol VARCHAR(1),  -- X or O
  move_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_stats (
  user_id INTEGER PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_lost INTEGER DEFAULT 0,
  games_draw INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 5: Frontend Integration

**How it works in V3 shell**:

1. User clicks "Accept" on challenge in lobby
2. Shell navigates to `/app/tic-tac-toe?gameId={gameId}`
3. `AppContainer.tsx` detects `tic-tac-toe` app
4. Loads `TicTacToeGame` React component (not iframe!)
5. Component:
   - Reads gameId from URL
   - Connects WebSocket to tic-tac-toe backend
   - Fetches initial state from Redis
   - Renders `GameBoard`
   - Handles moves and updates

**Component Structure**:
```jsx
// identity-shell/frontend/src/components/games/TicTacToe.jsx
import GameBoard from './TicTacToeBoard';
import useGameSocket from '../hooks/useGameSocket';

function TicTacToe({ gameId, user }) {
  const { game, makeMove, connected } = useGameSocket(gameId, user);

  return (
    <div className="game-container">
      <GameBoard
        board={game.board}
        currentTurn={game.currentTurn}
        mySymbol={game.player1.id === user.id ? 'X' : 'O'}
        onMove={makeMove}
      />
    </div>
  );
}
```

---

## Implementation Steps

### Step 1: Setup Infrastructure ⬅️ START HERE
- [ ] Create `games/tic-tac-toe` directory structure
- [ ] Setup PostgreSQL schema for games/moves/stats
- [ ] Design Redis schema for live game state
- [ ] Create backend boilerplate (main.go, routing)

### Step 2: Backend Game Logic
- [ ] Copy `websocket.go` from V2
- [ ] Adapt WebSocket to use Redis instead of SQLite
- [ ] Create `game_logic.go` for win detection
- [ ] Create `redis.go` for game state operations
- [ ] Create `database.go` for PostgreSQL history

### Step 3: Connect to V3 Challenge Flow
- [ ] Update V3 lobby backend to create game in Redis on accept
- [ ] Pass gameId to both players
- [ ] Navigate both players to tic-tac-toe with gameId
- [ ] Verify both players can connect

### Step 4: Frontend Components
- [ ] Copy `GameBoard.jsx` from V2
- [ ] Create `TicTacToe.jsx` wrapper component
- [ ] Create `useGameSocket.js` hook
- [ ] Integrate into identity shell's `AppContainer`
- [ ] Test real-time sync

### Step 5: Game Completion
- [ ] On game end, save to PostgreSQL
- [ ] Update challenge status in V3 lobby
- [ ] Update player stats
- [ ] Clean up Redis state

### Step 6: Polish
- [ ] Add rematch functionality (use V3 challenge system)
- [ ] Add game history view
- [ ] Add player stats view
- [ ] Mobile optimization

---

## Key Decisions

### ✅ Use Redis for Live Games
- Fast read/write for moves
- Auto-expiry for abandoned games
- Pub/sub for real-time updates (alternative to WebSocket broadcasting)

### ✅ Keep WebSocket for Real-Time Sync
- V2's WebSocket implementation works well
- Bidirectional handshake is solid
- Disconnect detection is crucial for turn-based games

### ✅ Embed as React Component (Not Iframe)
- Faster than iframe
- Shared state with identity shell
- Better user experience
- Can share CSS and utilities

### ✅ PostgreSQL for History
- Game results
- Move history (for replay)
- Player statistics
- Analytics

---

## Testing Plan

1. **Backend Unit Tests**:
   - Win detection logic
   - Turn validation
   - Redis operations

2. **Integration Tests**:
   - Challenge → Game creation flow
   - Two players making moves
   - Game completion and result saving
   - Disconnect/reconnect handling

3. **Manual Testing**:
   - Two users challenge each other
   - Play full game
   - Verify real-time updates
   - Test disconnection scenarios
   - Verify stats update

---

## Estimated Complexity

**Backend**: Medium (adapt V2 code, new Redis layer)
**Frontend**: Low (mostly copy from V2)
**Integration**: Medium (connect to V3 challenge flow)

**Total Effort**: ~2-3 days for complete integration

---

## Next Steps

Ready to start with **Step 1: Setup Infrastructure**?

I can:
1. Create the directory structure
2. Design the Redis schema in detail
3. Create the PostgreSQL migrations
4. Set up the backend boilerplate

Or would you like me to focus on a specific part first?
