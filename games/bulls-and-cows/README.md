# Bulls and Cows 🐂🐄

A code-breaking game where players guess a secret combination of colors or numbers. Also known as Mastermind.

## Game Modes

### Variants
- **Colors Mode**: 6 colors (Red, Blue, Green, Yellow, Orange, Purple), 4 pegs, duplicates allowed
- **Numbers Mode**: Digits 0-9, 4 digits, duplicates allowed

### Play Modes
- **1 Player**: Play against AI opponent
- **2 Player**: Challenge another player via real-time gameplay

## Game Rules

1. **Code Maker** creates a secret code (4 pegs: colors or numbers)
2. **Code Breaker** makes guesses to crack the code
3. After each guess, Code Maker provides feedback:
   - **Bulls (✓)**: Correct color/number in correct position (green badge)
   - **Cows (~)**: Correct color/number in wrong position (yellow badge)
4. Game continues until code is cracked or max attempts reached (12 guesses)

## Architecture

### Port
- **4091** (configured in `backend/main.go` and `scripts/start_core.sh`)

### Database
- **PostgreSQL**: `bulls_and_cows_db` (port 5555)
- **Tables**: `games`, `guesses`

### Redis
- Real-time updates via SSE
- Game state caching (1 hour TTL)

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | App configuration (minPlayers: 1, maxPlayers: 2) |
| POST | `/api/game` | Create new game |
| GET | `/api/game/{gameId}` | Get game state |
| POST | `/api/game/{gameId}/guess` | Submit a guess |
| GET | `/api/game/{gameId}/stream` | SSE stream for real-time updates |

## Deployment Instructions

### Copy-Paste Build Script (On Pi)

```bash
# ============================================
# Bulls and Cows - Complete Build & Deploy
# ============================================

# 1. Database Setup
# ============================================
# Create database
psql -h localhost -p 5555 -U activityhub -d postgres -c "CREATE DATABASE bulls_and_cows_db;"
# Run schema
psql -h localhost -p 5555 -U activityhub -d bulls_and_cows_db -f ~/pub-games-v3/games/bulls-and-cows/database/schema.sql
# Verify tables (should show: games, guesses)
psql -h localhost -p 5555 -U activityhub -d bulls_and_cows_db -c "\dt"

# 2. Backend Build
# ============================================
cd ~/pub-games-v3/games/bulls-and-cows/backend
# Download Go dependencies
go mod download
# Test compilation
go build -o bulls-and-cows
# Clean up test binary
rm bulls-and-cows

# 3. Frontend Build
# ============================================
cd ~/pub-games-v3/games/bulls-and-cows/frontend
# Install npm dependencies
npm install
# Build for production
npm run build
# Copy to backend static directory
mkdir -p ../backend/static
cp -r build/* ../backend/static/
# Verify (should show: index.html, static/js/, static/css/)
ls -la ../backend/static/

# 4. Register App
# ============================================
cd ~/pub-games-v3
psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_bulls_and_cows.sql
# Verify registration (should show: Bulls and Cows, port 4091, min_players: 1, max_players: 2)
psql -U activityhub -h localhost -p 5555 -d activity_hub -c "SELECT name, icon, backend_port, min_players, max_players FROM applications WHERE id = 'bulls-and-cows';"

# 5. Start Service
# ============================================
# Option A: Start all core services (includes Bulls and Cows)
cd ~/pub-games-v3/scripts
./start_core.sh

# Option B: Start Bulls and Cows manually (for testing)
# cd ~/pub-games-v3/games/bulls-and-cows/backend
# go run *.go

# 6. Verify Service
# ============================================
# Check if service is running on port 4091
lsof -i :4091
# Test config endpoint (should return: {"appName":"Bulls and Cows","minPlayers":1,"maxPlayers":2})
curl http://localhost:4091/api/config

# ============================================
# Done! Access at http://192.168.1.29:3001
# ============================================
```

### 7. Test Gameplay

**1-Player Mode:**
1. Access identity-shell: `http://192.168.1.29:3001`
2. Select "Bulls and Cows" from game list
3. Choose Colors or Numbers mode
4. Choose 1 Player
5. Make guesses and verify bulls/cows feedback
6. Win by cracking the code

**2-Player Mode:**
1. User A: Click "Challenge" → Select Bulls and Cows → Select User B
2. Choose Colors or Numbers mode
3. Choose 2 Player
4. User B: Accept challenge (receives gameId via URL)
5. User B makes guesses while User A observes
6. Verify SSE real-time updates appear for both users

## Development

### Local Frontend Development (On Pi)

```bash
cd ~/pub-games-v3/games/bulls-and-cows/frontend
npm start
```

Access at `http://192.168.1.29:3000` (React dev server)

### Testing API Directly

```bash
# Set your credentials (get token from identity-shell login)
TOKEN="your-jwt-token-here"
USER_ID="your-user-id"

# Create 1-player game (colors mode)
curl -X POST http://localhost:4091/api/game -H "Authorization: Bearer $TOKEN" -H "X-User-ID: $USER_ID" -H "Content-Type: application/json" -d '{"mode":"colors","variant":"1player"}'

# Save the gameId from the response above, then make a guess (replace GAME_ID_HERE)
curl -X POST http://localhost:4091/api/game/GAME_ID_HERE/guess -H "Authorization: Bearer $TOKEN" -H "X-User-ID: $USER_ID" -H "Content-Type: application/json" -d '{"guess":"RBYG"}'

# Get game state (replace GAME_ID_HERE)
curl http://localhost:4091/api/game/GAME_ID_HERE -H "Authorization: Bearer $TOKEN" -H "X-User-ID: $USER_ID"

# Test SSE stream (replace GAME_ID_HERE)
curl -N http://localhost:4091/api/game/GAME_ID_HERE/stream?token=$TOKEN
```

## Code Structure

```
games/bulls-and-cows/
├── backend/
│   ├── main.go          # Entry point, HTTP server setup
│   ├── game.go          # Game logic (code generation, validation, scoring)
│   ├── handlers.go      # API handlers (CRUD, guess submission)
│   ├── sse.go           # SSE streaming for real-time updates
│   ├── go.mod           # Go module dependencies
│   └── static/          # React build output (generated)
├── frontend/
│   ├── src/
│   │   ├── index.tsx           # Entry point with Activity Hub CSS loading
│   │   ├── App.tsx             # Main component (mode selection)
│   │   ├── GameBoard.tsx       # Gameplay UI
│   │   └── hooks/
│   │       └── useGameSocket.ts # SSE connection hook
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── tsconfig.json
├── database/
│   └── schema.sql       # PostgreSQL schema
└── README.md            # This file
```

## Mobile Support

Bulls and Cows is designed mobile-first:

- **Touch targets**: 50px minimum for color circles
- **Responsive layout**: Stacks on mobile, side-by-side on desktop
- **Auto-advance**: Selecting a color/number advances to next position
- **Scrollable history**: Shows all previous guesses with feedback
- **Clear visual feedback**: Green ✓ for bulls, orange ~ for cows

## Troubleshooting

### Frontend not loading styles
```bash
# Verify Activity Hub CSS is being served
curl http://localhost:3001/shared/activity-hub.css | head -20
# Check browser console for CSS 404 errors
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

### Database connection failed
```bash
# Check PostgreSQL is running
systemctl status postgresql
# Verify database exists
psql -h localhost -p 5555 -U activityhub -l | grep bulls_and_cows_db
# Test connection
psql -h localhost -p 5555 -U activityhub -d bulls_and_cows_db -c "SELECT 1;"
```

### SSE not connecting
```bash
# Check Redis is running (should return: PONG)
redis-cli ping
# Verify port 4091 is accessible
curl http://localhost:4091/api/config
# Check browser console for SSE errors
```

### Game not appearing in identity-shell
```bash
# Verify app is registered in activity_hub database
psql -h localhost -p 5555 -U activityhub -d activity_hub -c "SELECT name, backend_port, enabled FROM applications WHERE id = 'bulls-and-cows';"
# Check if service is running on correct port
lsof -i :4091
```

## Future Enhancements

- Variable difficulty (3-6 pegs, 8-10 colors)
- Hints system (reveal one peg position)
- Timed mode with leaderboards
- Statistics dashboard (avg guesses, win rate)
- Tournament brackets
- Custom color palettes
- Sound effects and animations

## License

Part of the Pub Games v3 platform.
