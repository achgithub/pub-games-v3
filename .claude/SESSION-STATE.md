# Activity Hub Migration - Session State

**Last Updated**: 2026-02-08
**Session ID**: giggly-inventing-pixel (implementation session)
**Current Phase**: REVISED PLAN - Identity-Shell Foundation First
**Status**: Phase 2 Complete, Planning Identity Improvements

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
NEXT: Start Phase A (User Management & Roles)

## Notes
- Shared library (lib/activity-hub-common/) ready but won't be used until apps migrate
- SSL/TLS deferred (easy to add later)
- Season Scheduler needs better name (background jobs/scheduling utility)

## Notes
- Working on Mac (code editing, Git operations)
- Will test builds on Pi after committing
- Using local replace directive in go.mod during development
- Library will eventually be published to GitHub for version management
