# Online Awareness Service

## Overview

The Online Awareness Service is a dedicated microservice (port 6001) that provides real-time presence tracking and session awareness across all mini-apps in the pub-games platform. It enables features like:

- **Live presence updates** - See who's online and what they're doing
- **App session tracking** - Know who's in each multiplayer game
- **Grace period reconnection** - Automatic rejoin if connection drops
- **Browser lifecycle awareness** - Status updates for tab visibility, network changes
- **Millisecond-level updates** - SSE for instant presence propagation

## Architecture

### Technology Stack

- **Real-Time**: Server-Sent Events (SSE) for push updates
- **Caching**: Redis for fast presence/session lookups
- **Persistence**: PostgreSQL for analytics and history
- **Language**: Go 1.25

### Service Port

- **Port 6001** - Awareness Service (all endpoints)

### Data Flow

```
┌──────────────────────────────────────────────────────────┐
│ Browser (App/Identity Shell)                             │
├──────────────────────────────────────────────────────────┤
│ • Heartbeat every 20s                                    │
│ • Lifecycle hooks (visibility, online/offline)           │
│ • SSE connections for real-time updates                  │
└──────────────┬──────────────────────────────────────────┘
               │
               │ HTTP + SSE
               ▼
┌──────────────────────────────────────────────────────────┐
│ Awareness Service (Port 6001)                            │
├──────────────────────────────────────────────────────────┤
│ • Presence handlers: GET /api/presence/*, POST updates  │
│ • Session handlers: POST /api/sessions/*, GET stream    │
│ • SSE streaming: Broadcast updates to clients           │
└──────────────┬──────────────────────────────────────────┘
               │
        ┌──────┴──────┬──────────┐
        │             │          │
        ▼             ▼          ▼
    ┌─────────┐  ┌────────┐  ┌──────────┐
    │ Redis   │  │        │  │PostgreSQL│
    │ Cache   │  │Cache   │  │Analytics │
    │Presence │  │Sessions│  │History   │
    └─────────┘  └────────┘  └──────────┘
```

## Data Model

### User Presence (Redis)

**Key**: `presence:user:{userId}`
**Type**: Hash
**TTL**: 45 seconds (auto-expire without heartbeat)

```json
{
  "userId": "alice@example.com",
  "displayName": "Alice",
  "status": "in_game",       // online|in_game|away|offline
  "currentApp": "tic-tac-toe",
  "currentSession": "game-123",
  "lastSeen": 1710541234,
  "platform": "web"
}
```

### Session Participants (Redis)

**Key**: `session:app:{appId}:{sessionId}`
**Type**: Hash (userId → joinTimestamp)
**TTL**: 1 hour

```redis
session:app:dots:game-456
  alice@example.com: 1710541200
  bob@example.com:   1710541210
```

### Grace Period (Reconnection Window)

**Key**: `session:grace:{appId}:{sessionId}:{userId}`
**Type**: String (disconnect timestamp)
**TTL**: 30 seconds

Used to allow users to reconnect without losing their session if connection drops.

## Status Values

- **online** - User in lobby, not in a game
- **in_game** - User actively playing a multiplayer game
- **away** - Tab backgrounded or idle
- **offline** - User disconnected or closed browser
- **do_not_disturb** - (Future) User disabled notifications

## API Endpoints

### Presence Endpoints

#### GET /api/presence/users
Returns all online users

```bash
curl http://localhost:6001/api/presence/users
```

**Response**:
```json
{
  "users": [
    {
      "userId": "alice@example.com",
      "displayName": "Alice",
      "status": "in_game",
      "currentApp": "tic-tac-toe",
      "lastSeen": 1710541234
    }
  ],
  "total": 42,
  "byStatus": {
    "online": 10,
    "in_game": 25,
    "away": 5,
    "offline": 2
  }
}
```

#### GET /api/presence/user/{userId}
Get single user's presence

```bash
curl http://localhost:6001/api/presence/user/alice@example.com
```

**Response**:
```json
{
  "userId": "alice@example.com",
  "displayName": "Alice",
  "status": "in_game",
  "currentApp": "tic-tac-toe",
  "currentSession": "game-123",
  "lastSeen": 1710541234,
  "platform": "web"
}
```

#### POST /api/presence/heartbeat
Update presence (periodic from client)

```bash
curl -X POST http://localhost:6001/api/presence/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice@example.com",
    "displayName": "Alice",
    "status": "in_game",
    "currentApp": "tic-tac-toe",
    "currentSession": "game-123",
    "platform": "web"
  }'
```

**Response**:
```json
{
  "success": true,
  "ttl": 45
}
```

#### POST /api/presence/status
Manually update status

```bash
curl -X POST http://localhost:6001/api/presence/status \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice@example.com",
    "status": "away",
    "currentApp": "tic-tac-toe",
    "currentSession": "game-123"
  }'
```

#### GET /api/presence/stream
SSE stream for presence updates

```bash
curl http://localhost:6001/api/presence/stream?userId=alice@example.com
```

**Events**:
```
event: presence_update
data: {"userId": "bob@example.com", "status": "online", ...}

event: user_online
data: {"userId": "charlie@example.com", ...}

event: user_offline
data: {"userId": "dave@example.com", ...}
```

### Session Endpoints

#### POST /api/sessions/join
Add user to a multiplayer session

```bash
curl -X POST http://localhost:6001/api/sessions/join \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice@example.com",
    "appId": "dots",
    "sessionId": "game-456"
  }'
```

**Response**:
```json
{
  "success": true,
  "sessionId": "game-456",
  "appId": "dots",
  "participants": [
    {
      "userId": "alice@example.com",
      "joinedAt": 1710541200,
      "status": "in_game"
    },
    {
      "userId": "bob@example.com",
      "joinedAt": 1710541210,
      "status": "in_game"
    }
  ],
  "count": 2
}
```

#### POST /api/sessions/leave
Remove user from session (with grace period)

```bash
curl -X POST http://localhost:6001/api/sessions/leave \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice@example.com",
    "appId": "dots",
    "sessionId": "game-456"
  }'
```

#### GET /api/sessions/app/{appId}?sessionId={sessionId}
Get participants in a specific session

```bash
curl http://localhost:6001/api/sessions/app/dots?sessionId=game-456
```

#### GET /api/sessions/stream/{appId}/{sessionId}
SSE stream for session updates

```bash
curl http://localhost:6001/api/sessions/stream/dots/game-456
```

**Events**:
```
event: participant_joined
data: {"userId": "alice@example.com"}

event: participant_left
data: {"userId": "bob@example.com", "gracePeriod": 30}

event: participant_reconnected
data: {"userId": "charlie@example.com", "wasInGracePeriod": true}

event: grace_period_expired
data: {"userId": "dave@example.com", "canClaimSession": true}
```

## Client Integration

### JavaScript Client

Import the awareness client in your app:

```javascript
import { AwarenessClient, StatusValues } from '../../../lib/activity-hub-common/awareness/client.js';

const client = new AwarenessClient('http://localhost:6001', userId, displayName);

// Initialize
await client.initialize();

// Listen for presence updates
client.connectPresenceStream((event) => {
  console.log('Presence update:', event);
});

// Update status
await client.setStatus(StatusValues.IN_GAME);

// Join multiplayer session
await client.joinSession('tic-tac-toe', 'game-123');

// Leave session
await client.leaveSession('tic-tac-toe', 'game-123');

// Cleanup on unmount
client.cleanup();
```

### React Hooks

Use the provided React hook in components:

```typescript
import { useAwareness } from '../../../lib/activity-hub-common/awareness/useAwareness';

function MyComponent() {
  const awareness = useAwareness(userId, displayName);

  useEffect(() => {
    // Initialize and listen
    awareness.client?.connectPresenceStream((event) => {
      // Handle events
    });
  }, [awareness.client]);

  return (
    <div>
      <button onClick={() => awareness.setStatus('in_game')}>
        Play Game
      </button>
      <p>Online users: {awareness.onlineUsers.length}</p>
    </div>
  );
}
```

### Provider Pattern

Wrap your app with AwarenessProvider:

```typescript
import { AwarenessProvider } from '../../../lib/activity-hub-common/awareness/useAwareness';

<AwarenessProvider userId={userId} displayName={displayName}>
  <YourApp />
</AwarenessProvider>
```

Then use hooks in any child component:

```typescript
import { usePresenceDisplay, useSessionDisplay } from '../../../lib/activity-hub-common/awareness/useAwareness';

function Lobby() {
  const presence = usePresenceDisplay();

  return (
    <div>
      {presence?.users.map(user => (
        <div key={user.userId}>
          {user.displayName} - {user.status}
        </div>
      ))}
    </div>
  );
}
```

## Browser Lifecycle Handling

The client automatically handles browser events:

```javascript
// Tab backgrounded → status: away
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    client.setStatus('away');
  } else {
    client.setStatus('online'); // or 'in_game'
  }
});

// Network online → reconnect SSE
window.addEventListener('online', () => {
  client.reconnectSSE();
});

// Page unload → offline beacon
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/presence/heartbeat', {
    userId, status: 'offline'
  });
});
```

## Reconnection Logic

If SSE disconnects:

1. **Immediate reconnection**: Retry immediately
2. **Exponential backoff**: 1s, 2s, 4s, 8s, 16s, 30s (max)
3. **Grace period**: Automatically rejoin sessions if within 30 seconds
4. **Fallback polling**: (Future) HTTP polling if SSE unavailable

## Performance Characteristics

| Operation | Latency | Throughput |
|-----------|---------|-----------|
| Heartbeat | < 100ms | 10k/sec |
| SSE push | < 50ms | Real-time |
| Session join | < 200ms | 1k/sec |
| Presence query | < 10ms | 100k/sec |

## Monitoring & Debugging

### Health Check

```bash
curl http://localhost:6001/health
# {"status":"ok"}
```

### Metrics

```bash
curl http://localhost:6001/metrics
# Prometheus-format metrics
```

### Debug Logging

Enable debug logging by setting environment variable:

```bash
export DEBUG=awareness:*
npm run dev
```

## Deployment

### Environment Variables

```bash
REDIS_ADDR=localhost:6379        # Redis connection
DATABASE_URL=postgres://...      # PostgreSQL connection
PORT=6001                        # Service port
```

### Running Locally

```bash
cd awareness-service/backend
go run main.go handlers_presence.go handlers_sessions.go redis.go postgres.go broadcaster.go models.go
```

### Docker

```dockerfile
FROM golang:1.25
WORKDIR /app
COPY . .
RUN go build -o awareness-service
EXPOSE 6001
CMD ["./awareness-service"]
```

## Integration Checklist

When integrating awareness into an app:

- [ ] Import AwarenessClient or useAwareness hook
- [ ] Call `client.initialize()` on app startup
- [ ] Connect to presence/session streams as needed
- [ ] Call `client.joinSession()` when entering multiplayer
- [ ] Call `client.leaveSession()` when exiting multiplayer
- [ ] Call `client.cleanup()` on unmount
- [ ] Display participant list if multiplayer
- [ ] Show online user count in lobby
- [ ] Handle connection loss gracefully

## Troubleshooting

### SSE Not Connecting

1. Check browser console for errors
2. Verify CORS headers: `Access-Control-Allow-Origin: *`
3. Test with curl: `curl http://localhost:6001/api/presence/stream?userId=test`
4. Check Redis is running and accessible

### Presence Not Updating

1. Verify heartbeat is being sent: `redis-cli HGETALL presence:user:{userId}`
2. Check TTL: `redis-cli TTL presence:user:{userId}` (should be ~45s)
3. Monitor Redis events: `redis-cli MONITOR | grep presence`

### Session Not Synchronizing

1. Verify both clients joined: `redis-cli HGETALL session:app:{appId}:{sessionId}`
2. Check session stream is connected: Browser DevTools → Network → SSE
3. Verify grace period exists: `redis-cli KEYS session:grace:*`

## Future Enhancements

- Presence persistence across restarts
- Do Not Disturb mode
- Activity-based status (AFK timeout)
- Geographic presence (map view)
- Status history analytics
- Offline message queue
- Mobile client support (native SSE libraries)

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Platform architecture overview
- [REALTIME.md](./REALTIME.md) - Real-time communication patterns
- [DATABASE.md](./DATABASE.md) - PostgreSQL and Redis usage
