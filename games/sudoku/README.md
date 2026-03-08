# Sudoku 🔢

Classic 9×9 Sudoku puzzle game with timer and auto-pause.

## Overview

**Port**: 4081
**Category**: Game
**Access**: Guest (no authentication required)
**Real-time**: None
**Players**: Single player

## Features

- **Classic 9×9 Grid**: Standard Sudoku gameplay
- **Conflict Detection**: Invalid entries highlighted in real-time
- **Timer**: Tracks solve time with automatic pause
- **Auto-Pause**: Timer pauses when tab is hidden or mobile disconnects
- **Visual Feedback**: Prefilled cells in gray, user entries in blue, conflicts in red
- **Validation**: Real-time checking of row, column, and 3×3 box rules
- **Controls**: Pause/Resume, Reset, New Game

## Technical Details

### Frontend
- React with TypeScript
- Activity Hub shared CSS
- Game-specific styles in `sudoku-board.css` (9×9 grid, cell styling)
- Inline validation logic (no backend calls during gameplay)

### Backend
- Go server (port 4081)
- PostgreSQL for game state persistence
- Saves progress: puzzle, current state, elapsed time, completion status

### Database
- `game_state` table: Stores user progress and completion
- Future: Will load daily puzzles from Game Admin

## Building

```bash
# Build frontend
cd frontend
npm install
npm run build
cp -r build/* ../backend/static/

# Run backend
cd ../backend
go run *.go
```

## Database Setup

```bash
# Create database
psql -U activityhub -d activity_hub -p 5555 -h localhost -f database/schema.sql
```

This creates:
- `game_state` table for saving progress
- Registers app in `activity_hub.applications`

## Gameplay

1. **Objective**: Fill the 9×9 grid with numbers 1-9
2. **Rules**:
   - Each row must contain 1-9 without repeating
   - Each column must contain 1-9 without repeating
   - Each 3×3 box must contain 1-9 without repeating
3. **Controls**:
   - Click a cell to select it
   - Type 1-9 to fill
   - Delete/Backspace to clear
   - Pause button stops timer (useful for breaks)
4. **Auto-Pause**: Timer automatically pauses when:
   - Tab loses focus
   - Mobile screen turns off
   - Browser minimized

## Current Implementation

**Puzzle Source**: Hardcoded sample puzzle (easy difficulty)

**Future Enhancements**:
- Daily puzzle system (one per day, same for all users)
- Puzzle builder in Game Admin
- Difficulty levels (easy, medium, hard)
- Leaderboard (fastest solve times)
- Hints system
- Undo/Redo
- Notes mode (pencil marks)
- Multiple save slots

## Access

- Direct: `http://192.168.1.29:4081/?userId=guest&userName=Guest&token=XXX`
- Via Identity Shell: Shows in guest mode app list

## Timer Behavior

- **Running**: Increments every second while puzzle is active
- **Paused**: Stops when:
  - User clicks Pause button
  - Browser tab hidden (visibilitychange event)
  - Mobile app backgrounded
- **Completed**: Stops when puzzle is correctly solved
- **Format**: HH:MM:SS (e.g., "00:12:45")

## Validation Logic

**Real-time Conflict Detection**:
- Red background on cells with conflicting values
- Checks all three rules simultaneously
- User can still enter conflicting values (helps with solving strategies)
- Puzzle only completes when all cells filled AND no conflicts

**Completion Check**:
- All 81 cells filled with 1-9
- No conflicts in any row, column, or 3×3 box
- Displays "🎉 Puzzle Complete!" with final time
