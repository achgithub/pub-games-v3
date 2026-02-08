# Activity Hub Migration - Session State

**Last Updated**: 2026-02-08
**Session ID**: giggly-inventing-pixel (implementation session)
**Current Phase**: Phase 0 - Database Rename (NEXT SESSION)
**Status**: Phase 2 Complete, Ready for Database Rename

## Completed
- ✅ Phase 1: Planning complete (plan saved in .claude/plans/)
- ✅ Phase 2: Shared package scaffolding COMPLETE
  - ✅ Created lib/activity-hub-common/ with 7 packages (1,559 lines)
  - ✅ All packages build and pass tests on Pi
  - ✅ Fixed module path to use achgithub username
  - ✅ go.sum generated and committed

## REVISED STRATEGY (Agreed 2026-02-08)
**Key Insight**: Can't migrate apps without solid identity-shell foundation.
**New Order**: Fix identity-shell FIRST, THEN migrate apps

### Foundation Work (Do First)
1. **Phase A: User Management & Roles**
   - Add two admin roles: `setup_admin` (system config) and `game_admin` (activity management)
   - Update identity-shell to check roles
   - Show/hide apps based on user roles
   - User home screen customization (favorites, ordering)

2. **Phase C: Create Admin Mini-Apps**
   - Setup Admin App (system configuration, only `setup_admin` can see)
   - Game Admin App (activity management, only `game_admin` can see)
   - Both are mini-apps shown on home screen based on roles

3. **Phase B: Database-Driven App Registry**
   - Migrate apps.json → PostgreSQL
   - Add role requirements per app
   - Admin endpoints for app management
   - User preferences (favorites, ordering)

### Migration Strategy (One of Each Type)
Only AFTER foundation complete, migrate one of each app category:

| App Type | Example | What It Tests |
|----------|---------|---------------|
| Static | TBD | Basic shared library integration |
| Simple Admin | Move admin features → Game Admin App | Role-based access |
| 2-Player Game | Tic-Tac-Toe | SSE, Redis, turn-based logic |
| Multi-Player Game | Spoof | Multi-user coordination |
| Utility/Scheduler | Season Scheduler (needs rename) | Different pattern |

**Don't lock down identity until all 5 app types migrated** - each reveals needed improvements.

## Current Task
NEXT: Phase 0 - Database Rename (do this BEFORE Phase A)

### Phase 0: Database Rename (Hybrid Approach - Database Now, Directory Later)

**Decided**: Rename database NOW before building foundation. Directory/repo rename later (cosmetic).

**Database Changes**:
- `pubgames` DB → `activity_hub`
- `pubgames` user → `activityhub` (same password)
- App databases: Keep as-is (`tictactoe_db`, `dots_db`, etc.)
- New admin databases: `activity_hub_setup_admin`, `activity_hub_game_admin`

**Steps (On Pi)**:
1. Dump current database: `pg_dump -U pubgames -p 5555 pubgames > pubgames_backup.sql`
2. Create new database: `psql -U pubgames -p 5555 -d postgres -c "CREATE DATABASE activity_hub;"`
3. Create new user: `psql -U pubgames -p 5555 -d postgres -c "CREATE USER activityhub WITH PASSWORD 'pubgames';"`
4. Grant permissions: `psql -U pubgames -p 5555 -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE activity_hub TO activityhub;"`
5. Restore data: `psql -U activityhub -p 5555 activity_hub < pubgames_backup.sql`
6. Test with identity-shell
7. Update all apps if identity-shell works
8. Drop old pubgames DB when confirmed

**Code Changes (On Mac)**:
1. Update connection strings in:
   - identity-shell/backend
   - games/tic-tac-toe/backend
   - games/dots/backend
   - games/spoof/backend
   - games/sweepstakes/backend
   - games/season-scheduler/backend
   - games/display-admin/backend
   - games/display-runtime/backend (if uses identity DB)
2. Update lib/activity-hub-common/database/postgres.go (InitIdentityDatabase)
3. Update documentation (CLAUDE.md, docs/)
4. Commit and push

**After Phase 0 Complete**:
- Proceed to Phase A (User Management & Roles)
- New admin apps will use correct DB names from the start

**Directory/Repo Rename (LATER)**:
- `pub-games-v3` → `activity-hub` (do after foundation stable)
- Less urgent, cosmetic change

## Notes
- Shared library (lib/activity-hub-common/) ready but won't be used until apps migrate
- SSL/TLS deferred (easy to add later)
- Season Scheduler needs better name (background jobs/scheduling utility)

## Notes
- Working on Mac (code editing, Git operations)
- Will test builds on Pi after committing
- Using local replace directive in go.mod during development
- Library will eventually be published to GitHub for version management
