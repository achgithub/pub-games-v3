# PubGames V3 - Leaderboard

Centralized leaderboard service for all PubGames. Games report their results here, and the standings are aggregated per game type.

## Architecture

- **Single Port**: Go backend serves both API and React frontend on port 5030
- **Database**: PostgreSQL (`leaderboard_db`)
- **Receives results from**: Tic-Tac-Toe, Dots, etc.
- **Provides**: Standings, recent games, player stats

## File Structure

```
leaderboard/
├── backend/
│   ├── main.go
│   ├── handlers.go
│   ├── models.go
│   ├── database.go
│   ├── go.mod
│   └── static/
├── frontend/
│   ├── src/
│   │   └── App.js
│   ├── public/
│   └── package.json
└── README.md
```

## API Endpoints

### Reporting (called by games)
- `POST /api/result` - Report a game result

### Querying
- `GET /api/standings` - List all game types with results
- `GET /api/standings/{gameType}` - Get standings for a game type
- `GET /api/recent/{gameType}` - Get recent games
- `GET /api/player/{playerId}` - Get player stats

## Result Reporting Format

Games POST to `/api/result`:

```json
{
  "gameType": "tic-tac-toe",
  "gameId": "unique-game-id",
  "winnerId": "winner@email.com",
  "winnerName": "Winner Name",
  "loserId": "loser@email.com",
  "loserName": "Loser Name",
  "isDraw": false,
  "score": "3-2",
  "duration": 120
}
```

For draws, set `isDraw: true` and both players in winner/loser fields.

## Scoring

- **Win**: 3 points
- **Draw**: 1 point
- **Loss**: 0 points

Standings are ranked by: points DESC, wins DESC, total games DESC.

## Running

Via start_services.sh:
```bash
./start_services.sh
```

Manual:
```bash
cd static-apps/leaderboard/frontend
npm install && npm run build
cp -r build/* ../backend/static/

cd ../backend
go run *.go
```

## Database Setup

On Pi:
```bash
psql -U pubgames -c "CREATE DATABASE leaderboard_db;"
```

Tables are created automatically on startup.
