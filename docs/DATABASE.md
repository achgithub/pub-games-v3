# Database Architecture

## Overview

This project uses a **PostgreSQL + Redis hybrid** architecture:

- **PostgreSQL** - Persistent data (system of record)
- **Redis** - Ephemeral real-time data (cache + pub/sub)

## Simple Rule

**If it's live and ephemeral → Redis**
**If it needs to survive a restart → PostgreSQL**

## PostgreSQL Usage

### What to store

- User accounts and identity
- Game history and final results
- Persistent leaderboards (all-time stats)
- Configuration and templates
- Static app data (sweepstakes picks, LMS selections)
- Quiz questions and media references

### When to use

- Data must persist across restarts
- Need ACID guarantees
- Complex queries required
- Historical analysis
- Audit trails

### Connection setup (Go)

```go
import (
    "database/sql"
    _ "github.com/lib/pq"
)

var db *sql.DB

func initDB() error {
    connStr := "postgres://user:password@localhost/dbname?sslmode=disable"
    var err error
    db, err = sql.Open("postgres", connStr)
    if err != nil {
        return err
    }

    // Set connection pool limits
    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)

    return db.Ping()
}
```

### Schema example

```sql
-- games/{app-name}/database/schema.sql
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    player1 TEXT NOT NULL,
    player2 TEXT NOT NULL,
    winner TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_games_player1 ON games(player1);
CREATE INDEX idx_games_player2 ON games(player2);
CREATE INDEX idx_games_status ON games(status);
```

### Query patterns

**Insert:**
```go
func saveGameResult(gameID, winner string) error {
    _, err := db.Exec(`
        INSERT INTO games (id, player1, player2, winner, status, completed_at)
        VALUES ($1, $2, $3, $4, 'completed', NOW())
    `, gameID, player1, player2, winner)
    return err
}
```

**Query:**
```go
func getPlayerStats(playerID string) (wins, losses int, err error) {
    err = db.QueryRow(`
        SELECT
            COUNT(*) FILTER (WHERE winner = $1) as wins,
            COUNT(*) FILTER (WHERE winner != $1 AND winner IS NOT NULL) as losses
        FROM games
        WHERE (player1 = $1 OR player2 = $1) AND status = 'completed'
    `, playerID).Scan(&wins, &losses)
    return
}
```

**Transaction:**
```go
func updateGameAndStats(gameID, winner string) error {
    tx, err := db.Begin()
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Update game
    _, err = tx.Exec(`
        UPDATE games SET winner = $1, status = 'completed', completed_at = NOW()
        WHERE id = $2
    `, winner, gameID)
    if err != nil {
        return err
    }

    // Update stats
    _, err = tx.Exec(`
        UPDATE player_stats SET wins = wins + 1 WHERE player_id = $1
    `, winner)
    if err != nil {
        return err
    }

    return tx.Commit()
}
```

### Setup script

Add your database to `scripts/setup_databases.sh`:

```bash
# Create database for your app
psql -U postgres -c "CREATE DATABASE your_app_db;"
psql -U postgres -d your_app_db < games/your-app/database/schema.sql
```

## Redis Usage

### What to store

- Real-time game state (current board, active turn)
- Live leaderboards during events
- Active session state (current question, timer, who's answered)
- Answer submission bursts
- Pub/sub for instant updates
- Temporary cache (with TTL)

### When to use

- Data is ephemeral (can be regenerated)
- Need sub-second read/write latency
- Real-time updates required
- High write throughput (100+ writes/second)
- Pub/sub messaging

### Connection setup (Go)

```go
import (
    "context"
    "github.com/go-redis/redis/v8"
)

var rdb *redis.Client
var ctx = context.Background()

func initRedis() error {
    rdb = redis.NewClient(&redis.Options{
        Addr:     "localhost:6379",
        Password: "", // No password by default
        DB:       0,  // Default DB
    })

    return rdb.Ping(ctx).Err()
}
```

### Data structure patterns

**Hash (game state):**
```go
// Store game state as hash
func saveGameState(gameID string, state map[string]interface{}) error {
    pipe := rdb.Pipeline()

    for key, val := range state {
        pipe.HSet(ctx, "game:"+gameID, key, val)
    }

    // Set expiry (auto-cleanup after 24 hours)
    pipe.Expire(ctx, "game:"+gameID, 24*time.Hour)

    _, err := pipe.Exec(ctx)
    return err
}

// Get game state
func getGameState(gameID string) (map[string]string, error) {
    return rdb.HGetAll(ctx, "game:"+gameID).Result()
}
```

**JSON (complex objects):**
```go
func saveGameJSON(gameID string, state GameState) error {
    data, err := json.Marshal(state)
    if err != nil {
        return err
    }

    return rdb.Set(ctx, "game:"+gameID, data, 24*time.Hour).Err()
}

func getGameJSON(gameID string) (*GameState, error) {
    data, err := rdb.Get(ctx, "game:"+gameID).Result()
    if err != nil {
        return nil, err
    }

    var state GameState
    err = json.Unmarshal([]byte(data), &state)
    return &state, err
}
```

**Sorted Set (leaderboard):**
```go
func updateScore(quizID, playerID string, score int) error {
    return rdb.ZAdd(ctx, "leaderboard:"+quizID, &redis.Z{
        Score:  float64(score),
        Member: playerID,
    }).Err()
}

func getTopPlayers(quizID string, limit int) ([]string, error) {
    // ZREVRANGE returns highest scores first
    return rdb.ZRevRange(ctx, "leaderboard:"+quizID, 0, int64(limit-1)).Result()
}
```

**List (recent activity):**
```go
func addActivity(playerID, activity string) error {
    pipe := rdb.Pipeline()

    // Add to front of list
    pipe.LPush(ctx, "activity:"+playerID, activity)

    // Keep only last 50
    pipe.LTrim(ctx, "activity:"+playerID, 0, 49)

    _, err := pipe.Exec(ctx)
    return err
}

func getRecentActivity(playerID string) ([]string, error) {
    return rdb.LRange(ctx, "activity:"+playerID, 0, 9).Result()
}
```

### Pub/Sub

**Publisher (game backend):**
```go
func broadcastGameUpdate(gameID string, update interface{}) error {
    data, err := json.Marshal(update)
    if err != nil {
        return err
    }

    return rdb.Publish(ctx, "game:"+gameID, data).Err()
}
```

**Subscriber (SSE handler):**
```go
func subscribeToGame(gameID string, callback func(string)) error {
    pubsub := rdb.Subscribe(ctx, "game:"+gameID)
    defer pubsub.Close()

    ch := pubsub.Channel()
    for msg := range ch {
        callback(msg.Payload)
    }

    return nil
}
```

See [REALTIME.md](./REALTIME.md#redis-pubsub-integration) for SSE + Redis patterns.

### TTL (Time-To-Live)

Always set expiry on ephemeral data:

```go
// Expire after 24 hours
rdb.Set(ctx, "game:"+gameID, data, 24*time.Hour)

// Expire after 1 hour
rdb.Expire(ctx, "session:"+sessionID, 1*time.Hour)

// No expiry (use carefully!)
rdb.Set(ctx, "config:app", data, 0)
```

### Key naming conventions

Use consistent prefixes:

```
game:{gameID}              # Game state
game:{gameID}:players      # Player list
leaderboard:{quizID}       # Sorted set
session:{sessionID}        # Session data
activity:{playerID}        # Activity log
config:{key}               # Configuration
```

## PostgreSQL + Redis Patterns

### Pattern 1: Write-Through Cache

**Redis as cache, PostgreSQL as source of truth:**

```go
func getPlayerProfile(playerID string) (*Player, error) {
    // Try cache first
    cached, err := rdb.Get(ctx, "player:"+playerID).Result()
    if err == nil {
        var player Player
        json.Unmarshal([]byte(cached), &player)
        return &player, nil
    }

    // Cache miss - fetch from PostgreSQL
    var player Player
    err = db.QueryRow(`
        SELECT id, name, email, created_at FROM users WHERE id = $1
    `, playerID).Scan(&player.ID, &player.Name, &player.Email, &player.CreatedAt)

    if err != nil {
        return nil, err
    }

    // Cache for 5 minutes
    data, _ := json.Marshal(player)
    rdb.Set(ctx, "player:"+playerID, data, 5*time.Minute)

    return &player, nil
}
```

### Pattern 2: Redis During, PostgreSQL After

**Real-time game uses Redis, final result saved to PostgreSQL:**

```go
func completeGame(gameID string) error {
    // 1. Get final state from Redis
    stateJSON, err := rdb.Get(ctx, "game:"+gameID).Result()
    if err != nil {
        return err
    }

    var state GameState
    json.Unmarshal([]byte(stateJSON), &state)

    // 2. Save result to PostgreSQL
    _, err = db.Exec(`
        INSERT INTO games (id, player1, player2, winner, status, completed_at)
        VALUES ($1, $2, $3, $4, 'completed', NOW())
    `, gameID, state.Player1, state.Player2, state.Winner)

    if err != nil {
        return err
    }

    // 3. Cleanup Redis (or let TTL expire)
    rdb.Del(ctx, "game:"+gameID)

    return nil
}
```

### Pattern 3: Live Leaderboard → Persistent Snapshot

**Quiz leaderboard in Redis during event, snapshot to PostgreSQL at end:**

```go
func finalizeQuiz(quizID string) error {
    // Get top 100 from Redis
    results, err := rdb.ZRevRangeWithScores(ctx, "leaderboard:"+quizID, 0, 99).Result()
    if err != nil {
        return err
    }

    // Save to PostgreSQL
    tx, _ := db.Begin()
    for rank, result := range results {
        tx.Exec(`
            INSERT INTO quiz_results (quiz_id, player_id, score, rank)
            VALUES ($1, $2, $3, $4)
        `, quizID, result.Member, int(result.Score), rank+1)
    }
    tx.Commit()

    // Optionally keep Redis data for 7 days
    rdb.Expire(ctx, "leaderboard:"+quizID, 7*24*time.Hour)

    return nil
}
```

## Database Selection Guide

| Use Case | Storage | Why |
|----------|---------|-----|
| User login/identity | PostgreSQL | Persistent, ACID required |
| Active game board | Redis | Real-time, ephemeral |
| Game result | PostgreSQL | Permanent record |
| Live quiz leaderboard | Redis | High write throughput |
| Final quiz rankings | PostgreSQL | Permanent record |
| Player stats (all-time) | PostgreSQL | Historical analysis |
| Session state | Redis | Temporary, fast access |
| Pub/sub updates | Redis | Real-time messaging |
| Configuration | PostgreSQL | Persistent, versioned |
| Cache | Redis | Fast reads, TTL |

## Common Mistakes

### ❌ Don't store persistent data only in Redis

```go
// BAD: User profile only in Redis
func createUser(user User) error {
    data, _ := json.Marshal(user)
    return rdb.Set(ctx, "user:"+user.ID, data, 0).Err()
}
```

**Problem:** Data lost on Redis restart.

**Fix:** Save to PostgreSQL, cache in Redis.

### ❌ Don't use PostgreSQL for high-frequency updates

```go
// BAD: Update game state in PostgreSQL on every move
func updateGameState(gameID string, state GameState) error {
    // 100+ moves = 100+ PostgreSQL writes
    _, err := db.Exec(`UPDATE games SET state = $1 WHERE id = $2`, state, gameID)
    return err
}
```

**Problem:** Slow, high load on PostgreSQL.

**Fix:** Use Redis during game, save final result to PostgreSQL.

### ❌ Don't forget TTL on Redis data

```go
// BAD: No expiry set
rdb.Set(ctx, "game:"+gameID, data, 0)
```

**Problem:** Redis memory grows forever.

**Fix:** Always set appropriate TTL.

```go
// GOOD: 24-hour expiry
rdb.Set(ctx, "game:"+gameID, data, 24*time.Hour)
```

## Performance Tips

### PostgreSQL

- **Use indexes** on frequently queried columns
- **Connection pooling** (SetMaxOpenConns, SetMaxIdleConns)
- **Prepared statements** for repeated queries
- **EXPLAIN ANALYZE** to debug slow queries

### Redis

- **Pipeline** multiple commands
- **Use hashes** for small objects (more memory efficient than JSON)
- **Monitor memory** with `redis-cli --bigkeys`
- **Set TTL** on all ephemeral data

## Monitoring

### PostgreSQL

```bash
# On Pi
psql -U postgres -d your_app_db

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### Redis

```bash
# On Pi
redis-cli

# Check memory usage
INFO memory

# Check key count
DBSIZE

# Monitor commands in real-time
MONITOR
```

## Backup Strategy

### PostgreSQL

```bash
# Dump database
pg_dump -U postgres your_app_db > backup.sql

# Restore
psql -U postgres -d your_app_db < backup.sql
```

### Redis

Redis data is ephemeral by design. No regular backups needed.

If you store permanent data in Redis (not recommended):
```bash
# Snapshot
redis-cli BGSAVE

# Restore from dump.rdb (automatic on restart)
```

## Reference Implementation

Check tic-tac-toe for examples:
- `games/tic-tac-toe/backend/redis.go` - Redis patterns
- `games/tic-tac-toe/database/schema.sql` - PostgreSQL schema
