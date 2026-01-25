# Quick Start Guide

## Prerequisites

- Go 1.25+
- Node.js 18+
- PostgreSQL 13+ (running on port 5555)
- Redis 6+ (running on port 6379)

## Running the Identity Shell

### 1. Setup Database

```bash
# Create database and run migrations
cd identity-shell/data
./migrate.sh
```

### 2. Start the Backend

```bash
cd identity-shell/backend
go run *.go
```

Backend starts on **http://localhost:3001**

### 3. Build the Frontend

```bash
cd identity-shell/frontend
npm install
npm run build
```

The backend serves the built frontend automatically.

### 4. Login

- Open http://localhost:3001
- Enter any email address
- Use code: **123456**
- You're in!

## Running Tic-Tac-Toe

### 1. Setup Database

```bash
cd games/tic-tac-toe/database
./setup.sh
```

### 2. Build Frontend

```bash
cd games/tic-tac-toe/frontend
npm install
npm run build
cp -r build/* ../backend/static/
```

### 3. Start Backend

```bash
cd games/tic-tac-toe/backend
go run *.go
```

Tic-Tac-Toe runs on **http://localhost:4001**

## What You'll See

- **Login Page**: Simple authentication
- **Shell Header**: Navigation, notifications, user menu
- **Lobby**: Online users, available games, challenges
- **Games**: Click any game to open it in an iframe

## Architecture

Each app serves frontend + API from a **single port**:

| Service | Port |
|---------|------|
| Identity Shell | 3001 |
| Tic-Tac-Toe | 4001 |
| Smoke Test | 5010 |
| PostgreSQL | 5555 |
| Redis | 6379 |

## Current Status

✅ Shell with lobby and challenges
✅ Tic-Tac-Toe backend and frontend
⏳ Challenge → game flow integration
