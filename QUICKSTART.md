# Quick Start Guide

## Prerequisites

- Go 1.25+
- Node.js 18+
- npm or yarn

## Running the Identity Shell Prototype

### 1. Start the Backend

```bash
cd identity-shell/backend
go mod download
go run main.go
```

Backend will start on **http://localhost:3001**

### 2. Start the Frontend

In a new terminal:

```bash
cd identity-shell/frontend
npm install
npm start
```

Frontend will start on **http://localhost:3000**

### 3. Login

- Open http://localhost:3000 in your browser
- Enter any email address
- Use code: **123456**
- You'll be logged into the shell!

## What You'll See

- **Login Page**: Simple authentication
- **Shell Header**: Navigation, notifications (placeholder), user menu
- **Lobby**:
  - Online users (placeholder)
  - Available apps grid (Tic-Tac-Toe, Sweepstakes placeholders)
  - Challenges (placeholder)
- **App Container**: Click any app to see the container (coming soon placeholders)

## Current State (Phase 1 Prototype)

✅ **Working:**
- Basic authentication
- Shell UI with header navigation
- Lobby with app grid
- App routing/container
- TypeScript throughout
- Responsive design

🚧 **Placeholders:**
- Presence tracking
- Challenge system
- Actual games (Tic-Tac-Toe, etc.)
- Real-time updates
- Profile management

## Next Steps

1. Test the shell navigation
2. Review the TypeScript types (`src/types.ts`)
3. Plan Phase 2: Lobby system with presence
4. Build interactive game template
