# Display Admin

Admin-only application for managing content displayed on pub TV screens.

## Overview

**Port**: 5050
**Database**: `display_admin_db` (separate) + `pubgames` (auth)
**Type**: Iframe app embedded in identity shell
**Access**: Admin users only

Display Admin is part of a two-app system:
1. **Display Admin (5050)** - Admin interface for managing content (this app)
2. **Display Runtime (5051)** - Standalone TV slideshow app (see `games/display-runtime/`)

## Status

✅ **Phase 1: Backend Foundation** - Complete
✅ **Phase 2: Backend Handlers** - Complete (all 10 tests passing)
✅ **Phase 3: Frontend** - Complete (TypeScript React admin UI)
✅ **Phase 4: Display Runtime** - Complete (TV slideshow app operational)

## Features

### Content Management
- Create/manage content items: images, URLs, announcements, embedded apps
- Upload images with automatic file handling
- Support for 6 content types:
  - `image` - Uploaded static images
  - `url` - Embedded iframe content
  - `social_feed` - Social media embeds
  - `leaderboard` - Internal leaderboard app
  - `schedule` - Internal season scheduler app
  - `announcement` - Custom text with colors

### Playlist Management
- Create ordered sequences of content
- Drag-drop reordering (frontend pending)
- Override duration per item
- Preview playlists

### Display Management
- Register physical TVs/screens
- Auto-generate UUID tokens for authentication
- Generate QR codes for TV setup
- Track display location and status

### Scheduling System
- Assign playlists to displays
- Time-based scheduling (date range, time range, days of week)
- Priority system for overlapping assignments
- Preview what display shows at current time

## Architecture

### Database Schema (5 tables)

```sql
displays (id, name, location, token, is_active)
content_items (id, title, content_type, duration_seconds, file_path, url, text_content, colors)
playlists (id, name, description, is_active)
playlist_items (id, playlist_id, content_item_id, display_order, override_duration)
display_assignments (id, display_id, playlist_id, priority, scheduling fields)
```

### Backend Structure

```
backend/
├── main.go              # Server, routing, CORS
├── auth.go              # JWT authentication (admin-only)
├── database.go          # DB connections, schema
├── models.go            # Go structs
├── displays.go          # Display CRUD + token generation
├── qrcode.go            # QR code generation
├── content.go           # Content CRUD + image upload
├── playlists.go         # Playlist CRUD + reordering
├── assignments.go       # Assignment CRUD + scheduling
├── preview.go           # Active playlist determination
├── go.mod               # Go module dependencies
├── test-backend.sh      # Test script (10 tests)
├── static/              # React build output
└── uploads/             # Uploaded images (gitignored)
```

### Frontend Structure

```
frontend/
├── package.json         # TypeScript React dependencies
├── tsconfig.json        # TypeScript configuration
├── public/
│   └── index.html       # HTML shell
└── src/
    ├── index.tsx        # Entry point
    ├── index.css        # Global styles
    ├── App.tsx          # Main admin UI (4 tabs)
    └── react-app-env.d.ts
```

**Frontend Features:**
- **Displays Tab**: Create displays, generate QR codes, manage TV tokens
- **Content Tab**: Create announcements/URLs, upload images, configure durations
- **Playlists Tab**: Build playlists, add/remove content items, reorder
- **Assignments Tab**: Schedule playlists to displays with date/time/day filtering

### API Endpoints (35 total)

All require admin authentication except public TV endpoints.

**Displays**: GET, POST, PUT, DELETE `/api/displays`, `/api/displays/:id/qr`, `/api/displays/:id/url`
**Content**: GET, POST, PUT, DELETE `/api/content`, `/api/content/upload-image`
**Playlists**: GET, POST, PUT, DELETE `/api/playlists`, `/api/playlists/:id/items`, `/api/playlists/:id/reorder`
**Assignments**: GET, POST, PUT, DELETE `/api/assignments`, `/api/assignments/display/:displayId`
**Preview**: GET `/api/preview/playlist/:id` (admin), GET `/api/preview/display/:id` (public)
**Runtime**: GET `/api/display/by-token/:token` (public)

## Setup on Pi

### Prerequisites
- PostgreSQL 5.5 running on port 5555
- Go 1.25+
- Node.js/npm
- Admin user in `pubgames.users` table with `is_admin=true`

### Database Creation
```bash
psql -U pubgames -h localhost -p 5555 -d postgres -c "CREATE DATABASE display_admin_db;"
```

### Installation

**1. Build Frontend**
```bash
cd ~/pub-games-v3/games/display-admin/frontend

# Install dependencies
npm install

# Build React app
npm run build

# Copy to backend static directory
cp -r build/* ../backend/static/
```

**2. Run Backend**
```bash
cd ~/pub-games-v3/games/display-admin/backend

# Download dependencies
go mod download

# Start server
go run *.go
```

Server starts on port 5050. Access at `http://192.168.1.45:5050`

### Testing

**Option 1: Basic API Tests**
```bash
# Edit test-backend.sh if needed (update admin token)
./test-backend.sh
```

All 10 tests should pass:
1. Health check
2. Create display (UUID token generation)
3. Get displays
4. Get QR code (saves test-qr.png)
5. Create content (announcement)
6. Create playlist
7. Add content to playlist
8. Get playlist with content
9. Assign playlist to display
10. Preview display (scheduling logic)

**Option 2: Seed Demo Data (Recommended for testing Display Runtime)**
```bash
# Creates 2 displays with content and playlists
./seed-displays.sh
```

This creates:
- **2 Displays**: Main Bar TV + Lounge TV
- **8 Content Items**: Announcements, leaderboard, schedule, URL
- **2 Playlists**: Different rotations for each display
- **QR Codes**: Saved as main-bar-tv-qr.png and lounge-tv-qr.png
- **Assignments**: Playlists assigned to displays

After seeding:
- Main Bar TV: 6 items, 79 second rotation
- Lounge TV: 5 items, 85 second rotation
- Tokens printed to test Display Runtime (port 5051)

## Dependencies

```go
require (
    github.com/google/uuid        // Token generation
    github.com/gorilla/handlers   // CORS
    github.com/gorilla/mux        // Routing
    github.com/lib/pq             // PostgreSQL driver
    github.com/skip2/go-qrcode    // QR code generation
)
```

## TV Setup Flow (Future)

1. Admin creates display in Display Admin → gets QR code
2. Open TV browser to `http://192.168.1.45:5051/setup`
3. Scan QR code or enter token manually
4. Token saved to localStorage
5. Redirect to runtime slideshow
6. On reboot, token persists and auto-loads

## Configuration

Environment variables (with defaults):
- `BACKEND_PORT` - Server port (default: 5050)
- `RUNTIME_HOST` - Display runtime host (default: 192.168.1.45)
- `RUNTIME_PORT` - Display runtime port (default: 5051)
- `STATIC_DIR` - Frontend build directory (default: ./static)

## Lessons Learned

- PostgreSQL port is 5555, password is "pubgames" (not "pubgames123")
- Use `sql.NullString` for nullable database columns
- Go modules require `go.mod` file
- Test with real admin users from database
- Two database connections: `pubgames` (auth) + `display_admin_db` (data)

## Next Steps

**Phase 4**: Implement Display Runtime (separate app, port 5051)
- Token-based authentication (no admin login required)
- Auto-rotating slideshow that cycles through playlist content
- Scheduling-aware playlist loading based on current time
- Fullscreen mode for TV displays
- Content rendering for all 6 types (image, URL, social feed, leaderboard, schedule, announcement)
- Auto-refresh when playlist assignments change
- Setup page for QR code scanning and token entry

## Reference Files

- **Auth pattern**: `games/sweepstakes/backend/auth.go`
- **Upload pattern**: `games/sweepstakes/backend/handlers.go:164`
- **Multi-tab UI**: `games/season-scheduler/frontend/src/App.tsx`
- **TypeScript setup**: `games/tic-tac-toe/frontend/`

## Support

See main project docs: `/docs/BACKEND.md`, `/docs/FRONTEND.md`, `/docs/DATABASE.md`
