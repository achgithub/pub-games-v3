# Quick Start Guide

## Prerequisites

- Go 1.25+
- Node.js 18+
- PostgreSQL 13+ (running on port 5555)
- Redis 6+ (running on port 6379)

## Automated Start (Recommended)

The easiest way to run all services:

```bash
# Start all services (auto-builds frontends)
./start_services.sh

# Check what's running
./status_services.sh

# Stop everything
./stop_services.sh
```

The start script will:
- Check if frontends need rebuilding
- Build frontends automatically if source changed
- Start all backends on correct ports
- Show access URLs when complete

Then open **http://localhost:3001** to access the Identity Shell.

## Manual Setup (First Time)

### 1. Setup Databases

```bash
# Create databases and run migrations
cd identity-shell/data
./migrate.sh

cd ../../games/tic-tac-toe/database
./setup.sh

# Display Admin database
psql -U pubgames -h localhost -p 5555 -d postgres -c "CREATE DATABASE display_admin_db;"
```

### 2. Start Services

Use the automated script (recommended) or start individually:

**Identity Shell**:
```bash
cd identity-shell/backend
go run *.go
```
Backend starts on **http://localhost:3001**

**Tic-Tac-Toe**:
```bash
cd games/tic-tac-toe/frontend
npm install && npm run build
cp -r build/* ../backend/static/

cd ../backend
go run *.go
```
Game runs on **http://localhost:4001**

**Display System** (optional):
```bash
# Display Admin
cd games/display-admin/backend
./seed-displays.sh  # Creates 2 test TVs with content
go run *.go         # Starts on port 5050

# Display Runtime (TV app)
cd games/display-runtime/backend
go run *.go         # Starts on port 5051
```

### 3. Login

- Open http://localhost:3001
- Create an account or login
- You're in!

## What You'll See

- **Login Page**: Simple authentication
- **Shell Header**: Navigation, notifications, user menu
- **Lobby**: Online users, available games, challenges
- **Games**: Click any game to open it in an iframe

## Architecture

Each app serves frontend + API from a **single port**:

| Service | Port | Type |
|---------|------|------|
| Identity Shell | 3001 | Core |
| Tic-Tac-Toe | 4001 | Game |
| Dots & Boxes | 4011 | Game |
| Sweepstakes | 4031 | Game |
| Smoke Test | 5010 | Utility |
| Leaderboard | 5030 | Utility |
| Season Scheduler | 5040 | Admin |
| Display Admin | 5050 | Admin |
| Display Runtime | 5051 | TV App |
| PostgreSQL | 5555 | Database |
| Redis | 6379 | Cache |

## What You'll See

- **Login Page**: User authentication
- **Shell Header**: Navigation, notifications, user menu
- **Lobby**: Online users, available games, challenges
- **Games**: Click any game to open it in an iframe
- **Admin Tools**: Leaderboard, Season Scheduler, Display Admin

## Current Status

✅ Shell with lobby and challenges
✅ Tic-Tac-Toe complete (SSE + HTTP, multi-browser tested)
✅ Dots & Boxes complete
✅ Challenge → game flow integration
✅ Season Scheduler with round-robin generation
✅ Display System (Admin UI + TV Runtime)
⏳ Additional games (Sweepstakes migration, Hangman, Quiz)
