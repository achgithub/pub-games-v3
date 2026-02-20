## Session Start - Read This First

- Platform: Pi at [192.168.1.29] (was 192.168.1.45 - IP changed after WiFi crash), Mac for editing
- Workflow: Edit on Mac → commit → USER pushes → pull & build on Pi
- Ports: identity-shell: 3001, tic-tac-toe: 4001, dots: 4011, sweepstakes: 4031, last-man-standing: 4021, quiz-player: 4041, spoof: 4051, mobile-test: 4061, leaderboard: 5030, season-scheduler: 5040, smoke-test: 5010, setup-admin: 5020, display-admin: 5050, display-runtime: 5051, game-admin: 5070, quiz-master: 5080, quiz-display: 5081
- Reference implementation: `games/smoke-test/` - COPY THIS when creating new apps
- Active work: Created smoke-test as definitive reference (PostgreSQL + Redis + SSE + shared CSS)
- Known issues: SSE presence requires manual refresh after impersonation (acceptable for debugging tool)
- Build: `cd games/{app}/frontend && npm run build && cp -r build/* ../backend/static/`
- PostgreSQL: Port 5555, password "pubgames", user "activityhub", database "activity_hub"

## ⚠️ CRITICAL: Reference Implementation

**WHEN CREATING A NEW APP, COPY `games/smoke-test/`**

Smoke-test demonstrates the complete Activity Hub stack:
- ✅ Shared CSS pattern (dynamic load from identity-shell)
- ✅ TypeScript frontend
- ✅ activity-hub-common library for auth
- ✅ PostgreSQL for persistent data
- ✅ Redis for ephemeral state + pub/sub
- ✅ SSE for real-time updates
- ✅ URL parameter parsing (userId, userName, token)
- ✅ Activity Hub CSS classes (.ah-*)

See `games/smoke-test/README.md` for complete documentation.

## ⚠️ CRITICAL: Shared CSS Architecture (DO NOT DEVIATE)

**THE PATTERN - Reference: `games/smoke-test/`**

All apps MUST load Activity Hub CSS from identity-shell. This is NOT optional.

### How It Works

1. **Identity-shell serves CSS** at `http://{host}:3001/shared/activity-hub.css`
   - File: `identity-shell/backend/static/activity-hub.css` (MUST exist in git and on Pi)
   - Route: `r.PathPrefix("/shared/").Handler(http.StripPrefix("/shared/", http.FileServer(http.Dir("./static"))))`
   - CORS enabled for cross-origin loading

2. **Each app loads CSS dynamically** in `index.tsx`:
```typescript
// games/{app}/frontend/src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles from identity-shell
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
```

3. **Minimal App.css** for base styles (optional but recommended):
```css
/* games/{app}/frontend/src/App.css */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: #F5F5F4;
  color: #1C1917;
}
* { box-sizing: border-box; }
```

4. **Use Activity Hub classes** in components:
   - `.ah-container` / `.ah-container--narrow` / `.ah-container--wide`
   - `.ah-card`
   - `.ah-btn-primary` / `.ah-btn-outline` / `.ah-btn-danger` / `.ah-btn-back`
   - `.ah-tabs` / `.ah-tab` / `.ah-tab.active`
   - `.ah-banner` / `.ah-banner--error` / `.ah-banner--warning` / etc.
   - `.ah-input` / `.ah-select`
   - `.ah-lobby-btn`
   - Full reference: `identity-shell/backend/static/activity-hub.css`

### Why This Pattern

- **Single source of truth** - all apps share one CSS file
- **IP-agnostic** - uses `window.location.hostname` (works on any IP/localhost)
- **No duplication** - CSS not bundled into each app
- **Easy updates** - change CSS once, all apps get it

### Troubleshooting

**CSS not loading (404 error)?**
```bash
# On Pi - verify file exists
ls -la ~/pub-games-v3/identity-shell/backend/static/activity-hub.css

# If missing, restore from git
git restore identity-shell/backend/static/activity-hub.css

# Verify it's being served
curl http://localhost:3001/shared/activity-hub.css | head -20
```

**App not styled?**
1. Check browser console for CSS 404 errors
2. Verify `index.tsx` has dynamic CSS loading code
3. Hard refresh browser (Cmd+Shift+R) or use private window
4. Check app was rebuilt after code changes

### DO NOT

- ❌ Bundle Activity Hub CSS into each app
- ❌ Copy CSS file to each app's directory
- ❌ Use different CSS loading patterns per app
- ❌ Create app-specific versions of Activity Hub CSS
- ❌ Use `@import` in CSS files (dynamic script tag only)

## Quiz System Pi Deployment

Run these steps after `git pull` on the Pi:

```bash
# 1. Create and initialise quiz_db
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE quiz_db;"
psql -U activityhub -h localhost -p 5555 -d quiz_db -f games/quiz-player/database/schema.sql

# 2. Update game-admin deps (added redis + pq)
cd ~/pub-games-v3/games/game-admin/backend && go mod tidy

# 3. Resolve deps for new backends
cd ~/pub-games-v3/games/quiz-player/backend  && go mod tidy
cd ~/pub-games-v3/games/quiz-master/backend  && go mod tidy
cd ~/pub-games-v3/games/quiz-display/backend && go mod tidy
cd ~/pub-games-v3/games/mobile-test/backend  && go mod tidy

# 4. Build all frontends (game-admin rebuilds to pick up quiz module)
cd ~/pub-games-v3/games/game-admin/frontend   && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/quiz-player/frontend  && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/quiz-master/frontend  && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/quiz-display/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/mobile-test/frontend  && npm run build && cp -r build/* ../backend/static/

# 5. Register apps in activity_hub
psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_quiz_apps.sql

# 6. Shared uploads directory — create and symlink so all quiz backends
#    read/write the same media files
mkdir -p ~/pub-games-v3/games/game-admin/backend/uploads/quiz/images
mkdir -p ~/pub-games-v3/games/game-admin/backend/uploads/quiz/audios
ln -sfn ~/pub-games-v3/games/game-admin/backend/uploads \
        ~/pub-games-v3/games/quiz-master/backend/uploads
ln -sfn ~/pub-games-v3/games/game-admin/backend/uploads \
        ~/pub-games-v3/games/quiz-display/backend/uploads
ln -sfn ~/pub-games-v3/games/game-admin/backend/uploads \
        ~/pub-games-v3/games/mobile-test/backend/uploads

# 7. Start new services (add to whatever process manager you use)
cd ~/pub-games-v3/games/quiz-player/backend  && go run *.go &
cd ~/pub-games-v3/games/quiz-master/backend  && go run *.go &
cd ~/pub-games-v3/games/quiz-display/backend && go run *.go &
cd ~/pub-games-v3/games/mobile-test/backend  && go run *.go &
```

### Notes
- Port 4051 was already taken by spoof — mobile-test uses **4061**
- game-admin must be running for media uploads to work (it owns the uploads dir)
- quiz-display URL format: `http://pi:5081/?session=JOINCODE` — no auth required
- To grant quiz_master role: `UPDATE users SET roles = array_append(roles, 'quiz_master') WHERE email = 'user@example.com';`
- Test workflow: Game Admin → Quiz → upload media → create questions → create pack → start quiz-master → join with quiz-player

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

- **[ROLES.md](./docs/ROLES.md)** - Role-based access control
  - Admin roles (setup_admin, game_admin)
  - Database schema
  - API responses with roles
  - Frontend role checking
  - Migration guide

- **[APP-REGISTRY.md](./docs/APP-REGISTRY.md)** - Dynamic app registry
  - Database-driven app management
  - Role-based app visibility
  - Admin endpoints for CRUD operations
  - Enable/disable apps dynamically
  - Custom display ordering
  - API documentation

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

## Lessons Learned (Abridged)

### Database Architecture
- **Two-layer system**: Shared `activity_hub` DB (auth) + separate app DBs (data)
- All apps connect to TWO databases: `activity_hub` for users, `{app}_db` for app data
- PostgreSQL location: Centralized server storage (NOT in project folders)
- SQLite vs PostgreSQL: Switched from file-based SQLite to PostgreSQL server

### Environment Configuration
- **PostgreSQL port**: 5555 (not default 5432)
- **PostgreSQL credentials**: user=`activityhub`, password=`pubgames` (not `pubgames123`)
- **Database creation**: `psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE {app}_db;"`
- Must specify `-p 5555` in all psql commands

### Go Development
- **Modules required**: Must have `go.mod` file (Go 1.25+)
- No manual `go get` - use `go mod download` or run directly
- **NULL handling**: Use `sql.NullString` for nullable DB columns, convert to string after scan
- **Import cleanup**: Remove unused imports (Go compiler enforces this)

### Testing Pattern
- Create test scripts with 10 core tests (not 35+ - too many)
- Test authentication with real admin users from database
- Use `jq` for JSON formatting in curl tests
- Save test artifacts (e.g., QR codes) for manual verification

### Common Pitfalls
- ❌ Forgetting to specify PostgreSQL port (5555)
- ❌ Using wrong password (pubgames123 vs pubgames)
- ❌ Scanning NULL database values directly into Go strings
- ❌ Missing `go.mod` file for Go modules
- ❌ Testing with non-existent users (check `activity_hub.users` table first)

### Display Admin Specifics
- **Port**: 5050
- **Database**: `display_admin_db`
- **Token system**: UUID tokens for TV identification
- **QR codes**: Use `github.com/skip2/go-qrcode` library
- **File uploads**: Store in `./uploads/`, serve via `/uploads/` route
- **Admin-only**: All endpoints require admin authentication except token lookup

### Development Workflow Reminder
1. Write code on Mac (Claude Code)
2. Commit to Git on Mac
3. Push when ready (user manually pushes)
4. Pull on Pi: `cd ~/pub-games-v3 && git pull`
5. Build/test on Pi (Go, npm, PostgreSQL run here)
