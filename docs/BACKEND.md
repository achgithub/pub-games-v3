# Backend Development Guide

## Tech Stack

- **Go 1.25** - Backend language (runs on Pi only)
- **net/http** - HTTP server (standard library)
- **PostgreSQL** - Persistent storage
- **Redis** - Real-time state and pub/sub
- **SSE** - Real-time communication (Server-Sent Events)

## Important: Development Workflow

- **Writing code:** Mac (using Claude Code)
- **Building/running:** Raspberry Pi only
- **Testing:** After commit and push to Pi

**Never attempt to run `go build` or `go test` on Mac** - these commands only work on the Pi.

## Backend Structure

```
games/{app-name}/backend/
├── main.go           # Entry point, HTTP server setup
├── handlers.go       # HTTP handlers
├── game.go           # Game logic
├── redis.go          # Redis operations (if needed)
├── db.go             # PostgreSQL operations (if needed)
├── static/           # React build output (served by Go)
└── ...
```

## Main Entry Point

```go
// main.go
package main

import (
    "log"
    "net/http"
    "os"
)

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "4001"
    }

    // API routes
    http.HandleFunc("/api/game", handleGame)
    http.HandleFunc("/api/game/", handleGameActions)
    http.HandleFunc("/api/config", handleConfig)

    // Serve React build
    fs := http.FileServer(http.Dir("./static"))
    http.Handle("/", fs)

    log.Printf("Server starting on port %s", port)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}
```

## Serving Static Files

Backend serves the React production build:

```go
// Serve static files (React build output)
fs := http.FileServer(http.Dir("./static"))
http.Handle("/", fs)
```

**Build process (run on Pi):**
```bash
cd frontend && npm run build
cp -r build/* ../backend/static/
cd ../backend && go run *.go
```

## API Patterns

### REST endpoints

```go
// handlers.go
func handleGame(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case "GET":
        getGame(w, r)
    case "POST":
        createGame(w, r)
    default:
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
    }
}

func getGame(w http.ResponseWriter, r *http.Request) {
    gameID := r.URL.Query().Get("id")
    if gameID == "" {
        respondJSON(w, http.StatusBadRequest, map[string]string{
            "error": "Missing game ID",
        })
        return
    }

    // Fetch from Redis/PostgreSQL
    state, err := getGameState(gameID)
    if err != nil {
        respondJSON(w, http.StatusInternalServerError, map[string]string{
            "error": "Failed to fetch game",
        })
        return
    }

    respondJSON(w, http.StatusOK, state)
}

func createGame(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Player1 string                 `json:"player1"`
        Player2 string                 `json:"player2"`
        Options map[string]interface{} `json:"options"`
    }

    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondJSON(w, http.StatusBadRequest, map[string]string{
            "error": "Invalid request body",
        })
        return
    }

    // Create game
    gameID, err := createNewGame(req.Player1, req.Player2, req.Options)
    if err != nil {
        respondJSON(w, http.StatusInternalServerError, map[string]string{
            "error": "Failed to create game",
        })
        return
    }

    respondJSON(w, http.StatusOK, map[string]string{
        "gameId": gameID,
    })
}
```

### JSON response helper

```go
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}
```

### Error handling

```go
func handleGameMove(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var move Move
    if err := json.NewDecoder(r.Body).Decode(&move); err != nil {
        respondJSON(w, http.StatusBadRequest, map[string]string{
            "error": "Invalid move format",
        })
        return
    }

    // Validate move
    if !isValidMove(move) {
        respondJSON(w, http.StatusBadRequest, map[string]string{
            "error": "Invalid move",
        })
        return
    }

    // Apply move
    if err := applyMove(move); err != nil {
        log.Printf("Error applying move: %v", err)
        respondJSON(w, http.StatusInternalServerError, map[string]string{
            "error": "Failed to apply move",
        })
        return
    }

    respondJSON(w, http.StatusOK, map[string]string{
        "status": "success",
    })
}
```

## Config Endpoint

Games should expose a `/api/config` endpoint for dynamic challenge options:

```go
func handleConfig(w http.ResponseWriter, r *http.Request) {
    config := map[string]interface{}{
        "appId": "your-app",
        "gameOptions": []map[string]interface{}{
            {
                "id":      "gridSize",
                "type":    "select",
                "label":   "Grid Size",
                "default": "4x4",
                "options": []map[string]interface{}{
                    {"value": "4x4", "label": "Small (4x4)"},
                    {"value": "6x6", "label": "Medium (6x6)"},
                    {"value": "8x8", "label": "Large (8x8)"},
                },
            },
            {
                "id":      "difficulty",
                "type":    "select",
                "label":   "Difficulty",
                "default": "normal",
                "options": []map[string]interface{}{
                    {"value": "easy", "label": "Easy"},
                    {"value": "normal", "label": "Normal"},
                    {"value": "hard", "label": "Hard"},
                },
            },
        },
    }

    respondJSON(w, http.StatusOK, config)
}
```

Options are passed to `/api/game` on challenge accept:

```go
func createGame(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Player1 string                 `json:"player1"`
        Player2 string                 `json:"player2"`
        Options map[string]interface{} `json:"options"`
    }

    // Parse options
    gridSize := req.Options["gridSize"].(string)  // e.g., "6x9"
    difficulty := req.Options["difficulty"].(string)  // e.g., "hard"

    // Create game with options
    // ...
}
```

## CORS (Not Needed)

Since backend serves both API and frontend from the same port, **no CORS configuration is needed**.

If you need to call another service (e.g., identity shell), use standard HTTP:

```go
func validateUser(userId string) error {
    resp, err := http.Get(fmt.Sprintf("http://localhost:3001/api/users/%s", userId))
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("user not found")
    }

    return nil
}
```

## Logging

Use standard log package:

```go
import "log"

log.Printf("Game created: %s", gameID)
log.Printf("Player %s made move: %+v", playerID, move)
log.Printf("Error fetching game: %v", err)
```

For structured logging (future):
```go
// Consider adding structured logging library
// github.com/sirupsen/logrus or similar
```

## Environment Variables

```go
import "os"

port := os.Getenv("PORT")
if port == "" {
    port = "4001"  // Default
}

redisAddr := os.Getenv("REDIS_ADDR")
if redisAddr == "" {
    redisAddr = "localhost:6379"
}

postgresURL := os.Getenv("DATABASE_URL")
if postgresURL == "" {
    postgresURL = "postgres://user:pass@localhost/dbname"
}
```

## Code Organization

### Separate concerns

```
backend/
├── main.go           # Server setup, routing
├── handlers.go       # HTTP handlers
├── game.go           # Business logic
├── redis.go          # Redis operations
├── db.go             # PostgreSQL operations
├── sse.go            # SSE streaming (if complex)
└── types.go          # Data structures
```

### Types

```go
// types.go
package main

type GameState struct {
    ID            string     `json:"id"`
    Board         [][]string `json:"board"`
    CurrentPlayer string     `json:"currentPlayer"`
    Winner        string     `json:"winner,omitempty"`
    Status        string     `json:"status"` // "waiting", "active", "completed"
    CreatedAt     time.Time  `json:"createdAt"`
}

type Move struct {
    GameID string `json:"gameId"`
    Player string `json:"player"`
    Row    int    `json:"row"`
    Col    int    `json:"col"`
}

type Player struct {
    ID     string `json:"id"`
    Name   string `json:"name"`
    Symbol string `json:"symbol"`
}
```

## Testing on Pi

After writing code on Mac:

1. **Commit:**
   ```bash
   git add .
   git commit -m "Add game move validation"
   ```

2. **Push** (user does this manually)

3. **On Pi:**
   ```bash
   cd ~/pub-games-v3
   git pull
   cd games/your-app/backend
   go run *.go
   ```

4. **Test:**
   ```bash
   curl http://localhost:4001/api/config
   curl -X POST http://localhost:4001/api/game \
     -H "Content-Type: application/json" \
     -d '{"player1":"alice","player2":"bob"}'
   ```

## Common Patterns

### Path routing

```go
func handleGameActions(w http.ResponseWriter, r *http.Request) {
    // Extract game ID from path: /api/game/{id}/...
    path := strings.TrimPrefix(r.URL.Path, "/api/game/")
    parts := strings.Split(path, "/")

    if len(parts) < 1 {
        http.Error(w, "Missing game ID", http.StatusBadRequest)
        return
    }

    gameID := parts[0]

    if len(parts) > 1 {
        switch parts[1] {
        case "move":
            handleGameMove(w, r, gameID)
        case "stream":
            handleGameStream(w, r, gameID)
        default:
            http.Error(w, "Unknown action", http.StatusNotFound)
        }
        return
    }

    // Default: get game state
    getGameState(w, r, gameID)
}
```

### Request validation

```go
func validateMoveRequest(move *Move) error {
    if move.GameID == "" {
        return fmt.Errorf("missing game ID")
    }
    if move.Player == "" {
        return fmt.Errorf("missing player")
    }
    if move.Row < 0 || move.Row >= 3 {
        return fmt.Errorf("invalid row")
    }
    if move.Col < 0 || move.Col >= 3 {
        return fmt.Errorf("invalid column")
    }
    return nil
}
```

### Response caching

```go
func handleGameState(w http.ResponseWriter, r *http.Request) {
    // Disable caching for real-time data
    w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
    w.Header().Set("Pragma", "no-cache")
    w.Header().Set("Expires", "0")

    // ... rest of handler
}
```

## Reference Implementation

**Always check tic-tac-toe first** before creating a new app:
- `games/tic-tac-toe/backend/` - Reference implementation
- Handler patterns
- Redis integration
- SSE streaming
- Error handling

## Build and Run

### Development (on Pi)

```bash
cd backend
go run *.go
```

### Production (future)

```bash
go build -o app
./app
```

Or use systemd service (see deployment docs).

## Debugging

### Log all requests

```go
func loggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        log.Printf("%s %s", r.Method, r.URL.Path)
        next(w, r)
    }
}

// Use it:
http.HandleFunc("/api/game", loggingMiddleware(handleGame))
```

### Pretty print JSON

```go
func prettyJSON(data interface{}) string {
    b, _ := json.MarshalIndent(data, "", "  ")
    return string(b)
}

log.Printf("Game state: %s", prettyJSON(state))
```

## Security Notes

### Input validation

Always validate user input:

```go
func sanitizeInput(input string) string {
    // Remove dangerous characters
    return strings.TrimSpace(input)
}
```

### SQL injection prevention

Use parameterized queries (see [DATABASE.md](./DATABASE.md)).

### Rate limiting (future)

Consider adding rate limiting for production:

```go
// TODO: Implement rate limiting
// github.com/didip/tollbooth or similar
```

## Performance Tips

### Connection pooling

Redis and PostgreSQL connections should be pooled (see [DATABASE.md](./DATABASE.md)).

### Concurrent request handling

Go's `net/http` handles requests concurrently by default. No additional setup needed.

### Memory management

Be mindful of large responses:

```go
// Avoid loading entire game history into memory
// Paginate large results
```

## Common Gotchas

1. **Static file serving:** Files must be in `backend/static/` (copied from frontend build)
2. **CORS:** Not needed (same origin)
3. **Go on Mac:** Won't work - all builds happen on Pi
4. **Environment variables:** Set them before running (or use `.env` file)
5. **SSE connections:** Keep-alive requires special handling (see [REALTIME.md](./REALTIME.md))
