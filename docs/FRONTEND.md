# Frontend Development Guide

## Tech Stack

- **React** - UI framework (hooks-based, functional components)
- **TypeScript** - ALL frontends use `.tsx` files, NEVER `.js`
- **Create React App** - Build tooling
- **CSS-in-JS** - Inline styles (no external CSS frameworks)

## Required TypeScript Setup

Every React frontend must be TypeScript-based.

### package.json dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^4.9.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

### File structure

```
frontend/
├── src/
│   ├── index.tsx         # Entry point (NOT .js)
│   ├── App.tsx           # Main component (NOT .js)
│   ├── react-app-env.d.ts # TypeScript environment
│   └── ...
├── public/
├── package.json
└── tsconfig.json         # Copy from tic-tac-toe/frontend/
```

### tsconfig.json

Copy from reference implementation:
```bash
cp games/tic-tac-toe/frontend/tsconfig.json games/your-app/frontend/
```

## URL Parameters

**CRITICAL:** The identity shell passes user context via URL query parameters. All apps MUST read and use these.

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `userId` | Yes | User's email address | `alice@test.com` |
| `userName` | Yes | User's display name | `Alice` |
| `gameId` | No | Game/session ID | `ABC123` |
| `admin` | No | Admin flag | `"true"` |

### Reading parameters

```typescript
// App.tsx
import React, { useEffect, useState } from 'react';

function App() {
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const userIdParam = params.get('userId');
    const userNameParam = params.get('userName');
    const gameIdParam = params.get('gameId');
    const adminParam = params.get('admin');

    if (!userIdParam) {
      // REQUIRED: Show error if userId missing
      alert('This app must be accessed through the Identity Shell.');
      return;
    }

    setUserId(userIdParam);
    setUserName(userNameParam || 'Unknown');
    setGameId(gameIdParam || '');
    setIsAdmin(adminParam === 'true');
  }, []);

  if (!userId) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome, {userName}</h1>
      {/* Your app UI */}
    </div>
  );
}

export default App;
```

### URL parameter validation

```typescript
// utils/urlParams.ts
export interface AppParams {
  userId: string;
  userName: string;
  gameId?: string;
  isAdmin: boolean;
}

export function getAppParams(): AppParams | null {
  const params = new URLSearchParams(window.location.search);

  const userId = params.get('userId');
  const userName = params.get('userName');
  const gameId = params.get('gameId');
  const admin = params.get('admin');

  if (!userId || !userName) {
    return null; // Missing required params
  }

  return {
    userId,
    userName,
    gameId: gameId || undefined,
    isAdmin: admin === 'true',
  };
}
```

Usage:
```typescript
const params = getAppParams();
if (!params) {
  return <div>Error: Must be accessed through Identity Shell</div>;
}
```

## Styling Conventions

### Light theme

All apps use a light theme to match the shell:

```typescript
const styles = {
  container: {
    backgroundColor: '#f5f5f5',  // Light gray background
    minHeight: '100vh',
    padding: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
};
```

### Inline styles (CSS-in-JS)

Prefer inline styles for simplicity:

```typescript
function GameBoard() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '10px',
      maxWidth: '300px',
      margin: '0 auto',
    }}>
      {/* Grid items */}
    </div>
  );
}
```

### Responsive design

Use viewport units and flexbox:

```typescript
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#007bff',
    color: 'white',
  },
};
```

## Component Patterns

### Functional components with hooks

```typescript
import React, { useState, useEffect } from 'react';

interface GameProps {
  gameId: string;
  userId: string;
}

const Game: React.FC<GameProps> = ({ gameId, userId }) => {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGameState();
  }, [gameId]);

  const fetchGameState = async () => {
    try {
      const response = await fetch(`/api/game/${gameId}`);
      const data = await response.json();
      setState(data);
    } catch (error) {
      console.error('Failed to fetch game state:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!state) return <div>Game not found</div>;

  return (
    <div>
      {/* Game UI */}
    </div>
  );
};

export default Game;
```

### TypeScript interfaces

Define clear types for data:

```typescript
// types.ts
export interface GameState {
  id: string;
  board: string[][];
  currentPlayer: string;
  winner: string | null;
  status: 'waiting' | 'active' | 'completed';
}

export interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O';
}

export interface Move {
  row: number;
  col: number;
  player: string;
}
```

## API Communication

### Fetching data

```typescript
async function fetchGameState(gameId: string): Promise<GameState> {
  const response = await fetch(`/api/game/${gameId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch game: ${response.statusText}`);
  }
  return response.json();
}
```

### Posting actions

```typescript
async function makeMove(gameId: string, row: number, col: number): Promise<void> {
  const response = await fetch(`/api/game/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row, col }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to make move');
  }
}
```

## SSE (Server-Sent Events)

For real-time updates, use SSE:

```typescript
useEffect(() => {
  const eventSource = new EventSource(`/api/game/${gameId}/stream`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setState(data);
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}, [gameId]);
```

See [REALTIME.md](./REALTIME.md#sse-client-implementation) for detailed patterns.

## Error Handling

### User-friendly errors

```typescript
const [error, setError] = useState<string>('');

async function handleAction() {
  try {
    setError('');
    await someAPICall();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'An error occurred');
  }
}

return (
  <div>
    {error && (
      <div style={{
        backgroundColor: '#ffebee',
        color: '#c62828',
        padding: '10px',
        borderRadius: '4px',
        marginBottom: '10px',
      }}>
        {error}
      </div>
    )}
    {/* Rest of UI */}
  </div>
);
```

## Build Process

### Development

```bash
cd frontend
npm install
npm start  # Runs on localhost:3000 (dev mode)
```

### Production build

```bash
cd frontend
npm run build
cp -r build/* ../backend/static/
```

**Important:** Backend serves the production build from `backend/static/`.

## Reference Implementation

**Always check tic-tac-toe first** before creating a new app:
- `games/tic-tac-toe/frontend/` - Reference implementation
- TypeScript setup
- URL parameter handling
- SSE integration
- Component patterns
- Styling conventions

## Common Patterns

### Loading states

```typescript
if (loading) {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <div>Loading...</div>
    </div>
  );
}
```

### Empty states

```typescript
if (!gameId) {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h2>No game selected</h2>
      <p>Create a game to get started</p>
    </div>
  );
}
```

### Button disabled states

```typescript
<button
  onClick={handleMove}
  disabled={!myTurn || gameOver}
  style={{
    ...styles.button,
    opacity: (!myTurn || gameOver) ? 0.5 : 1,
    cursor: (!myTurn || gameOver) ? 'not-allowed' : 'pointer',
  }}
>
  Make Move
</button>
```

## Testing

### Manual testing checklist

- [ ] App loads correctly in iframe
- [ ] URL parameters are read correctly
- [ ] Missing `userId` shows error
- [ ] SSE reconnects on connection loss
- [ ] UI is responsive on mobile
- [ ] Buttons have proper disabled states
- [ ] Errors are displayed clearly
- [ ] Loading states show during async operations

### Browser testing

- Chrome/Edge (primary)
- Safari iOS (SSE compatibility critical)
- Firefox (secondary)

## Debugging

### Console logging

```typescript
useEffect(() => {
  console.log('[App] Initializing with params:', { userId, userName, gameId });
}, [userId, userName, gameId]);
```

### SSE debugging

```typescript
eventSource.onopen = () => {
  console.log('[SSE] Connected');
};

eventSource.onmessage = (event) => {
  console.log('[SSE] Message received:', event.data);
};

eventSource.onerror = (error) => {
  console.error('[SSE] Error:', error);
};
```

### Network tab

- Check `/api/*` requests in browser DevTools
- Verify SSE connection stays open
- Check request/response payloads
