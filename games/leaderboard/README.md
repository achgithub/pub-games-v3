# Leaderboard

Centralized leaderboard service for all Activity Hub games.

## Overview

- **Port**: 5030
- **Database**: `leaderboard_db`
- **Purpose**: Track game results and display standings across all games

## Features

- **Dual Mode Support**:
  - Full mode: `http://pi:5030/` - tabs for all games, full navigation
  - Filtered mode: `http://pi:5030/?game=dots` - single game view, no tabs
- **Public Leaderboards**: All standings/recent games are public
- **Authenticated Reporting**: Only result submission requires authentication
- **Cross-Game Stats**: Track player performance across different games
- **Points System**: 3 points for win, 1 point for draw, 0 for loss

## API Endpoints

### Public Endpoints (no auth required)

- `GET /api/config` - App configuration
- `GET /api/standings` - List all game types
- `GET /api/standings/{gameType}` - Get standings for a game
- `GET /api/recent/{gameType}` - Get recent games
- `GET /api/player/{playerId}` - Get player stats

### Protected Endpoints (requires auth)

- `POST /api/result` - Report game result (called by games)

## Result Reporting Format

Games POST to `/api/result` with authentication:

```typescript
{
  gameType: "tic-tac-toe",
  gameId: "unique-game-id",
  winnerId: "winner@email.com",
  winnerName: "Winner Name",
  loserId: "loser@email.com",
  loserName: "Loser Name",
  isDraw: false,
  score: "3-2",
  duration: 120
}
```

For draws: set `isDraw: true` and include both players.

## URL Parameters

### Filtering (for embeds)

- `?game=dots` - Show only Dots leaderboard (no tabs, full screen)
- `?game=tic-tac-toe` - Show only Tic-Tac-Toe leaderboard

### Standard Parameters (future use)

- `?userId={email}` - User identifier
- `?userName={name}` - User display name
- `?token={token}` - Authentication token

## Use Cases

**1. From game apps:**
```
Dots → "View Leaderboard" → http://pi:5030/?game=dots
```

**2. In display-runtime playlist:**
```javascript
[
  { type: "url", url: "http://pi:5030/?game=dots" },
  { type: "url", url: "http://pi:5030/?game=tic-tac-toe" }
]
```

**3. In identity-shell lobby:**
```
"View All Leaderboards" → http://pi:5030/
```

## Database Setup

```bash
# On Pi
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE leaderboard_db;"
psql -U activityhub -h localhost -p 5555 -d leaderboard_db -f games/leaderboard/database/schema.sql
```

## Build & Deploy

```bash
# Build frontend
cd games/leaderboard/frontend
npm install
npm run build
cp -r build/* ../backend/static/

# Run backend
cd ../backend
go mod tidy
go run *.go
```

## Integration

Games report results after each game:

```typescript
const token = params.get('token');

fetch('http://pi:5030/api/result', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    gameType: 'dots',
    gameId: gameId,
    winnerId: winnerId,
    winnerName: winnerName,
    loserId: loserId,
    loserName: loserName,
    isDraw: false,
    score: '5-3',
    duration: 180
  })
});
```
