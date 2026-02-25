# Pub Games v3 - Roadmap

This document tracks future features, enhancements, and planned work for the pub-games-v3 platform.

---

## User Font Size Settings (Accessibility)

**Goal**: Allow users to adjust font size across all apps (Small/Medium/Large)

**Implementation approach:**
1. **Database**: Add `font_scale DECIMAL(3,2) DEFAULT 1.00` to `user_app_preferences` table
   - Values: 0.85 (small), 1.00 (medium), 1.15 (large)

2. **Identity Shell**: Add font size selector to Settings modal
   ```tsx
   <select value={fontSize}>
     <option value="0.85">Small</option>
     <option value="1.00">Medium</option>
     <option value="1.15">Large</option>
   </select>
   ```

3. **Delivery to Apps**: Pass via URL parameter
   - Identity shell already passes `userId`, `userName`, `token`
   - Add `fontSize` to query string: `?fontSize=1.15`

4. **Application in Apps**: Use CSS custom properties
   - Update `activity-hub.css` to use `--font-scale` variable
   - Each app reads `fontSize` from URL and sets:
     ```tsx
     const fontSize = params.get('fontSize') || '1.0';
     document.documentElement.style.setProperty('--font-scale', fontSize);
     ```

5. **CSS Pattern**:
   ```css
   :root {
     --font-scale: 1.0;
   }
   .ah-meta { font-size: calc(14px * var(--font-scale)); }
   .ah-btn-primary { font-size: calc(15px * var(--font-scale)); }
   /* etc. */
   ```

**Effort estimate**: 1-2 hours to implement across all apps

**Benefits**:
- Accessibility compliance
- Better user experience for varying eyesight
- Platform-wide consistency
- No per-app rebuilds needed (CSS updates only)

---

## UI Consistency Audit & Drift Prevention

**Goal**: Ensure visual consistency across all apps and prevent future drift through enforcement mechanisms

**Current Issue**: 10 of 17 apps don't follow modern Activity Hub CSS patterns - using inline styles, custom CSS, or missing shared CSS loading entirely

**Plan**: `.claude/plans/validated-nibbling-salamander.md` (22-26 hours total)

**Approach:**
1. **Enforcement First** (6-8 hours)
   - ESLint plugin to catch style violations
   - App template generator for new apps
   - Pre-commit hooks to block non-conforming code
   - No cloud CI/CD (future: on-prem pipeline on Pi)

2. **Expand Shared CSS** (6-8 hours)
   - Game board/grid utilities
   - Loading spinners & animations
   - Modal/dialog components
   - Status indicators for games
   - Reduce need for custom CSS per-app

3. **Migrate Apps** (10 hours)
   - tic-tac-toe, dots: Add shared CSS loading, convert to .ah-* classes
   - mobile-test: Replace inline styles with classes
   - spoof: Migrate dark theme to Activity Hub light theme
   - quiz-player/master/display: Add shared CSS loading
   - display-admin/runtime: Add shared CSS loading

**Key Decisions:**
- Spoof dark theme will be migrated to light (consistency over customization)
- Mobile-test inline styles will be replaced with .ah-* classes
- Enforcement mechanisms prioritized over migration (prevent new drift first)
- On-prem CI/CD pipeline deferred to future (no cloud costs)

**Benefits**:
- Visual consistency across all apps
- Automated enforcement prevents drift
- Faster new app creation via template
- Single source of truth for styling
- Reduced maintenance burden

**Future Enhancement**: On-prem CI/CD pipeline (Jenkins/Drone/custom) on Pi for automated testing without cloud dependency

---

## Mobile Test - Faster Timeout Handling ✅ COMPLETED

**Issue**: Mobile test steps currently take too long to timeout and fail when network/services are down

**Goal**: Reduce timeout duration so failures are detected quickly

**Current behavior**:
- Tests may hang indefinitely or take 30+ seconds to fail
- Poor user experience when something is wrong
- Unclear whether test is running or stuck

**Required changes**:

1. **HTTP requests**: Add timeout to fetch calls
   ```tsx
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

   const response = await fetch('/api/ping', {
     signal: controller.signal
   });
   clearTimeout(timeoutId);
   ```

2. **SSE connection**: Add connection timeout
   ```tsx
   const eventSource = new EventSource('/api/test-sse');
   const timeout = setTimeout(() => {
     if (messagesReceived === 0) {
       eventSource.close();
       setStepStatus('fail');
     }
   }, 10000); // 10 seconds for SSE to connect and send first message
   ```

3. **Image loading**: Already has timeout via Image.onload, but ensure it's reasonable
   ```tsx
   const timeout = setTimeout(() => {
     img.src = ''; // Cancel load
     setStepStatus('fail');
   }, 8000); // 8 seconds for image
   ```

4. **Audio playback**: Add timeout for play() promise
   ```tsx
   const playPromise = audio.play();
   const timeout = setTimeout(() => {
     audio.pause();
     setStepStatus('fail');
   }, 5000);
   ```

**Recommended timeouts**:
- HTTP ping: 5 seconds
- SSE connection: 10 seconds (needs time for handshake)
- Image load: 8 seconds
- Audio playback: 5 seconds

**Implementation location**: `games/mobile-test/frontend/src/App.tsx`

**Effort estimate**: 30 minutes

---

## Automated Testing & CI/CD Pipeline

**Goal**: Implement automated tests and continuous integration/deployment pipeline

**Current state**:
- No automated tests
- Manual testing on Pi after deployment
- No build validation before merge
- Manual deployment process

**Required implementation**:

### 1. Unit Tests

**Backend (Go)**:
```bash
# games/{app}/backend/*_test.go
go test ./...
```
- Handler tests (mock HTTP requests)
- Business logic tests
- Database query tests (using test database)
- Redis interaction tests (using miniredis)

**Frontend (TypeScript/React)**:
```bash
# games/{app}/frontend/src/**/*.test.tsx
npm test
```
- Component rendering tests (React Testing Library)
- Hook tests
- Utility function tests

**Coverage targets**: 70%+ for critical paths

### 2. Integration Tests

**API endpoint tests**:
```bash
# scripts/test/integration/
./test_identity_shell.sh
./test_smoke_test.sh
# etc.
```
- Authentication flow (login, token validation)
- Protected endpoints (with valid/invalid tokens)
- Database operations (CRUD)
- SSE connection establishment

**Database migration tests**:
- Apply migrations to test database
- Verify schema correctness
- Test rollback scenarios

### 3. End-to-End Tests (Optional, Phase 2)

**Browser automation** (Playwright/Cypress):
- User login flow
- Game creation and play
- Real-time updates (SSE)
- Multi-user scenarios

**Complexity**: High - requires running full stack

### 4. CI/CD Pipeline (GitHub Actions)

**File**: `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  # Phase 1: Build validation
  validate-builds:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [identity-shell, smoke-test, tic-tac-toe, dots, ...]
    steps:
      - uses: actions/checkout@v3

      # Backend
      - uses: actions/setup-go@v4
        with:
          go-version: '1.25'
      - name: Build backend
        run: |
          cd games/${{ matrix.app }}/backend
          go mod download
          go build -v ./...

      # Frontend
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Build frontend
        run: |
          cd games/${{ matrix.app }}/frontend
          npm ci
          npm run build

  # Phase 2: Unit tests
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: pubgames
          POSTGRES_USER: activityhub
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5555:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.25'
      - name: Run backend tests
        run: |
          for app in games/*/backend; do
            cd $app && go test -v ./... || exit 1
            cd ../../..
          done
        env:
          DB_HOST: localhost
          DB_PORT: 5555
          DB_USER: activityhub
          DB_PASS: pubgames
          REDIS_HOST: localhost
          REDIS_PORT: 6379

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Run frontend tests
        run: |
          for app in games/*/frontend; do
            cd $app
            npm ci
            npm test -- --coverage --watchAll=false || exit 1
            cd ../../..
          done

  # Phase 3: Integration tests (future)
  integration-tests:
    runs-on: ubuntu-latest
    # ... full stack setup ...

  # Phase 4: Deploy to Pi (on main branch only)
  deploy:
    runs-on: ubuntu-latest
    needs: [validate-builds, test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Pi
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PI_HOST }}
          username: ${{ secrets.PI_USERNAME }}
          key: ${{ secrets.PI_SSH_KEY }}
          script: |
            cd ~/pub-games-v3
            git pull
            ./scripts/deploy_all.sh
```

### 5. Test Infrastructure

**New scripts needed**:
```bash
scripts/
├── test/
│   ├── setup_test_db.sh       # Create test databases
│   ├── teardown_test_db.sh    # Clean up after tests
│   ├── run_all_tests.sh       # Run full test suite locally
│   └── integration/
│       ├── test_auth.sh
│       ├── test_smoke_test.sh
│       └── ...
└── deploy_all.sh               # Automated deployment script
```

**Test database pattern**:
```bash
# Setup
psql -U activityhub -h localhost -p 5555 -d postgres \
  -c "CREATE DATABASE test_activity_hub;"
psql -U activityhub -h localhost -p 5555 -d test_activity_hub \
  -f identity-shell/backend/schema.sql

# Run tests with test DB
export DB_NAME=test_activity_hub
go test ./...

# Teardown
psql -U activityhub -h localhost -p 5555 -d postgres \
  -c "DROP DATABASE test_activity_hub;"
```

### 6. Implementation Phases

**Phase 1 (Essential - 8 hours)**:
- [ ] Add Go unit tests for critical backend handlers
- [ ] Add React unit tests for key components
- [ ] Create GitHub Actions workflow for build validation
- [ ] PR checks: builds must pass before merge

**Phase 2 (Recommended - 8 hours)**:
- [ ] Integration test scripts for API endpoints
- [ ] Automated test database setup/teardown
- [ ] GitHub Actions: run tests on PR
- [ ] Test coverage reporting

**Phase 3 (Advanced - 16 hours)**:
- [ ] E2E tests with Playwright
- [ ] Automated deployment on main branch push
- [ ] Deployment rollback capability
- [ ] Test environment on separate Pi or Docker

**Phase 4 (Polish - 4 hours)**:
- [ ] Test coverage badges in README
- [ ] Slack/email notifications on build failures
- [ ] Automated dependency updates (Dependabot)
- [ ] Performance regression tests

**Total effort estimate**: 36+ hours (phased approach recommended)

**Benefits**:
- Catch bugs before deployment
- Confidence in refactoring
- Prevent breaking changes
- Faster development cycles
- Documentation through tests
- Reduced manual testing burden

**Challenges specific to this project**:
- Mac dev environment vs Pi production
- Multiple independent services to test
- Real-time features (SSE) harder to test
- Database dependencies (PostgreSQL, Redis)

**Recommended starting point**:
1. Add tests to smoke-test as reference
2. GitHub Actions for build validation only
3. Gradually add tests to other apps
4. Expand to integration tests when needed

---

## LMS Manager - Advanced Editor

**Goal**: Allow managers to edit past rounds after they've been closed to correct mistakes

**Current limitation**:
- Once a round is closed, results are locked
- Cannot change results if entered incorrectly
- Cannot un-eliminate players who were eliminated by mistake
- Cannot edit picks that were saved incorrectly
- Only option is to delete entire game and start over

**Required features**:

1. **Reopen Closed Rounds**
   - Add "Reopen Round" button on closed rounds (already exists)
   - When reopened, round status changes back to 'open'
   - Previously eliminated players in that round become active again
   - Manager can edit results and picks
   - Re-close when corrections are complete

2. **Edit Results After Closing**
   - View closed round results in edit mode
   - Change win/loss/draw/postponed for any team
   - Automatically recalculate eliminations based on new results
   - Show audit trail of changes (who, what, when)

3. **Edit Player Picks**
   - View all picks for a round (even after closed)
   - Change team selections for individual players
   - Mark picks as manager-modified (for transparency)
   - Prevent changes that would break game logic (e.g., team already used)

4. **Manual Elimination Override**
   - Add/remove players from elimination list
   - Override automatic elimination logic
   - Useful for special circumstances (late submission, technical issues)
   - Requires confirmation to prevent accidents

5. **Round History Viewer**
   - View complete timeline of all changes to a round
   - Show original values vs current values
   - Who made the change and when
   - Export audit log for record keeping

**Implementation approach**:

1. **Database changes**:
   ```sql
   -- Add audit table
   CREATE TABLE managed_round_edits (
     id SERIAL PRIMARY KEY,
     round_id INTEGER REFERENCES managed_rounds(id),
     manager_email TEXT NOT NULL,
     action TEXT NOT NULL, -- 'reopen', 'edit_result', 'edit_pick', 'manual_eliminate'
     target_player TEXT,
     target_team TEXT,
     old_value TEXT,
     new_value TEXT,
     timestamp TIMESTAMP DEFAULT NOW()
   );
   ```

2. **Backend endpoints**:
   ```
   POST /api/rounds/{roundId}/reopen (already exists)
   PUT  /api/rounds/{roundId}/results/{pickId}  -- Edit single result
   PUT  /api/rounds/{roundId}/picks/{pickId}    -- Edit single pick
   POST /api/rounds/{roundId}/override-elimination  -- Manual elimination
   GET  /api/rounds/{roundId}/audit  -- Get edit history
   ```

3. **Frontend UI**:
   - "Edit Round" button on closed rounds (next to reopen)
   - Modal or inline editor for results
   - Confirmation dialogs for destructive changes
   - Audit log viewer at bottom of round display

4. **Validation rules**:
   - Cannot edit rounds from completed games
   - Cannot select teams already used by player in previous rounds
   - Cannot eliminate all remaining players (must leave at least one)
   - Changes must maintain game integrity

**Use cases**:
- Manager enters wrong result (clicked Loss instead of Win)
- Player appeals elimination due to postponed match handling
- Technical glitch causes incorrect auto-assignment
- Late pick submission that should have been accepted
- Referee decision changed after round closed

**Effort estimate**: 12-16 hours

**Benefits**:
- Mistakes can be corrected without restarting entire game
- Increased flexibility for edge cases
- Better user experience for managers
- Complete audit trail for transparency
- Maintains data integrity

**Risks to mitigate**:
- Ensure changes maintain game integrity (no orphaned data)
- Prevent cascading eliminations when changing old rounds
- Clear UI to show which data has been edited vs original
- Confirmation dialogs to prevent accidental changes

---

## Managed Game Modes (Sweepstakes & LMS)

**Goal**: Create administrator-managed versions of Sweepstakes and Last Man Standing that don't require player participation

**Current behavior**:
- **Sweepstakes**: Players pick blind box entries, admin manages competitions
- **LMS**: Players join games and make weekly team picks, admin manages rounds/results
- Both require active player engagement

**New requirement**: "Managed" modes where admin maintains everything without players

**Use cases**:
- Office sweepstakes where admin draws on behalf of participants
- LMS where admin tracks picks manually (e.g., pub quiz format)
- Private games where participation is tracked offline
- Historical record keeping

### Implementation Approach

**1. New Role**: `game_manager`

```sql
-- Add to activity_hub.users roles array
UPDATE users SET roles = array_append(roles, 'game_manager')
WHERE email = 'manager@example.com';
```

**Role comparison**:
- `game_admin`: Technical setup (create games, upload fixtures, set results)
- `game_manager`: Operational management (make picks for players, assign entries, manual tracking)
- Can have both roles, or `game_manager` only for non-technical admins

**2. New Apps/Modes**

**Option A - Separate Apps** (Recommended):
```
sweepstakes-managed (Port 4032)
last-man-standing-managed (Port 4022)
```
- Dedicated apps with `game_manager` role requirement
- Different UI optimized for admin workflow
- Shares database with player versions
- Cleaner separation of concerns

**Option B - Toggle in Existing Apps**:
- Add "Managed Mode" toggle in game-admin
- Different view when managing on behalf of players
- More compact but could become cluttered

**3. Sweepstakes Managed Features**

**Admin capabilities**:
- View all available entries for a competition
- Assign entries to participants (without them picking)
- Bulk import assignments from CSV
- Manual draw assignment (random or specified)
- Override/swap entries after assignment
- Export current assignments
- Track which entries are taken vs available

**UI design**:
```
Sweepstakes Manager
├── Competitions (list/select)
├── Assignments Tab
│   ├── Participant list with assigned entries
│   ├── Quick assign (random available entry)
│   ├── Manual assign (select from dropdown)
│   └── Bulk actions (CSV import, clear all)
└── Available Pool
    ├── Show unassigned entries
    └── Entry search/filter
```

**Database changes**:
```sql
-- Add managed_by column to track admin-assigned picks
ALTER TABLE draws ADD COLUMN managed_by VARCHAR(255);
-- NULL = player picked, email = admin assigned

-- New table for bulk operations tracking
CREATE TABLE assignment_batches (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id),
  manager_email VARCHAR(255),
  assigned_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**4. LMS Managed Features**

**Admin capabilities**:
- View all active players in a game
- Make team picks on behalf of players
- Bulk pick assignment (CSV: player, round, team)
- Override/change picks before round closes
- Mark players as inactive (auto-byes)
- Manual elimination (e.g., late submission)
- Export picks for record keeping

**UI design**:
```
LMS Manager
├── Games (list/select)
├── Current Round
│   ├── Player list with pick status
│   ├── Quick pick (for players who haven't picked)
│   ├── Bulk import (CSV)
│   └── Override existing picks
├── Round History
│   ├── View all picks per round
│   └── Edit past picks (with audit trail)
└── Player Management
    ├── Add/remove players
    ├── Mark inactive
    └── View pick history
```

**Database changes**:
```sql
-- Add managed_by column
ALTER TABLE predictions ADD COLUMN managed_by VARCHAR(255);
-- NULL = player picked, email = admin assigned

-- New table for manager actions audit
CREATE TABLE manager_actions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  round_id INTEGER REFERENCES rounds(id),
  manager_email VARCHAR(255),
  player_email VARCHAR(255),
  action VARCHAR(50), -- 'assign_pick', 'override_pick', 'eliminate', 'mark_inactive'
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**5. Common Features (Both Games)**

**Audit trail**:
- Log all admin actions (who, what, when)
- Visible in manager UI
- Cannot be deleted (append-only)

**Permissions**:
- `game_manager` role required
- Read-only mode if user only has `super_user`
- `game_admin` can access but separate permissions

**API endpoints pattern**:
```
POST /api/sweepstakes/manage/{competitionId}/assign
POST /api/sweepstakes/manage/{competitionId}/bulk-assign
GET  /api/sweepstakes/manage/{competitionId}/assignments

POST /api/lms/manage/{gameId}/pick
POST /api/lms/manage/{gameId}/bulk-picks
GET  /api/lms/manage/{gameId}/picks/{roundId}
```

**6. Implementation Effort**

**Phase 1 - Sweepstakes Managed** (12 hours):
- [ ] Create new role `game_manager`
- [ ] Database migrations (managed_by columns, audit tables)
- [ ] New backend endpoints for assignment operations
- [ ] Manager UI (React app)
- [ ] CSV import/export functionality
- [ ] Basic audit logging

**Phase 2 - LMS Managed** (12 hours):
- [ ] Database migrations
- [ ] Manager endpoints
- [ ] Manager UI
- [ ] Bulk pick operations
- [ ] Player inactive status handling

**Phase 3 - Polish** (4 hours):
- [ ] Comprehensive audit trail UI
- [ ] Advanced filtering/search
- [ ] Undo/rollback capability
- [ ] Manager activity reports

**Total effort**: ~28 hours

**7. Benefits**

- Enable offline/manual game management
- Support non-technical game managers
- Flexibility for different participation models
- Complete audit trail for transparency
- Maintain all historical data in same database
- Can transition games between player-run and managed modes

**8. Migration Path**

Existing games can switch to managed mode:
```sql
-- Mark entire game as managed
UPDATE games SET managed_mode = TRUE WHERE id = X;

-- Or mark individual rounds as managed
UPDATE rounds SET managed_mode = TRUE WHERE id = Y;
```

Players can still view their assignments/picks (read-only) even in managed mode.

**9. Open Questions**

- Should managed games appear in player apps at all? (Read-only view vs hidden)
- Can a game switch between managed/player modes mid-season?
- Should managers be able to make picks while round is "open" for players? (hybrid mode)
- Email notifications when admin assigns on behalf of player?

---

## Future Game Ideas

**Hangman** (2-player, real-time)
- Classic word-guessing game
- One player picks word, other player guesses
- SSE + HTTP pattern (same as tic-tac-toe/dots)
- Letter selection UI
- Visual hangman progression
- Word categories/difficulty options
- Estimated effort: 8-12 hours

**Shut the Box** (solo or multiplayer)
- Classic dice game
- Roll dice, flip down numbered tiles (1-9)
- Goal: shut all tiles or achieve lowest score
- Simple UI with satisfying tile flip animation
- Estimated effort: 6-10 hours

**Battleships** (2-player, turn-based)
- Classic grid guessing game
- Place ships on hidden grid
- Take turns firing at opponent's grid
- SSE + HTTP pattern (same as tic-tac-toe)
- Classic 10x10 grid
- Estimated effort: 12-16 hours

---

## Infrastructure Improvements

**Challenge System Enhancements:**
- Challenge rejection handling - notify challenger when challenge is declined
- Offline user handling - pre-filter or grey out offline users in challenge list
- Challenge history - view past challenges, win/loss records

**Authentication & User Management:**
- Proper user registration (currently demo-token only)
  - Signup flow with email validation
  - Password requirements and strength indicator
  - User profile management (display name, avatar)
- Session management improvements
  - Session expiration
  - "Remember me" functionality
  - Logout all devices
- OAuth/SSO integration (Google, Discord, GitHub)

**Mobile & UI:**
- Mobile web UI optimization
  - Touch-friendly challenge buttons
  - Responsive lobby layout
  - Mobile toast positioning
  - Swipe gestures for challenge management
- Accessibility improvements
  - Keyboard navigation for challenges
  - Screen reader support
  - ARIA labels for interactive elements
  - Focus management

**Security & Deployment:**
- PostgreSQL security review
  - Review password strength ("pubgames" is weak)
  - Consider per-app database users with limited permissions
  - Review SSL/TLS configuration (currently sslmode=disable)
  - Audit connection string security (currently in code/env vars)
  - Consider row-level security policies
  - Review backup strategy
- SSL/HTTPS support
  - Secure connections for all services
  - Let's Encrypt certificate automation
  - Reverse proxy configuration (nginx/caddy)
- Error recovery improvements
  - Resume game state after disconnect
  - Offline queue for actions
  - Better handling of network transitions
- Performance optimization
  - Redis connection pooling
  - Database query optimization
  - Frontend bundle size reduction
  - Lazy loading for games

**Federation (Long-term):**
- Central Hub Service
  - Cloud-hosted central hub for multiple pubs
  - Cross-pub game challenges and leaderboards
  - Content distribution (quiz packs, sweepstake templates, fixtures)
  - Pi instances connect as clients
  - Pubs still work offline for local play
  - Subscription/licensing model potential

**Native Mobile Apps:**
- iOS and Android App Exploration
  - Lightweight native apps (React Native or Capacitor)
  - Online-only architecture (no offline functionality)
  - Resource downloads for native look and feel
  - Native UI components where beneficial
  - Deep linking to games and challenges
  - Push notifications for challenges
  - Code sharing strategy with web version

---

## Utility Apps

**Flip a Coin** (simple utility)
- Static app, no real-time needed
- Simple heads/tails result with animation
- History of recent flips (optional)
- Estimated effort: 2-3 hours

**Killer Draw** (pub game manager)
- Static app, single player manages game
- Enter player names
- Randomize button assigns numbers/targets
- Configurable lives per player
- Track eliminations during game
- Option to replicate to display screen
- Estimated effort: 6-8 hours

**Darts Scorer** (split input/display architecture)
- All possible scores on one screen (1-20, doubles, triples, bull, outer bull)
- Tap-to-score during live game
- Tracks remaining score per player
- Checkout suggestions when score is reachable
- Common game modes (501, 301, etc.)
- **Split architecture:**
  - Mobile app for input (players tap scores)
  - Display screen for output (pub TV shows live score)
- SSE to sync input app with display
- Multi-player support (2-4 players)
- Estimated effort: 16-20 hours

**Friend System:**
- Add/remove friends
- Friends list in lobby
- Quick challenge friends button
- Friend activity tracking

**User Customization:**
- User status customization (Online, Away, Do Not Disturb)
- Custom status messages
- Show "in game" with game name
- Avatar/profile pictures
