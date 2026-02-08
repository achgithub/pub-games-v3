# Activity Hub Common Library

Shared Go packages for the Activity Hub platform. Eliminates code duplication across mini-apps by providing centrally-managed, versioned packages for common functionality.

## Purpose

This library consolidates **1,200+ lines of duplicated code** from across 7+ mini-apps into reusable packages:

- **auth**: Authentication middleware, user context, admin authorization
- **database**: PostgreSQL connection pooling, common queries, helpers
- **redis**: Redis client initialization, CRUD operations, pub/sub
- **sse**: Server-Sent Events streaming, event formatting
- **http**: HTTP utilities, CORS, JSON responses, error handling
- **logging**: Structured logging, audit trails
- **config**: Environment variable management, configuration loading

## Installation

### During Development (Local)

While developing the library, apps use a local replace directive:

```go
// In your app's go.mod
module your-app

go 1.25

require github.com/achgithub/activity-hub-common v0.1.0

// Use local version during development
replace github.com/achgithub/activity-hub-common => ../../../lib/activity-hub-common
```

### After Publishing (GitHub)

Once the library is published and tagged:

```bash
cd your-app/backend
go get github.com/achgithub/activity-hub-common@v1.0.0
```

## Usage Examples

### Authentication

```go
import (
    "github.com/achgithub/activity-hub-common/auth"
    "github.com/achgithub/activity-hub-common/database"
)

func main() {
    // Initialize identity database
    identityDB, err := database.InitIdentityDatabase()
    if err != nil {
        log.Fatal(err)
    }

    // Create auth middleware
    authMiddleware := auth.Middleware(identityDB)
    adminMiddleware := auth.AdminMiddleware

    // Use in routes
    r := mux.NewRouter()
    r.HandleFunc("/api/game", authMiddleware(handleCreateGame)).Methods("POST")
    r.HandleFunc("/api/admin/users", authMiddleware(adminMiddleware(handleGetUsers))).Methods("GET")
}

// Access user in handler
func handleCreateGame(w http.ResponseWriter, r *http.Request) {
    user, ok := auth.GetUserFromContext(r.Context())
    if !ok {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    log.Printf("User %s creating game", user.Email)
    // ... game logic
}
```

### Database

```go
import "github.com/achgithub/activity-hub-common/database"

func main() {
    // Initialize app-specific database
    appDB, err := database.InitDatabase("tictactoe")
    if err != nil {
        log.Fatal(err)
    }
    defer appDB.Close()

    // Initialize shared identity database
    identityDB, err := database.InitIdentityDatabase()
    if err != nil {
        log.Fatal(err)
    }
    defer identityDB.Close()

    // Use helper for NULL strings
    var username sql.NullString
    err = appDB.QueryRow("SELECT username FROM games WHERE id = $1", gameID).Scan(&username)
    name := database.ScanNullString(username) // Returns "" if NULL
}
```

### Redis

```go
import (
    "github.com/achgithub/activity-hub-common/redis"
    "time"
)

func main() {
    // Initialize Redis client
    redisClient, err := redis.InitRedis()
    if err != nil {
        log.Fatal(err)
    }

    // Store game state (with 24-hour TTL)
    game := Game{ID: "game-123", Status: "active"}
    err = redis.CreateGame(ctx, redisClient, "game:123", game, 24*time.Hour)

    // Retrieve game state
    var loadedGame Game
    err = redis.GetGame(ctx, redisClient, "game:123", &loadedGame)

    // Publish real-time event
    event := map[string]interface{}{"type": "move", "position": 5}
    err = redis.PublishEvent(ctx, redisClient, "game:123", event)
}
```

### Server-Sent Events (SSE)

```go
import (
    "github.com/achgithub/activity-hub-common/sse"
    "github.com/achgithub/activity-hub-common/redis"
)

func handleGameStream(w http.ResponseWriter, r *http.Request) {
    gameID := mux.Vars(r)["gameId"]
    user, _ := auth.GetUserFromContext(r.Context())

    // Load initial game state
    var game Game
    redis.GetGame(r.Context(), redisClient, "game:"+gameID, &game)

    // Stream updates
    err := sse.HandleStream(w, r, sse.StreamConfig{
        RedisClient: redisClient,
        Channel:     "game:" + gameID,
        InitialData: game,
        ValidateAccess: func(userID string) error {
            if userID != game.Player1ID && userID != game.Player2ID {
                return errors.New("not a player in this game")
            }
            return nil
        },
    })

    if err != nil {
        log.Printf("SSE error: %v", err)
    }
}
```

### HTTP Utilities

```go
import "github.com/achgithub/activity-hub-common/http"

func handleCreateGame(w http.ResponseWriter, r *http.Request) {
    var req CreateGameRequest

    // Parse JSON request
    if err := http.ParseJSON(r, &req); err != nil {
        http.ErrorJSON(w, "Invalid request", http.StatusBadRequest)
        return
    }

    // ... business logic ...

    // Return JSON response
    http.SuccessJSON(w, GameResponse{ID: "game-123", Status: "created"}, http.StatusCreated)
}
```

## Versioning

This library follows [Semantic Versioning](https://semver.org/):

- **v1.0.0**: First stable release
- **v1.1.0**: New features (backward compatible)
- **v1.2.0**: More new features
- **v2.0.0**: Breaking changes (requires app updates)

### Upgrading

Apps can upgrade independently:

```bash
# Upgrade to latest v1.x (safe, backward compatible)
go get github.com/achgithub/activity-hub-common@v1

# Upgrade to specific version
go get github.com/achgithub/activity-hub-common@v1.2.0

# Upgrade to v2 (may require code changes)
go get github.com/achgithub/activity-hub-common@v2
```

## Development Workflow

### Making Changes

1. **Modify library**: Edit code in `lib/activity-hub-common/`
2. **Test locally**: Apps use local replace directive
3. **Commit changes**: `git add lib/ && git commit -m "Fix auth bug"`
4. **Test in one app**: Verify changes don't break existing functionality
5. **Tag release**: `git tag v1.0.1 && git push --tags`
6. **Roll out**: Apps upgrade when ready (`go get ...@v1.0.1`)

### Adding New Packages

1. Create directory: `mkdir lib/activity-hub-common/newpackage`
2. Add code with godoc comments
3. Write tests: `newpackage/package_test.go`
4. Update this README with usage examples
5. Commit and tag release

## Testing

Run all tests:

```bash
cd lib/activity-hub-common
go test ./...
```

Run tests with coverage:

```bash
go test -cover ./...
```

Run integration tests (requires PostgreSQL + Redis):

```bash
# On Pi (has PostgreSQL on port 5555 and Redis)
go test -tags=integration ./...
```

## Package Documentation

Generate and view documentation:

```bash
go doc -all github.com/achgithub/activity-hub-common/auth
go doc -all github.com/achgithub/activity-hub-common/database
```

Or browse with godoc server:

```bash
godoc -http=:6060
# Visit http://localhost:6060/pkg/github.com/achgithub/activity-hub-common/
```

## Migration Status

Track which apps have migrated to the shared library:

| App | Status | Version | Migrated Packages |
|-----|--------|---------|------------------|
| tic-tac-toe | Pending | - | - |
| dots | Pending | - | - |
| spoof | Pending | - | - |
| sweepstakes | Pending | - | - |
| season-scheduler | Pending | - | - |
| display-admin | Pending | - | - |
| display-runtime | Pending | - | - |

See `.claude/APP-MIGRATION-STATUS.json` for detailed tracking.

## Architecture

### Package Dependencies

```
auth          → database (requires identity DB)
database      → (no dependencies)
redis         → (no dependencies)
sse           → redis (for pub/sub)
http          → (no dependencies)
logging       → (no dependencies)
config        → (no dependencies)
```

### Design Principles

- **No circular dependencies**: Clear hierarchy
- **Minimal external dependencies**: Only essential libraries
- **Backward compatibility**: Breaking changes only in major versions
- **Well-tested**: 80%+ code coverage target
- **Well-documented**: Godoc comments on all public APIs

## Contributing

1. Follow existing code patterns
2. Add tests for new functionality
3. Update README with usage examples
4. Use godoc comment format
5. Test with at least one app before releasing

## License

Internal use only (Activity Hub platform).

## Support

For questions or issues:
1. Check this README first
2. Review package godoc: `go doc github.com/achgithub/activity-hub-common/<package>`
3. Look at existing app implementations (tic-tac-toe is the reference)
4. Check `.claude/SESSION-STATE.md` for current development status
