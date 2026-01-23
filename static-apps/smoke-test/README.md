# PubGames V3 - Smoke Test

This is the standard template for creating new static (iframe-embedded) apps in the PubGames V3 ecosystem.

## Architecture

- **Backend**: Go API (Port 5011)
- **Frontend**: React app (Port 5010), loaded in iframe by Identity Shell
- **Database**: PostgreSQL (own database for microservice isolation)
- **Authentication**: Handled by Identity Shell, user info passed via URL params
- **Styling**: Shared CSS loaded from Identity Shell

## Key Differences from V2

| Feature | V2 | V3 |
|---------|----|----|
| Navigation | Full app with header | Embedded in shell iframe |
| Auth | SSO token validation | User params from shell |
| Database | SQLite per app | PostgreSQL per app |
| Styling | Local CSS | Shared CSS from shell |
| Back button | Each app had one | Shell controls navigation |

## File Structure

```
/template/
├── main.go           # Entry point, routing, CORS
├── handlers.go       # HTTP handlers
├── models.go         # Data structures
├── database.go       # PostgreSQL initialization
├── auth.go           # User sync and validation
├── /src/            # React source
│   ├── index.js
│   └── App.js       # Simplified for iframe
├── /public/         # Static files
│   └── index.html   # Loads shared CSS
├── /data/           # Database migrations (optional)
├── package.json     # NPM config
└── go.mod           # Go module
```

## Quick Start

### Prerequisites

- Go 1.25+
- Node.js 18+
- PostgreSQL 13+ (with pubgames user)
- Identity Shell running on ports 3000/3001

### Installation

1. **Create app from template**:
   ```bash
   cd pub-games-v3
   ./scripts/new_static_app.sh --name my-app --number 5
   ```

2. **Install dependencies** (on Pi):
   ```bash
   cd static-apps/my-app
   go mod download
   npm install
   ```

3. **Run** (on Pi):
   ```bash
   # Backend
   go run *.go

   # Frontend (in another terminal)
   npm start
   ```

## How It Works

### 1. User Flow

1. User logs into Identity Shell (http://hostname:3000)
2. User selects app from lobby
3. Shell opens iframe with URL: `http://hostname:5050?user=admin@pubgames.local&name=Admin&admin=true`
4. App reads user params, syncs with backend, displays content

### 2. Authentication

- Shell passes user info via URL params: `?user=EMAIL&name=NAME&admin=BOOL`
- App syncs user to local database on first access
- Backend validates user param on all protected routes

### 3. Database

- Each app has its own PostgreSQL database (e.g., `myapp_db`)
- Users table mirrors identity-shell for local reference
- App-specific tables for business logic

### 4. Styling

- Shared CSS loaded from Identity Shell: `http://hostname:3001/static/pubgames.css`
- Consistent look & feel across all apps
- Mobile-responsive by default

## API Endpoints

### Public
- `GET /api/health` - Health check
- `GET /api/config` - App configuration

### Protected (require `?user=EMAIL` param)
- `GET /api/items` - List items
- `POST /api/items` - Create item
- `POST /api/sync-user` - Sync user from shell

### Admin (require admin user)
- `GET /api/admin/stats` - Admin statistics

## Customization

### Create New App

Use the script:
```bash
./scripts/new_static_app.sh --name poker-night --number 10 --icon 🃏
```

This will:
1. Copy template to `static-apps/poker-night`
2. Create PostgreSQL database `pokernight_db`
3. Update ports to 5100 (frontend) and 5101 (backend)
4. Replace all placeholders with your values

### Modify Database Schema

Edit `database.go` and add your tables:

```go
func createTables(db *sql.DB) error {
    schema := `
    -- Your custom tables here
    CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        player_email TEXT NOT NULL,
        score INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `
    // ...
}
```

### Add Business Logic

Edit `handlers.go` and `models.go`:

```go
// models.go
type Game struct {
    ID    int    `json:"id"`
    Score int    `json:"score"`
    // ...
}

// handlers.go
func HandleCreateGame(w http.ResponseWriter, r *http.Request) {
    // Your logic here
}
```

## Development Tips

### Hot Reload
- Backend: Restart with `go run *.go`
- Frontend: Automatic via React dev server

### Testing Standalone
- Access directly: `http://hostname:5050?user=test@example.com&name=Test&admin=false`
- This simulates shell parameters

### Mobile Testing
- Identity Shell auto-discovers hostname
- Apps use dynamic hostname for API calls
- Test on mobile by accessing shell from phone

## Deployment

### Build (on Pi)
```bash
# Frontend
npm run build

# Backend
go build -o app
```

### Run
```bash
# Set environment variables
export DB_NAME=myapp_db
export BACKEND_PORT=5051
export FRONTEND_PORT=5050
export HOSTNAME=$(hostname -I | awk '{print $1}')

# Start backend
./app

# Serve frontend (use nginx or similar in production)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | 127.0.0.1 | PostgreSQL host |
| `DB_PORT` | 5555 | PostgreSQL port |
| `DB_USER` | pubgames | PostgreSQL user |
| `DB_PASS` | pubgames | PostgreSQL password |
| `DB_NAME` | smoke_test_db | Database name |
| `BACKEND_PORT` | 5011 | Backend API port |
| `FRONTEND_PORT` | 5010 | Frontend dev server port |
| `HOSTNAME` | localhost | Server hostname (for CORS) |

## Troubleshooting

### Database Connection Failed
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check database exists: `psql -U pubgames -l`
- Verify credentials in environment variables

### CORS Errors
- Check `main.go` CORS configuration includes your hostname
- Identity Shell must be on port 3000/3001

### Shared CSS Not Loading
- Ensure Identity Shell is running and serving `/static/pubgames.css`
- Check browser console for 404 errors

## Notes

- All apps use ports 5000+ (static apps)
- Interactive games use ports 4000+ (different template)
- Shell uses ports 3000-3099
- Each app is an independent microservice
- Apps can be deployed/updated independently
