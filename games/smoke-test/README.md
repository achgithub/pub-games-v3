# Smoke Test - Activity Hub Reference Implementation

**⚠️ THIS IS THE REFERENCE IMPLEMENTATION - When creating a new app, copy this pattern**

This app demonstrates the complete Activity Hub architecture with all recommended patterns.

## Port

**5010**

## What it does

Simple global counter app that demonstrates:
- Counter stored in Redis (ephemeral state)
- Activity log in PostgreSQL (persistent history)
- Real-time updates via Server-Sent Events
- Redis pub/sub for broadcasting
- Shared CSS from identity-shell
- TypeScript frontend
- activity-hub-common library for auth

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Frontend (React + TypeScript)                   │
│ - Shared CSS loaded from identity-shell:3001   │
│ - URL params: userId, userName, token          │
│ - SSE connection for real-time updates         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Backend (Go + activity-hub-common)              │
│ - Auth middleware (JWT validation)             │
│ - SSE middleware (for /api/events)             │
│ - Single port (5010) serves API + static       │
└─────────────────────────────────────────────────┘
          ↓                          ↓
┌──────────────────┐       ┌──────────────────┐
│ Redis            │       │ PostgreSQL       │
│ - counter value  │       │ - activity_log   │
│ - pub/sub chan   │       │   (history)      │
└──────────────────┘       └──────────────────┘
```

## Key Files (Copy These Patterns)

### Backend

1. **go.mod** - Dependencies + local replace for activity-hub-common
2. **main.go** - Server setup, Redis + PostgreSQL init, routing
3. **redis.go** - Redis connection boilerplate
4. **handlers.go** - API handlers including SSE streaming

### Frontend

1. **package.json** - React + TypeScript dependencies
2. **tsconfig.json** - TypeScript configuration
3. **src/index.tsx** - **CRITICAL:** Dynamic CSS loading from identity-shell
4. **src/App.css** - Minimal base styles (body, box-sizing)
5. **src/App.tsx** - Component using shared CSS classes

### Database

1. **database/schema.sql** - PostgreSQL schema for app data

## Critical Patterns

### 1. Shared CSS Loading (index.tsx)

```typescript
// Inject shared Activity Hub styles from identity-shell
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);
```

### 2. URL Parameter Parsing (App.tsx)

```typescript
function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      userName: params.get('userName'),
      token: params.get('token'),
    };
  }, []);
}
```

### 3. Activity Hub CSS Classes (App.tsx)

```tsx
<div className="ah-container ah-container--narrow">
  <div className="ah-card">
    <h3 className="ah-section-title">Title</h3>
    <p className="ah-meta">Metadata text</p>
    <button className="ah-btn-primary">Action</button>
    <button className="ah-lobby-btn">← Lobby</button>
  </div>
</div>
```

### 4. Backend Auth (main.go)

```go
// Build per-route middleware
authMiddleware := authlib.Middleware(identityDB)
sseMiddleware := authlib.SSEMiddleware(identityDB)

// Protected endpoints
r.HandleFunc("/api/counter", authMiddleware(HandleGetCounter)).Methods("GET")

// SSE endpoint
r.HandleFunc("/api/events", sseMiddleware(HandleSSE)).Methods("GET")
```

### 5. Redis + PostgreSQL (main.go)

```go
// Initialize Redis
if err := InitRedis(); err != nil {
    log.Fatal("Failed to connect to Redis:", err)
}

// Initialize app database
db, err = database.InitDatabase("smoke_test")

// Initialize identity database
identityDB, err := database.InitIdentityDatabase()
```

### 6. SSE Streaming (handlers.go)

```go
func HandleSSE(w http.ResponseWriter, r *http.Request) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    // Subscribe to Redis pub/sub
    pubsub := redisClient.Subscribe(ctx, REDIS_PUBSUB_CHANNEL)
    defer pubsub.Close()

    ch := pubsub.Channel()

    // Stream updates
    for {
        select {
        case msg := <-ch:
            fmt.Fprintf(w, "data: %s\n\n", msg.Payload)
            flusher.Flush()
        case <-r.Context().Done():
            return
        }
    }
}
```

### 7. Frontend SSE Client (App.tsx)

```typescript
useEffect(() => {
  const eventSource = new EventSource(
    `${API_BASE}/api/events?token=${encodeURIComponent(token)}`
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Handle update
  };

  return () => eventSource.close();
}, [token]);
```

## Deployment (on Pi)

```bash
# 1. Create database
psql -U activityhub -h localhost -p 5555 -d postgres -c "CREATE DATABASE smoke_test_db;"
psql -U activityhub -h localhost -p 5555 -d smoke_test_db -f games/smoke-test/database/schema.sql

# 2. Resolve dependencies
cd ~/pub-games-v3/games/smoke-test/backend
go mod tidy

# 3. Build frontend
cd ~/pub-games-v3/games/smoke-test/frontend
npm install
npm run build
cp -r build/* ../backend/static/

# 4. Run backend
cd ../backend
go run *.go
```

## When to Use Different Patterns

| Need | Use | Reference |
|------|-----|-----------|
| Real-time updates | Redis pub/sub + SSE | smoke-test (this app) |
| Turn-based game | Redis + SSE + HTTP | tic-tac-toe |
| Static app (no real-time) | PostgreSQL only | (future) |
| Ephemeral state | Redis | smoke-test counter |
| Persistent data | PostgreSQL | smoke-test activity_log |

## Checklist for New Apps

- [ ] Copy smoke-test directory structure
- [ ] Update go.mod module name
- [ ] Update APP_NAME and port in main.go
- [ ] Update database name in schema.sql
- [ ] Update package.json name
- [ ] Implement dynamic CSS loading in index.tsx
- [ ] Use Activity Hub CSS classes (.ah-*)
- [ ] Parse URL params (userId, userName, token)
- [ ] Use activity-hub-common for auth
- [ ] Add to identity-shell/backend/apps.json
- [ ] Test on Pi after deployment

## CSS Classes Available

See `identity-shell/backend/static/activity-hub.css` for full list:

**Layout:**
- `.ah-container` / `.ah-container--narrow` / `.ah-container--wide`

**Components:**
- `.ah-card`
- `.ah-btn-primary` / `.ah-btn-outline` / `.ah-btn-danger` / `.ah-btn-back`
- `.ah-lobby-btn`
- `.ah-tabs` / `.ah-tab` / `.ah-tab.active`
- `.ah-banner` / `.ah-banner--error` / `.ah-banner--success` / etc.

**Typography:**
- `.ah-section-title`
- `.ah-meta`
- `.ah-label`

**Forms:**
- `.ah-input`
- `.ah-select`
- `.ah-table`
