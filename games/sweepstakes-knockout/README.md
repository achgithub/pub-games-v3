# Sweepstakes Knockout

Manager-controlled sweepstakes for single-event competitions like horse races, greyhounds, athletics, etc.

## Recent Updates (2026-03-08)

**Group Import Feature**:
- Import groups with competitors from Game Admin registry
- Modal dialog with checkbox group selection
- Imports as local copies (can be edited/deleted independently)
- Success banner showing import results
- Accessible from Setup tab via "Import from Game Admin" button

## Overview

This app allows a game manager to:
1. Create/import groups of competitors (e.g., "Grand National 2026")
2. Add competitors to groups (horses, greyhounds, athletes, etc.)
3. Add players to player pool
4. Create events and assign competitors to players
5. Configure winning positions (1st, 2nd, 3rd, last, etc.)
6. Enter results by assigning positions to competitors
7. View winners report

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

### 1. Setup Tab
- **Player Pool**: Add participants who will join games
- **Groups & Competitors**:
  - Create groups (e.g., "Grand National 2026", "Greyhound Derby")
  - Add competitors to groups (horses, greyhounds, athletes, etc.)
  - **OR** Import groups from Game Admin:
    - Click "Import from Game Admin" button
    - Select groups from centralized registry
    - Imports groups with all competitors as local copies
    - Can edit/delete imported groups independently

### 2. Create Event
- Select a group (source of competitors for this event)
- Select players from pool
- Configure winning positions (e.g., "1,2,3,last")
- Enable spinner for randomized assignment (optional)

### 3. Games Tab - Assignment
- **Manual Assignment**: Use dropdown to assign each player a competitor
- **Spinner Assignment**: Click spin button for randomized assignment
  - Privacy reveal button (press & hold) to hide selections
  - Clear/reset button for corrections
  - Auto-saves on each selection

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

### Setup - Players
- `GET /api/players` - List players in manager's pool
- `POST /api/players` - Add player to pool
- `DELETE /api/players/{id}` - Delete player from pool

### Setup - Groups
- `GET /api/groups` - List manager's groups
- `POST /api/groups` - Create group
- `POST /api/groups/import` - Import groups from Game Admin
- `DELETE /api/groups/{id}` - Delete group

### Setup - Competitors
- `GET /api/groups/{groupId}/competitors` - List competitors in group
- `POST /api/groups/{groupId}/competitors` - Add competitor to group
- `DELETE /api/competitors/{id}` - Delete competitor

### Events
- `GET /api/events` - List manager's events
- `POST /api/events` - Create event
- `GET /api/events/{id}` - Get event details
- `DELETE /api/events/{id}` - Delete event

### Participants
- `PUT /api/participants/{id}` - Assign competitor to participant
- `DELETE /api/participants/{id}` - Remove participant from event

### Results
- `GET /api/events/{eventId}/results` - Get results
- `PUT /api/events/{eventId}/results` - Update results
- `POST /api/events/{eventId}/results` - Save final results

### Reports
- `GET /api/events/{eventId}/report` - Get winners for manager
- `GET /api/report/{eventId}` - Public report (no auth required)

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
