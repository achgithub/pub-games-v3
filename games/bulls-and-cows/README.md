# Bulls and Cows

Code-breaking game (also known as Mastermind) with single-player and two-player modes.

## Game Modes

### Colors Mode
- **Code length**: 4 pegs
- **Options**: 6 colors (Red, Blue, Green, Yellow, Orange, Purple)
- **Max guesses**: 12
- **Duplicates**: Not allowed
- **Example code**: RBYG

### Numbers Mode
- **Code length**: 5 digits
- **Options**: 0-9 (10 digits)
- **Max guesses**: 25
- **Duplicates**: Not allowed
- **Example code**: 13790

## Gameplay

### Rules
1. **Code Maker** creates a secret code
2. **Code Breaker** makes guesses to crack the code
3. After each guess, feedback is provided:
   - **Bulls (✓)**: Correct value in correct position (green badge)
   - **Cows (~)**: Correct value in wrong position (orange badge)
4. Game continues until code is cracked or max guesses reached

### 1-Player Mode
- Player is Code Breaker
- AI generates random secret code
- Solo play available from GameChallengeModal
- **Status**: ✅ WORKING

### 2-Player Mode
- One player is Code Maker, other is Code Breaker
- Challenge sent via identity-shell
- Real-time updates via SSE
- **Status**: ❌ NOT WORKING - Recipients cannot accept challenges

## Known Issue: 2-Player Challenge Acceptance

### Symptoms
- User A sends challenge to User B
- User B sees challenge notification
- User B clicks to accept
- Nothing happens - game doesn't launch

### Expected Behavior
- Should launch Bulls and Cows game board with gameId
- Similar pattern works correctly in tic-tac-toe and dots

### Investigation Needed
- Compare challenge acceptance flow with tic-tac-toe
- Verify gameId is passed correctly
- Check backend game creation with gameId
- Test SSE connection establishment
- Verify URL parameters passed to game

## Technical Details

### Port
- Backend: 4091
- Database: bulls_and_cows_db (PostgreSQL port 5555)

### Database Schema
- `games` table: Game state, mode, variant, secret code, players
- `guesses` table: All guesses with bulls/cows feedback

### API Endpoints
- `GET /api/config` - Game configuration (min/max players, game options)
- `POST /api/game` - Create new game
- `GET /api/game/{gameId}` - Get game state
- `POST /api/game/{gameId}/guess` - Submit guess
- `GET /api/game/{gameId}/stream` - SSE stream for real-time updates

### Game Options
Mode selection exposed via `/api/config`:
```json
{
  "gameOptions": [
    {
      "id": "mode",
      "label": "Mode",
      "type": "select",
      "default": "colors",
      "options": [
        {"value": "colors", "label": "Colors (4 pegs, 6 colors)"},
        {"value": "numbers", "label": "Numbers (5 digits, 0-9)"}
      ]
    }
  ]
}
```

## Implementation Status

### ✅ Completed Features
- Database schema with games and guesses tables
- Backend game logic (code generation, validation, bulls/cows calculation)
- Backend API handlers (create, get, guess, stream)
- Frontend game board (mobile-first, Activity Hub CSS)
- Solo play support (minPlayers = 0)
- Mode selection via GameChallengeModal
- SSE connection handling
- No duplicates in codes or guesses (frontend + backend validation)
- Dynamic guess positions (4 for colors, 5 for numbers)
- Color display with proper CSS specificity
- Different max guesses per mode (12 vs 25)

### ❌ Known Issues
- 2-player mode: Challenge acceptance not working

## File Structure

```
games/bulls-and-cows/
├── README.md (this file)
├── backend/
│   ├── main.go              # Entry point, routes
│   ├── handlers.go          # API handlers
│   ├── game.go              # Game logic
│   ├── sse.go               # Server-Sent Events
│   ├── go.mod
│   └── static/              # Frontend build
├── frontend/
│   ├── src/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── GameBoard.tsx
│   │   ├── bulls-and-cows-board.css
│   │   └── hooks/
│   │       └── useGameSocket.ts
│   ├── package.json
│   └── tsconfig.json
└── database/
    └── schema.sql
```

## Building & Deploying

### Frontend Build
```bash
cd games/bulls-and-cows/frontend
npm run build
cp -r build/* ../backend/static/
```

### Backend Run
```bash
cd games/bulls-and-cows/backend
go run *.go
```

### Full Deployment (on Pi)
```bash
cd ~/pub-games-v3
git pull
cd games/bulls-and-cows/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3
./scripts/stop_core.sh
./scripts/start_core.sh
```

## Development Notes

### No Duplicates Design
Changed from "duplicates allowed" to "no duplicates" because:
1. More strategic, less random
2. Reduces combinations for fairer gameplay
3. Frontend prevents duplicate selection
4. Backend validates and rejects duplicates

### Max Guesses Rationale
- **Colors**: 12 guesses for 360 combinations (4 from 6)
- **Numbers**: 25 guesses for 30,240 combinations (5 from 10)
- Numbers has 84× more combinations, needs more guesses

## Next Steps

1. **PRIORITY**: Debug 2-player challenge acceptance
2. Add game history/statistics
3. Implement leaderboards
4. Add hint system (optional)
