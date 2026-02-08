# Activity Hub - Revised Implementation Plan

**Date**: 2026-02-08
**Session**: giggly-inventing-pixel
**Status**: Phase 2 Complete, Starting Identity-Shell Foundation Work

---

## Why the Revision?

**Original Plan Problem**: Tried to migrate apps to shared library before identity-shell was production-ready.

**Reality Check**: Can't properly test app migrations without a stable identity-shell foundation.

**Solution**: Build identity-shell foundation FIRST, THEN migrate apps incrementally.

---

## Foundation Work (Do These First)

### Phase A: User Management & Roles

**Goal**: Add role-based access control to identity-shell

**New Database Schema**:
```sql
-- Add to pubgames.users table
ALTER TABLE users ADD COLUMN roles TEXT[] DEFAULT '{}';

-- Possible roles:
-- 'user' - default, can access games
-- 'game_admin' - can manage activities/games
-- 'setup_admin' - can configure system settings
```

**Identity-Shell Changes**:
1. Update auth to check user roles
2. Filter apps based on role requirements
3. Show admin apps only to users with correct roles

**Files to Modify**:
- `identity-shell/backend/database.go` - Add role queries
- `identity-shell/backend/auth.go` - Include roles in AuthUser
- `identity-shell/backend/apps.go` - Filter apps by user roles
- `identity-shell/frontend/src/components/Shell.tsx` - Hide apps without permission

---

### Phase C: Create Admin Mini-Apps

**Goal**: Create two new mini-apps for admin functions

#### 1. Setup Admin App
- **Port**: 5060
- **Role Required**: `setup_admin`
- **Purpose**: System configuration
  - Manage users (create, edit, delete)
  - Assign roles
  - System settings
  - View logs/audit trail

- **Tech Stack**:
  - Backend: Go (port 5060)
  - Frontend: React TypeScript
  - Database: PostgreSQL (pubgames DB only - no app DB needed)
  - No Redis/SSE needed (static admin interface)

#### 2. Game Admin App
- **Port**: 5061
- **Role Required**: `game_admin`
- **Purpose**: Activity/game management
  - View all active games
  - View game statistics
  - Moderate/end games if needed
  - View player statistics
  - Leaderboard management

- **Tech Stack**:
  - Backend: Go (port 5061)
  - Frontend: React TypeScript
  - Database: PostgreSQL (reads from all game databases)
  - Redis: Read-only access to active games
  - SSE: Optional for real-time game monitoring

**Registration**:
Both apps registered in apps.json with role requirements:
```json
{
  "id": "setup-admin",
  "name": "Setup Admin",
  "roles": ["setup_admin"],
  "category": "admin"
}
```

---

### Phase B: Database-Driven App Registry

**Goal**: Move apps.json → PostgreSQL for dynamic management

**Schema**:
```sql
CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    category TEXT,              -- 'game', 'utility', 'admin'
    backend_url TEXT,
    backend_port INTEGER,
    roles TEXT[],               -- Required roles (empty = all users)
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_app_preferences (
    user_email TEXT,
    app_id TEXT,
    is_favorite BOOLEAN DEFAULT false,
    display_order INTEGER,
    last_accessed TIMESTAMP,
    PRIMARY KEY (user_email, app_id)
);
```

**Migration Script**:
- Read apps.json
- Insert all apps into database
- Keep apps.json as backup (eventually delete)

**Identity-Shell Changes**:
- Load apps from PostgreSQL instead of JSON file
- Add admin endpoints to manage apps
- User endpoints for favorites/preferences

---

## Migration Strategy (After Foundation Complete)

### Philosophy
**Don't lock down identity-shell until proven across all app types.**

Each app type will reveal different requirements for identity/auth/registry:
- Static apps → Basic auth
- Admin apps → Role checking
- 2-player games → Player matching, turn management
- Multi-player games → Complex state coordination
- Utilities → Background jobs, scheduling

### Migration Order (One of Each Type)

#### 1. Static App (Easiest)
**Candidate**: TBD - need to identify a simple static app
**Tests**: Basic shared library integration (auth, database, http packages)

#### 2. Simple Admin Features → Game Admin App
**Source**: Extract admin features from existing apps
**Tests**: Role-based access, admin middleware from shared library

#### 3. Two-Player Game: Tic-Tac-Toe
**Why**: Well-tested reference implementation
**Tests**: SSE, Redis, turn-based logic, real-time updates

#### 4. Multi-Player Game: Spoof
**Why**: More complex state management
**Tests**: Multi-user coordination, complex game logic

#### 5. Utility/Scheduler: Season Scheduler (needs rename)
**Why**: Different pattern from games
**Tests**: Background jobs?, scheduling patterns, different data model

### Success Criteria (After All 5 Migrated)
- ✅ All app types working with shared library
- ✅ Identity-shell stable and production-ready
- ✅ Role-based access working
- ✅ App registry dynamic and admin-managed
- ✅ No regressions in functionality

**THEN**: Lock down identity-shell, migrate remaining apps en masse

---

## Port Allocation

| Service | Port | Status |
|---------|------|--------|
| identity-shell | 3001 | Existing |
| tic-tac-toe | 4001 | Existing |
| dots | 4011 | Existing |
| spoof | 4021 | Existing |
| sweepstakes | 4031 | Existing |
| leaderboard | 5030 | Existing |
| season-scheduler | 5040 | Existing |
| smoke-test | 5010 | Existing |
| display-admin | 5050 | Existing |
| display-runtime | 5051 | Existing |
| **setup-admin** | **5060** | **NEW** |
| **game-admin** | **5061** | **NEW** |

---

## Deferred Items

- **SSL/TLS**: Easy to add later (Let's Encrypt, Cloudflare Tunnel, or other)
- **JWT Tokens**: Currently using demo-token-{email}, move to JWT after foundation stable
- **Shared Library Mass Migration**: Only after 5 pilot apps prove the framework
- **Repository Separation**: Keep monorepo until library stable

---

## Session Continuity

**To Resume in Next Session**:
1. Read `.claude/SESSION-STATE.md` for current progress
2. Read `.claude/REVISED-PLAN.md` (this file) for strategy
3. Continue with next task in sequence

**Current Status**: Ready to start Phase A (User Management & Roles)

---

## Questions to Answer

1. **Season Scheduler Rename**: What should we call it? Options:
   - Activity Scheduler
   - Event Coordinator
   - Venue Scheduler
   - Competition Manager

2. **Static App Candidate**: Which existing app is simplest/most static?
   - Sweepstakes? (picks-based, less real-time)
   - Leaderboard? (read-heavy, minimal writes)
   - Other?

3. **Role Naming**: Confirm role names:
   - `user` (default)
   - `game_admin` (activity management)
   - `setup_admin` (system configuration)
   - Others needed?

---

## Next Session Start Command

"Continue with Activity Hub identity-shell improvements - Phase A"

Claude will read session state and pick up where we left off.
