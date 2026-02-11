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
│   │   └── index.html   ← REQUIRED by Create React App
│   ├── package.json
│   └── tsconfig.json
└── database/
    └── schema.sql (if needed)
```

### Step 2: Create public/index.html

**REQUIRED** — `npm run build` will fail without this file.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your App Name</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

### Step 3: Copy TypeScript Configuration

```bash
# Copy from reference implementation
cp games/tic-tac-toe/frontend/tsconfig.json games/{app-name}/frontend/
cp games/tic-tac-toe/frontend/src/react-app-env.d.ts games/{app-name}/frontend/src/
```

### Step 4: Create Frontend package.json

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

### Step 5: Create Frontend Entry Point

**src/index.tsx** — include the shared CSS injection:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles from identity-shell
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Shared CSS Classes

The injected stylesheet provides these ready-to-use classes:

| Class | Usage |
|-------|-------|
| `ah-container` | Page wrapper (max 900px) |
| `ah-container--narrow` | Narrow variant (max 600px) |
| `ah-container--wide` | Wide variant (max 1200px) |
| `ah-card` | White card with border |
| `ah-banner ah-banner--error/success/warning/info` | Status banners |
| `ah-tabs` | Tab bar container |
| `ah-tab` + `.active` | Individual tab button |
| `ah-btn-primary` | Blue primary button |
| `ah-btn-outline` | Outline button (blue) |
| `ah-btn-danger` | Outline button (red) |
| `ah-btn-back` | Grey back button |
| `ah-lobby-btn` | Back-to-lobby link/button (auto right-aligns in `ah-header`) |
| `ah-header` | Flex row for app title + lobby button |
| `ah-header-title` | App title `h2` inside `ah-header` |
| `ah-section-title` | Section heading |
| `ah-meta` | Secondary grey text |
| `ah-label` | Form label |
| `ah-input` | Styled text input |
| `ah-select` | Styled select |
| `ah-table` / `ah-table-header` / `ah-table-row` | Data table |

App-specific styles go in a local `const s` or CSS file. See `games/last-man-standing/frontend/src/App.tsx` for a reference implementation.

### Step 6: Create Main App Component

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

### Step 7: Create Backend Entry Point

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

### Step 8: Create Handlers

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

### Step 9: Add Database Schema (if needed)

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

### Step 10: Update Database Setup Script

Add your database to the DATABASES list in `scripts/setup_databases.sh`:

```bash
# List of all databases needed by apps
DATABASES="pubgames tictactoe_db dots_db leaderboard_db your_app_db"
```

And add to the output section:

```bash
echo "      your_app_db           - Your App Name"
```

The database will be created automatically when the script runs.

### Step 11: Register in App Registry

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

### Step 12: Update Start Services Script

Add your app to `start_services.sh` so it starts automatically:

```bash
# Start Your App (optional)
if [ -d "$BASE_DIR/games/your-app/backend" ]; then
    start_service "Your App Name" \
        "$BASE_DIR/games/your-app/backend" \
        "$BASE_DIR/games/your-app/frontend" \
        4XXX
    echo ""
fi
```

And add to the "Access:" section:

```bash
if lsof -Pi :4XXX -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Your App Name:${NC}    http://localhost:4XXX"
fi
```

### Step 13: Build and Test

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

- [ ] `public/index.html` exists (npm run build WILL FAIL without this)
- [ ] `backend/static/` directory exists with `.gitkeep`
- [ ] package.json includes `typescript`, `@types/react`, `@types/react-dom`
- [ ] All files use `.tsx` extension (NOT `.js`)
- [ ] Entry point is `src/index.tsx`
- [ ] Main component is `src/App.tsx`
- [ ] `tsconfig.json` copied from tic-tac-toe
- [ ] `react-app-env.d.ts` exists
- [ ] Shared CSS injected in `src/index.tsx` (see Step 5)

## Styling Checklist

- [ ] Shared CSS loaded in `index.tsx` (injects `activity-hub.css` from port 3001)
- [ ] Back-to-lobby button (`ah-lobby-btn`) in app header
- [ ] App header uses `ah-header` + `ah-header-title` classes
- [ ] Cards use `ah-card`
- [ ] Banners use `ah-banner ah-banner--{error|success|warning|info}`
- [ ] Tabs use `ah-tabs` / `ah-tab` / `.active`
- [ ] Buttons use `ah-btn-primary`, `ah-btn-outline`, `ah-btn-danger`
- [ ] Inputs use `ah-input`, selects use `ah-select`
- [ ] App-specific styles in local `const s` or CSS file

## Integration Checklist

- [ ] App reads `userId` from URL parameters
- [ ] App shows error if `userId` missing
- [ ] App added to `apps.json`
- [ ] Database added to `setup_databases.sh`
- [ ] App added to `start_services.sh`
- [ ] `/api/config` endpoint implemented
- [ ] `/api/game` (POST) creates game
- [ ] `/api/game/{id}` (GET) fetches state
- [ ] SSE endpoint at `/api/game/{id}/stream` (if real-time)

## Common Mistakes to Avoid

### ❌ Don't forget public/index.html

```bash
# BAD: Missing public/index.html
# npm run build will fail with:
# "Could not find a required file. Name: index.html"

# GOOD: Always create frontend/public/index.html
# (see Step 2 above for template)
```

### ❌ Don't forget backend/static/

```bash
# BAD: Missing backend/static/ directory
# cp -r build/* ../backend/static/ will fail

# GOOD: Create it with a .gitkeep so git tracks it
mkdir -p backend/static && touch backend/static/.gitkeep
```

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
