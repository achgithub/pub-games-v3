# PubGames V3 - TODO List

**Last Updated**: January 24, 2026

## 🔴 Critical (Blocks Core Functionality)

### Game Integration
- [ ] **Connect challenge acceptance to game launch**
  - When user accepts challenge, navigate to game with challenge context
  - Pass player assignments (who is X, who is O) to game
  - Store game session ID linking to challenge ID

- [ ] **Tic-Tac-Toe integration**
  - Update tic-tac-toe to receive challenge context
  - Connect game state to Redis
  - Report game results back to identity shell
  - Update challenge status to "completed" or "abandoned"

- [ ] **Game state management**
  - Redis schema for live game boards
  - Turn tracking and validation
  - Game completion detection
  - Result persistence to PostgreSQL

## 🟡 High Priority (After Critical Integration Complete)

### Game Migration & Development
- [ ] **Migrate Tic-Tac-Toe**
  - Port existing tic-tac-toe from V2 or integrate current prototype
  - Full challenge flow integration
  - Real-time board state updates via Redis
  - Game completion and result tracking

- [ ] **Migrate Sweepstakes**
  - Port sweepstakes app from V2
  - Integrate with identity shell (iframe-embedded)
  - Update to use new auth system
  - Adapt UI to work within shell chrome

- [ ] **Migrate Last Man Standing**
  - Port last man standing from V2
  - Integrate with identity shell
  - Solo mode support (no challenges)
  - Multi-player mode support (with challenges)

- [ ] **Create Dots Game**
  - New game implementation
  - Classic dots-and-boxes gameplay
  - 2-player turn-based
  - Redis-backed game state
  - Challenge integration

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
- [ ] **Challenge app selection**
  - Currently hardcoded to 'tic-tac-toe'
  - Let user choose which game when challenging
  - Display game name in challenge notification

- [ ] **Challenge rejection handling**
  - Notify challenger when challenge is declined
  - Show toast notification to challenger
  - Clear from sent challenges list immediately

- [ ] **Offline user handling improvements**
  - Currently shows toast "User is offline"
  - Could pre-filter offline users from challenge button
  - Or grey out/disable challenge button for offline users

### Mobile & UI
- [ ] **Mobile UI optimization**
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
- [ ] **WebSocket migration**
  - Replace SSE with WebSocket for bidirectional communication
  - Reduce latency for game moves
  - Better mobile support

- [ ] **Error recovery**
  - Auto-reconnect on connection loss
  - Resume game state after disconnect
  - Offline queue for actions

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
- [x] Server-Sent Events for real-time updates (Jan 23)
- [x] Challenge notifications with toast (Jan 23)
- [x] Prevent duplicate challenges (Jan 24)
- [x] Auto-remove expired challenges (Jan 24)
- [x] Subtle notification design (Jan 24)
- [x] TypeScript compilation fixes (Jan 24)

## Notes

### Priority Order
1. **Critical first**: Get tic-tac-toe working end-to-end with challenge flow
2. **Then migrate games**: Sweepstakes, Last Man Standing, create Dots
3. **Then display system**: Screen slideshow with leaderboards and social feeds
4. **Then polish**: Mobile optimization, additional features, documentation

### Game Development Focus
- Start with simpler games (Tic-Tac-Toe, Dots) to validate architecture
- Migrate proven V2 games (Sweepstakes, Last Man Standing)
- Display system enables pub-wide engagement and visibility

### Display System Vision
- Central display on pub TVs showing:
  - Live leaderboards across all games
  - Upcoming scheduled tournaments
  - Active games in progress
  - Social media buzz about the pub
  - Promotional content via URL embedding
