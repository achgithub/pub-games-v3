# Phase 0: Database Rename Plan

**Date Created**: 2026-02-08
**Status**: Ready to Execute
**Estimated Time**: 30-45 minutes

---

## Why Now?

We're about to build the identity-shell foundation (roles, admin apps, app registry). Renaming the database NOW means:
- ✅ New features built on correct foundation
- ✅ Less to rename later
- ✅ New admin databases get correct names from start
- ✅ Surgical change - just connection strings

---

## What Gets Renamed

### Database Level (NOW)
- `pubgames` DB → `activity_hub`
- `pubgames` user → `activityhub`
- Password: Keep as `pubgames` (or change if desired)

### App Databases (NO CHANGE)
- `tictactoe_db` - stays as-is
- `dots_db` - stays as-is
- `spoof_db` - stays as-is
- `sweepstakes_db` - stays as-is
- `display_admin_db` - stays as-is

### New Admin Databases (FUTURE)
- `activity_hub_setup_admin` - setup admin app database
- `activity_hub_game_admin` - game admin app database

### Directory/Repo (LATER)
- `pub-games-v3` → `activity-hub` (defer until foundation stable)

---

## Step-by-Step Execution

### Part 1: Database Migration (On Pi)

```bash
# 1. Backup current database
cd ~/pub-games-v3
pg_dump -U pubgames -p 5555 pubgames > pubgames_backup_$(date +%Y%m%d).sql

# 2. Verify backup
ls -lh pubgames_backup_*.sql

# 3. Create new database
psql -U pubgames -p 5555 -d postgres -c "CREATE DATABASE activity_hub;"

# 4. Create new user (or skip if keeping pubgames user)
psql -U pubgames -p 5555 -d postgres -c "CREATE USER activityhub WITH PASSWORD 'pubgames';"

# 5. Grant permissions
psql -U pubgames -p 5555 -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE activity_hub TO activityhub;"

# 6. Restore data to new database
psql -U activityhub -p 5555 activity_hub < pubgames_backup_$(date +%Y%m%d).sql

# 7. Verify data restored
psql -U activityhub -p 5555 -d activity_hub -c "SELECT COUNT(*) FROM users;"
psql -U activityhub -p 5555 -d activity_hub -c "\dt"

# 8. Test connection with new credentials
psql -U activityhub -p 5555 -d activity_hub -c "SELECT email, name, is_admin FROM users LIMIT 5;"
```

### Part 2: Update Code (On Mac)

**Files to Update**:

1. **Shared Library**:
   ```
   lib/activity-hub-common/database/postgres.go
   ```
   Change: `dbName := "pubgames"` → `dbName := "activity_hub"`
   Change: `dbUser := getEnv("DB_USER", "pubgames")` → `dbUser := getEnv("DB_USER", "activityhub")`

2. **Identity Shell**:
   ```
   identity-shell/backend/database.go
   identity-shell/backend/main.go (if has hardcoded connection)
   ```

3. **All Game Apps** (7 apps):
   ```
   games/tic-tac-toe/backend/database.go
   games/dots/backend/database.go
   games/spoof/backend/database.go
   games/sweepstakes/backend/database.go
   games/season-scheduler/backend/database.go
   games/display-admin/backend/database.go
   games/display-runtime/backend/database.go (if uses identity DB)
   ```

   Change in each:
   ```go
   // OLD
   dbName := "pubgames"
   dbUser := getEnv("DB_USER", "pubgames")

   // NEW
   dbName := "activity_hub"
   dbUser := getEnv("DB_USER", "activityhub")
   ```

4. **Documentation**:
   ```
   CLAUDE.md
   docs/DATABASE.md
   docs/BACKEND.md
   README.md (if exists)
   ```

   Search and replace:
   - Database name: `pubgames` → `activity_hub`
   - Database user: `pubgames` → `activityhub`
   - Update examples, commands, connection strings

5. **Scripts**:
   ```
   scripts/setup_databases.sh (if exists)
   scripts/*.sh (any database scripts)
   ```

### Part 3: Test on Pi

```bash
# On Mac: Commit and push
git add .
git commit -m "Phase 0: Rename database pubgames → activity_hub

- Update shared library to use activity_hub database
- Update all apps to use activityhub user
- Update documentation
- Preserve app database names (tictactoe_db, etc.)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push

# On Pi: Pull and test
cd ~/pub-games-v3
git pull

# Test identity-shell first
cd identity-shell/backend
go run *.go

# In another terminal, test endpoint
curl http://localhost:3001/api/apps

# If identity-shell works, test one game app
cd ~/pub-games-v3/games/tic-tac-toe/backend
go run *.go

curl -H "Authorization: Bearer demo-token-admin@test.com" http://localhost:4001/api/config
```

### Part 4: Verify and Cleanup

```bash
# On Pi: If all apps work, drop old database
psql -U pubgames -p 5555 -d postgres -c "DROP DATABASE pubgames;"

# Optional: Drop old user if created new one
psql -U activityhub -p 5555 -d postgres -c "DROP USER pubgames;"

# Keep backup for safety
mv pubgames_backup_*.sql ~/backups/ # or wherever you keep backups
```

---

## Rollback Plan (If Issues)

```bash
# On Pi: Restore old database if needed
psql -U pubgames -p 5555 -d postgres -c "CREATE DATABASE pubgames;"
psql -U pubgames -p 5555 pubgames < pubgames_backup_YYYYMMDD.sql

# On Mac: Revert code changes
git revert HEAD
git push
```

---

## Checklist

**Pre-Migration**:
- [ ] Backup current database
- [ ] Verify backup file exists and has data

**Database Migration**:
- [ ] Create `activity_hub` database
- [ ] Create `activityhub` user
- [ ] Grant permissions
- [ ] Restore data
- [ ] Verify data (user count, tables)

**Code Updates** (On Mac):
- [ ] Update lib/activity-hub-common/database/postgres.go
- [ ] Update identity-shell/backend/database.go
- [ ] Update tic-tac-toe/backend/database.go
- [ ] Update dots/backend/database.go
- [ ] Update spoof/backend/database.go
- [ ] Update sweepstakes/backend/database.go
- [ ] Update season-scheduler/backend/database.go
- [ ] Update display-admin/backend/database.go
- [ ] Update display-runtime/backend/database.go (if applicable)
- [ ] Update CLAUDE.md
- [ ] Update docs/DATABASE.md
- [ ] Update docs/BACKEND.md
- [ ] Update any scripts

**Testing** (On Pi):
- [ ] Identity-shell starts
- [ ] Identity-shell API responds
- [ ] Tic-tac-toe starts
- [ ] Tic-tac-toe API responds
- [ ] Dots starts and works
- [ ] Spoof starts and works
- [ ] Other apps start and work

**Cleanup**:
- [ ] Drop old `pubgames` database
- [ ] Drop old `pubgames` user (optional)
- [ ] Archive backup file

---

## After Phase 0

**Immediate Next Steps**:
1. Phase A: User Management & Roles (add `roles` column to `activity_hub.users`)
2. Phase C: Create Admin Mini-Apps (use `activity_hub_setup_admin`, `activity_hub_game_admin` databases)
3. Phase B: Database-Driven App Registry (add `applications` table to `activity_hub`)

**Directory Rename (Later)**:
- Defer `pub-games-v3` → `activity-hub` until foundation stable
- Less urgent, more cosmetic

---

## Questions/Decisions

1. **User password**: Keep as `pubgames` or change to `activityhub`?
   - Recommendation: Keep as `pubgames` (less to remember, internal only)

2. **Environment variables**: Update or keep?
   - `DB_USER=pubgames` → `DB_USER=activityhub` (in environment)
   - Or hardcode defaults in code and leave env vars optional

3. **Old database**: When to drop?
   - After 1 day of testing? 1 week?
   - Recommendation: 1 week, keep backup indefinitely

---

## Resume Command

**Next Session**: "Continue with Phase 0 - Database Rename"

Claude will read this file and `.claude/SESSION-STATE.md` to resume.
