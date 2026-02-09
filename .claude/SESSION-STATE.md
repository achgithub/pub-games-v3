# Activity Hub Migration - Session State

**Last Updated**: 2026-02-09
**Session ID**: Phase 0, A & B Complete
**Current Phase**: Foundation Complete - Ready for Phase C
**Status**: Identity-shell foundation fully operational

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

### Phase B: Database-Driven App Registry ✅ (2026-02-09)
- ✅ Created `applications` table in PostgreSQL
- ✅ Seeded with 8 existing apps from apps.json
- ✅ Identity-shell reads apps from database (not apps.json)
- ✅ Role-based app visibility (GetAppsForUser)
- ✅ Admin CRUD endpoints:
  - GET /api/admin/apps (list all)
  - PUT /api/admin/apps/:id (update)
  - POST /api/admin/apps/:id/enable (enable)
  - POST /api/admin/apps/:id/disable (disable)
- ✅ requireSetupAdmin middleware for auth
- ✅ Tested and verified - all endpoints working
- ✅ Documentation: docs/APP-REGISTRY.md

**Features:**
- Apps can require specific roles for visibility
- Enable/disable apps without code changes
- Custom display ordering
- Auto-reloading registry after updates

### Earlier Work
- ✅ Phase 1: Planning complete (plan saved in .claude/plans/)
- ✅ Phase 2: Shared package scaffolding COMPLETE
  - ✅ Created lib/activity-hub-common/ with 7 packages (1,559 lines)
  - ✅ All packages build and pass tests on Pi

## Foundation Status

**Identity-shell foundation is COMPLETE:**
- ✅ Database renamed to activity_hub
- ✅ Role-based access control operational
- ✅ Dynamic app registry operational
- ✅ Admin endpoints for app management

**Ready for:**
- Phase C: Build Admin Mini-Apps (Setup Admin, Game Admin)
- Or: Start migrating existing apps to use shared library

## Next Steps

### Phase C: Create Admin Mini-Apps

Build two admin apps to demonstrate the foundation:

**1. Setup Admin App** (requires `setup_admin` role)
- User management (view, create, edit roles)
- App registry management (use admin CRUD endpoints)
- System configuration
- Port: 5060
- Database: `setup_admin_db`

**2. Game Admin App** (requires `game_admin` role)
- Schedule games/activities
- Manage tournaments
- View game statistics
- Activity calendar
- Port: 5070
- Database: `game_admin_db`

Both apps will:
- Be registered in `applications` table with role requirements
- Only visible to users with appropriate roles
- Demonstrate role-based visibility working end-to-end

### Alternative: Start App Migration

Begin migrating existing apps to use shared library. Order:

| App Type | Example | What It Tests |
|----------|---------|---------------|
| Static | TBD | Basic shared library integration |
| Simple Admin | Move admin features → Game Admin App | Role-based access |
| 2-Player Game | Tic-Tac-Toe | SSE, Redis, turn-based logic |
| Multi-Player Game | Spoof | Multi-user coordination |
| Utility/Scheduler | Season Scheduler (needs rename) | Different pattern |

**Recommendation:** Phase C first - demonstrates the foundation working, then migrate apps.

## Current Database State

**Identity Database:**
- Database: `activity_hub`
- User: `activityhub`
- Password: `pubgames`
- Port: 5555
- Tables:
  - `users` (with `roles` column)
  - `challenges`
  - `applications` (new - app registry)

**App Databases:**
- Still use `pubgames` user (will update during app migration)
- Names unchanged: `tictactoe_db`, `dots_db`, `spoof_db`, etc.

**Old Database:**
- `pubgames` database still exists as backup
- Can be dropped after stable operation

## Architecture Summary

```
Identity-Shell (Port 3001)
├── Database: activity_hub
│   ├── users (with roles)
│   ├── challenges (lobby system)
│   └── applications (app registry)
├── Public API
│   ├── /api/login (returns user + roles)
│   ├── /api/validate (returns user + roles)
│   └── /api/apps (filtered by user roles)
├── Admin API (requires setup_admin)
│   ├── GET /api/admin/apps
│   ├── PUT /api/admin/apps/:id
│   ├── POST /api/admin/apps/:id/enable
│   └── POST /api/admin/apps/:id/disable
└── Lobby API (existing)
```

## Notes
- Shared library (lib/activity-hub-common/) ready but won't be used until apps migrate
- SSL/TLS deferred (easy to add later)
- Season Scheduler needs better name (background jobs/scheduling utility)
- Working on Mac (code editing, Git operations)
- Testing on Pi after committing
- Foundation is solid - ready to build on top
