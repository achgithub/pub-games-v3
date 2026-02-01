# New App Creation Guide

## CRITICAL: Read This First

**BEFORE creating any new app, you MUST:**

1. **Read tic-tac-toe structure first** - It's the reference implementation
2. **Use TypeScript** - ALL React frontends use `.tsx` files, NEVER `.js`
3. **Follow the directory pattern** shown below
4. **Copy configuration files** from tic-tac-toe (don't write from scratch)

## Step-by-Step Checklist

### Step 1: Create Directory Structure

```bash
games/{app-name}/
├── backend/
│   ├── main.go
│   ├── handlers.go
│   ├── game.go
│   ├── redis.go (if needed)
│   ├── db.go (if needed)
│   └── static/ (will hold React build)
├── frontend/
│   ├── src/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   └── react-app-env.d.ts
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
└── database/
    └── schema.sql (if needed)
```

### Step 2: Copy TypeScript Configuration

```bash
# Copy from reference implementation
cp games/tic-tac-toe/frontend/tsconfig.json games/{app-name}/frontend/
cp games/tic-tac-toe/frontend/src/react-app-env.d.ts games/{app-name}/frontend/src/
```

### Step 3: Create Frontend package.json

Copy from tic-tac-toe and modify:

```json
{
  "name": "your-app-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^4.9.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

### Step 4: Create Frontend Entry Point

**src/index.tsx:**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 5: Create Main App Component

**src/App.tsx:**

```typescript
import React, { useEffect, useState } from 'react';

function App() {
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userIdParam = params.get('userId');
    const userNameParam = params.get('userName');
    const gameIdParam = params.get('gameId');

    if (!userIdParam) {
      alert('This app must be accessed through the Identity Shell.');
      return;
    }

    setUserId(userIdParam);
    setUserName(userNameParam || 'Unknown');
    setGameId(gameIdParam || '');
  }, []);

  if (!userId) {
    return <div>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <h1>Your App Name</h1>
      <p>Welcome, {userName}</p>
      {/* Your app UI here */}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    padding: '20px',
  },
};

export default App;
```

### Step 6: Create Backend Entry Point

**backend/main.go:**

```go
package main

import (
    "log"
    "net/http"
    "os"
)

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "4XXX" // Choose your port (4000-4999 range)
    }

    // Initialize database connections (if needed)
    // initRedis()
    // initPostgreSQL()

    // API routes
    http.HandleFunc("/api/config", handleConfig)
    http.HandleFunc("/api/game", handleGame)
    http.HandleFunc("/api/game/", handleGameActions)

    // Serve React build
    fs := http.FileServer(http.Dir("./static"))
    http.Handle("/", fs)

    log.Printf("Server starting on port %s", port)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}
```

### Step 7: Create Handlers

**backend/handlers.go:**

```go
package main

import (
    "encoding/json"
    "net/http"
)

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
    config := map[string]interface{}{
        "appId": "your-app",
        "gameOptions": []map[string]interface{}{
            // Add your game options here
        },
    }
    respondJSON(w, http.StatusOK, config)
}

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
    // Implement: fetch game state
    respondJSON(w, http.StatusOK, map[string]string{
        "message": "Get game",
    })
}

func createGame(w http.ResponseWriter, r *http.Request) {
    // Implement: create new game
    respondJSON(w, http.StatusOK, map[string]string{
        "gameId": "ABC123",
    })
}

func handleGameActions(w http.ResponseWriter, r *http.Request) {
    // Handle /api/game/{id}/move, /api/game/{id}/stream, etc.
}
```

### Step 8: Add Database Schema (if needed)

**database/schema.sql:**

```sql
CREATE TABLE IF NOT EXISTS your_app_games (
    id TEXT PRIMARY KEY,
    player1 TEXT NOT NULL,
    player2 TEXT NOT NULL,
    winner TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_your_app_games_player1 ON your_app_games(player1);
CREATE INDEX idx_your_app_games_player2 ON your_app_games(player2);
```

### Step 9: Update Database Setup Script

Add to `scripts/setup_databases.sh`:

```bash
# Create database for your app
echo "Creating your-app database..."
psql -U postgres -c "CREATE DATABASE your_app_db;"
psql -U postgres -d your_app_db < games/your-app/database/schema.sql
echo "✓ your-app database created"
```

### Step 10: Register in App Registry

Add to `identity-shell/backend/apps.json`:

```json
{
  "id": "your-app",
  "name": "Your App Name",
  "icon": "🎮",
  "type": "iframe",
  "url": "http://{host}:4XXX",
  "backendPort": 4XXX,
  "category": "game",
  "realtime": "sse"
}
```

**Field reference:**
- `id`: Unique identifier (lowercase, hyphens)
- `name`: Display name
- `icon`: Emoji icon
- `type`: Always `"iframe"`
- `url`: `http://{host}:PORT` (use your chosen port)
- `backendPort`: Same port as URL
- `category`: `"game"` or `"activity"`
- `realtime`: `"sse"`, `"websocket"`, or `"none"`

### Step 11: Build and Test

**On Mac:**
```bash
# Commit your code
git add games/your-app
git commit -m "Add your-app skeleton"
```

**On Pi (after push and pull):**
```bash
# Install frontend dependencies
cd games/your-app/frontend
npm install

# Build frontend
npm run build

# Copy build to backend
cp -r build/* ../backend/static/

# Run backend
cd ../backend
go run *.go

# Test in browser
# http://pi:4XXX?userId=test@test.com&userName=Test
```

## TypeScript Requirements Checklist

- [ ] package.json includes `typescript`, `@types/react`, `@types/react-dom`
- [ ] All files use `.tsx` extension (NOT `.js`)
- [ ] Entry point is `src/index.tsx`
- [ ] Main component is `src/App.tsx`
- [ ] `tsconfig.json` copied from tic-tac-toe
- [ ] `react-app-env.d.ts` exists

## Styling Checklist

- [ ] Light theme background: `#f5f5f5`
- [ ] Card backgrounds: `#ffffff`
- [ ] Border radius: `8px`
- [ ] Box shadow: `0 2px 4px rgba(0,0,0,0.1)`
- [ ] Responsive design (mobile-first)

## Integration Checklist

- [ ] App reads `userId` from URL parameters
- [ ] App shows error if `userId` missing
- [ ] App added to `apps.json`
- [ ] Database added to `setup_databases.sh`
- [ ] `/api/config` endpoint implemented
- [ ] `/api/game` (POST) creates game
- [ ] `/api/game/{id}` (GET) fetches state
- [ ] SSE endpoint at `/api/game/{id}/stream` (if real-time)

## Common Mistakes to Avoid

### ❌ Don't use .js files

```javascript
// BAD: src/index.js
import React from 'react';
```

```typescript
// GOOD: src/index.tsx
import React from 'react';
```

### ❌ Don't write tsconfig.json from scratch

```bash
# BAD: Create manually
echo "{...}" > tsconfig.json

# GOOD: Copy from reference
cp games/tic-tac-toe/frontend/tsconfig.json .
```

### ❌ Don't forget URL parameters

```typescript
// BAD: No URL parameter handling
function App() {
  return <div>My App</div>;
}

// GOOD: Read and validate URL parameters
function App() {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userIdParam = params.get('userId');
    if (!userIdParam) {
      alert('Must be accessed through Identity Shell');
      return;
    }
    setUserId(userIdParam);
  }, []);

  if (!userId) return <div>Loading...</div>;
  return <div>My App</div>;
}
```

### ❌ Don't skip the registry

```json
// BAD: Forgetting to add to apps.json
// App won't appear in shell

// GOOD: Always register in identity-shell/backend/apps.json
{
  "id": "your-app",
  "name": "Your App",
  ...
}
```

## Testing Your New App

### Manual test checklist

1. [ ] App loads in iframe at `http://pi:4XXX?userId=test@test.com&userName=Test`
2. [ ] Error shown if accessed without `userId`
3. [ ] App appears in identity shell app list
4. [ ] Challenge modal shows app (if `category: "game"`)
5. [ ] SSE connection works (if real-time)
6. [ ] Creating a game works
7. [ ] Game state updates correctly
8. [ ] UI is responsive on mobile

### API testing

```bash
# Test config endpoint
curl http://localhost:4XXX/api/config

# Test game creation
curl -X POST http://localhost:4XXX/api/game \
  -H "Content-Type: application/json" \
  -d '{"player1":"alice","player2":"bob"}'

# Test game fetch
curl http://localhost:4XXX/api/game?id=ABC123
```

## Reference Implementation

**Always refer to tic-tac-toe** for complete examples:

- **Directory structure:** `games/tic-tac-toe/`
- **TypeScript setup:** `games/tic-tac-toe/frontend/`
- **Backend patterns:** `games/tic-tac-toe/backend/`
- **SSE integration:** `games/tic-tac-toe/backend/handlers.go`
- **URL parameters:** `games/tic-tac-toe/frontend/src/App.tsx`

## Next Steps

After creating your app:

1. **Add game logic** - Implement your specific game rules
2. **Add UI** - Build your game interface
3. **Add SSE** - Implement real-time updates (if needed)
4. **Add Redis** - Store game state (if real-time)
5. **Add PostgreSQL** - Store final results (if needed)
6. **Test thoroughly** - Check all edge cases
7. **Document** - Add README to your app directory

## Port Assignment

Choose a port from the available range:

| Port Range | Usage |
|------------|-------|
| 3000-3001 | Identity shell |
| 4001-4010 | Turn-based games (tic-tac-toe, dots, chess) |
| 4011-4020 | Board/strategy games |
| 4021-4030 | Quiz/trivia apps |
| 4031-4040 | Social/activity apps |
| 4041-4050 | Admin/management apps |

Check `identity-shell/backend/apps.json` for used ports.

## Getting Help

If stuck, check:

1. **This guide** - Step-by-step instructions
2. **Tic-tac-toe** - Reference implementation
3. **Other docs:**
   - [FRONTEND.md](./FRONTEND.md) - React/TypeScript patterns
   - [BACKEND.md](./BACKEND.md) - Go backend patterns
   - [DATABASE.md](./DATABASE.md) - PostgreSQL + Redis
   - [REALTIME.md](./REALTIME.md) - SSE patterns
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
