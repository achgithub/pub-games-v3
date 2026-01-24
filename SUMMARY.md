# PubGames V3 - Current Status Summary

**Last Updated**: January 24, 2026

## What's Working

### Identity Shell (Complete)
- ✅ React frontend with persistent shell UI
- ✅ User authentication (email + password with bcrypt)
- ✅ App routing and navigation
- ✅ Iframe embedding for static apps (full-height rendering)
- ✅ React component embedding for interactive games

### Lobby System (Complete)
- ✅ **Real-time presence tracking** (Redis-backed, 30s TTL)
- ✅ **Challenge system** (send, accept, decline, 60s expiration)
- ✅ **Server-Sent Events** for instant updates (no polling)
- ✅ **Challenge notifications** (subtle toast, auto-dismiss after 5s)
- ✅ **Duplicate prevention** (can't send multiple challenges between same users)
- ✅ **Auto-expiration** (expired challenges removed from UI automatically)
- ✅ **PostgreSQL persistence** (challenge history)
- ✅ **Redis for live data** (presence, active challenges, pub/sub)

### Static Apps
- ✅ Smoke Test app (template validation, working)
- ✅ Template for new static apps

### Interactive Games
- ⚠️ Tic-Tac-Toe exists but not integrated with challenge flow

## Technology Stack

**Frontend**:
- React (hooks-based)
- React Router (client-side routing)
- TypeScript

**Backend**:
- Go 1.25
- PostgreSQL (persistent data)
- Redis (ephemeral/live data, pub/sub)
- Server-Sent Events (real-time updates)

## Architecture Highlights

### Hybrid Data Strategy
- **Redis**: Live game state, presence, active challenges, real-time pub/sub
- **PostgreSQL**: User accounts, challenge history, persistent data

### Challenge Flow
1. User A sends challenge to User B
2. Redis stores challenge with 60s TTL
3. SSE notification sent to User B
4. Toast appears on User B's screen (5s auto-dismiss)
5. User B accepts/declines in lobby
6. Challenge result saved to PostgreSQL
7. Expired challenges auto-removed from UI

### Port Allocation
- `3000` - Identity Shell (serves both frontend static files and API)
- `3001` - Identity Shell Backend API
- `5010` - Smoke Test (iframe-embedded static app)
- `6379` - Redis
- `5555` - PostgreSQL

## Current Phase

**Phase 2.5: Lobby System Complete, Game Integration Pending**

We've completed the lobby infrastructure but haven't connected it to actual gameplay yet.

## File Structure (Actual)

```
pub-games-v3/
├── identity-shell/
│   ├── backend/
│   │   ├── main.go           # HTTP server, auth, routing
│   │   ├── lobby.go          # Lobby API handlers
│   │   └── redis.go          # Redis operations, presence, challenges
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Shell.tsx       # Main shell container
│   │       │   ├── Lobby.tsx       # Lobby UI with challenges
│   │       │   ├── ChallengeToast.tsx  # Notification popup
│   │       │   └── AppContainer.tsx    # Game/app loader
│   │       ├── hooks/
│   │       │   └── useLobby.ts     # SSE, presence, challenges
│   │       └── types.ts            # TypeScript definitions
│   └── data/                 # PostgreSQL migrations
│
├── games/
│   └── tic-tac-toe/          # Exists but not integrated
│
├── static-apps/
│   ├── smoke-test/           # Working iframe-embedded app
│   └── template/             # Template for static apps
│
└── scripts/
    ├── migrate_lobby.sh      # Database setup
    └── README.md
```

## Known Limitations

1. **No game integration**: Accepting a challenge doesn't launch the game
2. **Basic auth**: Email/password only, no OAuth or SSO
3. **No game state management**: Redis setup exists but not used by games
4. **Single-device only**: No cross-device presence sync
5. **No mobile optimization**: UI works but not touch-optimized
6. **No error recovery**: Lost connections require page refresh

## Recent Improvements (Jan 24, 2026)

- Made challenge toast more subtle (bottom-right, semi-transparent)
- Removed accept/decline from toast (informational only)
- Auto-dismiss toast after 5 seconds
- Prevent duplicate challenges between users
- Auto-remove expired challenges from UI
- Fixed TypeScript compilation errors
