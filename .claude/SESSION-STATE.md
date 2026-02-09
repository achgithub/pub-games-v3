# Activity Hub Migration - Session State

**Last Updated**: 2026-02-09
**Session ID**: Phase 0, A, B, C (Part 1) & Identity Shell Improvements Complete
**Current Phase**: Ready for new features
**Status**: Identity-shell foundation complete with Impersonation, Personalization, and Guest Mode

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
- ✅ Backend (Go) on port 5020
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

### Identity Shell Improvements ✅ (2026-02-09)

**Phase 1: User Impersonation**
- ✅ Database: `impersonation_sessions` table for audit tracking
- ✅ Backend: `identity-shell/backend/impersonation.go` with start/end endpoints
- ✅ New role: `super_user` with read-only Setup Admin access + impersonation
- ✅ Frontend: Impersonation banner and Exit button
- ✅ Setup Admin: Impersonate button for each user, read-only mode for super_user
- ✅ Security: Full audit trail, read-only enforcement via X-Permission-Level header
- ✅ Migration: `scripts/migrate_add_impersonation.sh`
- ✅ Tested and operational
- ⚠️ Known issue: SSE presence requires manual F5 refresh after impersonation (acceptable for debugging tool)

**Phase 2: App Personalization**
- ✅ Database: `user_app_preferences` table for per-user app settings
- ✅ Backend: `identity-shell/backend/preferences.go` with GET/PUT endpoints
- ✅ Frontend: Settings modal with show/hide toggles and reorder controls
- ✅ Features: Hide apps, reorder with up/down arrows, changes persist per-user
- ✅ Applied after role-based filtering (can't unhide admin apps)
- ✅ Migration: `scripts/migrate_add_user_preferences.sh`
- ✅ Tested and operational

**Phase 3: Guest Mode**
- ✅ Database: `guest_accessible` column on applications table
- ✅ Backend: Guest login endpoint with guest-token-{uuid}
- ✅ Frontend: "Continue as Guest" button, simplified guest UI
- ✅ Features: Public access without authentication, no lobby/challenges/SSE
- ✅ Security: Only apps marked guest_accessible visible to guests
- ✅ Migration: `scripts/migrate_add_guest_mode.sh` (marks leaderboard as guest_accessible)
- ✅ Tested and operational

**Test Users:**
- `alice@pubgames.local` - super_user (can impersonate, read-only Setup Admin)
- `bob@pubgames.local` - regular user (for personalization testing)
- Guest - no authentication (only sees guest_accessible apps)

**App Registry Updates:**
- Setup Admin visible to both `setup_admin` and `super_user` roles
- Leaderboard marked as `guest_accessible = true`

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

**Status:** Ready for new features/improvements

**Available Options:**
1. **Phase C (Part 2)**: Game Admin App - Build second admin mini-app for activity management
2. **App Migration**: Start migrating existing apps to use shared library
3. **New Features**: Additional identity-shell enhancements
4. **Bug Fixes**: Address any issues that arise

**Deferred (Can be added later):**
- Game Admin App (similar to Setup Admin, for activity management)
- SSL/TLS (easy to add when needed)
- SSE reconnection on user change (would fix impersonation presence delay)

## Architecture Summary

```
Identity-Shell (Port 3001)
├── Database: activity_hub
│   ├── users (with roles)
│   ├── challenges (lobby system)
│   ├── applications (app registry with guest_accessible)
│   ├── impersonation_sessions (audit trail)
│   └── user_app_preferences (personalization)
├── Public API
│   ├── /api/login (returns user + roles)
│   ├── /api/login/guest (guest access)
│   ├── /api/validate (returns user + roles + impersonation state)
│   ├── /api/apps (filtered by user roles + preferences)
│   ├── /api/user/preferences (GET/PUT)
│   └── /api/admin/impersonate (super_user only)
├── Admin API (requires setup_admin)
│   ├── GET /api/admin/apps
│   ├── PUT /api/admin/apps/:id
│   ├── POST /api/admin/apps/:id/enable
│   └── POST /api/admin/apps/:id/disable
└── Lobby API (existing)

Setup Admin App (Port 5020)
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
  - `users` (with `roles` column - supports setup_admin, game_admin, super_user)
  - `challenges` (lobby system)
  - `applications` (app registry with 9 apps, includes guest_accessible flag)
  - `impersonation_sessions` (audit trail for super_user impersonation)
  - `user_app_preferences` (per-user app hide/reorder settings)

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

**Identity-shell foundation is complete and operational with all improvements:**
- ✅ Role-based access control
- ✅ Dynamic app registry
- ✅ User impersonation for debugging
- ✅ Per-user app personalization
- ✅ Guest mode for public access

**Options for next work:**
1. Build Game Admin App (Phase C Part 2)
2. Migrate existing apps to shared library
3. New identity-shell features as requested
4. Address issues/improvements as they arise

**Recommendation:** Wait for user direction on next priority.

## Notes
- Shared library (lib/activity-hub-common/) ready but won't be used until apps migrate
- SSL/TLS deferred (easy to add later)
- Season Scheduler needs better name (background jobs/scheduling utility)
- Working on Mac (code editing, Git operations)
- Testing on Pi after committing
- Foundation is solid and proven - ready to scale
