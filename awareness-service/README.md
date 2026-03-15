# Online Awareness Service

Real-time presence and session tracking microservice for the pub-games platform.

## Quick Start

### Prerequisites

- Go 1.25+
- Redis (for presence caching)
- PostgreSQL (for analytics)

### Running

```bash
cd awareness-service/backend
go mod download
go run main.go handlers_presence.go handlers_sessions.go redis.go postgres.go broadcaster.go models.go
```

Service will start on `http://localhost:6001`

### Docker

```bash
docker build -t awareness-service .
docker run -p 6001:6001 \
  -e REDIS_ADDR=redis:6379 \
  -e DATABASE_URL=postgres://user:pass@postgres:5432/pubgames \
  awareness-service
```

## Architecture

- **Language**: Go 1.25
- **Real-time**: Server-Sent Events (SSE)
- **Cache**: Redis (presence, sessions)
- **Storage**: PostgreSQL (history, analytics)
- **Port**: 6001

## Key Concepts

### Presence
Every user has a presence status: online, in_game, away, offline. Status automatically updates based on:
- Periodic heartbeats (20 second interval)
- Browser visibility changes
- Network connectivity changes
- Explicit status updates

### Sessions
Multiplayer games track participants in sessions. Users can rejoin within a 30-second grace period if connection drops.

### Real-Time Updates
All updates broadcast via SSE for millisecond-level awareness across all connected clients.

## Directory Structure

```
awareness-service/
├── README.md (this file)
├── go.mod
├── backend/
│   ├── main.go                  # Server entry point and routing
│   ├── models.go                # Data structures
│   ├── handlers_presence.go     # Presence endpoints
│   ├── handlers_sessions.go     # Session endpoints
│   ├── handlers_sse.go          # SSE streaming (broadcast)
│   ├── redis.go                 # Redis operations
│   ├── postgres.go              # PostgreSQL operations
│   ├── broadcaster.go           # SSE broadcaster
│   └── static/                  # (Will contain compiled frontend if added)
└── database/
    └── schema.sql               # PostgreSQL schema
```

## API Overview

### Presence
- `GET /api/presence/users` - All online users
- `GET /api/presence/user/{id}` - Single user
- `POST /api/presence/heartbeat` - Update presence
- `POST /api/presence/status` - Change status
- `GET /api/presence/stream` - SSE stream

### Sessions
- `POST /api/sessions/join` - Join multiplayer session
- `POST /api/sessions/leave` - Leave session (grace period)
- `GET /api/sessions/app/{appId}` - Get participants
- `GET /api/sessions/stream/{appId}/{sessionId}` - SSE stream

See [AWARENESS-SERVICE.md](../docs/AWARENESS-SERVICE.md) for full endpoint documentation.

## Client Integration

Use the JavaScript client in your frontend:

```javascript
import { AwarenessClient } from '../../../lib/activity-hub-common/awareness/client.js';

const client = new AwarenessClient('http://localhost:6001', userId);
await client.initialize();
```

Or use React hooks:

```typescript
import { useAwareness } from '../../../lib/activity-hub-common/awareness/useAwareness';

const { status, setStatus, joinSession, leaveSession } = useAwareness(userId);
```

## Testing

### Manual Testing

```bash
# Check if service is running
curl http://localhost:6001/health

# Get all users
curl http://localhost:6001/api/presence/users

# Send heartbeat
curl -X POST http://localhost:6001/api/presence/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"userId":"test@example.com","status":"online"}'

# Connect to stream
curl http://localhost:6001/api/presence/stream?userId=test@example.com
```

### Redis Verification

```bash
# Check presence key
redis-cli HGETALL presence:user:test@example.com

# Check TTL
redis-cli TTL presence:user:test@example.com

# Check sessions
redis-cli HGETALL session:app:dots:game-123

# Monitor all operations
redis-cli MONITOR | grep presence
```

## Database

Run migrations:

```bash
psql pubgames < database/schema.sql
```

## Environment Variables

```bash
REDIS_ADDR=localhost:6379
DATABASE_URL=postgres://activityhub:pubgames@localhost:5555/pubgames?sslmode=disable
PORT=6001
```

## Key Files

- `backend/main.go` - HTTP server setup and routing
- `backend/redis.go` - All Redis operations (presence, sessions, grace periods)
- `backend/handlers_presence.go` - Presence API endpoints
- `backend/handlers_sessions.go` - Session API endpoints
- `backend/broadcaster.go` - SSE broadcast mechanism

## Integration Steps

1. **App Startup**:
   ```javascript
   const client = new AwarenessClient(baseUrl, userId);
   await client.initialize();
   ```

2. **Game Launch**:
   ```javascript
   await client.joinSession(appId, sessionId);
   client.connectSessionStream(appId, sessionId, handleEvent);
   ```

3. **Game Close**:
   ```javascript
   await client.leaveSession(appId, sessionId);
   ```

4. **Cleanup**:
   ```javascript
   client.cleanup();
   ```

## Performance

- **Heartbeat**: < 100ms
- **SSE push**: < 50ms
- **Session join**: < 200ms
- **Presence query**: < 10ms

## Monitoring

Health check:
```bash
curl http://localhost:6001/health
```

Metrics (Prometheus format):
```bash
curl http://localhost:6001/metrics
```

## Development Notes

- Redis expires presence keys automatically (45s TTL)
- SSE connections send keep-alive comments every 30s
- Grace period allows 30-second reconnection window
- All timestamps are Unix seconds
- Session participants stored as hash (userId → joinTimestamp)

## Future Work

- [ ] Presence persistence across restarts
- [ ] Do Not Disturb status
- [ ] Activity-based timeout
- [ ] Historical analytics dashboard
- [ ] Geographic presence view
- [ ] Mobile client support
- [ ] Offline message queue

## Troubleshooting

**SSE not connecting?**
- Check CORS headers (should allow all origins)
- Test with: `curl http://localhost:6001/api/presence/stream?userId=test`
- Check browser console for errors

**Presence not updating?**
- Verify heartbeat being sent: `redis-cli MONITOR`
- Check key exists: `redis-cli HGETALL presence:user:test@example.com`
- Check TTL: `redis-cli TTL presence:user:test@example.com`

**Database errors?**
- Verify PostgreSQL is running: `psql pubgames -c "SELECT 1"`
- Check schema exists: `psql pubgames -c "\dt"`
- Run migrations: `psql pubgames < database/schema.sql`

## See Also

- [AWARENESS-SERVICE.md](../docs/AWARENESS-SERVICE.md) - Complete documentation
- [REALTIME.md](../docs/REALTIME.md) - Real-time patterns
- [DATABASE.md](../docs/DATABASE.md) - Database guide
