# Activity Hub Migration - Session State

**Last Updated**: 2026-02-09
**Session ID**: Phase 0, A, B & C (Part 1) Complete
**Current Phase**: Phase C (Part 2) - Game Admin App
**Status**: Identity-shell foundation complete, Setup Admin operational

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

### Phase C (Part 1): Setup Admin App ✅ (2026-02-09)
- ✅ Built complete admin mini-app for system configuration
- ✅ Backend (Go) on port 5060
  - User management endpoints
  - App management endpoints
  - requireSetupAdmin middleware
  - Audit logging
- ✅ Frontend (React/TypeScript)
  - Two-tab interface: Users | Apps
  - Toggle user roles (setup_admin, game_admin)
  - Enable/disable apps
  - Token-based authentication
- ✅ Database: `setup_admin_db` with audit_log table
- ✅ Registered in applications table with required_roles=['setup_admin']
- ✅ Role-based visibility working:
  - Regular users: Cannot see Setup Admin
  - Admin users: See Setup Admin in app list
- ✅ Fixed frontend to send Authorization header for role filtering
- ✅ Tested and operational

**Setup Admin Features:**
- View all users and their roles
- Grant/revoke setup_admin and game_admin roles
- View all apps in registry
- Enable/disable apps dynamically
- See required roles and display order
- All actions logged to audit_log

### Earlier Work
- ✅ Phase 1: Planning complete (plan saved in .claude/plans/)
- ✅ Phase 2: Shared package scaffolding COMPLETE
  - ✅ Created lib/activity-hub-common/ with 7 packages (1,559 lines)
  - ✅ All packages build and pass tests on Pi

## Foundation Status

**Identity-shell foundation is COMPLETE and OPERATIONAL:**
- ✅ Database renamed to activity_hub
- ✅ Role-based access control operational
- ✅ Dynamic app registry operational
- ✅ Admin endpoints for app management
- ✅ First admin app (Setup Admin) built and working
- ✅ Role-based app visibility working end-to-end

**Demonstrated capabilities:**
- Users with setup_admin role can see and access Setup Admin app
- Regular users cannot see admin apps
- Setup Admin can manage users and apps through web UI
- All changes take effect immediately (no code deployment needed)

## Current Work

### Phase C (Part 2): Game Admin App - IN PROGRESS

Build second admin mini-app for activity management:

**Game Admin App** (requires `game_admin` role)
- Schedule games/activities
- Manage tournaments
- View game statistics
- Activity calendar
- Port: 5070
- Database: `game_admin_db`

Similar structure to Setup Admin, focused on game/activity management rather than system configuration.

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

Setup Admin App (Port 5060)
├── Database: setup_admin_db (audit_log)
├── Auth: requires setup_admin role
├── Features:
│   ├── User management (roles)
│   └── App registry management
└── Registered with required_roles=['setup_admin']
```

## Current Database State

**Identity Database:**
- Database: `activity_hub`
- User: `activityhub`
- Password: `pubgames`
- Port: 5555
- Tables:
  - `users` (with `roles` column)
  - `challenges` (lobby system)
  - `applications` (app registry with 9 apps including setup-admin)

**Admin Databases:**
- `setup_admin_db` (audit_log table) ✅
- `game_admin_db` (to be created)

**App Databases:**
- Still use `pubgames` user (will update during app migration)
- Names unchanged: `tictactoe_db`, `dots_db`, `spoof_db`, etc.

**Old Database:**
- `pubgames` database still exists as backup
- Can be dropped after stable operation

## Testing Notes

**Role-based visibility verified:**
```bash
# Regular users don't see setup-admin
curl http://localhost:3001/api/apps | jq '.apps[] | select(.id=="setup-admin")'
# Returns nothing

# Admin users see setup-admin
curl -H "Authorization: Bearer demo-token-admin@pubgames.local" \
     http://localhost:3001/api/apps | jq '.apps[] | select(.id=="setup-admin") | .name'
# Returns "Setup Admin"
```

**Setup Admin UI working:**
- Accessible at http://192.168.1.45:3001 (logged in as admin)
- Shows in app list for admin users
- Can manage users and apps
- All changes persist to database

## Next Steps

1. **Complete Phase C**: Build Game Admin App (similar structure to Setup Admin)
2. **Document Phase C**: Add ADMIN-APPS.md guide
3. **Begin App Migration**: Start migrating existing apps to use shared library

**Recommendation:** Complete Phase C (Game Admin), then start app migration to test shared library integration.

## Notes
- Shared library (lib/activity-hub-common/) ready but won't be used until apps migrate
- SSL/TLS deferred (easy to add later)
- Season Scheduler needs better name (background jobs/scheduling utility)
- Working on Mac (code editing, Git operations)
- Testing on Pi after committing
- Foundation is solid and proven - ready to scale
