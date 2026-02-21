# LMS Manager

Managed Last Man Standing game application for game managers to run LMS competitions without requiring player participation.

## Overview

LMS Manager allows game managers to:
- Maintain master data (teams and players with custom nicknames)
- Create games with selected teams and players
- Manage rounds and picks on behalf of players
- Track results and eliminations
- Generate anonymous reports (with manager's team marked with ⭐)
- Embed public reports in display apps

## Architecture

- **Backend**: Go (port 4022), uses activity-hub-common library
- **Frontend**: React + TypeScript with shared CSS from identity-shell
- **Database**: PostgreSQL (`lms_manager_db`)
- **Auth**: Requires `game_manager` role

## Database Schema

```sql
-- Master data (manager-specific)
managed_teams (id, manager_email, team_name, created_at)
managed_players (id, manager_email, player_nickname, created_at)

-- Game setup
managed_games (id, manager_email, game_name, status, winner_names, created_at)
managed_game_teams (id, game_id, team_name)
managed_game_players (id, game_id, player_nickname, status, eliminated_round, created_at)

-- Rounds and picks
managed_rounds (id, game_id, round_number, status, created_at)
managed_picks (id, game_id, round_id, player_nickname, team_name, result, created_at)
```

## Workflow

1. **Master Data Setup**
   - Add teams (e.g., "Chelsea", "Arsenal")
   - Add players with nicknames (e.g., "Bob", "Alice")

2. **Create Game**
   - Select teams from master data
   - Select players from master data
   - Game starts in "active" status

3. **Round Management**
   - Create round (auto-increments round number)
   - Add picks for each player (one team per round)
   - Each team can only be picked once per game
   - Manager's own team picks are tracked for transparency

4. **Process Results**
   - Set pick results (win/lose)
   - Close round
   - Process round → eliminates players with losing picks

5. **Complete Game**
   - Declare winner early → all active players become winners
   - Or continue until one player remains

## Dual Mode

### Manager Interface
`http://pi:4022/`
- Full CRUD for teams, players, games
- Round and pick management
- Results processing
- Requires authentication with `game_manager` role

### Report View (Embed Mode)
`http://pi:4022/?gameId={id}`
- Public, read-only view
- Shows round-by-round team counts (anonymous)
- Manager's team marked with ⭐
- Eliminated players listed per round
- Final winners displayed
- Can be embedded in display-runtime

## Key Features

### Anonymous Reporting
Reports show team pick counts (e.g., "5 Chelsea") without revealing individual player picks to prevent cheating.

### Manager Transparency
The manager's own team picks are marked with ⭐ in reports for transparency.

### Early Winner Declaration
If all remaining players agree to end early, manager can declare all active players as joint winners.

## API Endpoints

### Master Data
- `GET /api/teams` - List manager's teams
- `POST /api/teams` - Create team
- `DELETE /api/teams/{id}` - Delete team
- `GET /api/players` - List manager's players
- `POST /api/players` - Create player
- `DELETE /api/players/{id}` - Delete player

### Games
- `GET /api/games` - List manager's games
- `POST /api/games` - Create game
- `DELETE /api/games/{id}` - Delete game
- `POST /api/games/{gameId}/declare-winner` - Declare all active as winners

### Rounds
- `GET /api/games/{gameId}/rounds` - List rounds
- `POST /api/games/{gameId}/rounds` - Create round
- `POST /api/rounds/{roundId}/close` - Close round
- `POST /api/rounds/{roundId}/process` - Process eliminations

### Picks
- `GET /api/rounds/{roundId}/picks` - List picks
- `POST /api/rounds/{roundId}/picks` - Create pick
- `PUT /api/picks/{id}` - Update pick
- `DELETE /api/picks/{id}` - Delete pick
- `PUT /api/picks/{id}/result` - Set result (win/lose)

### Helpers
- `GET /api/rounds/{roundId}/available-teams` - Teams not yet picked
- `GET /api/rounds/{roundId}/available-players` - Players who haven't picked

### Reporting (Public)
- `GET /api/games/{gameId}/report` - Full game report with rounds

## Deployment (Pi)

```bash
# 1. Create database
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE lms_manager_db;"
psql -U activityhub -h localhost -p 5555 -d lms_manager_db -f games/lms-manager/database/schema.sql

# 2. Grant game_manager role to users
psql -U activityhub -h localhost -p 5555 -d activity_hub -c "UPDATE users SET roles = array_append(roles, 'game_manager') WHERE email = 'your@email.com';"

# 3. Register app
psql -U activityhub -h localhost -p 5555 -f scripts/migrate_add_lms_manager_app.sql

# 4. Build frontend
cd ~/pub-games-v3/games/lms-manager/frontend
npm install
npm run build
mkdir -p ../backend/static
cp -r build/* ../backend/static/

# 5. Start backend
cd ../backend
go run *.go
# Server starts on port 4022
```

## Development

### Frontend
```bash
cd frontend
npm install
npm start  # Development server on port 3000
```

### Backend
```bash
cd backend
go run *.go  # Production server on port 4022
```

## Example Usage

1. **Add Teams**: Chelsea, Arsenal, Liverpool, Man City
2. **Add Players**: Bob, Alice, Charlie, Dave
3. **Create Game**: "Premier League LMS" with all 4 teams and all 4 players
4. **Round 1**:
   - Create round
   - Bob picks Chelsea
   - Alice picks Arsenal
   - Charlie picks Liverpool
   - Dave picks Man City (manager's pick - will show ⭐)
   - Set results: Chelsea win, Arsenal lose, Liverpool win, Man City win
   - Close round
   - Process round → Alice eliminated
5. **Round 2**:
   - Create round (available teams now exclude Chelsea, Liverpool, Man City)
   - Continue until one player remains or declare early winner

## Notes

- Teams and players are manager-specific (nicknames can differ between managers)
- Each team can only be picked once per game across all rounds
- Manager's picks are tracked and displayed with ⭐ in reports
- Reports are intentionally anonymous (counts only) to prevent cheating
- Games can be deleted (cascades to all rounds and picks)
- Early winner declaration makes all active players joint winners
