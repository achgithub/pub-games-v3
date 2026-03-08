# Rrroll the Dice 🎲

Simple dice roller utility with smooth animations.

## Overview

**Port**: 4071
**Category**: Utility
**Access**: Guest (no authentication required)
**Real-time**: None

## Features

- Roll 1-6 dice with a single click
- Smooth 2-second roll animation with shake/rotate effects
- Adjustable dice count with ▼/▲ buttons
- Shows total of all dice values
- High-quality dice images with shadows
- Fallback to Unicode emoji if images fail to load

## Technical Details

### Frontend
- React with TypeScript
- Activity Hub shared CSS
- Game-specific styles in `dice-board.css` (shake animation, dice layout)
- Dynamic CSS loading from identity-shell

### Backend
- Simple Go static file server
- No database required
- CORS enabled for development
- Serves `/api/config` endpoint for app metadata

### Database
- No app-specific tables
- Registered in `activity_hub.applications` table
- Guest accessible (empty `required_roles`)

## Building

```bash
# Build frontend
cd frontend
npm install
npm run build

# Copy to backend
cp -r build/* ../backend/static/

# Run backend
cd ../backend
go run *.go
```

Access at: `http://192.168.1.29:4071/?userId=guest&userName=Guest&token=XXX`

## Registration

Run database schema to register in app registry:

```bash
psql -U activityhub -d activity_hub -p 5555 -h localhost -f database/schema.sql
```

## Animation Details

- **Duration**: 2 seconds
- **Interval**: 100ms (20 cycles)
- **Effects**: Shake, rotate, slight blur (1px)
- **Settle**: Smooth scale-down when roll completes

## Layout

- Max 3 dice per row (prevents awkward 4-in-a-row layout)
- Centered with responsive wrapping
- Fixed container width (408px) for consistent layout

## Future Enhancements

Possible features mentioned but not implemented:
- Knockout mode (order players by random roll results)
- Custom dice sides (d4, d8, d12, d20)
- Roll history
- Sound effects
