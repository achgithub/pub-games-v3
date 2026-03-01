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

**Resume work**: Compare side-by-side with LMS Manager and fix UI to match exactly

---

# Pub Games v3 - Project Guide

## Quick Start

**First Time Here?**
- **Reference implementation**: `games/component-library/` - Living style guide showcasing ALL Activity Hub components
- Creating new app: See `docs/NEW-APP-GUIDE.md`
- Platform overview: See `docs/ARCHITECTURE.md`
- Component examples: Access Component Library app (admin-only, port 5010)

**Essential Info:**
- **Platform**: Pi at 192.168.1.29 (server), Mac for editing
- **Workflow**: Edit on Mac → commit → USER pushes → pull & build on Pi
- **PostgreSQL**: Port 5555, user "activityhub", password "pubgames"
- **Build command**: `cd games/{app}/frontend && npm run build && cp -r build/* ../backend/static/`

**Port Allocation:**
- Identity Shell: 3001
- Games (4xxx): tic-tac-toe: 4001, dots: 4011, sweepstakes: 4031, lms: 4021, quiz-player: 4041, spoof: 4051, mobile-test: 4061
- Admin/Support (5xxx): component-library: 5010, setup-admin: 5020, leaderboard: 5030, display-admin: 5050, display-runtime: 5051, game-admin: 5070, quiz-master: 5080, quiz-display: 5081

**Known Issues:**
- SSE presence requires manual refresh after impersonation (acceptable for debugging tool)
- 4 apps need CSS migration: quiz-player, quiz-master, quiz-display, mobile-test

---

## Documentation Index

All detailed documentation lives in `docs/`:

### Getting Started
- **[NEW-APP-GUIDE.md](./docs/NEW-APP-GUIDE.md)** - Step-by-step guide for creating new apps
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment procedures and workflows

### Architecture & Design
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System overview and design patterns
- **[ARCHITECTURE-DECISIONS.md](./docs/ARCHITECTURE-DECISIONS.md)** - Key architectural decisions (ADRs)

### Development Guides
- **[FRONTEND.md](./docs/FRONTEND.md)** - React/TypeScript development patterns
- **[BACKEND.md](./docs/BACKEND.md)** - Go backend development patterns
- **[DATABASE.md](./docs/DATABASE.md)** - PostgreSQL and Redis usage patterns
- **[REALTIME.md](./docs/REALTIME.md)** - SSE and real-time communication

### Project Management
- **[ROLES.md](./docs/ROLES.md)** - Role-based access control system
- **[APP-REGISTRY.md](./docs/APP-REGISTRY.md)** - Dynamic app registry system
- **[LESSONS-LEARNED.md](./docs/LESSONS-LEARNED.md)** - Important lessons from development
- **[ROADMAP.md](./docs/ROADMAP.md)** - Future features and planned work

### Overview

Multi-app platform for pub-based games and activities. Microservices architecture where each mini-app is a standalone service with its own data.

**Core concept**: Identity Shell hosts independent mini-apps via iframe embedding. Each app serves both its API and frontend from a single port.

---

## ⚠️ CRITICAL: Reference Implementation

**Component Library (`games/component-library/`) is THE definitive reference**

Component Library is a living style guide that showcases:
- ✅ **ALL Activity Hub CSS classes** with live examples
- ✅ **Zero app-specific CSS** - uses ONLY shared CSS
- ✅ **Zero inline styles** - everything uses `.ah-*` classes
- ✅ **TypeScript throughout** - no .js files
- ✅ **Dynamic CSS loading** from identity-shell
- ✅ **Copy-paste code snippets** for every component
- ✅ **Interactive demo** - tests PostgreSQL + Redis + SSE
- ✅ **Admin-only access** via role-based auth

**Access**: Port 5010 (requires `admin` role)

**Purpose**:
- Living documentation for all UI components
- Reference for correct patterns
- Proof that complex UIs work with shared CSS only
- Source of truth for component usage

See `games/component-library/README.md` for complete documentation.

---

## ⚠️ CRITICAL: Shared CSS Architecture

**THE PATTERN - All apps MUST load Activity Hub CSS from identity-shell**

### How It Works

1. **Identity-shell serves CSS** at `http://{host}:3001/shared/activity-hub.css`
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

3. **Use Activity Hub classes** in components:
   - `.ah-container` / `.ah-container--narrow` / `.ah-container--wide`
   - `.ah-card`
   - `.ah-btn-primary` / `.ah-btn-outline` / `.ah-btn-danger`
   - `.ah-tabs` / `.ah-tab` / `.ah-tab.active`
   - `.ah-banner` / `.ah-banner--error` / `.ah-banner--success`
   - **Full reference with live examples**: Component Library app (port 5010)
   - **CSS source**: `lib/activity-hub-common/styles/activity-hub-src.css`
   - **Compiled CSS**: `identity-shell/backend/static/activity-hub.css`

### Why This Pattern

- **Single source of truth** - all apps share one CSS file
- **IP-agnostic** - uses `window.location.hostname`
- **No duplication** - CSS not bundled into each app
- **Easy updates** - change CSS once, all apps get it

### Troubleshooting

**CSS not loading?**
```bash
# Verify file exists
ls -la ~/pub-games-v3/identity-shell/backend/static/activity-hub.css

# Verify it's being served
curl http://localhost:3001/shared/activity-hub.css | head -20
```

**App not styled?**
1. Check browser console for CSS 404 errors
2. Verify `index.tsx` has dynamic CSS loading code
3. Hard refresh browser (Cmd+Shift+R)
4. Check app was rebuilt after code changes

---

## ⚠️ CRITICAL: Component Library (Living Style Guide)

**Component Library is THE reference for all UI development**

**Access**: `http://192.168.1.29:5010/?userId=X&userName=Admin&token=XXX` (admin role required)

### What It Provides

1. **Live Examples**: Every Activity Hub CSS class with working demos
2. **Code Snippets**: Copy-paste ready code for each component
3. **Interactive Demo**: Tests full stack (PostgreSQL + Redis + SSE)
4. **Proof of Concept**: Shows complex UIs work with shared CSS only

### Component Categories (12 Tabs)

1. **Interactive Demo** - Tests DB/Redis/SSE integration
2. **Layout & Structure** - Containers, flexbox utilities
3. **Buttons** - All button variants with states
4. **Forms** - Inputs, selects, inline forms
5. **Navigation** - Tabs, app headers
6. **Cards & Banners** - Content surfaces and notifications
7. **Data Display** - Tables, lists, grids
8. **Status & Feedback** - Status indicators, badges
9. **Loading States** - Spinners, skeletons, animations
10. **Modals** - Modal dialogs with size variants
11. **Game Components** - Game boards (3×3, 4×4, 5×5, 6×6)
12. **Common Patterns** - Reusable component combinations

### Why It Matters

- **Zero app-specific CSS** - Proves shared CSS pattern works
- **Zero inline styles** - Every example uses `.ah-*` classes
- **Zero violations** - Passes all pre-commit checks
- **Single source of truth** - Developers copy from here, not from random apps

**When building UIs**: Check Component Library first. If a component exists, use it. If not, add it to shared CSS.

---

## ⚠️ CRITICAL: Automated Enforcement

**All new apps MUST follow standards. Enforcement is automated.**

### 1. App Template Generator

**Use this instead of manual creation**:

```bash
./scripts/create-app.sh my-new-game 4099
```

This automatically creates correct patterns for:
- Dynamic CSS loading
- Activity Hub classes
- TypeScript configuration
- URL parameter parsing
- Backend with activity-hub-common
- ESLint configuration

### 2. Pre-commit Hooks (STRICT ENFORCEMENT)

Installed in `.git/hooks/pre-commit` - **ZERO TOLERANCE** for violations:

**ERRORS (block commit)**:
- ❌ App-specific CSS files in `games/*/frontend/` (NO EXCEPTIONS)
- ❌ CSS imports in TypeScript files (`import './App.css'`)
- ❌ Missing Activity Hub CSS loading in `index.tsx`
- ❌ `.js/.jsx` files in `frontend/src` (must be `.tsx`)
- ❌ `localhost` in SQL migration URLs (use `{host}` placeholder)

**WARNINGS (allowed but discouraged)**:
- ⚠️  Hardcoded colors in inline styles
- ⚠️  Excessive inline styles (> 3 declarations)

**Setup**:
```bash
./scripts/setup-git-hooks.sh
```

**If you need new styles**: Add them to `lib/activity-hub-common/styles/activity-hub-src.css`, NOT to app-specific CSS files.

### 3. ESLint Plugin

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

---

## ⚠️ CRITICAL: Built Artifacts Workflow

**Problem**: Shared CSS and frontends must be built on Pi (has npm), but Mac is Git lead.

**CORRECT WORKFLOW**:

1. **Mac**: Edit source file → commit → push
2. **Pi**: Pull → build artifact
3. **Mac IMMEDIATELY**: SCP built file from Pi → commit → push
4. **Pi**: Discard local changes → pull committed version

**Example**:
```bash
# 1. Mac: Edit activity-hub-src.css → commit → push

# 2. Pi: Build
cd ~/pub-games-v3 && git pull
cd lib/activity-hub-common/styles && npm run build

# 3. Mac: SCP and commit IMMEDIATELY
scp andrew@192.168.1.29:~/pub-games-v3/identity-shell/backend/static/activity-hub.css identity-shell/backend/static/
git add identity-shell/backend/static/activity-hub.css
git commit -m "build: rebuild shared CSS"
git push

# 4. Pi: Discard and pull
cd ~/pub-games-v3
git checkout -- identity-shell/backend/static/activity-hub.css
git pull
```

**Why this matters**: Mac must be the single source of commits. If Pi commits, it creates divergent branches.

See `docs/DEPLOYMENT.md` for full deployment procedures.

---

## Critical Requirements

### For ALL new apps:

1. **TypeScript required** - ALL React frontends use `.tsx` files, NEVER `.js`
2. **URL parameters required** - Apps MUST read `userId`, `userName`, `token` from URL
3. **Shared CSS required** - All apps MUST load Activity Hub CSS from identity-shell
4. **Registry required** - Apps MUST be registered in database (via game-admin)
5. **Reference first** - Check `games/smoke-test/` before creating new patterns

### TypeScript checklist:
- ✅ package.json includes: `typescript`, `@types/react`, `@types/react-dom`
- ✅ Entry point: `src/index.tsx` (not .js)
- ✅ Main component: `src/App.tsx` (not .js)
- ✅ Copy `tsconfig.json` from smoke-test
- ✅ Add `src/react-app-env.d.ts`

---

## Quick Reference

### App Structure

```
games/{app-name}/
├── backend/
│   ├── main.go          # Entry point
│   ├── handlers.go      # HTTP handlers
│   ├── game.go          # Game logic
│   └── static/          # React build output
├── frontend/
│   ├── src/
│   │   ├── index.tsx    # TypeScript entry (loads shared CSS)
│   │   └── App.tsx      # Main component
│   ├── package.json
│   └── tsconfig.json
└── database/
    └── schema.sql       # PostgreSQL schema (if needed)
```

### Common Commands (run on Pi)

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

### Decision Matrix

| Need | Solution | Doc Reference |
|------|----------|---------------|
| Create new app | Use template generator or follow guide | [NEW-APP-GUIDE.md](./docs/NEW-APP-GUIDE.md) |
| Deploy changes | Follow deployment workflow | [DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| Real-time updates | Use SSE + Redis | [REALTIME.md](./docs/REALTIME.md) |
| Persistent data | PostgreSQL | [DATABASE.md](./docs/DATABASE.md) |
| Ephemeral state | Redis | [DATABASE.md](./docs/DATABASE.md) |
| Frontend styling | Activity Hub CSS classes | See above |
| Game options | `/api/config` endpoint | [BACKEND.md](./docs/BACKEND.md) |

---

## Getting Help

1. **Check Component Library**: `games/component-library/` - Live examples of ALL components
2. **Read relevant doc**: See Documentation Index above
3. **Search codebase**: Look for similar patterns in existing apps
4. **Check lessons learned**: `docs/LESSONS-LEARNED.md`
5. **Review roadmap**: `docs/ROADMAP.md` for planned features

**For UI/CSS questions**: Access Component Library app (port 5010, requires admin role)

---

## File Organization

```
pub-games-v3/
├── CLAUDE.md (this file)           # Project overview and quick reference
├── docs/                           # All detailed documentation
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE-DECISIONS.md
│   ├── FRONTEND.md
│   ├── BACKEND.md
│   ├── DATABASE.md
│   ├── REALTIME.md
│   ├── NEW-APP-GUIDE.md
│   ├── DEPLOYMENT.md
│   ├── LESSONS-LEARNED.md
│   └── ROADMAP.md
├── games/
│   ├── component-library/         # Reference implementation & living style guide
│   ├── tic-tac-toe/
│   ├── dots/
│   └── {your-app}/
├── identity-shell/
│   └── backend/
│       └── static/
│           └── activity-hub.css   # Shared CSS (served to all apps)
├── lib/
│   ├── activity-hub-common/       # Shared Go library
│   └── eslint-plugin-activity-hub/ # ESLint plugin for standards
└── scripts/
    ├── create-app.sh              # App template generator
    └── build-shared-css.sh        # CSS build script
```

---

## Development Workflow

1. **Write code on Mac** using Claude Code
2. **Commit to Git** on Mac
3. **User pushes** manually
4. **Pull on Pi** and build/test
5. **For built artifacts**: SCP back to Mac and commit immediately

See global `~/.claude/CLAUDE.md` for Mac/Pi split environment details.
See `docs/DEPLOYMENT.md` for complete deployment procedures.
See `docs/LESSONS-LEARNED.md` for important lessons and pitfalls to avoid.
See `docs/ROADMAP.md` for future features and planned work.
