# PubGames V3 - TODO List

**Last Updated**: January 27, 2026

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

- [ ] **Migrate Sweepstakes**
  - Port sweepstakes app from V2
  - Integrate with identity shell (iframe-embedded)
  - Update to use new auth system
  - PostgreSQL only (static app, no real-time needed)
  - Optional: Simple polling or SSE for "results ready" notification

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

### Infrastructure
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
- [ ] **Cross-pub challenges**
  - Central cloud instance
  - Pi as client for federated features
  - Still works offline for local play

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

## Notes

### Priority Order
1. ~~Challenge integration~~: ✅ Complete with dynamic game selection
2. ~~Create Dots~~: ✅ Second real-time game validates multi-game support
3. ~~Leaderboard~~: ✅ Centralized stats service
4. **Migrate static games**: Sweepstakes, Last Man Standing (simpler, no real-time)
5. **Quiz app**: Multi-player, real-time, critical for pub engagement
6. **Display system**: Screen slideshow with leaderboards and social feeds
7. **Polish**: Mobile optimization, additional features, documentation

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
