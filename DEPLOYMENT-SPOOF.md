# Spoof Game - Deployment Instructions

## Summary

The Spoof multi-player game has been implemented along with a complete multi-player challenge system for the identity shell. This enables 3-6 player games with real-time challenge acceptance tracking.

**What's new:**
- Multi-player challenge system (shell backend + frontend)
- Spoof game (backend + frontend)
- Support for 3-6 player challenges

## Prerequisites on Pi

Before deploying, ensure you have:
- ✅ PostgreSQL running on port 5555
- ✅ Redis running on port 6379
- ✅ Go 1.25+ installed
- ✅ Node.js/npm installed

## Deployment Steps on Pi

### 1. Push from Mac (when ready)
```bash
git push origin main
```

### 2. Pull on Pi
```bash
cd ~/pub-games-v3
git pull origin main
```

### 3. Run Identity Shell Database Migration
```bash
cd ~/pub-games-v3/identity-shell/data/migrations
psql -U pubgames -h localhost -p 5555 -d pubgames -f 001_add_multiplayer_challenges.sql
```

Expected output:
```
ALTER TABLE
CREATE INDEX
CREATE INDEX
[comments added]
```

### 4. Create Spoof Database
```bash
# Create the database
psql -U pubgames -h localhost -p 5555 -d postgres -c "CREATE DATABASE spoof_db;"

# Create schema
cd ~/pub-games-v3/games/spoof/database
psql -U pubgames -h localhost -p 5555 -d spoof_db -f schema.sql
```

Expected output:
```
CREATE DATABASE
CREATE TABLE
CREATE TABLE
CREATE INDEX
[indexes and comments]
```

### 5. Build Spoof Frontend
```bash
cd ~/pub-games-v3/games/spoof/frontend
npm install
npm run build
```

### 6. Copy Frontend to Backend Static
```bash
cd ~/pub-games-v3/games/spoof/frontend
mkdir -p ../backend/static
cp -r build/* ../backend/static/
```

### 7. Install Go Dependencies for Spoof
```bash
cd ~/pub-games-v3/games/spoof/backend
go mod download
```

### 8. Rebuild Identity Shell Frontend
The identity shell frontend has new multi-player components that need to be rebuilt:

```bash
cd ~/pub-games-v3/identity-shell/frontend
npm install  # Install any new dependencies
npm run build
cp -r build/* ../backend/static/
```

### 9. Start Services

You can use the existing `start_services.sh` script, but you'll need to add Spoof to it:

**Option A: Add to start_services.sh**
Edit `~/pub-games-v3/scripts/start_services.sh` and add:
```bash
# Spoof (multi-player coin game)
tmux new-window -t pubgames -n spoof
tmux send-keys -t pubgames:spoof "cd ~/pub-games-v3/games/spoof/backend && go run *.go" C-m
```

**Option B: Start Spoof manually**
```bash
cd ~/pub-games-v3/games/spoof/backend
go run *.go
```

Spoof should start on port **4051**.

### 10. Restart Identity Shell
Since the identity shell has new challenge handlers and frontend changes:

```bash
# Kill existing identity-shell process (if using tmux)
tmux send-keys -t pubgames:identity-shell C-c

# Restart it
tmux send-keys -t pubgames:identity-shell "cd ~/pub-games-v3/identity-shell/backend && go run *.go" C-m
```

Or use the full restart:
```bash
cd ~/pub-games-v3/scripts
./stop_services.sh
./start_services.sh  # (after adding Spoof to it)
```

## Verification

### 1. Check Services are Running
```bash
# Check ports
lsof -i :3001  # Identity Shell
lsof -i :4051  # Spoof

# Or check tmux
tmux attach -t pubgames
# Use Ctrl+B then w to see window list
```

### 2. Test Identity Shell
Open browser: `http://192.168.1.45:3001`
- Should see updated lobby interface
- Look for "Challenge Multiple Players" button when 3+ users online

### 3. Test Spoof Registration
```bash
curl http://localhost:3001/api/apps | jq
```
Should see Spoof in the apps list with:
```json
{
  "id": "spoof",
  "name": "Spoof",
  "icon": "🪙",
  "minPlayers": 3,
  "maxPlayers": 6,
  "backendPort": 4051,
  "realtime": "sse"
}
```

### 4. Test Spoof Backend
```bash
curl http://localhost:4051/api/health
curl http://localhost:4051/api/config | jq
```

Expected:
```json
{
  "status": "ok",
  "game": "spoof"
}
```

## Testing Multi-Player Challenge Flow

You'll need 3+ users to test. Recommended test scenario:

1. **Login as 3 users** in different browsers/devices
2. **All users navigate to Lobby** (should see each other as online)
3. **User 1 clicks "Challenge Multiple Players"**
   - Selects Spoof
   - Selects 2 other players (3 total)
   - Sends challenge
4. **Users 2 and 3 receive challenge notifications**
   - Should see challenge progress UI showing "1/3 accepted"
5. **Users 2 and 3 accept**
   - When 3rd player accepts, game auto-starts
6. **All users redirected to Spoof game**
   - URL: `http://192.168.1.45:4051/?gameId=...&userId=...`

## Game Flow Test

Once in game:
1. **Coin Selection Phase**: Each player selects 0-3 coins
2. **Guessing Phase**: Players take turns guessing total coins
3. **Reveal Phase**: Shows everyone's coins and round result
4. **Next Round**: Winner loses 1 coin, or player with 0 eliminated
5. **Game Over**: Last player standing wins

## Troubleshooting

### Database Migration Fails
```bash
# Check if columns already exist
psql -U pubgames -h localhost -p 5555 -d pubgames -c "\d challenges"

# If migration already ran, that's fine (idempotent)
```

### Spoof Database Creation Fails
```bash
# Check if database already exists
psql -U pubgames -h localhost -p 5555 -d postgres -c "\l" | grep spoof

# If exists, either drop and recreate, or just create schema
```

### Frontend Build Fails
```bash
# Check Node version
node --version  # Should be 16+

# Clear cache and retry
cd ~/pub-games-v3/games/spoof/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### "Challenge Multiple Players" Button Not Showing
- Ensure identity-shell frontend was rebuilt and copied to static/
- Check browser console for errors
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

### Spoof Game Won't Start
```bash
# Check logs
cd ~/pub-games-v3/games/spoof/backend
go run *.go

# Common issues:
# - Port 4051 already in use
# - Database connection failed
# - Redis connection failed
```

### Multi-Player Challenge Not Working
Check identity-shell logs for errors:
```bash
tmux attach -t pubgames
# Navigate to identity-shell window (Ctrl+B then n)
# Look for error messages
```

## Files Changed

### Identity Shell
- `backend/lobby.go` - Multi-player challenge handlers
- `backend/main.go` - New route
- `backend/redis.go` - Multi-player Redis functions
- `backend/apps.json` - Spoof registration
- `frontend/src/` - New components (MultiPlayerChallengeModal, ChallengeProgress)
- `data/migrations/001_add_multiplayer_challenges.sql` - Database migration

### Spoof Game
- `games/spoof/backend/` - Complete backend (Go)
- `games/spoof/frontend/` - Complete frontend (TypeScript React)
- `games/spoof/database/schema.sql` - Database schema

## Ports Summary

| Service | Port | Purpose |
|---------|------|---------|
| Identity Shell | 3001 | Main shell and lobby |
| Spoof Backend | 4051 | Game API and static files |
| Spoof Frontend (dev) | 4052 | Development only (not used in production) |
| PostgreSQL | 5555 | Database |
| Redis | 6379 | Cache and pub/sub |

## Next Steps

After successful deployment:
1. Test with real users (3-6 players)
2. Gather feedback on game flow
3. Consider adding:
   - Round history display
   - Player statistics
   - Sound effects
   - Animation improvements
4. Use multi-player system for Shut the Box and Quiz games

## Backup Plan

If anything goes wrong:
```bash
# Rollback
cd ~/pub-games-v3
git reset --hard HEAD~2  # Undo both commits

# Restart services
./scripts/stop_services.sh
./scripts/start_services.sh
```

Then debug on Mac before redeploying.
