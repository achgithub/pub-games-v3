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

## 🟡 High Priority (Improves User Experience)

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

### Games
- [ ] **Additional game templates**
  - Chess
  - Checkers
  - Connect Four
  - Card games (Hearts, Spades)

- [ ] **Spectator mode**
  - Watch ongoing games
  - View game history/replays

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

- Focus on game integration before adding more lobby features
- Mobile optimization should come after core gameplay works
- Documentation can wait until architecture stabilizes
