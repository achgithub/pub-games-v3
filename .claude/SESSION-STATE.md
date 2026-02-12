# Activity Hub Migration - Session State

**Last Updated**: 2026-02-12
**Session ID**: Phase 0, A, B, C (Part 1), Identity Shell Improvements & LMS Migration Complete + Shared CSS + Fixture File Architecture
**Current Phase**: LMS fixture file architecture complete — awaiting Pi deployment
**Status**: Committed, not yet deployed. Pi needs DB recreation (breaking schema change).

## Completed

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

### LMS Fixture File Architecture ✅ (2026-02-12) — awaiting Pi deployment

Redesigned LMS data model and game-admin UI to support multiple games sharing one fixture file.

**Key architectural change:** `matches` now belongs to `fixture_files`, not `games`. Results are facts about the real-world match, shared across all games using that fixture file. Prediction evaluation is still scoped per game.

**Schema changes (`last_man_standing_db`):**
- New `fixture_files` table (name, timestamps)
- `matches.fixture_file_id` replaces `matches.game_id`
- `games.fixture_file_id` foreign key to fixture_files

**game-admin backend:**
- `GET /api/lms/fixtures` — list fixture files with match counts
- `POST /api/lms/fixtures/upload` — find-or-create fixture file, upsert matches
- `GET /api/lms/fixtures/{id}/matches` — matches for a fixture file
- `POST /api/lms/rounds/{gameId}/{round}/process` — explicit batch evaluation (pre-flight: all matches must have results)
- `PUT /api/lms/matches/{id}/result` — store result only, NO auto-evaluation
- Create game now requires `fixtureFileId`

**player backend:** Match queries now join via `games.fixture_file_id`

**game-admin frontend:** Full 5-tab rewrite
- **Fixtures** — upload CSV, view fixture files and matches by round
- **Games** — create game with fixture file selection, set current/complete
- **Rounds** — create/open/close rounds
- **Results** — round selector, per-match result entry, "Process Round X" button (disabled until all matches have results)
- **Predictions** — view picks with round filter

**Commit:** 6d3cc30

**⚠️ BREAKING CHANGE — Pi requires DB recreation:**
```bash
cd ~/pub-games-v3 && git pull
psql -U activityhub -h localhost -p 5555 -d last_man_standing_db -f games/last-man-standing/database/schema.sql
cd ~/pub-games-v3/games/game-admin/frontend && npm run build && cp -r build/* ../backend/static/
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
| smoke-test | 5010 |
| setup-admin | 5020 |
| leaderboard | 5030 |
| season-scheduler | 5040 |
| display-admin | 5050 |
| display-runtime | 5051 |
| game-admin | 5070 |

## Current Database State

**Identity Database (`activity_hub`):**
- `users` (roles: setup_admin, game_admin, super_user)
- `challenges`, `applications`, `impersonation_sessions`, `user_app_preferences`
- 9+ registered apps (after LMS migration script runs)

**Admin Databases:**
- `setup_admin_db` (audit_log) ✅ deployed
- `game_admin_db` (audit_log) ✅ deployed

**App Databases:**
- `last_man_standing_db` ✅ deployed (fresh, no v2 data migration)
- `tictactoe_db`, `dots_db`, `spoof_db` etc. — unchanged

## Next Steps

**Immediate (commit 6d3cc30 — fixture file architecture):**
1. Push and pull on Pi
2. Recreate `last_man_standing_db` schema (breaking change — commands above)
3. Rebuild game-admin frontend only (LMS player frontend unchanged)
4. Restart core services
5. End-to-end test: upload fixture CSV → create game → create round → set results → process round

**Workflow to verify:**
1. Upload "Premier League 2025/26" CSV → fixture file created
2. Create "Andy's Friends" game → pick fixture file → open for registration
3. Create "Julie's Friends" → same fixture file
4. Players join, make picks for round 1
5. Admin enters results match by match
6. "Process Round 1" per game → verify eliminations are scoped per game

**Pending:**
1. Grant `game_admin` role to appropriate users via Setup Admin
2. Register LMS apps in `applications` table (if not already done)

**Future options:**
1. Migrate other existing apps (dots, sweepstakes, etc.) to v3 patterns
2. Add more game modules to game-admin as new games are created
3. SSL/TLS (easy to add when needed)
4. SSE reconnection on user change (would fix impersonation presence delay)

---

## ⚠️ Design Decision Pending: LMS Round Model Needs Rethink

**Problem:** The current model uses a `round_number` integer (from the CSV and DB). This is fragile — football matches move, get rescheduled, and a fixed round number doesn't map cleanly to real-world scheduling.

**Proposed approach — Date-Range Rounds:**

- A round is defined by a **date range** (start date / end date), not a round number
- Admin creates a round by selecting a date range (e.g. 15 Aug → 18 Aug)
- All matches whose date falls within that range are automatically included in that round
- The `round_number` column in the CSV upload becomes **irrelevant** — ignore it
- Admin typically schedules up to an **18-day horizon**; subsequent CSV re-uploads may shift match dates/times

**Match movement rules:**
- Match shifts slightly within the window → still counted as part of the round, no special handling
- Match postponed / moved **outside** the window → player gets a **bye** (survives the round) but **the team they picked is still consumed** (cannot be reused later in the game)
- This is fair: the player made a commitment, the team slot is used, but they're not penalised by elimination for an event outside their control

**Admin workflow (revised):**
1. Upload fixture CSV (with or without results)
2. Create round: select game + date range → system previews matching matches
3. Open round → players pick a team for any match in the window
4. Admin re-uploads CSV if dates/times change before deadline
5. After deadline: admin confirms results in Results tab (sets status = completed)
6. "Process Round" — evaluates predictions against confirmed results, applies bye rule for postponed matches

**What needs to change in the schema:**
- `rounds` table: replace `round_number INTEGER` + `submission_deadline TEXT` with `start_date TIMESTAMP`, `end_date TIMESTAMP` (keep a display label/number for UI)
- `predictions` table: replace `round_number INTEGER` with `round_id INTEGER REFERENCES rounds(id)`; `match_id` stays as-is
- `matches`: `round_number` column becomes a hint only (from CSV), not used for grouping

**What needs to change in the backend:**
- Round creation: accept `startDate` / `endDate`, auto-resolve which matches are in scope
- Prediction submission: validate match belongs to the round's date range
- Process Round: handle bye case for matches where status != 'completed' at processing time
- All queries joining on `round_number` rewritten to join on `round_id`

**Key principle:** Logic should be based on **match dates relative to the round window** and **player-entered picks**, not on a CSV-assigned integer. This makes the system resilient to real-world schedule changes.

**This is a breaking schema change** — do not implement until the current fixture file architecture is deployed and tested end-to-end first.

## Notes
- LMS uses NO Redis/SSE — deadline-based HTTP polling only
- v2 LMS data not migrated — fresh start on v3
- Game admin grows with additional game tabs as more games are migrated
- LMS apps now use lib/activity-hub-common/ shared library (refactored from inline patterns)
- Library middleware (01f718f) supports impersonation tokens and role-based access
- Working on Mac (code editing, Git operations)
- Testing on Pi after committing
