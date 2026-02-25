# Pub Games v3 - Deployment Guide

This document covers deployment procedures for the pub-games-v3 platform.

---

## Standard Deployment Workflow

The standard workflow for deploying changes:

### On Mac (Development)

1. Write code using Claude Code
2. Test locally if possible (limited - no Go/npm)
3. Commit changes:
   ```bash
   git add .
   git commit -m "descriptive message"
   ```
4. Push to GitHub:
   ```bash
   git push
   ```

### On Pi (Production)

1. Pull latest changes:
   ```bash
   cd ~/pub-games-v3
   git pull
   ```

2. If Go dependencies changed:
   ```bash
   cd games/{app}/backend
   go mod tidy
   ```

3. If frontend changed:
   ```bash
   cd games/{app}/frontend
   npm install  # if package.json changed
   npm run build
   cp -r build/* ../backend/static/
   ```

4. If database schema changed:
   ```bash
   psql -U activityhub -h localhost -p 5555 -d {app}_db -f games/{app}/database/schema.sql
   ```

5. Restart service:
   ```bash
   # Stop old process (find PID and kill)
   ps aux | grep "games/{app}/backend"
   kill <PID>

   # Start new process
   cd games/{app}/backend
   go run *.go &
   ```

---

## Built Artifacts Workflow

**Problem**: Shared CSS and frontends must be built on Pi (has npm), but Mac is Git lead.

**CORRECT WORKFLOW (Always follow this)**:

1. **Mac**: Edit source file → commit → push
2. **Pi**: Pull → build artifact (`npm run build`)
3. **Mac IMMEDIATELY**: SCP built file from Pi → commit → push
4. **Pi**: Discard local changes → pull committed version

### Example: Shared CSS

```bash
# 1. Mac: Edit lib/activity-hub-common/styles/activity-hub-src.css → commit → push

# 2. Pi: Build
cd ~/pub-games-v3 && git pull
cd lib/activity-hub-common/styles && npm run build

# 3. Mac: Get built file and commit IMMEDIATELY
cd ~/Documents/Projects/pub-games-v3
scp andrew@192.168.1.29:~/pub-games-v3/identity-shell/backend/static/activity-hub.css identity-shell/backend/static/
git add identity-shell/backend/static/activity-hub.css
git commit -m "build: rebuild shared CSS"
git push

# 4. Pi: Discard local build and pull committed version
cd ~/pub-games-v3
git checkout -- identity-shell/backend/static/activity-hub.css
git pull
```

### NEVER DO THIS

- ❌ Build on Pi → commit from Pi → push from Pi (breaks "Mac is lead", causes merge conflicts)
- ❌ Build on Pi and forget to commit from Mac (built file out of sync with source)

**Why this matters**: If Pi commits, it creates divergent branches requiring merges. Mac must always be the single source of commits.

---

## Quiz System Deployment

Run these steps after `git pull` on the Pi for initial quiz system setup:

```bash
# 1. Create and initialise quiz_db
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE quiz_db;"
psql -U activityhub -h localhost -p 5555 -d quiz_db -f games/quiz-player/database/schema.sql

# 2. Update game-admin deps (added redis + pq)
cd ~/pub-games-v3/games/game-admin/backend && go mod tidy

# 3. Resolve deps for new backends
cd ~/pub-games-v3/games/quiz-player/backend  && go mod tidy
cd ~/pub-games-v3/games/quiz-master/backend  && go mod tidy
cd ~/pub-games-v3/games/quiz-display/backend && go mod tidy
cd ~/pub-games-v3/games/mobile-test/backend  && go mod tidy

# 4. Build all frontends (game-admin rebuilds to pick up quiz module)
cd ~/pub-games-v3/games/game-admin/frontend   && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/quiz-player/frontend  && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/quiz-master/frontend  && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/quiz-display/frontend && npm run build && cp -r build/* ../backend/static/
cd ~/pub-games-v3/games/mobile-test/frontend  && npm run build && cp -r build/* ../backend/static/

# 5. Register apps in activity_hub
psql -U activityhub -h localhost -p 5555 -d activity_hub -f scripts/migrate_add_quiz_apps.sql

# 6. Shared uploads directory — create and symlink so all quiz backends
#    read/write the same media files
mkdir -p ~/pub-games-v3/games/game-admin/backend/uploads/quiz/images
mkdir -p ~/pub-games-v3/games/game-admin/backend/uploads/quiz/audios
ln -sfn ~/pub-games-v3/games/game-admin/backend/uploads \
        ~/pub-games-v3/games/quiz-master/backend/uploads
ln -sfn ~/pub-games-v3/games/game-admin/backend/uploads \
        ~/pub-games-v3/games/quiz-display/backend/uploads
ln -sfn ~/pub-games-v3/games/game-admin/backend/uploads \
        ~/pub-games-v3/games/mobile-test/backend/uploads

# 7. Start new services (add to whatever process manager you use)
cd ~/pub-games-v3/games/quiz-player/backend  && go run *.go &
cd ~/pub-games-v3/games/quiz-master/backend  && go run *.go &
cd ~/pub-games-v3/games/quiz-display/backend && go run *.go &
cd ~/pub-games-v3/games/mobile-test/backend  && go run *.go &
```

### Quiz System Notes

- Port 4051 was already taken by spoof — mobile-test uses **4061**
- game-admin must be running for media uploads to work (it owns the uploads dir)
- quiz-display URL format: `http://pi:5081/?session=JOINCODE` — no auth required
- To grant quiz_master role: `UPDATE users SET roles = array_append(roles, 'quiz_master') WHERE email = 'user@example.com';`
- Test workflow: Game Admin → Quiz → upload media → create questions → create pack → start quiz-master → join with quiz-player

---

## New App Deployment

When deploying a new app for the first time:

### 1. On Mac - Create and Commit

Use the app template generator:
```bash
./scripts/create-app.sh my-new-game 4099
```

Or manually create following `docs/NEW-APP-GUIDE.md`.

Commit all code:
```bash
git add games/my-new-game
git commit -m "feat: add my-new-game app"
git push
```

### 2. On Pi - Setup Database

```bash
cd ~/pub-games-v3
git pull

# Create database (if app needs one)
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE my_new_game_db;"

# Apply schema (if exists)
psql -U activityhub -h localhost -p 5555 -d my_new_game_db -f games/my-new-game/database/schema.sql
```

### 3. On Pi - Install Dependencies

```bash
# Backend deps
cd ~/pub-games-v3/games/my-new-game/backend
go mod tidy

# Frontend deps
cd ../frontend
npm install
```

### 4. On Pi - Build Frontend

```bash
cd ~/pub-games-v3/games/my-new-game/frontend
npm run build
cp -r build/* ../backend/static/
```

### 5. On Pi - Register in App Registry

```sql
-- Via psql
psql -U activityhub -h localhost -p 5555 -d activity_hub

INSERT INTO apps (
  app_id, name, url, description, category, enabled, display_order
) VALUES (
  'my-new-game',
  'My New Game',
  'http://192.168.1.29:4099',
  'Description of the game',
  'games',
  true,
  100
);
```

Or use the API via game-admin interface.

### 6. On Pi - Start Service

```bash
cd ~/pub-games-v3/games/my-new-game/backend
go run *.go &

# Or add to process manager (systemd, PM2, etc.)
```

### 7. Test

```bash
# Check app is running
curl http://localhost:4099/api/config

# Check it appears in identity-shell
curl http://localhost:3001/api/apps?token=<admin-token>
```

---

## Database Migrations

When modifying database schemas:

### Creating a Migration

```bash
# Create migration SQL file
touch games/{app}/database/migration_v2.sql
```

Example migration:
```sql
-- games/{app}/database/migration_v2.sql
ALTER TABLE my_table ADD COLUMN new_field VARCHAR(255);

-- Always include rollback comments
-- Rollback: ALTER TABLE my_table DROP COLUMN new_field;
```

### Applying a Migration

```bash
# On Pi
cd ~/pub-games-v3
git pull

psql -U activityhub -h localhost -p 5555 -d {app}_db -f games/{app}/database/migration_v2.sql
```

### Best Practices

- Always test migrations on a backup first
- Include rollback instructions in comments
- Use transactions where possible
- Document breaking changes clearly
- Update schema.sql to reflect final state

---

## Service Management

### Manual Process Management

Current approach uses background processes:

```bash
# Start service
cd ~/pub-games-v3/games/{app}/backend
go run *.go &

# Find running services
ps aux | grep "games/"

# Stop a service
kill <PID>
```

### Future: Process Manager

Consider using a process manager like:
- **systemd** (native Linux)
- **PM2** (Node.js process manager)
- **Supervisor** (Python-based)

Example systemd service file:
```ini
[Unit]
Description=Identity Shell
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=andrew
WorkingDirectory=/home/andrew/pub-games-v3/identity-shell/backend
ExecStart=/usr/local/go/bin/go run *.go
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Rollback Procedure

If a deployment breaks something:

### 1. Quick Rollback (Git)

```bash
# On Pi
cd ~/pub-games-v3
git log --oneline -10  # Find last good commit
git checkout <commit-hash>

# Rebuild if needed
cd games/{app}/frontend && npm run build && cp -r build/* ../backend/static/

# Restart service
ps aux | grep "games/{app}"
kill <PID>
cd games/{app}/backend && go run *.go &
```

### 2. Database Rollback

```sql
-- Use rollback instructions from migration comments
-- Example:
ALTER TABLE my_table DROP COLUMN new_field;
```

### 3. Return to Main Branch

After fixing the issue on Mac:

```bash
# On Pi
cd ~/pub-games-v3
git checkout main
git pull
```

---

## Health Checks

Verify system health:

```bash
# Check all services are running
ps aux | grep "games/" | grep -v grep

# Check PostgreSQL
psql -U activityhub -h localhost -p 5555 -d postgres -c "SELECT 1;"

# Check Redis
redis-cli ping

# Check identity-shell (critical)
curl http://localhost:3001/api/apps

# Check shared CSS is being served
curl http://localhost:3001/shared/activity-hub.css | head -20
```

---

## Troubleshooting

### Service Won't Start

1. Check for port conflicts:
   ```bash
   lsof -i :<port>
   ```

2. Check Go dependencies:
   ```bash
   cd games/{app}/backend
   go mod tidy
   go mod verify
   ```

3. Check logs:
   ```bash
   cd games/{app}/backend
   go run *.go  # Run in foreground to see errors
   ```

### Database Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   ps aux | grep postgres
   ```

2. Check port 5555:
   ```bash
   lsof -i :5555
   ```

3. Test connection:
   ```bash
   psql -U activityhub -h localhost -p 5555 -d postgres
   ```

### Frontend Not Updating

1. Hard rebuild:
   ```bash
   cd games/{app}/frontend
   rm -rf build node_modules
   npm install
   npm run build
   cp -r build/* ../backend/static/
   ```

2. Check browser cache:
   - Hard refresh: Cmd+Shift+R
   - Or use private/incognito window

3. Verify files copied:
   ```bash
   ls -la games/{app}/backend/static/
   ```

---

## Pi Configuration

### Environment Details

- **Hostname**: 192.168.1.29 (was 192.168.1.45)
- **OS**: Raspberry Pi OS
- **User**: andrew
- **Project Location**: `~/pub-games-v3`

### Installed Software

- Go 1.25
- Node.js / npm
- PostgreSQL 15 (port 5555)
- Redis
- Git

### PostgreSQL Configuration

- **Port**: 5555 (non-standard)
- **User**: activityhub
- **Password**: pubgames
- **Databases**:
  - activity_hub (shared auth)
  - {app}_db (per-app data)

### Key Directories

```
~/pub-games-v3/
├── identity-shell/backend/static/activity-hub.css  # Shared CSS
├── games/{app}/backend/static/                      # Frontend builds
└── games/game-admin/backend/uploads/                # Shared quiz media
```

---

## Backup Strategy

**Current State**: No automated backups (TODO)

**Recommended**:

1. **Database backups**:
   ```bash
   # Daily backup of all databases
   pg_dumpall -U activityhub -h localhost -p 5555 > backup_$(date +%Y%m%d).sql
   ```

2. **Code backups**:
   - Already handled by Git/GitHub
   - Ensure all changes are committed and pushed

3. **Media backups**:
   ```bash
   # Backup quiz media uploads
   tar -czf uploads_backup_$(date +%Y%m%d).tar.gz games/game-admin/backend/uploads/
   ```

4. **Configuration backups**:
   - Document Pi setup steps
   - Keep config files in Git where possible

---

## Future Improvements

- [ ] Automated deployment script (`scripts/deploy_all.sh`)
- [ ] Process manager (systemd or PM2)
- [ ] Automated backups
- [ ] Health check monitoring
- [ ] Log aggregation
- [ ] CI/CD pipeline (see `docs/ROADMAP.md`)
