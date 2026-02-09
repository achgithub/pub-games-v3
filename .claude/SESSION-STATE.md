# Activity Hub Migration - Session State

**Last Updated**: 2026-02-09
**Session ID**: Phase 0 & A Complete
**Current Phase**: Foundation Complete - Ready for Phase B or C
**Status**: Identity database renamed, roles system operational

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

### Earlier Work
- ✅ Phase 1: Planning complete (plan saved in .claude/plans/)
- ✅ Phase 2: Shared package scaffolding COMPLETE
  - ✅ Created lib/activity-hub-common/ with 7 packages (1,559 lines)
  - ✅ All packages build and pass tests on Pi

## Foundation Strategy

**Identity-shell foundation complete:** Database renamed, roles system operational

### Next Options

**Option 1: Phase B - Database-Driven App Registry**
- Migrate apps.json → PostgreSQL `applications` table
- Add role requirements per app
- Admin endpoints for app management
- User preferences (favorites, ordering)
- Dynamic app visibility based on roles

**Option 2: Phase C - Create Admin Mini-Apps**
- Setup Admin App (system configuration, only `setup_admin` can see)
- Game Admin App (activity management, only `game_admin` can see)
- Both are mini-apps shown on home screen based on roles
- Demonstrates role-based app visibility

**Recommendation:** Either order works. Phase B provides infrastructure for Phase C apps to register themselves. Phase C provides immediate value and tests role-based visibility.

### Migration Strategy (After Foundation)

Only AFTER foundation complete, migrate one of each app category:

| App Type | Example | What It Tests |
|----------|---------|---------------|
| Static | TBD | Basic shared library integration |
| Simple Admin | Move admin features → Game Admin App | Role-based access |
| 2-Player Game | Tic-Tac-Toe | SSE, Redis, turn-based logic |
| Multi-Player Game | Spoof | Multi-user coordination |
| Utility/Scheduler | Season Scheduler (needs rename) | Different pattern |

**Don't lock down identity until all 5 app types migrated** - each reveals needed improvements.

## Current Database State

**Identity Database:**
- Database: `activity_hub`
- User: `activityhub`
- Password: `pubgames`
- Port: 5555
- Tables: `users` (with `roles` column), `challenges`

**App Databases:**
- Still use `pubgames` user (will update during app migration)
- Names unchanged: `tictactoe_db`, `dots_db`, `spoof_db`, etc.

**Old Database:**
- `pubgames` database still exists as backup
- Can be dropped after stable operation

## Notes
- Shared library (lib/activity-hub-common/) ready but won't be used until apps migrate
- SSL/TLS deferred (easy to add later)
- Season Scheduler needs better name (background jobs/scheduling utility)
- Working on Mac (code editing, Git operations)
- Testing on Pi after committing
