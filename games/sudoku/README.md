# Sudoku 🔢

Classic 9×9 Sudoku puzzle game with puzzle management and progress tracking.

## Overview

**Port**: 4081
**Category**: Game
**Access**: Public (puzzle viewing), Authenticated (progress saving)
**Real-time**: None
**Players**: Single player
**Admin**: Game Admin integration (port 5070)

## Features

### Player Features
- **Puzzle Library**: Browse puzzles by difficulty (easy, medium, hard)
- **Status Filtering**: Filter by not-started, in-progress, or completed
- **Auto-Save Progress**: Saves every 2 seconds while playing
- **Resume Games**: Automatically loads saved progress when returning to puzzle
- **Notes Mode**: Add pencil marks (candidates) to cells
- **Conflict Detection**: Invalid entries highlighted in real-time
- **Visual Feedback**: Prefilled cells in gray, user entries in blue, conflicts in red
- **Validation**: Real-time checking of row, column, and 3×3 box rules

### Admin Features (via Game Admin)
- **Manual Create**: 9×9 grid editor with auto-validation
- **Puzzle Generator**: One-click generation by difficulty
- **Library View**: Browse all created puzzles with metadata
- **Single-Solution Validation**: Ensures puzzle quality before saving

## Technical Details

### Frontend
- React with TypeScript
- Activity Hub shared CSS
- Game-specific styles in `sudoku-board.css` (9×9 grid, cell styling)
- Inline validation logic (no backend calls during gameplay)
- Dynamic puzzle loading from backend API
- Debounced auto-save (2 second delay)

### Backend
- Go server (port 4081)
- Pure Go puzzle generator with backtracking algorithm
- Single-solution validation
- PostgreSQL for puzzle storage and progress tracking
- Authentication middleware from activity-hub-common
- Admin-only puzzle creation endpoints
- Public puzzle viewing, authenticated progress saving

### Database Schema

**puzzles table**:
- JSONB storage for puzzle grids (efficient querying)
- Difficulty levels: easy (~45 clues), medium (~35 clues), hard (~25 clues)
- Unique puzzle numbers assigned by admins
- Created by tracking (admin email)

**game_progress table**:
- User progress tracking with current board state
- Notes storage (cell candidates)
- Completion status and timestamps
- Auto-cleanup: Incomplete progress older than 28 days deleted on startup
- Unique constraint: One progress record per user per puzzle

## API Endpoints

### Public Endpoints
- `GET /api/puzzles` - List all puzzles (metadata only, no grids)
- `GET /api/puzzles?difficulty=easy` - Filter by difficulty
- `GET /api/puzzles/:id` - Get full puzzle data (includes grid)
- `GET /api/config` - App configuration
- `GET /api/ping` - Health check

### Authenticated Endpoints
- `POST /api/progress` - Save/update user progress
- `GET /api/progress` - Get all user progress
- `GET /api/progress?puzzleId=5` - Get specific puzzle progress

### Admin-Only Endpoints
- `POST /api/puzzles` - Create puzzle manually
- `POST /api/puzzles/generate` - Generate puzzle with algorithm

## Building

```bash
# Build frontend
cd games/sudoku/frontend
npm install
npm run build
cp -r build/* ../backend/static/

# Run backend
cd ../backend
go mod tidy
go run *.go
```

## Database Setup

```bash
# Create database
psql -h localhost -p 5555 -U activityhub -d postgres -c "CREATE DATABASE sudoku_db;"

# Run schema migration
psql -h localhost -p 5555 -U activityhub -d sudoku_db -f ~/pub-games-v3/games/sudoku/database/schema_v2.sql
```

This creates:
- `puzzles` table for puzzle storage
- `game_progress` table for user progress
- Auto-update trigger for `last_accessed` timestamp
- Indexes for performance

## Gameplay

1. **Select Puzzle**: Browse library and click a puzzle to play
2. **Fill Grid**: Click cells and select numbers 1-9
3. **Notes Mode**: Toggle to add candidate numbers to cells
4. **Auto-Save**: Progress saves automatically every 2 seconds
5. **Resume**: Return anytime and your progress will load
6. **Complete**: Fill entire grid with no conflicts to win

### Rules
- Each row must contain 1-9 without repeating
- Each column must contain 1-9 without repeating
- Each 3×3 box must contain 1-9 without repeating

### Controls
- **Click cell** → Select it
- **Click number** → Fill selected cell (or toggle note in notes mode)
- **Clear button** → Empty selected cell
- **Notes toggle** → Switch between fill and notes mode
- **← Library** → Return to puzzle selection

## Creating Puzzles (Game Admin)

### Option 1: Generator (Recommended)
1. Open Game Admin (port 5070) → Sudoku → Generator
2. Select difficulty (easy/medium/hard)
3. Click "Generate Puzzle"
4. Puzzle auto-assigned next available number

### Option 2: Manual Create
1. Open Game Admin (port 5070) → Sudoku → Manual Create
2. Enter puzzle number (e.g., 101)
3. Select difficulty
4. Fill in grid with starting clues (0 = empty)
5. Click "Save Puzzle"
6. Backend validates single solution before saving

### Library View
- Browse all created puzzles
- Filter by difficulty
- See metadata: puzzle number, clue count, created date

## Puzzle Generation Algorithm

**Implementation**: Pure Go backtracking solver
- Generates complete valid grid first
- Removes cells to create puzzle based on difficulty
- Validates single solution after each removal
- No external dependencies

**Difficulty Targets**:
- Easy: ~45 clues (simpler logic required)
- Medium: ~35 clues (moderate strategies needed)
- Hard: ~25 clues (advanced techniques required)

**Single-Solution Validation**:
- Counts all possible solutions for given puzzle
- Rejects puzzles with 0 or 2+ solutions
- Ensures fair, solvable puzzles

## Progress Tracking

**Auto-Save**:
- Triggers 2 seconds after last move
- Saves current board state + notes
- Updates last_accessed timestamp

**Resume Behavior**:
- Checks for saved progress on puzzle selection
- Loads board state and notes if found
- Falls back to fresh puzzle if load fails

**Cleanup Policy**:
- Incomplete progress older than 28 days deleted
- Completed puzzles kept forever
- Cleanup runs on backend startup

## Access

- **Play**: `http://192.168.1.29:4081/?userId=X&userName=X&token=XXX`
- **Manage**: `http://192.168.1.29:5070/?userId=X&userName=X&token=XXX` (admin role)
- **Via Identity Shell**: Shows in app list for all users

## Architecture Decisions

**JSONB for Grids**: Efficient storage, easy querying, PostgreSQL native support
**Debounced Auto-Save**: Reduces database writes while ensuring progress safety
**28-Day Cleanup**: Balances storage with user convenience
**Single-Solution Validation**: Ensures puzzle quality and fairness
**Admin-Only Creation**: Prevents spam, maintains puzzle quality
**Public Viewing**: Anyone can browse and play puzzles

## Future Enhancements

- **Hints System**: Show valid candidate for selected cell
- **Undo/Redo**: Revert moves during play
- **Timer**: Track solve time (currently removed)
- **Daily Challenge**: Featured puzzle of the day
- **Leaderboard**: Fastest solve times per puzzle
- **Import/Export**: Share puzzles via text format
- **Difficulty Scoring**: Dynamic difficulty based on required techniques
- **Mobile Optimization**: Touch-friendly number pad

## Notes on Current Implementation

**Completed**:
- ✅ Backend puzzle management with generator
- ✅ Progress tracking with auto-save
- ✅ Single-solution validation
- ✅ Game Admin integration (create, generate, library)
- ✅ Notes mode for candidate tracking
- ✅ Conflict detection and visual feedback

**Known Tweaks Needed**:
- Manual create UX (Save button requires puzzle number first)
- UI refinements in game interface
- Additional features per roadmap above

## Database Migration

From hardcoded puzzles to backend system:

**Old**: `game_state` table with embedded puzzle data
**New**: Separate `puzzles` and `game_progress` tables

Migration not needed - schema_v2.sql is clean install for new system.
