# Pub Games v3 - Documentation Index

## Quick Start

**Creating a new app?** → Start here: [docs/NEW-APP-GUIDE.md](./docs/NEW-APP-GUIDE.md)

**Reference implementation:** `games/tic-tac-toe/` (check this first for examples)

## Overview

Multi-app platform for pub-based games and activities. Microservices architecture where each mini-app is a standalone service with its own data.

**Core concept:** Identity Shell hosts independent mini-apps via iframe embedding. Each app serves both its API and frontend from a single port.

## Documentation Structure

### Getting Started

- **[NEW-APP-GUIDE.md](./docs/NEW-APP-GUIDE.md)** - Step-by-step guide for creating new apps
  - Directory structure
  - TypeScript setup
  - Frontend/backend skeleton
  - Registration and integration
  - Complete checklist

### System Architecture

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System overview and design
  - Service structure
  - Mini-app architecture
  - App registry system
  - Shell ↔ App communication
  - Port allocation
  - Future federation plans

- **[ARCHITECTURE-DECISIONS.md](./docs/ARCHITECTURE-DECISIONS.md)** - Why we made key choices
  - ADR-001: Single port per app
  - ADR-002: Iframe embedding
  - ADR-003: Dynamic app registry
  - ADR-004: Auto-discovery of challengeable games
  - ADR-005: PostgreSQL + Redis hybrid
  - ADR-006: SSE over WebSocket
  - ADR-007: Local-first federation strategy
  - ADR-008: Dynamic challenge options

### Development Guides

- **[FRONTEND.md](./docs/FRONTEND.md)** - React/TypeScript development
  - TypeScript setup (required)
  - URL parameter handling (critical)
  - Component patterns
  - Styling conventions
  - SSE client implementation
  - API communication
  - Error handling

- **[BACKEND.md](./docs/BACKEND.md)** - Go backend development
  - Server setup
  - API patterns
  - Config endpoint
  - Error handling
  - Logging and debugging
  - Build and deployment

- **[DATABASE.md](./docs/DATABASE.md)** - Data storage patterns
  - PostgreSQL (persistent data)
  - Redis (ephemeral/real-time data)
  - When to use each
  - Common patterns
  - Connection setup
  - Query examples

- **[REALTIME.md](./docs/REALTIME.md)** - Real-time communication
  - SSE + HTTP pattern (preferred)
  - SSE only (broadcasts)
  - Polling/no real-time
  - Implementation examples
  - Redis pub/sub integration
  - Performance tips

## Critical Requirements

### For ALL new apps:

1. **TypeScript required** - ALL React frontends use `.tsx` files, NEVER `.js`
2. **URL parameters required** - Apps MUST read `userId`, `userName`, `gameId` from URL
3. **Registry required** - Apps MUST be registered in `identity-shell/backend/apps.json`
4. **Reference first** - Check `games/tic-tac-toe/` before creating new patterns

### TypeScript checklist:
- ✅ package.json includes: `typescript`, `@types/react`, `@types/react-dom`
- ✅ Entry point: `src/index.tsx` (not .js)
- ✅ Main component: `src/App.tsx` (not .js)
- ✅ Copy `tsconfig.json` from tic-tac-toe
- ✅ Add `src/react-app-env.d.ts`

## Quick Reference

### App structure template

```
games/{app-name}/
├── backend/
│   ├── main.go          # Entry point
│   ├── handlers.go      # HTTP handlers
│   ├── game.go          # Game logic
│   └── static/          # React build output
├── frontend/
│   ├── src/
│   │   ├── index.tsx    # TypeScript entry
│   │   └── App.tsx      # Main component
│   ├── package.json
│   └── tsconfig.json
└── database/
    └── schema.sql       # PostgreSQL schema (if needed)
```

### Common commands (run on Pi)

```bash
# Build frontend
cd games/{app}/frontend && npm run build

# Copy to backend
cp -r build/* ../backend/static/

# Run backend
cd ../backend && go run *.go

# Test
curl http://localhost:4XXX/api/config
```

### Decision matrix

| Need | Solution | Doc Reference |
|------|----------|---------------|
| Create new app | Follow checklist | [NEW-APP-GUIDE.md](./docs/NEW-APP-GUIDE.md) |
| Real-time updates | Use SSE + Redis | [REALTIME.md](./docs/REALTIME.md) |
| Persistent data | PostgreSQL | [DATABASE.md](./docs/DATABASE.md) |
| Ephemeral state | Redis | [DATABASE.md](./docs/DATABASE.md) |
| Turn-based game | SSE + HTTP pattern | [REALTIME.md](./docs/REALTIME.md) |
| Static picks app | No real-time, PostgreSQL only | [DATABASE.md](./docs/DATABASE.md) |
| Frontend styling | Light theme, inline CSS | [FRONTEND.md](./docs/FRONTEND.md) |
| Game options | `/api/config` endpoint | [BACKEND.md](./docs/BACKEND.md) |

## Deployment

- **Mac**: Code editing, Git operations, Claude Code
- **Pi**: Go builds, npm, PostgreSQL, Redis, running services
- **Workflow**: Write on Mac → Commit → Push → Pull on Pi → Build/test

See global `~/.claude/CLAUDE.md` for detailed workflow.

## Getting Help

1. **Check reference implementation:** `games/tic-tac-toe/`
2. **Read relevant doc:** See structure above
3. **Search codebase:** Look for similar patterns in existing apps
4. **Ask specific questions:** Provide context about what you've already tried

## File Organization

```
pub-games-v3/
├── CLAUDE.md (this file)           # Main index
├── docs/                           # All documentation
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE-DECISIONS.md
│   ├── FRONTEND.md
│   ├── BACKEND.md
│   ├── DATABASE.md
│   ├── REALTIME.md
│   └── NEW-APP-GUIDE.md
├── games/
│   ├── tic-tac-toe/               # Reference implementation
│   ├── dots/
│   └── {your-app}/
├── identity-shell/
│   └── backend/
│       └── apps.json              # App registry
└── scripts/
    └── setup_databases.sh         # Database setup
