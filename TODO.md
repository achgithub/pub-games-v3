# PubGames V3 - TODO List

**Last Updated**: February 2, 2026

---

## 🔴 CRITICAL: Security & Authentication (MUST FIX BEFORE INTERNET EXPOSURE)

**Status:** 🔴 **INSECURE - Not production ready**

See [docs/SECURITY-CRITICAL.md](./docs/SECURITY-CRITICAL.md) for complete vulnerability analysis.

### Current State

**Authentication is broken:**
- JWT tokens generated but NOT validated by backends
- Apps trust URL parameters (`?userId=X&isAdmin=true`) without verification
- Anyone can impersonate any user by editing URLs
- Admin access granted by adding `&isAdmin=true` to URL
- All API endpoints accept requests without authentication

**Risk level:**
- 🟡 **MEDIUM** for local pub network (trusted users)
- 🔴 **CRITICAL** if exposed to internet (DO NOT EXPOSE)

### Required Fixes (Est. 4-6 hours total)

#### Phase 1: Backend Token Validation (2-3 hours) ⚠️ CRITICAL

- [ ] **Create authentication middleware for all backends**
  - Extract JWT token from `Authorization: Bearer {token}` header
  - Validate token format (`demo-token-{email}`)
  - Query user from database by email
  - Store authenticated user in request context
  - Return 401 if token invalid or missing

- [ ] **Apply middleware to ALL API endpoints in:**
  - [ ] Tic-Tac-Toe backend
  - [ ] Dots backend
  - [ ] Sweepstakes backend ⚠️ (has admin features)
  - [ ] Season Scheduler backend ⚠️ (has admin features)
  - [ ] Leaderboard backend
  - [ ] Smoke Test backend (for consistency)

- [ ] **Add admin-only middleware**
  - Check `is_admin` flag from authenticated user
  - Return 403 Forbidden if not admin
  - Apply to admin-only endpoints (create competitions, delete entries, etc.)

- [ ] **Use authenticated user in operations**
  - Replace `user_id` from request body with authenticated user
  - Prevents impersonation (e.g., creating draws as another user)
  - Trust the token, not the request data

#### Phase 2: Frontend Token Transmission (1-2 hours) ⚠️ CRITICAL

- [ ] **Update identity shell to pass token to apps**
  - Store token in localStorage after login
  - Pass token to apps via URL parameter or postMessage
  - Clear token on logout

- [ ] **Update all app frontends to send token**
  - [ ] Tic-Tac-Toe frontend
  - [ ] Dots frontend
  - [ ] Sweepstakes frontend
  - [ ] Season Scheduler frontend
  - [ ] Leaderboard frontend
  - [ ] Smoke Test frontend

- [ ] **Add Authorization header to all axios requests**
  ```typescript
  axios.get('/api/endpoint', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  ```

- [ ] **Handle 401 responses**
  - Redirect to login if token expired/invalid
  - Show friendly error message

#### Phase 3: Permission Layer (Optional, 2-3 hours)

- [ ] Define role-based permissions model
- [ ] Store permissions in database (roles table)
- [ ] Check permissions on sensitive operations
- [ ] Audit log for admin actions
- [ ] User management UI for admins

### Implementation Notes

**Quick start:** See code examples in `docs/SECURITY-CRITICAL.md`

**Testing checklist:**
- [ ] Login generates valid token
- [ ] Token sent with every API request
- [ ] Invalid token returns 401
- [ ] Missing token returns 401
- [ ] Non-admin user cannot access admin endpoints (403)
- [ ] User cannot create resources as another user
- [ ] Manually editing URL parameters has no effect

**Deployment priority:**
- **If keeping local-only:** Can defer indefinitely (trust users)
- **If exposing to internet:** MUST complete Phase 1 & 2 FIRST
- **If handling money/sensitive data:** MUST complete all phases

---

## ✅ Leaderboard & Game Reporting (Complete)
- [x] Centralized Leaderboard app (port 5030)
- [x] Games report results directly to Leaderboard service
- [x] Standings per game type (points: 3 win, 1 draw, 0 loss)
- [x] Tic-tac-toe reports on game end, forfeit, claim-win
- [x] Dots reports on game end, forfeit, claim-win

## ✅ Challenge → Game Integration (Complete)
- [x] Connect challenge acceptance to game launch
- [x] Pass player assignments (who is X, who is O) to game
- [x] Store game session ID linking to challenge ID
- [x] Both players redirected to game via SSE notification
- [x] Dynamic game selection (user picks game when challenging)
- [x] Games auto-discovered from apps.json (category: game, realtime: sse)

## 🟡 High Priority (After Challenge Integration)

### Game Migration & Development

- [x] **Migrate Sweepstakes** ✅ (Feb 2)
  - Port sweepstakes app from V2
  - Integrate with identity shell (iframe-embedded)
  - PostgreSQL + Redis (for selection locks)
  - Blind box selection, admin dashboard, CSV upload
  - Admin features working (create competitions, manage entries)
  - ⚠️ **Known issue:** Admin authentication via URL parameter only (insecure)
  - ⚠️ **TODO:** Implement backend token validation (see SECURITY section above)

- [ ] **Migrate Last Man Standing**
  - Port last man standing from V2
  - Integrate with identity shell (iframe-embedded)
  - PostgreSQL only (static app, users pick and wait)
  - Solo mode support (no challenges)
  - Multi-player competitive mode

- [x] **Create Dots Game** ✅
  - Classic dots-and-boxes gameplay
  - 2-player turn-based on port 4011
  - SSE + HTTP (same pattern as tic-tac-toe)
  - Redis for live game state + pub/sub
  - PostgreSQL for game history
  - Challenge integration working
  - Reports to Leaderboard service
  - Rectangular grid support (4x4, 6x6, 6x9 mobile, 8x8)
  - Challenge options forwarded dynamically to game backends

- [ ] **Build Hangman Game**
  - Classic word-guessing game
  - 2-player: one picks word, other guesses
  - SSE + HTTP (same pattern as tic-tac-toe/dots)
  - Letter selection UI
  - Visual hangman progression
  - Word categories/difficulty options

- [ ] **Build Spoof Game**
  - Classic pub coin guessing game
  - Multi-player (3+ players ideal)
  - Each player secretly holds 0-3 coins
  - Players take turns guessing total coins
  - No duplicate guesses allowed
  - Elimination when wrong, last player wins
  - SSE for real-time sync between players

- [ ] **Build Shut the Box**
  - Classic dice game
  - Roll dice, flip down numbered tiles (1-9)
  - Goal: shut all tiles or lowest score
  - Solo or multiplayer modes
  - Simple UI, satisfying tile flip animation

- [ ] **Build Battleships**
  - 2-player grid guessing game
  - Place ships on hidden grid
  - Take turns firing at opponent's grid
  - SSE + HTTP (same pattern as tic-tac-toe)
  - Classic 10x10 grid

- [ ] **Build Local Quizzing App**
  - Pub quiz application (multi-player)
  - Question bank management (PostgreSQL)
  - Live quiz sessions with host controls
  - SSE for broadcasting questions and leaderboard updates
  - HTTP POST for answer submissions
  - Real-time scoring and leaderboard (Redis sorted sets)
  - Round-based format (multiple rounds per quiz)
  - Team support (players can join teams)
  - Display integration (show questions on pub screens via SSE)

### Display & Presentation System
- [ ] **Screen Display / Slideshow Application**
  - Dedicated display app for pub screens/TVs
  - URL embedding capabilities (show external content)
  - Leaderboard display (pull from game databases)
  - Upcoming games schedule
  - Active games in progress
  - App-driven content (games can push updates to display)
  - Auto-rotation between slides
  - Remote control/configuration

- [ ] **Social Media Feed Aggregator**
  - Retrieve pub-related social media posts
  - Support for X/Twitter, Instagram, Facebook, TikTok
  - Tag/hashtag filtering (pub-specific tags)
  - Display in slideshow rotation
  - Auto-refresh feed periodically
  - Moderation/filtering capabilities

### Lobby & Challenges
- [x] **Challenge app selection** ✅
  - Dynamic game selection modal when clicking Challenge
  - Games auto-discovered from apps.json (category: game + realtime support)
  - Single-game case skips selection for convenience

- [ ] **Challenge rejection handling**
  - Notify challenger when challenge is declined
  - Show toast notification to challenger
  - Clear from sent challenges list immediately

- [ ] **Offline user handling improvements**
  - Currently shows toast "User is offline"
  - Could pre-filter offline users from challenge button
  - Or grey out/disable challenge button for offline users

### Mobile & UI
- [ ] **Mobile web UI optimization**
  - Touch-friendly challenge buttons
  - Responsive lobby layout
  - Mobile toast positioning
  - Swipe gestures for challenge management

- [ ] **Accessibility improvements**
  - Keyboard navigation for challenges
  - Screen reader support
  - ARIA labels for interactive elements
  - Focus management

## 🟢 Medium Priority (Nice to Have)

### Authentication & User Management
- [ ] **Proper user registration**
  - Currently only login exists
  - Add signup flow with email validation
  - Password requirements and strength indicator
  - User profile management (display name, avatar)

- [ ] **Session management improvements**
  - Currently basic email-based sessions
  - Add session expiration
  - "Remember me" functionality
  - Logout all devices

- [ ] **OAuth/SSO integration**
  - Google Sign-In
  - Discord OAuth
  - GitHub OAuth (for developers)

### Native Mobile Apps
- [ ] **iOS and Android App Exploration**
  - Lightweight native apps (React Native or similar)
  - Online-only architecture (no offline functionality)
  - Resource downloads for native look and feel
    - Download game assets on first launch
    - Cache CSS/UI resources locally
    - Optimized images and icons
  - Native UI components where beneficial
  - Deep linking to games and challenges
  - Push notifications for challenges
  - App store deployment considerations
  - Code sharing strategy with web version

### Lobby Features
- [ ] **User status customization**
  - Allow users to set status (Online, Away, Do Not Disturb)
  - Custom status messages
  - Show "in game" with game name

- [ ] **Challenge history**
  - View past challenges (already in PostgreSQL)
  - Win/loss records
  - Challenge statistics per user

- [ ] **Friend system**
  - Add/remove friends
  - Friends list in lobby
  - Challenge friends button

### Simple Utilities
- [ ] **Flip a Coin**
  - Static app, no real-time needed
  - Simple heads/tails result with animation
  - History of recent flips (optional)

- [ ] **Killer Draw**
  - Static app, single player manages game
  - Enter player names
  - Randomize button assigns numbers/targets
  - Configurable lives per player
  - Track eliminations during game
  - Option to replicate to display screen

### Darts Scorer
- [ ] **Darts Scoring App**
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

### Season Scheduler Enhancements
- [ ] **Email distribution**
  - Send schedule to email addresses (bulk or individual)
  - Formatted plaintext or HTML version
  - Include download link for CSV

- [ ] **Print-friendly view**
  - Optimized layout for A4/Letter printing
  - Remove interactive elements
  - Better spacing for readability

- [ ] **iCal export**
  - Generate .ics calendar file
  - Compatible with Outlook, Google Calendar, Apple Calendar
  - Include team names, home/away info in event titles

- [ ] **Conflict resolution wizard**
  - Suggest automatic fixes for detected conflicts
  - Smart rescheduling based on constraints
  - Manual approval before applying

### Additional Game Features
- [ ] **Spectator mode**
  - Watch ongoing games in real-time
  - View game history/replays
  - Share game links

- [ ] **Future games** (after initial 4 are complete)
  - Chess
  - Checkers
  - Connect Four
  - Card games (Hearts, Spades)

## 🔵 Low Priority (Future Enhancements)

### Dots Polish
- [ ] **Revisit line drawn and box complete messages**
  - Current messages may need better wording/timing
  - Consider visual feedback improvements

### Future Games
- [ ] **Cribbage**
  - Classic card game with pegging board
  - 2-player, complex scoring rules
  - Visual pegging board for score tracking

- [ ] **Dominoes**
  - Classic tile matching game
  - Multiple game variants (block, draw, etc.)
  - 2-4 players

### Infrastructure
- [ ] **SSL/HTTPS support**
  - Secure connections for all services
  - Let's Encrypt certificate automation
  - Reverse proxy configuration (nginx/caddy)

- [ ] **Error recovery improvements**
  - Resume game state after disconnect
  - Offline queue for actions
  - Better handling of network transitions

- [ ] **Performance optimization**
  - Redis connection pooling
  - Database query optimization
  - Frontend bundle size reduction
  - Lazy loading for games

### Federation (Future)
- [ ] **Central Hub Service**
  - Cloud-hosted central hub for multiple pubs
  - Cross-pub game challenges and leaderboards
  - Content distribution:
    - Quiz packs (question banks, themed quizzes)
    - Sweepstake templates and fixtures
  - Pi instances connect as clients
  - Pubs still work offline for local play
  - Subscription/licensing model potential

### Testing
- [ ] **Automated testing**
  - Unit tests for Go backends
  - React component tests
  - Integration tests for game flows
  - CI pipeline for test automation

### Documentation
- [ ] **API documentation**
  - Document all lobby endpoints
  - Redis schema documentation
  - PostgreSQL schema documentation

- [ ] **Developer guides**
  - How to create a new game
  - How to create a static app
  - Contributing guidelines

- [ ] **User documentation**
  - How to play guide
  - Challenge system tutorial
  - Troubleshooting guide

## ✅ Recently Completed (Reference)

- [x] Lobby presence tracking (Jan 21-22)
- [x] Challenge system (Jan 22-23)
- [x] Server-Sent Events for shell real-time updates (Jan 23)
- [x] Challenge notifications with toast (Jan 23)
- [x] Prevent duplicate challenges (Jan 24)
- [x] Auto-remove expired challenges (Jan 24)
- [x] Subtle notification design (Jan 24)
- [x] TypeScript compilation fixes (Jan 24)
- [x] Tic-Tac-Toe backend (Redis + PostgreSQL) (Jan 25)
- [x] Tic-Tac-Toe frontend (React) (Jan 25)
- [x] WebSocket → SSE + HTTP refactor for iOS Safari (Jan 26-27)
- [x] Forfeit and claim-win functionality (Jan 27)
- [x] Connection tracking with 15s timeout (Jan 27)
- [x] Multi-browser testing (Chrome, Safari, iOS Safari) (Jan 27)
- [x] Smoke test restructured to match tic-tac-toe pattern (Jan 27)
- [x] URL params standardized: userId, userName, gameId (Jan 27)
- [x] Challenge → game integration working (Jan 27)
- [x] Centralized Leaderboard app (port 5030) (Jan 27)
- [x] Game result reporting to Leaderboard (Jan 27)
- [x] Dots & Boxes game (port 4011) (Jan 27)
- [x] Dynamic game selection in challenges (Jan 27)
- [x] Dots rectangular grid support (6x9 mobile option) (Jan 27)
- [x] Challenge options forwarded dynamically to game backends (Jan 27)
- [x] Dots UI improvements: lighter dots, claim-win timing (Jan 27)
- [x] **Season Scheduler app** (port 5040) (Feb 2)
  - [x] Round-robin schedule generation with no duplicate home/away matchups
  - [x] Conflict detection (red highlighting for teams with multiple games same date)
  - [x] Multi-select bulk reordering of matches
  - [x] Exclusion week displacement (free/special/catchup weeks displace all games)
  - [x] UK Bank Holiday detection and warning
  - [x] Schedule saving to PostgreSQL with 30-day auto-cleanup
  - [x] CSV export functionality

## Notes

### Priority Order
1. ~~Challenge integration~~: ✅ Complete with dynamic game selection
2. ~~Create Dots~~: ✅ Second real-time game validates multi-game support
3. ~~Leaderboard~~: ✅ Centralized stats service
4. ~~Season Scheduler~~: ✅ Complete with round-robin, conflict detection, manual adjustments
5. **Migrate static games**: Sweepstakes, Last Man Standing (simpler, no real-time)
6. **Quiz app**: Multi-player, real-time, critical for pub engagement
7. **Display system**: Screen slideshow with leaderboards and social feeds
8. **Polish**: Mobile optimization, additional features, documentation

### Architecture Decisions Made
- **SSE + HTTP over WebSocket**: Better iOS Safari compatibility, simpler debugging
- **Redis pub/sub**: Enables multiple server instances, reliable message delivery
- **15-second connection timeout**: Balance between quick disconnect detection and network tolerance

### Game Development Focus
- Tic-Tac-Toe validates the SSE + HTTP pattern for turn-based games
- Same pattern will work for Dots, Chess, and other turn-based games
- Quiz uses SSE for broadcasts, HTTP POST for answers (same building blocks)
- Static apps (Sweepstakes, LMS) are simpler - no real-time needed

### Display System Vision
- Central display on pub TVs showing:
  - Live leaderboards across all games
  - Quiz questions during active quiz sessions
  - Upcoming scheduled tournaments
  - Active games in progress
  - Social media buzz about the pub
  - Promotional content via URL embedding

### Mobile App Strategy
- Lightweight, online-only (no offline mode)
- Resources downloaded and cached for performance
- Native feel with web architecture underneath
- Consider React Native or Capacitor for code sharing
- Push notifications for challenges and quiz start times
