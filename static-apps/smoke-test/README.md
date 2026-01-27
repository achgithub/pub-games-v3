# PubGames V3 - Smoke Test

Template for creating new static (iframe-embedded) apps in PubGames V3.

## Architecture

- **Single Port**: Go backend serves both API and React frontend on port 5010
- **Database**: PostgreSQL (own database for microservice isolation)
- **Authentication**: User info passed via URL params from Identity Shell
- **Real-time**: None (static app pattern)

## File Structure

```
smoke-test/
├── backend/
│   ├── main.go           # Entry point, routing, serves static files
│   ├── handlers.go       # HTTP handlers
│   ├── models.go         # Data structures
│   ├── database.go       # PostgreSQL initialization
│   ├── auth.go           # User sync and validation
│   ├── go.mod            # Go module
│   └── static/           # React build output (created by build)
├── frontend/
│   ├── src/
│   │   ├── index.js
│   │   └── App.js
│   ├── public/
│   │   └── index.html
│   └── package.json
├── data/                  # Database migrations (optional)
└── README.md
```

## Quick Start

### Running via start_services.sh (Recommended)

```bash
cd ~/pub-games-v3
./start_services.sh
```

This automatically builds the frontend and starts the backend.

### Manual Start (on Pi)

```bash
# Build frontend
cd static-apps/smoke-test/frontend
npm install
npm run build
cp -r build/* ../backend/static/

# Start backend
cd ../backend
go run *.go
```

Access at: `http://pi:5010?userId=test@example.com&userName=Test`

## URL Parameters (from Shell)

The Identity Shell passes user context via URL query parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `userId` | Yes | User's email address |
| `userName` | Yes | User's display name |
| `admin` | No | `"true"` if user is admin |

**Example URL**: `http://pi:5010?userId=alice@test.com&userName=Alice&admin=true`

## API Endpoints

All endpoints served from the same port (5010):

### Public
- `GET /api/health` - Health check
- `GET /api/config` - App configuration

### Protected (require `?user=EMAIL` param)
- `GET /api/items` - List items
- `POST /api/items` - Create item
- `POST /api/sync-user` - Sync user from shell

### Admin (require admin user)
- `GET /api/admin/stats` - Admin statistics

## Creating a New Static App

Copy this structure and update:

1. **backend/main.go**: Change `APP_NAME` and `BACKEND_PORT`
2. **backend/database.go**: Change database name
3. **frontend/src/App.js**: Update UI and logic
4. **apps.json**: Add entry in `identity-shell/backend/apps.json`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | 127.0.0.1 | PostgreSQL host |
| `DB_PORT` | 5555 | PostgreSQL port |
| `DB_USER` | pubgames | PostgreSQL user |
| `DB_PASS` | pubgames | PostgreSQL password |
| `DB_NAME` | smoke_test_db | Database name |
| `BACKEND_PORT` | 5010 | Server port |
| `STATIC_DIR` | ./static | Frontend build directory |

## Comparison with Tic-Tac-Toe

| Feature | Smoke Test | Tic-Tac-Toe |
|---------|------------|-------------|
| Port | 5010 | 4001 |
| Real-time | None | SSE + HTTP |
| Redis | No | Yes |
| Structure | Same | Same |

Both apps follow the same pattern:
- `backend/` - Go server + `static/` for React build
- `frontend/` - React source
- Single port serves everything
