# Markdown Files Audit - 2026-02-25

Comprehensive review of all 30 markdown files in the project after CLAUDE.md consolidation.

---

## Summary

**Total files**: 30 markdown files
**Status**:
- ✅ **Good (24)**: Current, accurate, properly located
- ⚠️ **Needs Update (5)**: Outdated credentials or minor fixes needed
- ❌ **Should Delete (1)**: Redundant after consolidation

---

## Files by Category

### ✅ Core Documentation (docs/) - All Good

**Status**: All current and accurate after consolidation

1. `docs/ARCHITECTURE.md` ✅
2. `docs/ARCHITECTURE-DECISIONS.md` ✅
3. `docs/FRONTEND.md` ✅
4. `docs/BACKEND.md` ✅
5. `docs/DATABASE.md` ✅
6. `docs/REALTIME.md` ✅
7. `docs/ROLES.md` ✅
8. `docs/APP-REGISTRY.md` ✅
9. `docs/NEW-APP-GUIDE.md` ✅
10. `docs/MIGRATION-TO-ACTIVITY-HUB-CSS.md` ✅
11. `docs/STYLE-GUIDE.md` ✅
12. `docs/ROADMAP.md` ✅ (created today)
13. `docs/LESSONS-LEARNED.md` ✅ (created today)
14. `docs/DEPLOYMENT.md` ✅ (created today)

---

### ✅ Library Documentation - All Good

**Status**: Current and accurate

15. `lib/activity-hub-common/README.md` ✅
16. `lib/activity-hub-common/CHANGELOG.md` ✅
17. `lib/eslint-plugin-activity-hub/README.md` ✅

---

### ✅ Game Documentation - Good

**Status**: Current and properly maintained

18. `games/smoke-test/README.md` ✅ - Reference implementation docs
19. `games/tic-tac-toe/TESTING.md` ✅ - Game-specific technical doc
20. `games/tic-tac-toe/REDIS-SCHEMA.md` ✅ - Game-specific technical doc
21. `games/season-scheduler/README.md` ✅
22. `games/display-runtime/README.md` ✅
23. `games/leaderboard/README.md` ✅ - Updated with correct credentials
24. `games/sweepstakes-knockout/README.md` ✅ - Good but see note below

---

### ⚠️ Needs Update - Outdated Credentials

**Issue**: Reference old PostgreSQL credentials (user "pubgames" instead of "activityhub")

25. `scripts/README.md` ⚠️
   - **Line 40**: `PGPASSWORD=pubgames psql -h localhost -U pubgames`
   - **Fix**: Update to use `activityhub` user
   - **Also**: Update default users table and environment variables section

26. `games/dots/README.md` ⚠️
   - **Line 83**: `psql -U pubgames -c "CREATE DATABASE dots_db;"`
   - **Fix**: Change to `psql -U activityhub -h localhost -p 5555`

27. `games/display-admin/README.md` ⚠️
   - **Lines 8, 125, 128**: References to `pubgames` database/user
   - **Fix**: Change to `activity_hub` database and `activityhub` user
   - **Also**: IP address 192.168.1.45 should be 192.168.1.29

28. `static-apps/leaderboard/README.md` ⚠️
   - **Issue**: Wrong directory path (should be `games/leaderboard/`)
   - **Lines 92**: `psql -U pubgames` should be `psql -U activityhub`
   - **Note**: Duplicate of `games/leaderboard/README.md` (which is correct)

---

### ❌ Should Delete - Redundant

29. `.claude/SESSION-STATE.md` ❌
   - **Size**: 784 lines
   - **Issue**: Outdated session notes (last updated 2026-02-24)
   - **Reason**: Information now properly organized in:
     - `docs/LESSONS-LEARNED.md` (historical context)
     - `docs/DEPLOYMENT.md` (deployment procedures)
     - `docs/ROADMAP.md` (future work)
     - `CLAUDE.md` (current status)
   - **Action**: Delete or archive

---

### ✅ Main Project File - Updated

30. `CLAUDE.md` ✅ (updated today)
   - Consolidated from 1528 lines to 395 lines (74% reduction)
   - Now serves as project guide and documentation index
   - Current and accurate

---

## Recommendations

### High Priority

1. **Delete `.claude/SESSION-STATE.md`**
   - Fully redundant after consolidation
   - Information moved to appropriate docs
   - No longer needed

2. **Delete `static-apps/leaderboard/README.md`**
   - Wrong directory location
   - Duplicate of `games/leaderboard/README.md`
   - Outdated credentials

### Medium Priority

3. **Update `scripts/README.md`**
   - Change all `pubgames` references to `activityhub`
   - Update port references (add `-p 5555`)
   - Update default users section to reflect `activity_hub` database

4. **Update `games/dots/README.md`**
   - Line 83: Change database creation command
   - Use `activityhub` user and port 5555

5. **Update `games/display-admin/README.md`**
   - Change `pubgames` to `activity_hub` database
   - Change user to `activityhub`
   - Update IP address: 192.168.1.45 → 192.168.1.29
   - Add port specification: `-p 5555`

### Low Priority

6. **Update `games/sweepstakes-knockout/README.md`** (optional)
   - Add note about current incomplete status
   - Reference CLAUDE.md for current work status

---

## Migration Commands

### Delete Redundant Files

```bash
cd ~/Documents/Projects/pub-games-v3

# Delete session state (redundant)
rm .claude/SESSION-STATE.md

# Delete wrong-location leaderboard readme (duplicate)
rm static-apps/leaderboard/README.md
```

### Update Credentials References

Quick search for remaining old credentials:

```bash
# Find remaining references to old user
grep -r "pubgames" --include="*.md" .

# Find IP address references that need updating
grep -r "192.168.1.45" --include="*.md" .
```

---

## Post-Consolidation Benefits

After today's reorganization:

1. **Single source of truth**: Each type of information has one home
   - Historical lessons → `docs/LESSONS-LEARNED.md`
   - Future plans → `docs/ROADMAP.md`
   - Deployment procedures → `docs/DEPLOYMENT.md`
   - Quick reference → `CLAUDE.md`

2. **Reduced duplication**: Eliminated 1133 lines of redundant content

3. **Better organization**: Clear documentation hierarchy

4. **Easier maintenance**: Updates go in one logical place

5. **Cleaner repository**: Fewer outdated/conflicting files

---

## Files Not Needing Changes

These files are current and accurate:

- All documentation in `docs/` (14 files)
- All library READMEs (3 files)
- Most game READMEs (7 files)
- Main `CLAUDE.md`

Total: 25 of 30 files are already good ✅

---

## Next Steps

1. Review this audit
2. Delete 2 redundant files
3. Update 3 files with outdated credentials
4. Commit changes with message: `docs: audit and update markdown files after consolidation`
