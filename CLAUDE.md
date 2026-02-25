## 🚧 INCOMPLETE WORK - Sweepstakes Knockout

**Status**: Backend complete, frontend UI DOES NOT match LMS Manager design

**What's broken**:
1. **Game creation layout** - Description field presentation is skewed/wrong
2. **Results dropdowns NOT dynamic** - Should only show unassigned positions (1, 2, 3, last)
   - Code has `getAvailablePositions()` function but may not be working
   - As positions are assigned, they should disappear from other dropdowns
3. **Overall layout mismatch** - Width, spacing, button alignment still different from LMS Manager
4. **Games tab structure** - Event cards and expansion behavior needs review

**What works**:
- ✅ Database restructure complete (global player/horse pools)
- ✅ Backend API all working (Setup/Games/Reports tabs)
- ✅ Setup tab: Player Pool and Horse Pool cards functional

**Files modified** (2026-02-25):
- Database: `games/sweepstakes-knockout/database/migrate_to_v2.sql`
- Backend: `games/sweepstakes-knockout/backend/handlers.go` (completely rewritten)
- Frontend: `games/sweepstakes-knockout/frontend/src/App.tsx` (completely rewritten)
- Old files preserved: `handlers_old.go`, `App_old.tsx`

**Resume work**: Compare side-by-side with LMS Manager and fix UI to match exactly

---

## Session Start - Read This First

- Platform: Pi at [192.168.1.29] (was 192.168.1.45 - IP changed after WiFi crash), Mac for editing
- Workflow: Edit on Mac → commit → USER pushes → pull & build on Pi
- Ports: identity-shell: 3001, tic-tac-toe: 4001, dots: 4011, sweepstakes: 4031, last-man-standing: 4021, quiz-player: 4041, spoof: 4051, mobile-test: 4061, leaderboard: 5030, season-scheduler: 5040, smoke-test: 5010, setup-admin: 5020, display-admin: 5050, display-runtime: 5051, game-admin: 5070, quiz-master: 5080, quiz-display: 5081
- Reference implementation: `games/smoke-test/` - COPY THIS when creating new apps
- Active work: **Sweepstakes Knockout restructure INCOMPLETE** - Backend done, frontend UI doesn't match LMS Manager (see below)
- Known issues: SSE presence requires manual refresh after impersonation (acceptable for debugging tool)
- Build: `cd games/{app}/frontend && npm run build && cp -r build/* ../backend/static/`
- PostgreSQL: Port 5555, password "pubgames", user "activityhub", database "activity_hub"

## Session State (2026-02-24)

**Completed today:**
- ✅ Fixed broken shared CSS (Tailwind config: `content: []` → `content: ['./activity-hub-src.css']`)
- ✅ Added missing `.ah-app-header` classes to activity-hub-src.css
- ✅ Migrated 7 apps to standardized ah-app-header layout:
  - setup-admin, game-admin, last-man-standing, sweepstakes, leaderboard, tic-tac-toe, dots
- ✅ All 7 frontends rebuilt on Pi
- ✅ Documented built artifacts workflow in CLAUDE.md to prevent future merge conflicts

**Current state:**
- Shared CSS: 81 classes, properly built and served from identity-shell:3001/shared/
- 7 apps: Have consistent header (title left, lobby button right), game-specific headers preserved below
- Changes committed and pushed to GitHub
- Services running, no restart needed (static file serving)

**Pending work (for next session):**
- 4 apps still need full migration (don't load shared CSS yet):
  - quiz-player, quiz-master, quiz-display, mobile-test
- These need: Add dynamic CSS loading to index.tsx + ah-app-header + convert inline styles to .ah-* classes

**Testing note:**
Hard refresh (Cmd+Shift+R) or private window needed to see header changes due to browser caching.

## ⚠️ CRITICAL: Built Artifacts Workflow

**Problem:** Shared CSS and frontends must be built on Pi (has npm), but Mac is Git lead.

**CORRECT WORKFLOW (Always follow this):**

1. **Mac:** Edit source file → commit → push
2. **Pi:** Pull → build artifact (`npm run build`)
3. **Mac IMMEDIATELY:** SCP built file from Pi → commit → push
4. **Pi:** Discard local changes → pull committed version

**Example for shared CSS:**
```bash
# 1. Mac: Edit lib/activity-hub-common/styles/activity-hub-src.css → commit → push

# 2. Pi: Build
cd ~/pub-games-v3 && git pull
cd lib/activity-hub-common/styles && npm run build

# 3. Mac: Get built file and commit IMMEDIATELY
cd ~/Documents/Projects/pub-games-v3
scp andrew@192.168.1.29:~/pub-games-v3/identity-shell/backend/static/activity-hub.css identity-shell/backend/static/
git add identity-shell/backend/static/activity-hub.css
git commit -m "build: rebuild shared CSS"
git push

# 4. Pi: Discard local build and pull committed version
cd ~/pub-games-v3
git checkout -- identity-shell/backend/static/activity-hub.css
git pull
```

**NEVER DO THIS:**
- ❌ Build on Pi → commit from Pi → push from Pi (breaks "Mac is lead", causes merge conflicts)
- ❌ Build on Pi and forget to commit from Mac (built file out of sync with source)

**Why this matters:** If Pi commits, it creates divergent branches requiring merges. Mac must always be the single source of commits.

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

## ⚠️ CRITICAL: Automated Enforcement (2026)

**All new apps MUST follow standards. Enforcement is automated.**

### 1. App Template Generator (REQUIRED for new apps)

**Use this instead of manual creation**:

```bash
./scripts/create-app.sh my-new-game 4099
```

This automatically creates:
- ✅ Dynamic CSS loading in `index.tsx`
- ✅ Activity Hub classes in `App.tsx`
- ✅ TypeScript configuration
- ✅ URL parameter parsing
- ✅ Backend with activity-hub-common
- ✅ ESLint configuration with Activity Hub rules

**DO NOT create apps manually** - always use the template generator.

### 2. Pre-commit Hooks (INSTALLED)

Hooks are installed in `.git/hooks/pre-commit` and check:

✅ **Dynamic CSS loading** in `index.tsx` files (ERROR - blocks commit)
✅ **Hardcoded colors** in inline styles (WARNING - allows commit)
✅ **Excessive inline styles** (WARNING - allows commit)
✅ **`.js/.jsx` files** in `frontend/src` (ERROR - blocks commit)

If commit blocked:
```bash
# Fix the issues, then commit again
# To bypass (NOT recommended):
git commit --no-verify
```

### 3. ESLint Plugin (REQUIRED in all apps)

Install in each app's frontend:

```bash
cd games/{app}/frontend
npm install --save-dev file:../../../lib/eslint-plugin-activity-hub
```

Add to `.eslintrc.js`:
```javascript
module.exports = {
  extends: ['react-app', 'plugin:activity-hub/recommended'],
};
```

Run linter:
```bash
npm run lint
```

Rules enforced:
- `require-shared-css` (ERROR) - Missing Activity Hub CSS loading
- `no-hardcoded-colors` (WARNING) - Hex/RGB colors in code
- `prefer-ah-classes` (WARNING) - Suggests Activity Hub classes for common patterns

### 4. Shared CSS Expansion (2026)

New classes added for common game patterns:

**Game Boards**:
- `.ah-game-board`, `.ah-game-board--3x3`, `.ah-game-board--4x4`
- `.ah-game-cell`, `.ah-game-cell.disabled`, `.ah-game-cell.active`

**Loading**:
- `.ah-spinner`, `.ah-spinner--small`, `.ah-spinner--large`
- `.ah-loading-container`, `.ah-loading-text`
- `.ah-skeleton`, `.ah-skeleton--text`, `.ah-skeleton--title`

**Modals**:
- `.ah-modal-overlay`, `.ah-modal`, `.ah-modal--small`, `.ah-modal--large`
- `.ah-modal-header`, `.ah-modal-title`, `.ah-modal-close`
- `.ah-modal-body`, `.ah-modal-footer`

**Status Indicators**:
- `.ah-status`, `.ah-status--active`, `.ah-status--waiting`, etc.
- `.ah-player`, `.ah-player--current`, `.ah-player--opponent`
- `.ah-status-dot`, `.ah-status-dot--online`, etc.

**Animations**:
- `.ah-pulse`, `.ah-fade-in`, `.ah-slide-down`, `.ah-box-complete`

See `docs/STYLE-GUIDE.md` for complete class reference.

### 5. Migration Guide

For existing apps not following standards, see:
- **Migration documentation**: `docs/MIGRATION-TO-ACTIVITY-HUB-CSS.md`
- **Example migration**: `games/tic-tac-toe/` (recently migrated)
- **Reference app**: `games/smoke-test/`

**Apps needing migration** (as of 2026):
- dots, mobile-test, spoof, quiz-player, quiz-master, quiz-display
- display-admin, display-runtime, season-scheduler

### 6. Building Shared CSS

After modifying `lib/activity-hub-common/styles/activity-hub-src.css`:

```bash
# On Pi - rebuild the CSS
bash ~/pub-games-v3/scripts/build-shared-css.sh

# Commit the updated file
git add identity-shell/backend/static/activity-hub.css
git commit -m "Update shared Activity Hub CSS"
```

The built CSS file MUST be committed to the repository.

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

## Future Requirements

### User Font Size Settings (Accessibility)

**Goal**: Allow users to adjust font size across all apps (Small/Medium/Large)

**Implementation approach:**
1. **Database**: Add `font_scale DECIMAL(3,2) DEFAULT 1.00` to `user_app_preferences` table
   - Values: 0.85 (small), 1.00 (medium), 1.15 (large)

2. **Identity Shell**: Add font size selector to Settings modal
   ```tsx
   <select value={fontSize}>
     <option value="0.85">Small</option>
     <option value="1.00">Medium</option>
     <option value="1.15">Large</option>
   </select>
   ```

3. **Delivery to Apps**: Pass via URL parameter
   - Identity shell already passes `userId`, `userName`, `token`
   - Add `fontSize` to query string: `?fontSize=1.15`

4. **Application in Apps**: Use CSS custom properties
   - Update `activity-hub.css` to use `--font-scale` variable
   - Each app reads `fontSize` from URL and sets:
     ```tsx
     const fontSize = params.get('fontSize') || '1.0';
     document.documentElement.style.setProperty('--font-scale', fontSize);
     ```

5. **CSS Pattern**:
   ```css
   :root {
     --font-scale: 1.0;
   }
   .ah-meta { font-size: calc(14px * var(--font-scale)); }
   .ah-btn-primary { font-size: calc(15px * var(--font-scale)); }
   /* etc. */
   ```

**Effort estimate**: 1-2 hours to implement across all apps

**Benefits**:
- Accessibility compliance
- Better user experience for varying eyesight
- Platform-wide consistency
- No per-app rebuilds needed (CSS updates only)

### UI Consistency Audit & Drift Prevention

**Goal**: Ensure visual consistency across all apps and prevent future drift through enforcement mechanisms

**Current Issue**: 10 of 17 apps don't follow modern Activity Hub CSS patterns - using inline styles, custom CSS, or missing shared CSS loading entirely

**Plan**: `.claude/plans/validated-nibbling-salamander.md` (22-26 hours total)

**Approach:**
1. **Enforcement First** (6-8 hours)
   - ESLint plugin to catch style violations
   - App template generator for new apps
   - Pre-commit hooks to block non-conforming code
   - No cloud CI/CD (future: on-prem pipeline on Pi)

2. **Expand Shared CSS** (6-8 hours)
   - Game board/grid utilities
   - Loading spinners & animations
   - Modal/dialog components
   - Status indicators for games
   - Reduce need for custom CSS per-app

3. **Migrate Apps** (10 hours)
   - tic-tac-toe, dots: Add shared CSS loading, convert to .ah-* classes
   - mobile-test: Replace inline styles with classes
   - spoof: Migrate dark theme to Activity Hub light theme
   - quiz-player/master/display: Add shared CSS loading
   - display-admin/runtime: Add shared CSS loading

**Key Decisions:**
- Spoof dark theme will be migrated to light (consistency over customization)
- Mobile-test inline styles will be replaced with .ah-* classes
- Enforcement mechanisms prioritized over migration (prevent new drift first)
- On-prem CI/CD pipeline deferred to future (no cloud costs)

**Benefits**:
- Visual consistency across all apps
- Automated enforcement prevents drift
- Faster new app creation via template
- Single source of truth for styling
- Reduced maintenance burden

**Future Enhancement**: On-prem CI/CD pipeline (Jenkins/Drone/custom) on Pi for automated testing without cloud dependency

### Mobile Test - Faster Timeout Handling ✅ COMPLETED

**Issue**: Mobile test steps currently take too long to timeout and fail when network/services are down

**Goal**: Reduce timeout duration so failures are detected quickly

**Current behavior**:
- Tests may hang indefinitely or take 30+ seconds to fail
- Poor user experience when something is wrong
- Unclear whether test is running or stuck

**Required changes**:

1. **HTTP requests**: Add timeout to fetch calls
   ```tsx
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

   const response = await fetch('/api/ping', {
     signal: controller.signal
   });
   clearTimeout(timeoutId);
   ```

2. **SSE connection**: Add connection timeout
   ```tsx
   const eventSource = new EventSource('/api/test-sse');
   const timeout = setTimeout(() => {
     if (messagesReceived === 0) {
       eventSource.close();
       setStepStatus('fail');
     }
   }, 10000); // 10 seconds for SSE to connect and send first message
   ```

3. **Image loading**: Already has timeout via Image.onload, but ensure it's reasonable
   ```tsx
   const timeout = setTimeout(() => {
     img.src = ''; // Cancel load
     setStepStatus('fail');
   }, 8000); // 8 seconds for image
   ```

4. **Audio playback**: Add timeout for play() promise
   ```tsx
   const playPromise = audio.play();
   const timeout = setTimeout(() => {
     audio.pause();
     setStepStatus('fail');
   }, 5000);
   ```

**Recommended timeouts**:
- HTTP ping: 5 seconds
- SSE connection: 10 seconds (needs time for handshake)
- Image load: 8 seconds
- Audio playback: 5 seconds

**Implementation location**: `games/mobile-test/frontend/src/App.tsx`

**Effort estimate**: 30 minutes

### Automated Testing & CI/CD Pipeline

**Goal**: Implement automated tests and continuous integration/deployment pipeline

**Current state**:
- No automated tests
- Manual testing on Pi after deployment
- No build validation before merge
- Manual deployment process

**Required implementation**:

#### 1. Unit Tests

**Backend (Go)**:
```bash
# games/{app}/backend/*_test.go
go test ./...
```
- Handler tests (mock HTTP requests)
- Business logic tests
- Database query tests (using test database)
- Redis interaction tests (using miniredis)

**Frontend (TypeScript/React)**:
```bash
# games/{app}/frontend/src/**/*.test.tsx
npm test
```
- Component rendering tests (React Testing Library)
- Hook tests
- Utility function tests

**Coverage targets**: 70%+ for critical paths

#### 2. Integration Tests

**API endpoint tests**:
```bash
# scripts/test/integration/
./test_identity_shell.sh
./test_smoke_test.sh
# etc.
```
- Authentication flow (login, token validation)
- Protected endpoints (with valid/invalid tokens)
- Database operations (CRUD)
- SSE connection establishment

**Database migration tests**:
- Apply migrations to test database
- Verify schema correctness
- Test rollback scenarios

#### 3. End-to-End Tests (Optional, Phase 2)

**Browser automation** (Playwright/Cypress):
- User login flow
- Game creation and play
- Real-time updates (SSE)
- Multi-user scenarios

**Complexity**: High - requires running full stack

#### 4. CI/CD Pipeline (GitHub Actions)

**File**: `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  # Phase 1: Build validation
  validate-builds:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [identity-shell, smoke-test, tic-tac-toe, dots, ...]
    steps:
      - uses: actions/checkout@v3

      # Backend
      - uses: actions/setup-go@v4
        with:
          go-version: '1.25'
      - name: Build backend
        run: |
          cd games/${{ matrix.app }}/backend
          go mod download
          go build -v ./...

      # Frontend
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Build frontend
        run: |
          cd games/${{ matrix.app }}/frontend
          npm ci
          npm run build

  # Phase 2: Unit tests
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: pubgames
          POSTGRES_USER: activityhub
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5555:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.25'
      - name: Run backend tests
        run: |
          for app in games/*/backend; do
            cd $app && go test -v ./... || exit 1
            cd ../../..
          done
        env:
          DB_HOST: localhost
          DB_PORT: 5555
          DB_USER: activityhub
          DB_PASS: pubgames
          REDIS_HOST: localhost
          REDIS_PORT: 6379

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Run frontend tests
        run: |
          for app in games/*/frontend; do
            cd $app
            npm ci
            npm test -- --coverage --watchAll=false || exit 1
            cd ../../..
          done

  # Phase 3: Integration tests (future)
  integration-tests:
    runs-on: ubuntu-latest
    # ... full stack setup ...

  # Phase 4: Deploy to Pi (on main branch only)
  deploy:
    runs-on: ubuntu-latest
    needs: [validate-builds, test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Pi
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PI_HOST }}
          username: ${{ secrets.PI_USERNAME }}
          key: ${{ secrets.PI_SSH_KEY }}
          script: |
            cd ~/pub-games-v3
            git pull
            ./scripts/deploy_all.sh
```

#### 5. Test Infrastructure

**New scripts needed**:
```bash
scripts/
├── test/
│   ├── setup_test_db.sh       # Create test databases
│   ├── teardown_test_db.sh    # Clean up after tests
│   ├── run_all_tests.sh       # Run full test suite locally
│   └── integration/
│       ├── test_auth.sh
│       ├── test_smoke_test.sh
│       └── ...
└── deploy_all.sh               # Automated deployment script
```

**Test database pattern**:
```bash
# Setup
psql -U activityhub -h localhost -p 5555 -d postgres \
  -c "CREATE DATABASE test_activity_hub;"
psql -U activityhub -h localhost -p 5555 -d test_activity_hub \
  -f identity-shell/backend/schema.sql

# Run tests with test DB
export DB_NAME=test_activity_hub
go test ./...

# Teardown
psql -U activityhub -h localhost -p 5555 -d postgres \
  -c "DROP DATABASE test_activity_hub;"
```

#### 6. Implementation Phases

**Phase 1 (Essential - 8 hours)**:
- [ ] Add Go unit tests for critical backend handlers
- [ ] Add React unit tests for key components
- [ ] Create GitHub Actions workflow for build validation
- [ ] PR checks: builds must pass before merge

**Phase 2 (Recommended - 8 hours)**:
- [ ] Integration test scripts for API endpoints
- [ ] Automated test database setup/teardown
- [ ] GitHub Actions: run tests on PR
- [ ] Test coverage reporting

**Phase 3 (Advanced - 16 hours)**:
- [ ] E2E tests with Playwright
- [ ] Automated deployment on main branch push
- [ ] Deployment rollback capability
- [ ] Test environment on separate Pi or Docker

**Phase 4 (Polish - 4 hours)**:
- [ ] Test coverage badges in README
- [ ] Slack/email notifications on build failures
- [ ] Automated dependency updates (Dependabot)
- [ ] Performance regression tests

**Total effort estimate**: 36+ hours (phased approach recommended)

**Benefits**:
- Catch bugs before deployment
- Confidence in refactoring
- Prevent breaking changes
- Faster development cycles
- Documentation through tests
- Reduced manual testing burden

**Challenges specific to this project**:
- Mac dev environment vs Pi production
- Multiple independent services to test
- Real-time features (SSE) harder to test
- Database dependencies (PostgreSQL, Redis)

**Recommended starting point**:
1. Add tests to smoke-test as reference
2. GitHub Actions for build validation only
3. Gradually add tests to other apps
4. Expand to integration tests when needed

### LMS Manager - Advanced Editor

**Goal**: Allow managers to edit past rounds after they've been closed to correct mistakes

**Current limitation**:
- Once a round is closed, results are locked
- Cannot change results if entered incorrectly
- Cannot un-eliminate players who were eliminated by mistake
- Cannot edit picks that were saved incorrectly
- Only option is to delete entire game and start over

**Required features**:

1. **Reopen Closed Rounds**
   - Add "Reopen Round" button on closed rounds (already exists)
   - When reopened, round status changes back to 'open'
   - Previously eliminated players in that round become active again
   - Manager can edit results and picks
   - Re-close when corrections are complete

2. **Edit Results After Closing**
   - View closed round results in edit mode
   - Change win/loss/draw/postponed for any team
   - Automatically recalculate eliminations based on new results
   - Show audit trail of changes (who, what, when)

3. **Edit Player Picks**
   - View all picks for a round (even after closed)
   - Change team selections for individual players
   - Mark picks as manager-modified (for transparency)
   - Prevent changes that would break game logic (e.g., team already used)

4. **Manual Elimination Override**
   - Add/remove players from elimination list
   - Override automatic elimination logic
   - Useful for special circumstances (late submission, technical issues)
   - Requires confirmation to prevent accidents

5. **Round History Viewer**
   - View complete timeline of all changes to a round
   - Show original values vs current values
   - Who made the change and when
   - Export audit log for record keeping

**Implementation approach**:

1. **Database changes**:
   ```sql
   -- Add audit table
   CREATE TABLE managed_round_edits (
     id SERIAL PRIMARY KEY,
     round_id INTEGER REFERENCES managed_rounds(id),
     manager_email TEXT NOT NULL,
     action TEXT NOT NULL, -- 'reopen', 'edit_result', 'edit_pick', 'manual_eliminate'
     target_player TEXT,
     target_team TEXT,
     old_value TEXT,
     new_value TEXT,
     timestamp TIMESTAMP DEFAULT NOW()
   );
   ```

2. **Backend endpoints**:
   ```
   POST /api/rounds/{roundId}/reopen (already exists)
   PUT  /api/rounds/{roundId}/results/{pickId}  -- Edit single result
   PUT  /api/rounds/{roundId}/picks/{pickId}    -- Edit single pick
   POST /api/rounds/{roundId}/override-elimination  -- Manual elimination
   GET  /api/rounds/{roundId}/audit  -- Get edit history
   ```

3. **Frontend UI**:
   - "Edit Round" button on closed rounds (next to reopen)
   - Modal or inline editor for results
   - Confirmation dialogs for destructive changes
   - Audit log viewer at bottom of round display

4. **Validation rules**:
   - Cannot edit rounds from completed games
   - Cannot select teams already used by player in previous rounds
   - Cannot eliminate all remaining players (must leave at least one)
   - Changes must maintain game integrity

**Use cases**:
- Manager enters wrong result (clicked Loss instead of Win)
- Player appeals elimination due to postponed match handling
- Technical glitch causes incorrect auto-assignment
- Late pick submission that should have been accepted
- Referee decision changed after round closed

**Effort estimate**: 12-16 hours

**Benefits**:
- Mistakes can be corrected without restarting entire game
- Increased flexibility for edge cases
- Better user experience for managers
- Complete audit trail for transparency
- Maintains data integrity

**Risks to mitigate**:
- Ensure changes maintain game integrity (no orphaned data)
- Prevent cascading eliminations when changing old rounds
- Clear UI to show which data has been edited vs original
- Confirmation dialogs to prevent accidental changes

### Managed Game Modes (Sweepstakes & LMS)

**Goal**: Create administrator-managed versions of Sweepstakes and Last Man Standing that don't require player participation

**Current behavior**:
- **Sweepstakes**: Players pick blind box entries, admin manages competitions
- **LMS**: Players join games and make weekly team picks, admin manages rounds/results
- Both require active player engagement

**New requirement**: "Managed" modes where admin maintains everything without players

**Use cases**:
- Office sweepstakes where admin draws on behalf of participants
- LMS where admin tracks picks manually (e.g., pub quiz format)
- Private games where participation is tracked offline
- Historical record keeping

#### Implementation Approach

**1. New Role**: `game_manager`

```sql
-- Add to activity_hub.users roles array
UPDATE users SET roles = array_append(roles, 'game_manager')
WHERE email = 'manager@example.com';
```

**Role comparison**:
- `game_admin`: Technical setup (create games, upload fixtures, set results)
- `game_manager`: Operational management (make picks for players, assign entries, manual tracking)
- Can have both roles, or `game_manager` only for non-technical admins

**2. New Apps/Modes**

**Option A - Separate Apps** (Recommended):
```
sweepstakes-managed (Port 4032)
last-man-standing-managed (Port 4022)
```
- Dedicated apps with `game_manager` role requirement
- Different UI optimized for admin workflow
- Shares database with player versions
- Cleaner separation of concerns

**Option B - Toggle in Existing Apps**:
- Add "Managed Mode" toggle in game-admin
- Different view when managing on behalf of players
- More compact but could become cluttered

**3. Sweepstakes Managed Features**

**Admin capabilities**:
- View all available entries for a competition
- Assign entries to participants (without them picking)
- Bulk import assignments from CSV
- Manual draw assignment (random or specified)
- Override/swap entries after assignment
- Export current assignments
- Track which entries are taken vs available

**UI design**:
```
Sweepstakes Manager
├── Competitions (list/select)
├── Assignments Tab
│   ├── Participant list with assigned entries
│   ├── Quick assign (random available entry)
│   ├── Manual assign (select from dropdown)
│   └── Bulk actions (CSV import, clear all)
└── Available Pool
    ├── Show unassigned entries
    └── Entry search/filter
```

**Database changes**:
```sql
-- Add managed_by column to track admin-assigned picks
ALTER TABLE draws ADD COLUMN managed_by VARCHAR(255);
-- NULL = player picked, email = admin assigned

-- New table for bulk operations tracking
CREATE TABLE assignment_batches (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id),
  manager_email VARCHAR(255),
  assigned_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**4. LMS Managed Features**

**Admin capabilities**:
- View all active players in a game
- Make team picks on behalf of players
- Bulk pick assignment (CSV: player, round, team)
- Override/change picks before round closes
- Mark players as inactive (auto-byes)
- Manual elimination (e.g., late submission)
- Export picks for record keeping

**UI design**:
```
LMS Manager
├── Games (list/select)
├── Current Round
│   ├── Player list with pick status
│   ├── Quick pick (for players who haven't picked)
│   ├── Bulk import (CSV)
│   └── Override existing picks
├── Round History
│   ├── View all picks per round
│   └── Edit past picks (with audit trail)
└── Player Management
    ├── Add/remove players
    ├── Mark inactive
    └── View pick history
```

**Database changes**:
```sql
-- Add managed_by column
ALTER TABLE predictions ADD COLUMN managed_by VARCHAR(255);
-- NULL = player picked, email = admin assigned

-- New table for manager actions audit
CREATE TABLE manager_actions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  round_id INTEGER REFERENCES rounds(id),
  manager_email VARCHAR(255),
  player_email VARCHAR(255),
  action VARCHAR(50), -- 'assign_pick', 'override_pick', 'eliminate', 'mark_inactive'
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**5. Common Features (Both Games)**

**Audit trail**:
- Log all admin actions (who, what, when)
- Visible in manager UI
- Cannot be deleted (append-only)

**Permissions**:
- `game_manager` role required
- Read-only mode if user only has `super_user`
- `game_admin` can access but separate permissions

**API endpoints pattern**:
```
POST /api/sweepstakes/manage/{competitionId}/assign
POST /api/sweepstakes/manage/{competitionId}/bulk-assign
GET  /api/sweepstakes/manage/{competitionId}/assignments

POST /api/lms/manage/{gameId}/pick
POST /api/lms/manage/{gameId}/bulk-picks
GET  /api/lms/manage/{gameId}/picks/{roundId}
```

**6. Implementation Effort**

**Phase 1 - Sweepstakes Managed** (12 hours):
- [ ] Create new role `game_manager`
- [ ] Database migrations (managed_by columns, audit tables)
- [ ] New backend endpoints for assignment operations
- [ ] Manager UI (React app)
- [ ] CSV import/export functionality
- [ ] Basic audit logging

**Phase 2 - LMS Managed** (12 hours):
- [ ] Database migrations
- [ ] Manager endpoints
- [ ] Manager UI
- [ ] Bulk pick operations
- [ ] Player inactive status handling

**Phase 3 - Polish** (4 hours):
- [ ] Comprehensive audit trail UI
- [ ] Advanced filtering/search
- [ ] Undo/rollback capability
- [ ] Manager activity reports

**Total effort**: ~28 hours

**7. Benefits**

- Enable offline/manual game management
- Support non-technical game managers
- Flexibility for different participation models
- Complete audit trail for transparency
- Maintain all historical data in same database
- Can transition games between player-run and managed modes

**8. Migration Path**

Existing games can switch to managed mode:
```sql
-- Mark entire game as managed
UPDATE games SET managed_mode = TRUE WHERE id = X;

-- Or mark individual rounds as managed
UPDATE rounds SET managed_mode = TRUE WHERE id = Y;
```

Players can still view their assignments/picks (read-only) even in managed mode.

**9. Open Questions**

- Should managed games appear in player apps at all? (Read-only view vs hidden)
- Can a game switch between managed/player modes mid-season?
- Should managers be able to make picks while round is "open" for players? (hybrid mode)
- Email notifications when admin assigns on behalf of player?

---

### Future Game Ideas

**Hangman** (2-player, real-time)
- Classic word-guessing game
- One player picks word, other player guesses
- SSE + HTTP pattern (same as tic-tac-toe/dots)
- Letter selection UI
- Visual hangman progression
- Word categories/difficulty options
- Estimated effort: 8-12 hours

**Shut the Box** (solo or multiplayer)
- Classic dice game
- Roll dice, flip down numbered tiles (1-9)
- Goal: shut all tiles or achieve lowest score
- Simple UI with satisfying tile flip animation
- Estimated effort: 6-10 hours

**Battleships** (2-player, turn-based)
- Classic grid guessing game
- Place ships on hidden grid
- Take turns firing at opponent's grid
- SSE + HTTP pattern (same as tic-tac-toe)
- Classic 10x10 grid
- Estimated effort: 12-16 hours

---

### Infrastructure Improvements

**Challenge System Enhancements:**
- Challenge rejection handling - notify challenger when challenge is declined
- Offline user handling - pre-filter or grey out offline users in challenge list
- Challenge history - view past challenges, win/loss records

**Authentication & User Management:**
- Proper user registration (currently demo-token only)
  - Signup flow with email validation
  - Password requirements and strength indicator
  - User profile management (display name, avatar)
- Session management improvements
  - Session expiration
  - "Remember me" functionality
  - Logout all devices
- OAuth/SSO integration (Google, Discord, GitHub)

**Mobile & UI:**
- Mobile web UI optimization
  - Touch-friendly challenge buttons
  - Responsive lobby layout
  - Mobile toast positioning
  - Swipe gestures for challenge management
- Accessibility improvements
  - Keyboard navigation for challenges
  - Screen reader support
  - ARIA labels for interactive elements
  - Focus management

**Security & Deployment:**
- PostgreSQL security review
  - Review password strength ("pubgames" is weak)
  - Consider per-app database users with limited permissions
  - Review SSL/TLS configuration (currently sslmode=disable)
  - Audit connection string security (currently in code/env vars)
  - Consider row-level security policies
  - Review backup strategy
- SSL/HTTPS support
  - Secure connections for all services
  - Let's Encrypt certificate automation
  - Reverse proxy configuration (nginx/caddy)
- Error recovery improvements
  - Resume game state after disconnect
  - Offline queue for actions
  - Better handling of network transitions
- Performance optimization
  - Redis connection pooling
  - Database query optimization
  - Frontend bundle size reduction
  - Lazy loading for games

**Federation (Long-term):**
- Central Hub Service
  - Cloud-hosted central hub for multiple pubs
  - Cross-pub game challenges and leaderboards
  - Content distribution (quiz packs, sweepstake templates, fixtures)
  - Pi instances connect as clients
  - Pubs still work offline for local play
  - Subscription/licensing model potential

**Native Mobile Apps:**
- iOS and Android App Exploration
  - Lightweight native apps (React Native or Capacitor)
  - Online-only architecture (no offline functionality)
  - Resource downloads for native look and feel
  - Native UI components where beneficial
  - Deep linking to games and challenges
  - Push notifications for challenges
  - Code sharing strategy with web version

---

### Utility Apps

**Flip a Coin** (simple utility)
- Static app, no real-time needed
- Simple heads/tails result with animation
- History of recent flips (optional)
- Estimated effort: 2-3 hours

**Killer Draw** (pub game manager)
- Static app, single player manages game
- Enter player names
- Randomize button assigns numbers/targets
- Configurable lives per player
- Track eliminations during game
- Option to replicate to display screen
- Estimated effort: 6-8 hours

**Darts Scorer** (split input/display architecture)
- All possible scores on one screen (1-20, doubles, triples, bull, outer bull)
- Tap-to-score during live game
- Tracks remaining score per player
- Checkout suggestions when score is reachable
- Common game modes (501, 301, etc.)
- **Split architecture:**
  - Mobile app for input (players tap scores)
  - Display screen for output (pub TV shows live score)
- SSE to sync input app with display
- Multi-player support (2-4 players)
- Estimated effort: 16-20 hours

**Friend System:**
- Add/remove friends
- Friends list in lobby
- Quick challenge friends button
- Friend activity tracking

**User Customization:**
- User status customization (Online, Away, Do Not Disturb)
- Custom status messages
- Show "in game" with game name
- Avatar/profile pictures
