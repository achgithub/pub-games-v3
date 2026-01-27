# PubGames V3 - Dots & Boxes

Classic dots-and-boxes game for two players.

## How to Play

1. Players take turns drawing lines between adjacent dots
2. When you complete all 4 sides of a box, you:
   - Score a point
   - Get another turn
3. Game ends when all boxes are filled
4. Player with most boxes wins!

## Architecture

- **Port**: 4011
- **Real-time**: SSE + HTTP (same pattern as tic-tac-toe)
- **Storage**: Redis for live state, PostgreSQL for history
- **Reports to**: Leaderboard app

## File Structure

```
dots/
├── backend/
│   ├── main.go           # Server entry point
│   ├── handlers.go       # HTTP + SSE handlers
│   ├── game_logic.go     # Game rules and move processing
│   ├── redis.go          # Redis operations + pub/sub
│   ├── database.go       # PostgreSQL operations
│   ├── models.go         # Data structures
│   ├── go.mod
│   └── static/           # React build output
├── frontend/
│   ├── src/
│   │   └── App.js        # Game UI
│   ├── public/
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/config` | Game configuration |
| GET | `/api/game/{gameId}` | Get game state |
| POST | `/api/game` | Create new game |
| POST | `/api/move` | Draw a line |
| POST | `/api/game/{gameId}/forfeit` | Forfeit game |
| POST | `/api/game/{gameId}/claim-win` | Claim win if opponent disconnected |
| GET | `/api/stats/{userId}` | Get player stats |
| GET | `/api/game/{gameId}/stream` | SSE stream for real-time updates |

## Game Options

When challenging via the shell, you can configure:

- **Grid Size**: 3x3 (small), 4x4 (standard), 5x5 (large), 6x6 (extra large)

## Running

Via start_services.sh:
```bash
./start_services.sh
```

Manual:
```bash
cd games/dots/frontend
npm install && npm run build
cp -r build/* ../backend/static/

cd ../backend
go run *.go
```

## Database Setup

On Pi:
```bash
psql -U pubgames -c "CREATE DATABASE dots_db;"
```

Tables are created automatically on startup.

## Testing

1. Create a game via shell challenge system
2. Both players connect to SSE stream
3. Players take turns drawing lines
4. Complete boxes to score points
5. Game ends when all boxes are filled
