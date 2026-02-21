# Activity Hub Migration - Session State

**Last Updated**: 2026-02-20
**Current Phase**: Reference implementation created (smoke-test)
**Status**: Created `games/smoke-test/` as definitive reference with full stack (PostgreSQL + Redis + SSE + shared CSS + TypeScript). This is THE template for new apps.

## ⚠️ CRITICAL: Reference Implementation

**WHEN CREATING A NEW APP, COPY `games/smoke-test/`**

Smoke-test (port 5010) is the complete reference implementation demonstrating:
- ✅ Shared CSS pattern (dynamic load from identity-shell)
- ✅ TypeScript frontend with all Activity Hub CSS classes
- ✅ activity-hub-common library for auth
- ✅ PostgreSQL for persistent data (activity_log)
- ✅ Redis for ephemeral state (counter) + pub/sub
- ✅ SSE for real-time updates
- ✅ URL parameter parsing (userId, userName, token)
- ✅ Proper error handling and loading states

See `games/smoke-test/README.md` for complete documentation and checklist.

## ⚠️ CRITICAL: Shared CSS Architecture

**THE PATTERN (DO NOT DEVIATE):**

All apps load Activity Hub CSS from identity-shell's shared endpoint. Reference: `games/smoke-test/`

**Files required in each app:**

1. **`index.tsx`** - Dynamic CSS loading:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles from identity-shell
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<App />);
```

2. **`App.css`** - Minimal base styles (optional, but recommended):
```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: #F5F5F4;
  color: #1C1917;
}

* {
  box-sizing: border-box;
}
```

3. **`App.tsx`** - Import App.css and use Activity Hub classes:
```typescript
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="ah-container ah-container--narrow">
      <div className="ah-card">
        <h2 className="ah-section-title">Title</h2>
        <button className="ah-btn-primary">Action</button>
      </div>
    </div>
  );
}
```

**How it works:**
- Identity-shell backend serves CSS at `http://{host}:3001/shared/activity-hub.css`
- Route: `r.PathPrefix("/shared/").Handler(http.StripPrefix("/shared/", http.FileServer(http.Dir("./static"))))`
- File location: `identity-shell/backend/static/activity-hub.css` (MUST be committed to git)
- All apps dynamically load this CSS in their index.tsx
- CORS configured to allow cross-origin CSS loading (`AllowedOrigins: ["*"]`)

## ⚠️ Next Session — Start Here

**What was created:** Built `games/smoke-test/` as the definitive reference implementation. This is a complete, working example of the Activity Hub stack with all recommended patterns.

**Fixed:** Redis version (v8) and middleware patterns to match tic-tac-toe reference.

**Ready for Pi deployment:**
```bash
# On Pi:
cd ~/pub-games-v3 && git pull

# 1. Create database
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE smoke_test_db;"
psql -U activityhub -h localhost -p 5555 -d smoke_test_db -f games/smoke-test/database/schema.sql

# 2. Register app in activity_hub
psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_smoke_test.sql

# 3. Build and deploy
cd games/smoke-test/backend && go mod tidy
cd ../frontend && npm install && npm run build && cp -r build/* ../backend/static/
cd ../backend && go run *.go &
```

**Next steps:**
1. Test smoke-test on Pi to verify it works
2. Use smoke-test as template to audit/fix other apps:
   - tic-tac-toe (has Redis/SSE but old CSS)
   - dots (has Redis/SSE but old CSS)
   - last-man-standing (no Redis/SSE, old CSS)
   - sweepstakes (no Redis/SSE, old CSS)
   - game-admin (no Redis/SSE, old CSS)

**App status:**
- ✅ smoke-test: REFERENCE IMPLEMENTATION (created, not deployed yet)
- ✅ identity-shell: Working
- ⚠️ tic-tac-toe: Works but needs CSS migration to shared pattern
- ⚠️ dots: Works but needs CSS migration to shared pattern
- ⚠️ setup-admin: Loads shared CSS but has custom overrides in App.css - needs migration
- ❌ last-man-standing: Needs CSS migration
- ❌ sweepstakes: Needs CSS migration
- ❌ game-admin: Needs CSS migration

**To migrate an app to shared CSS:**

```bash
# 1. Ensure setup-admin pattern in index.tsx (dynamic CSS loading)
# 2. Add minimal App.css (body/box-sizing)
# 3. Import App.css in App.tsx
# 4. Use Activity Hub classes (.ah-container, .ah-card, etc.)
# 5. Rebuild and test

cd ~/pub-games-v3/games/{app}/frontend
npm run build
cp -r build/* ../backend/static/

# Restart services
cd ~/pub-games-v3/scripts
./stop_core.sh
./start_core.sh
```

**Verification:**
```bash
# CSS must be served by identity-shell
curl http://localhost:3001/shared/activity-hub.css | head -20

# Should show Activity Hub CSS, not 404
```

**Known issues:**
- SSE presence requires manual refresh after impersonation (acceptable — debugging tool only)

## Completed

### Identity Shell: Light Theme + Tailwind CSS Infrastructure ✅ (2026-02-19)

**Shared CSS modernisation (`identity-shell/backend/static/activity-hub.css`):**
- New Tailwind build pipeline: `lib/activity-hub-common/styles/` with `package.json`, `tailwind.config.js`, `activity-hub-src.css`
- `scripts/build-shared-css.sh` — run on Pi after changing source CSS
- Custom `brand` colour key = Material Blue (#2196F3 palette)
- System font stack (no Google Fonts CDN — safe for offline pub use)
- `.ah-*` component classes: cards, banners, buttons (primary/outline/danger/back), tabs, table, form inputs, header, lobby button
- All interactive states: hover lift, coloured shadow, 150ms ease transitions
- Warm stone neutral palette: `#F5F5F4` bg, `#1C1917` text, `#E7E5E4` borders

**Identity Shell frontend — full light theme rewrite (4 CSS files):**
- `index.css`: light body (stone-100 bg, stone-900 text), blue arc spinner
- `LoginView.css`: white card on blue/green gradient, modern inputs with focus ring, blue button with hover lift
- `Shell.css`: white header with shadow, stone icon buttons, outlined logout button
- `Lobby.css`: white section cards with shadow, stone user rows, app cards with blue hover border/lift, light badges (blue=interactive, green=static)

**Rebuild needed on Pi:**
```bash
cd ~/pub-games-v3/identity-shell/frontend
npm run build && cp -r build/* ../backend/static/
```

**To rebuild shared CSS after source changes:**
```bash
bash ~/pub-games-v3/scripts/build-shared-css.sh
# commit the updated identity-shell/backend/static/activity-hub.css
```

---

### Mobile Test Redesign ✅ (2026-02-19)

Full redesign as a professional step-by-step test runner.

**Backend (`handlers.go` + `main.go`):**
- New `GET /api/ping` — unauthed, returns `{ok, time}` for HTTP latency measurement
- New `GET /api/test-sse` — unauthed SSE, pushes 3 `ping` events (300ms apart) then `done` event
- Both registered before the auth middleware (no token required)

**Frontend (`App.tsx` — full rewrite):**
- Card-based layout: header card, steps list card, image preview card, summary banner
- "Run Tests" button triggers sequential runner:
  1. HTTP Connectivity — ping latency in ms
  2. SSE Connectivity — counts 3/3 messages received
  3. Text Rendering — loads `/api/test-content`, shows question text
  4. Image Loading — `new Image()` load test, preview shown on pass
  5. Audio Playback — attempts autoplay; shows "Tap to Play" card if iOS blocks it
- Animated SVG spinner per step while running; PASS/FAIL labels with colour coding
- Green/amber summary banner on completion
- "Run Again" button resets and reruns

**Seed script updated:** 600×600 PNG (was 200×200) for retina displays.

---

### Dots & Boxes: Polish + Bug Fixes ✅ (2026-02-19)

- **Removed toasts**: "Line drawn" and "Box completed! Go again!" messages removed from backend (`game_logic.go`)
- **Waiting banner fix**: "Waiting for opponent to connect" now clears correctly on mobile and for the game originator
  - Fixed race condition: `GetConnectedPlayers` pre-check sends direct `opponent_connected` SSE if opponent already connected when you join
  - Also sets `opponentEverConnected=true` when `game_state` arrives with `status=active`
- **Removed `● Connected` badge**: permanent status indicator removed from top of game screen
- **Fixed opponentName bug**: Player 1 was seeing their own name as opponent name
- **Line colour lag fix**: Added `drawn` class to owned lines in JSX; fixes CSS specificity issue where `.line:hover:not(.drawn)` was beating `.line.p1` on mobile (hover persists after tap)
- **Optimistic line update**: Lines colour immediately on tap before SSE confirmation arrives
- **Status messages below grid**: Turn indicator, waiting banners, actions all moved below the game board to prevent layout shift on load

### Tic-Tac-Toe: Messages Below Board ✅ (2026-02-19)

Moved all status elements (turn status, claim win, error, actions, back-to-lobby) into a `.ttt-below-board` flex container below the board — consistent with dots layout pattern.

---

### Quiz System: Full Implementation + Deployment ✅ (2026-02-19)

Four new apps + game-admin quiz module, all deployed on Pi.

**Apps:**
- `quiz-player` (port 4041) — player joins by session code, answers questions, sees leaderboard
- `quiz-master` (port 5080) — host controls: manage packs, run live quiz, reveal answers, show scores
- `quiz-display` (port 5081) — TV display, unauthenticated (`?session=CODE`), shows questions/leaderboard
- `mobile-test` (port 4061) — device compatibility checker (HTTP, SSE, text, image, audio)

**game-admin Quiz module:**
- Media uploads (images + audio) stored in `game-admin/backend/uploads/quiz/`
- All quiz backends symlink to this shared uploads directory
- Question management: text/picture/music types, `is_test_content` flag
- Pack builder: group questions into packs with ordered rounds
- Quiz session management: create, start, advance questions, end

**Database:** `quiz_db` — schema at `games/quiz-player/database/schema.sql`

**Seed script:** `scripts/seed_quiz_test_content.sh` — generates test PNG + WAV, inserts test questions

**Pi deployment:** See "Quiz System Pi Deployment" section in CLAUDE.md

---

### Tic-Tac-Toe + Dots: Shared Library Migration ✅ (2026-02-16) — deployed ✅

Migrated both game backends to `activity-hub-common`. No functional changes — auth/db/config patterns unified.

**Changes (both apps):**
- Deleted inline `auth.go` → replaced with `authlib.Middleware` / `authlib.SSEMiddleware`
- Removed inline `InitDatabase` / `InitIdentityDatabase` → shared `database.InitDatabase` / `database.InitIdentityDatabase`
- Identity DB now connects to `activity_hub` (was `pubgames`), credentials `activityhub`/`pubgames`
- `getUserFromContext(r)` → `authlib.GetUserFromContext(r.Context())`
- `go.mod` updated: new module names, `activity-hub-common` dependency, local `replace` directive
- `go.sum` cleared for `go mod tidy` on Pi
- Redis kept inline (game-specific, not shared)
- dots: `createTables` kept inline, called from `main` after DB init

**Pi build commands:**
```bash
cd ~/pub-games-v3 && git pull
cd games/tic-tac-toe/backend && go mod tidy && go run *.go
cd games/dots/backend && go mod tidy && go run *.go
```

---

### Sweepstakes Migration ✅ (2026-02-15) — deployed ✅

Migrated sweepstakes from pub-games-v2 to v3. Same split pattern as LMS.

**Player app (port 4031):**
- Rewritten with activity-hub-common (no Redis, no custom auth)
- DB UNIQUE constraints replace Redis locking:
  - `UNIQUE(competition_id, entry_id)` — entry can only be drawn once
  - `UNIQUE(user_id, competition_id)` — one draw per user per competition
- Frontend: .ah-* CSS, lobby button, impersonation banner, inline reveal after picking
- Views: Competitions tab (pick box / view results) + My Picks tab

**Game Admin additions:**
- `sweepstakesDB` connection to `sweepstakes_db`
- New `/api/sweepstakes/*` routes: CRUD competitions, CSV entry upload, position, draws
- Module switcher in frontend: [Last Man Standing] [Sweepstakes]
- Sweepstakes section: Competitions tab + Entries tab (with Draws sub-view)

**Schema changes (sweepstakes_db):**
- Removed: `selection_mode`, `blind_box_interval`, `start_date`, `end_date` from competitions
- Removed: `stage`, `eliminated_date` from entries
- Added: UNIQUE constraints on draws (replaces Redis)
- Entry status simplified to `available/taken`

**App registry:** `scripts/migrate_add_sweepstakes_app.sql`

**⚠️ Pi deployment — sweepstakes_db recreation required:**
```bash
cd ~/pub-games-v3 && git pull
go mod tidy  # run in games/sweepstakes/backend/
psql -U activityhub -h localhost -p 5555 -d postgres -c "DROP DATABASE IF EXISTS sweepstakes_db;"
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE sweepstakes_db;"
psql -U activityhub -h localhost -p 5555 -d sweepstakes_db -f games/sweepstakes/database/schema.sql

# Build frontends
cd ~/pub-games-v3/games/sweepstakes/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/game-admin/frontend && npm run build && cp -r build/* ../backend/static/

# Register sweepstakes in app registry
psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_sweepstakes_app.sql

~/pub-games-v3/scripts/stop_core.sh
~/pub-games-v3/scripts/start_core.sh
```

Note: `go mod tidy` must be run in `games/sweepstakes/backend/` on Pi before first build
(go.sum was cleared since Redis was removed and activity-hub-common was added).

---

### LMS Bug Fixes ✅ (2026-02-15) — awaiting Pi deployment

Two bugs fixed, both requiring DB recreation (schema change to rounds).

**Bug 1: Duplicate team when team plays twice in a round**
- Root cause: player UI was match-centric (one card per fixture) — team appearing in 2 games showed up twice
- Fix: new `PickView` component in player frontend — team-centric UI
  - Deduplicates teams across all matches in the round
  - Shows alphabetically sorted team buttons in a grid
  - When a team plays multiple times, always uses their earliest match (by `match_number`) as the prediction's `match_id`
  - Matches shown below as reference (not as pick targets)
  - Old `TeamBtn` repurposed as grid cell (removed `flex: 1` layout)

**Bug 2: Submission deadline + auto-pick**
- Root cause: `submission_deadline` was not included in the date-range round redesign
- Fix:
  - Schema: added `submission_deadline TIMESTAMP` (nullable) to `rounds` table
  - Game-admin backend: `handleCreateRound` accepts `submissionDeadline` (datetime-local format); `handleGetLMSRounds` returns it
  - Game-admin backend: `handleProcessRound` now calls `applyAutoPicks()` before processing — auto-picks first alphabetically available team for any active player who hasn't picked. Edge case (all teams used) gives a forced bye.
  - Game-admin frontend: deadline field in round creation (auto-fills to noon on start date); shown in round list; process result shows auto-picked count
  - Player backend: `handleGetOpenRounds` returns `submissionDeadline`
  - Player frontend: deadline shown on open round cards (orange text)

**⚠️ BREAKING CHANGE — Pi requires DB recreation (schema adds submission_deadline):**
```bash
cd ~/pub-games-v3 && git pull
psql -U activityhub -h localhost -p 5555 -d postgres -c "DROP DATABASE IF EXISTS last_man_standing_db;"
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE last_man_standing_db;"
psql -U activityhub -h localhost -p 5555 -d last_man_standing_db -f games/last-man-standing/database/schema.sql
cd ~/pub-games-v3/games/game-admin/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/last-man-standing/frontend && npm run build && cp -r build/* ../backend/static/
~/pub-games-v3/scripts/stop_core.sh
~/pub-games-v3/scripts/start_core.sh
```

---



### Phase 0: Database Rename ✅ (2026-02-09)
- ✅ Created `activityhub` user with CREATEROLE and CREATEDB privileges
- ✅ Created `activity_hub` database
- ✅ Migrated all user data from `pubgames` → `activity_hub`
- ✅ Updated identity-shell code to use new credentials
- ✅ Updated all identity database scripts
- ✅ Tested and verified - identity-shell operational

### Phase A: User Management & Roles ✅ (2026-02-09)
- ✅ Added `roles` TEXT[] column to `activity_hub.users`
- ✅ Created GIN index for efficient role queries
- ✅ Migrated existing admin users to have both roles
- ✅ Updated identity-shell to return roles in login/validate
- ✅ Tested with admin and regular users - working perfectly
- ✅ Documentation: docs/ROLES.md

**Roles:**
- `setup_admin` - System configuration (Setup Admin App)
- `game_admin` - Activity management (Game Admin App)
- `super_user` - Impersonation capability

### Phase B: Database-Driven App Registry ✅ (2026-02-09)
- ✅ Created `applications` table in PostgreSQL
- ✅ Seeded with 8 existing apps
- ✅ Identity-shell reads apps from database (not apps.json)
- ✅ Role-based app visibility (GetAppsForUser)
- ✅ Admin CRUD endpoints for app management
- ✅ Tested and verified - all endpoints working
- ✅ Documentation: docs/APP-REGISTRY.md

### Phase C (Part 1): Setup Admin App ✅ (2026-02-09)
- ✅ Backend (Go) on port 5020
- ✅ Frontend (React/TypeScript) — Users | Apps tabs
- ✅ Database: `setup_admin_db` with audit_log table
- ✅ Registered in applications table with required_roles=['setup_admin']
- ✅ Tested and operational

### Identity Shell Improvements ✅ (2026-02-09)

**Phase 1: User Impersonation**
- ✅ `impersonation_sessions` table, impersonation.go, impersonation banner
- ✅ super_user role: read-only Setup Admin + impersonation
- ✅ Migration: `scripts/migrate_add_impersonation.sh`
- ⚠️ Known issue: SSE presence requires manual F5 refresh after impersonation (acceptable)

**Phase 2: App Personalization**
- ✅ `user_app_preferences` table, preferences.go, Settings modal
- ✅ Hide apps, reorder with up/down arrows, persisted per-user
- ✅ Migration: `scripts/migrate_add_user_preferences.sh`

**Phase 3: Guest Mode**
- ✅ `guest_accessible` column, guest login endpoint, "Continue as Guest" button
- ✅ Migration: `scripts/migrate_add_guest_mode.sh`

### LMS Fixture File Architecture + Date-Range Rounds ✅ (2026-02-14) — awaiting Pi deployment

Two combined breaking schema changes — deploy together.

#### Fixture File Architecture (commit 6d3cc30)

`matches` now belongs to `fixture_files`, not `games`. Results are facts about the real-world match, shared across all games using that fixture file. Prediction evaluation is still scoped per game.

- New `fixture_files` table; `matches.fixture_file_id` replaces `matches.game_id`
- `games.fixture_file_id` foreign key to fixture_files
- game-admin: Fixtures tab (upload CSV, view matches), create game requires `fixtureFileId`

#### Date-Range Rounds (commit 66c5d05)

Rounds are now defined by a **date window** (start_date / end_date), not a CSV round number. Admin creates rounds each week with auto-incrementing display labels (Round 1, 2, 3...). Matches are grouped by whether their `match_date` falls within the window.

**Bye rule:** if a match is postponed or moves outside the round window, the player gets a bye — they survive the round but the team is consumed (cannot be reused).

**Schema changes (`last_man_standing_db`):**
- `matches.date TEXT` → `match_date DATE` (enables BETWEEN queries)
- `rounds`: replaced `round_number + submission_deadline` with `label INTEGER`, `start_date DATE`, `end_date DATE`
- `predictions`: `round_number INTEGER` → `round_id INTEGER REFERENCES rounds(id)`; added `bye BOOLEAN`
- `games`: removed `postponement_rule` column (bye rule is now universal)

**game-admin backend:**
- Round creation: `{ gameId, label, startDate, endDate }`
- Match filtering: `match_date BETWEEN start_date AND end_date`
- Process round: postponed or out-of-window → `bye=TRUE` (survive, team consumed); draws eliminate
- CSV upload: multi-format date parser (ISO, DD/MM, DD-MM); reports skipped count
- Route params: `{label}` for round identification in admin routes

**game-admin frontend:**
- Round form: date range pickers with auto-fill defaults (next Wednesday → +6 days = Tuesday)
- Results tab: round selector shows "Round N (start → end) [status]"
- Predictions tab: Bye status indicator

**player backend:**
- Open rounds: returns `id, label, startDate, endDate, hasPredicted`
- Matches: fetched by round ID, filtered by round's date range
- Submit prediction: accepts `roundId` (not `roundNumber`)
- History: returns label as `roundNumber`, includes `startDate/endDate/bye`

**player frontend:**
- Open rounds: shows `Round {label}` + date range (no more deadline)
- Pick detail view: round label + date range
- Prediction submit: sends `roundId`
- History: date range per round, Bye status badge (blue 🔄)

**⚠️ BREAKING CHANGE — Pi requires DB recreation:**
```bash
cd ~/pub-games-v3 && git pull
psql -U activityhub -h localhost -p 5555 -d last_man_standing_db -f games/last-man-standing/database/schema.sql
cd ~/pub-games-v3/games/game-admin/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/last-man-standing/frontend && npm run build && cp -r build/* ../backend/static/
~/pub-games-v3/scripts/stop_core.sh
~/pub-games-v3/scripts/start_core.sh
```

---

### Shared CSS Refactor ✅ (2026-02-11)
- ✅ Renamed `pubgames.css` → `activity-hub.css` with full `.ah-*` component library
- ✅ Primary colour standardised to `#2196F3` across all shared components
- ✅ CSS injection added to `index.tsx` in last-man-standing, game-admin, setup-admin
- ✅ Refactored last-man-standing and game-admin App.tsx to use `.ah-*` classes
- ✅ Added back-to-lobby button (`ah-lobby-btn`) to LMS, game-admin, and setup-admin
- ✅ Pattern documented in `docs/NEW-APP-GUIDE.md`

### Phase C (Part 2): Game Admin App + LMS Migration ✅ (2026-02-10)

Migrated Last Man Standing (LMS) from pub-games-v2 to pub-games-v3, split into two apps:

**Last Man Standing Player App (`games/last-man-standing/`, port 4021)**
- ✅ Go backend with custom `AuthMiddleware` (handles demo-token + impersonate- tokens)
- ✅ Player routes: join game, status, open rounds, match picks, prediction history, used teams, standings, round summaries
- ✅ PostgreSQL (`last_man_standing_db`) - fresh schema, no v2 data migration
- ✅ TypeScript React frontend: Make Pick | My Picks | Standings tabs
- ✅ Impersonation banner (yellow warning showing who is being impersonated and by whom)
- ✅ Prediction validation: round must be open, team valid, team not already used this game
- ✅ `games/last-man-standing/database/schema.sql` for Pi setup

**Game Admin App (`games/game-admin/`, port 5070)**
- ✅ Go backend with `requireGameAdmin` middleware (mirrors requireSetupAdmin)
  - `game_admin` role → full write access
  - `super_user` role → read-only access (X-Permission-Level: read-only)
- ✅ LMS admin routes: create/activate/complete games, create/open/close rounds, CSV match upload, set match results, view all predictions
- ✅ Result processing: automatically marks predictions correct/incorrect, eliminates players
- ✅ P-P (postponed) handling: 'loss' rule eliminates, 'win' rule voids prediction
- ✅ Draws eliminate all predictors
- ✅ Audit logging to `game_admin_db`
- ✅ TypeScript React frontend: Games | Rounds | Matches | Predictions tabs
- ✅ Read-only mode UI (disabled buttons, read-only badge) for super_user impersonation
- ✅ `games/game-admin/database/schema.sql` for Pi setup

**App Registry:**
- ✅ `scripts/migrate_add_lms_apps.sql` — inserts both apps into `activity_hub.applications`
  - last-man-standing: port 4021, no required roles (visible to all)
  - game-admin: port 5070, required_roles=['game_admin']

**Committed:** dfdc9d8 (initial LMS build), 84a103e (refactor: use activity-hub-common library)

**activity-hub-common library:** 01f718f (fix middleware signature, add impersonation and role support)

**✅ DEPLOYED — Pi deployment complete (2026-02-11)**

Pi notes:
- Used local `replace` directive in go.mod (private GitHub repo not accessible from Pi)
- core scripts (start_core.sh / stop_core.sh / status_core.sh) working via tmux session 'core'

**To apply shared CSS refactor (commit c643b78):**
```bash
cd ~/pub-games-v3 && git pull

# Rebuild all three frontends (no npm install needed — no new packages)
cd ~/pub-games-v3/games/last-man-standing/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/game-admin/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/setup-admin/frontend && npm run build && cp -r build/* ../backend/static/

# Restart services
~/pub-games-v3/scripts/stop_core.sh
~/pub-games-v3/scripts/start_core.sh
```

### Earlier Work
- ✅ Phase 1: Planning complete (plan saved in .claude/plans/)
- ✅ Phase 2: Shared package scaffolding COMPLETE
  - ✅ Created lib/activity-hub-common/ with 7 packages (1,559 lines)
  - ✅ All packages build and pass tests on Pi

## Architecture Summary

```
Identity-Shell (Port 3001)
├── Database: activity_hub
│   ├── users (with roles: setup_admin, game_admin, super_user)
│   ├── challenges (lobby system)
│   ├── applications (app registry with guest_accessible)
│   ├── impersonation_sessions (audit trail)
│   └── user_app_preferences (personalization)
├── Public API
│   ├── /api/login, /api/login/guest, /api/validate
│   ├── /api/apps (filtered by user roles + preferences)
│   ├── /api/user/preferences (GET/PUT)
│   └── /api/admin/impersonate (super_user only)
└── Admin API (requires setup_admin)

Setup Admin App (Port 5020)
├── Database: setup_admin_db (audit_log)
├── Auth: requires setup_admin or super_user role
└── Features: user role management, app registry management

Last Man Standing - Player (Port 4021)  ← NEW
├── Database: last_man_standing_db (shared)
├── Auth: demo-token + impersonate- token support
└── Features: join game, make picks, history, standings

Game Admin App (Port 5070)  ← NEW
├── Databases: game_admin_db (audit) + last_man_standing_db (LMS data)
├── Auth: requires game_admin or super_user role
└── Features: manage LMS games/rounds/matches/results/predictions
```

## Port Reference

| App | Port |
|-----|------|
| identity-shell | 3001 |
| tic-tac-toe | 4001 |
| dots | 4011 |
| last-man-standing | 4021 |
| sweepstakes | 4031 |
| quiz-player | 4041 |
| spoof | 4051 |
| mobile-test | 4061 |
| smoke-test | 5010 |
| setup-admin | 5020 |
| leaderboard | 5030 |
| season-scheduler | 5040 |
| display-admin | 5050 |
| display-runtime | 5051 |
| game-admin | 5070 |
| quiz-master | 5080 |
| quiz-display | 5081 |

## Current Database State

**Identity Database (`activity_hub`):**
- `users` (roles: setup_admin, game_admin, super_user)
- `challenges`, `applications`, `impersonation_sessions`, `user_app_preferences`
- 9+ registered apps (after LMS migration script runs)

**Admin Databases:**
- `setup_admin_db` (audit_log) ✅ deployed
- `game_admin_db` (audit_log) ✅ deployed

**App Databases:**
- `last_man_standing_db` ✅ deployed
- `quiz_db` ✅ deployed
- `tictactoe_db`, `dots_db`, `spoof_db` etc. — unchanged

## Next Steps

**Immediate Pi tasks:**
- Rebuild identity-shell frontend and restart (see top of file) — light theme CSS is committed and pulled
- Mobile-test: rebuild frontend + re-seed if not done yet

**Future options:**
1. **Font size settings** — User-adjustable font scale (accessibility)
   - Add `font_scale` to `user_app_preferences` (0.85/1.00/1.15)
   - Settings modal control in identity-shell
   - Pass via URL param or preferences API to apps
   - Apply via CSS custom properties: `--font-scale`
   - ~1-2 hours to implement across all apps
2. **Mobile test - faster timeouts** — Tests currently hang too long on failure
   - Add AbortController timeouts to fetch calls (5s)
   - SSE connection timeout (10s)
   - Image/audio load timeouts (8s/5s)
   - Clearer failure detection for poor network conditions
   - ~30 minutes to implement
3. **Automated testing & CI/CD pipeline** — No automated tests currently
   - Phase 1: Unit tests (Go + React) + GitHub Actions build validation (~8 hours)
   - Phase 2: Integration tests + test databases (~8 hours)
   - Phase 3: E2E tests + automated deployment (~16 hours)
   - Phase 4: Coverage badges, notifications, performance tests (~4 hours)
   - Benefits: catch bugs early, confidence in refactoring, faster development
   - Start with smoke-test as reference, expand gradually
   - Total effort: ~36+ hours (phased approach)
4. **Managed game modes (Sweepstakes & LMS)** — Admin maintains games without player participation
   - New `game_manager` role for operational management
   - Separate managed apps or toggle mode in existing apps
   - Admin assigns entries/picks on behalf of participants
   - Bulk operations (CSV import/export)
   - Complete audit trail for all manager actions
   - Use cases: offline games, manual tracking, private games
   - Phase 1: Sweepstakes Managed (~12 hours)
   - Phase 2: LMS Managed (~12 hours)
   - Phase 3: Polish and audit UI (~4 hours)
   - Total effort: ~28 hours
5. Quiz system — plan exists at `.claude/plans/radiant-sparking-kettle.md` for media clips, deduplication, and CSV import
6. Add more game modules to game-admin as new games are built
7. SSL/TLS when needed
8. SSE reconnection on user change (would fix impersonation presence delay)

## Notes
- LMS uses NO Redis/SSE — deadline-based HTTP polling only
- v2 LMS data not migrated — fresh start on v3
- Game admin grows with additional game tabs as more games are migrated
- LMS apps now use lib/activity-hub-common/ shared library (refactored from inline patterns)
- Library middleware (01f718f) supports impersonation tokens and role-based access
- Working on Mac (code editing, Git operations)
- Testing on Pi after committing
