# Sweepstakes Knockout

Manager-controlled sweepstakes for single-event competitions like horse races, greyhounds, athletics, etc.

## Overview

This app allows a game manager to:
1. Create events (e.g., "Grand National 2026")
2. Add horses/entrants
3. Add players and assign each player a horse
4. Configure winning positions (1st, 2nd, 3rd, last, etc.)
5. Enter results by assigning positions to horses
6. View winners report

## Access Control

- **Role required**: `game_manager`
- Only the manager who created an event can manage it
- Each manager sees only their own events

## Database

**Database name**: `sweepstakes_knockout_db`

**Tables**:
- `events` - Event details (name, description, status, manager_email)
- `horses` - Entrants in each event
- `players` - Participants with assigned horses
- `winning_positions` - Configurable positions that pay out (e.g., "1", "2", "3", "last")
- `results` - Final positions assigned to each horse

## Workflow

### 1. Create Event
Create a new event with name and optional description.

### 2. Setup Tab
- **Add Horses**: Add all entrants (horses, greyhounds, athletes, etc.)
- **Add Players**: Add participants with email and name
- **Assign Horses**: Use dropdown to assign each player a horse
- **Configure Winning Positions**: Add positions that will pay out
  - Accepts numbers: "1", "2", "3", etc.
  - Accepts "last" (case-insensitive: LAST, Last, lAsT, etc.)

### 3. Results Tab
- Assign each horse to a finishing position using dropdowns
- Must assign all winning positions before saving
- Click "Save Results" to complete the event
- Event status changes to "completed"

### 4. Report Tab
- Shows all winners (players whose horses finished in winning positions)
- Displays: Player name, email, horse name, position
- Only available after results are saved

## Special Features

### "last" Position
- Position "last" is treated specially
- Case-insensitive: "last", "LAST", "Last", "lAsT" all normalized to "last"
- In reports, sorted to end of list (after numbered positions)

### Validation
- Each horse can only be assigned to one player
- Each position can only be assigned to one horse
- Duplicate horse names not allowed in same event
- Duplicate player emails not allowed in same event
- All winning positions must be assigned before completing event

## Port

**4032**

## API Endpoints

All endpoints require `game_manager` role.

### Events
- `GET /api/events` - List manager's events
- `POST /api/events` - Create event
- `GET /api/events/{id}` - Get event details
- `PUT /api/events/{id}` - Update event status
- `DELETE /api/events/{id}` - Delete event

### Horses
- `GET /api/events/{eventId}/horses` - List horses
- `POST /api/events/{eventId}/horses` - Add horse
- `DELETE /api/horses/{id}` - Delete horse

### Players
- `GET /api/events/{eventId}/players` - List players
- `POST /api/events/{eventId}/players` - Add player
- `PUT /api/players/{id}` - Update player (assign horse)
- `DELETE /api/players/{id}` - Delete player

### Winning Positions
- `GET /api/events/{eventId}/positions` - List positions
- `POST /api/events/{eventId}/positions` - Add position
- `DELETE /api/positions/{id}` - Delete position

### Results
- `GET /api/events/{eventId}/results` - Get results
- `POST /api/events/{eventId}/results` - Save results (completes event)

### Report
- `GET /api/events/{eventId}/report` - Get winners

## Deployment

### On Pi

```bash
cd ~/pub-games-v3 && git pull

# 1. Create database
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE sweepstakes_knockout_db;"
psql -U activityhub -h localhost -p 5555 -d sweepstakes_knockout_db -f games/sweepstakes-knockout/database/schema.sql

# 2. Register app
psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_sweepstakes_knockout.sql

# 3. Build backend
cd games/sweepstakes-knockout/backend
go mod tidy

# 4. Build frontend
cd ../frontend
npm install
npm run build
cp -r build/* ../backend/static/

# 5. Add to core services
# Edit scripts/start_core.sh to add:
# tmux new-window -t core -n sweepstakes-knockout "cd ~/pub-games-v3/games/sweepstakes-knockout/backend && go run *.go"

# 6. Start service
cd ../backend
go run *.go &
```

## Testing

Access at: `http://pi:4032/?token=YOUR_TOKEN`

Users with `game_manager` role:
- admin@pubgames.local
- alice@pubgames.local
- bob@pubgames.local

## Future Enhancements

- CSV import for horses and players
- Bulk assignment tool
- Export winners to CSV
- Event templates (save configuration for reuse)
- Multi-event tournaments
