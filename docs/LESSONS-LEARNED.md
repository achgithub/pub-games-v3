# Pub Games v3 - Lessons Learned

This document captures important lessons learned during development to help avoid repeating mistakes.

---

## Database Architecture

**Lesson**: Two-layer database system is essential for multi-app architecture

- **Two-layer system**: Shared `activity_hub` DB (auth) + separate app DBs (data)
- All apps connect to TWO databases: `activity_hub` for users, `{app}_db` for app data
- PostgreSQL location: Centralized server storage (NOT in project folders)
- SQLite vs PostgreSQL: Switched from file-based SQLite to PostgreSQL server

**Why it matters**: Having a shared authentication database allows users to seamlessly move between apps while maintaining their identity. App-specific databases provide isolation and prevent one app from breaking another.

---

## Environment Configuration

**Lesson**: Non-standard port configurations must be explicitly documented

- **PostgreSQL port**: 5555 (not default 5432)
- **PostgreSQL credentials**: user=`activityhub`, password=`pubgames` (not `pubgames123`)
- **Database creation**: `psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE {app}_db;"`
- Must specify `-p 5555` in all psql commands

**Why it matters**: Using a non-standard port avoids conflicts with other PostgreSQL instances but requires explicit configuration everywhere. Forgetting the port specification leads to mysterious connection failures.

---

## Go Development

**Lesson**: Go modules are non-negotiable in modern Go development

- **Modules required**: Must have `go.mod` file (Go 1.25+)
- No manual `go get` - use `go mod download` or run directly
- **NULL handling**: Use `sql.NullString` for nullable DB columns, convert to string after scan
- **Import cleanup**: Remove unused imports (Go compiler enforces this)

**Why it matters**: Go modules provide reproducible builds and dependency management. NULL handling is critical for database operations - scanning NULL values directly into Go strings causes runtime errors.

---

## Testing Pattern

**Lesson**: Keep test suites focused and realistic

- Create test scripts with 10 core tests (not 35+ - too many)
- Test authentication with real admin users from database
- Use `jq` for JSON formatting in curl tests
- Save test artifacts (e.g., QR codes) for manual verification

**Why it matters**: Overly comprehensive test suites take too long to run and become maintenance burdens. Focus on critical paths and realistic scenarios. Testing with real data catches more issues than synthetic tests.

---

## Common Pitfalls

**What we learned to avoid**:

- ❌ **Forgetting to specify PostgreSQL port (5555)** - Leads to "connection refused" errors
- ❌ **Using wrong password (pubgames123 vs pubgames)** - Causes authentication failures
- ❌ **Scanning NULL database values directly into Go strings** - Runtime panic
- ❌ **Missing `go.mod` file for Go modules** - Build failures
- ❌ **Testing with non-existent users** - Check `activity_hub.users` table first

**Solutions**:
- Create environment variable files for database config
- Always use `sql.NullString` for nullable columns
- Initialize go modules immediately: `go mod init`
- Query database before writing tests

---

## Display Admin Specifics

**Lesson**: TV/display apps need different patterns than player apps

- **Port**: 5050
- **Database**: `display_admin_db`
- **Token system**: UUID tokens for TV identification (not user auth)
- **QR codes**: Use `github.com/skip2/go-qrcode` library
- **File uploads**: Store in `./uploads/`, serve via `/uploads/` route
- **Admin-only**: All endpoints require admin authentication except token lookup

**Why it matters**: Display screens don't have user authentication - they use device tokens instead. This requires a fundamentally different authentication pattern than player-facing apps.

---

## Development Workflow Reminder

**Lesson**: Split development environment requires discipline

1. Write code on Mac (Claude Code)
2. Commit to Git on Mac
3. Push when ready (user manually pushes)
4. Pull on Pi: `cd ~/pub-games-v3 && git pull`
5. Build/test on Pi (Go, npm, PostgreSQL run here)

**Why it matters**: Having the Mac as the single source of truth for Git operations prevents merge conflicts. Building on Pi ensures the production environment is always tested. Breaking this workflow causes divergent branches and merge headaches.

---

## Built Artifacts

**Lesson**: Built files must be in Git but only committed from Mac

**Problem**: Shared CSS and frontends must be built on Pi (has npm), but Mac is Git lead.

**Solution**: Build on Pi, SCP to Mac, commit from Mac immediately.

**Why it matters**: If Pi commits built files, it creates divergent branches. Mac must always be the single commit source. Built files in Git ensure deployments work without build step.

See `CLAUDE.md` for detailed workflow.

---

## SSE Presence System

**Lesson**: Real-time presence is hard; acceptable workarounds are okay

**Known issue**: SSE presence requires manual refresh after impersonation (acceptable for debugging tool)

**Why it's acceptable**: The impersonation feature is a debugging/admin tool, not a production feature. Requiring a refresh after impersonation is a reasonable tradeoff vs complex session management.

**Why it matters**: Perfect real-time presence is complex and error-prone. Sometimes "good enough" is actually good enough, especially for admin-only features.

---

## Port Allocation Strategy

**Lesson**: Logical port ranges prevent chaos

Current allocation:
- identity-shell: 3001
- Games (4xxx): tic-tac-toe: 4001, dots: 4011, sweepstakes: 4031, lms: 4021, quiz-player: 4041, spoof: 4051, mobile-test: 4061
- Admin/Support (5xxx): smoke-test: 5010, setup-admin: 5020, leaderboard: 5030, season-scheduler: 5040, display-admin: 5050, display-runtime: 5051, game-admin: 5070, quiz-master: 5080, quiz-display: 5081

**Pattern**: Group related apps by port range, leave gaps for future additions.

**Why it matters**: Random port allocation leads to confusion. Logical grouping makes it easy to remember and prevents accidental port conflicts.

---

## TypeScript Migration

**Lesson**: TypeScript should have been mandatory from day one

**What happened**: Some early apps used JavaScript, causing type-related bugs and inconsistencies.

**Solution**: ALL new apps MUST use TypeScript. Pre-commit hooks enforce this.

**Why it matters**: TypeScript catches bugs at compile time that would be runtime errors in JavaScript. Consistency across apps makes maintenance easier. The upfront cost of TypeScript pays off immediately.

---

## Shared CSS Evolution

**Lesson**: CSS duplication wastes time and causes drift

**What happened**: Early apps had copy-pasted CSS. Changes required updating multiple files. Visual inconsistencies emerged.

**Solution**: Single shared CSS file (`activity-hub.css`) served from identity-shell, loaded dynamically by all apps.

**Why it matters**: Single source of truth for styling. Update once, all apps benefit. Automated enforcement prevents new apps from deviating.

See `docs/MIGRATION-TO-ACTIVITY-HUB-CSS.md` for migration guide.

---

## Pre-commit Hooks

**Lesson**: Enforcement mechanisms prevent technical debt

**What happened**: Created sweepstakes-knockout by copying smoke-test. Pre-commit checks passed but app had wrong patterns (missing CSS loading, inline styles, etc.).

**Problem**: Hooks weren't strong enough to catch violations.

**Solution**: Strengthened pre-commit hooks, added ESLint plugin, created app template generator.

**Why it matters**: Automated enforcement is more reliable than manual code review. Catching issues before commit is cheaper than fixing them later.

---

## Quiz System Architecture

**Lesson**: Media management needs shared storage

**Solution**: Symlink uploads directories so all quiz backends read/write the same media files.

```bash
mkdir -p ~/pub-games-v3/games/game-admin/backend/uploads/quiz/images
mkdir -p ~/pub-games-v3/games/game-admin/backend/uploads/quiz/audios
ln -sfn ~/pub-games-v3/games/game-admin/backend/uploads \
        ~/pub-games-v3/games/quiz-master/backend/uploads
```

**Why it matters**: Multiple apps need access to the same media files. Symlinking prevents duplication and keeps storage centralized. game-admin owns the files, others share access.

---

## Reference Implementation

**Lesson**: Having a "gold standard" app prevents reinventing the wheel

**Solution**: `games/smoke-test/` demonstrates all patterns correctly.

**Pattern**:
- Shared CSS loading
- TypeScript frontend
- activity-hub-common library
- PostgreSQL + Redis
- SSE for real-time
- URL parameter parsing

**Why it matters**: New developers (or Claude) can copy smoke-test and get everything right the first time. No guessing about patterns. Reduces setup time from hours to minutes.

---

## Key Takeaways

1. **Standardization prevents drift** - Enforce patterns early and automatically
2. **Split environments require discipline** - Mac commits, Pi builds, always
3. **Reference implementations save time** - Copy what works, don't reinvent
4. **Testing realism matters** - 10 good tests beat 100 synthetic ones
5. **Documentation must be current** - Outdated docs are worse than no docs
6. **Good enough is sometimes good enough** - Perfect is the enemy of done
7. **Type safety pays off immediately** - TypeScript should be non-negotiable
8. **Shared resources need clear ownership** - One source of truth per artifact
