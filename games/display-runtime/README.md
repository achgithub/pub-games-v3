# Display Runtime

TV slideshow application for displaying content on pub screens.

## Overview

**Port**: 5051
**Type**: Standalone app (NOT embedded in identity shell)
**Access**: Public (token-based authentication)

Display Runtime is part of a two-app system:
1. **Display Admin (5050)** - Admin interface for managing content
2. **Display Runtime (5051)** - Standalone TV slideshow app (this app)

## Features

### Setup Flow
- Enter display token manually
- Token verification with Display Admin API
- Token stored in localStorage for persistence
- Automatic redirect to slideshow after setup

### Slideshow Functionality
- Auto-rotating content based on configured durations
- Supports all 6 content types:
  - **Image** - Display uploaded static images
  - **URL** - Embedded iframe content (websites)
  - **Social Feed** - Social media embeds
  - **Leaderboard** - Internal leaderboard app (port 5030)
  - **Schedule** - Internal season scheduler app (port 5040)
  - **Announcement** - Custom text with configurable colors
- Scheduling-aware playlist loading
- Progress indicator showing current position in playlist
- Auto-refresh playlist every 60 seconds

### Controls (Show on Mouse Move)
- Previous/Next buttons for manual navigation
- Fullscreen toggle
- Display info (name, location)
- Playlist info (name, position)
- Reset token button

## Architecture

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
    ├── App.tsx          # Main app (routing logic)
    ├── SetupPage.tsx    # Token entry page
    ├── SlideshowPage.tsx # Main slideshow component
    └── ContentRenderer.tsx # Content type renderers
```

### Backend Structure

```
backend/
├── main.go              # Simple static file server
├── go.mod               # Go module dependencies
└── static/              # React build output
```

### Data Flow

1. **Setup**: User enters token → Verify with Display Admin API → Save to localStorage
2. **Load Display**: Fetch display info by token from `/api/display/by-token/:token`
3. **Load Playlist**: Fetch active playlist from `/api/preview/display/:id`
4. **Render Content**: Cycle through playlist items automatically
5. **Refresh**: Check for playlist changes every 60 seconds

## Setup on Pi

### Prerequisites
- Display Admin (port 5050) must be running
- Display token from Display Admin
- Node.js/npm
- Go 1.25+

### Installation

**1. Build Frontend**
```bash
cd ~/pub-games-v3/games/display-runtime/frontend

# Install dependencies
npm install

# Build React app
npm run build

# Copy to backend static directory
cp -r build/* ../backend/static/
```

**2. Run Backend**
```bash
cd ~/pub-games-v3/games/display-runtime/backend

# Download dependencies
go mod download

# Start server
go run *.go
```

Server starts on port 5051. Access at `http://192.168.1.45:5051`

### TV Setup

1. Open TV browser to `http://192.168.1.45:5051`
2. Enter display token (get from Display Admin QR code or display list)
3. Click "Start Display"
4. Token is saved to localStorage
5. Slideshow begins automatically
6. On TV reboot, token persists and slideshow resumes

## Content Types

### Image
- Displays uploaded image files
- Full-screen with aspect ratio preservation
- Source: `http://192.168.1.45:5050/uploads/filename.jpg`

### URL
- Embeds external website in iframe
- Source: User-configured URL
- Sandboxed for security

### Social Feed
- Embeds social media content in iframe
- Source: User-configured embed URL
- Sandboxed for security

### Leaderboard
- Embeds internal leaderboard app
- Source: `http://192.168.1.45:5030`
- Shows current game standings

### Schedule
- Embeds internal season scheduler app
- Source: `http://192.168.1.45:5040`
- Shows upcoming events

### Announcement
- Full-screen text with custom colors
- Large title (72px)
- Optional body text (36px)
- Configurable background and text colors

## Usage

### First Time Setup
1. Admin creates display in Display Admin
2. Admin generates QR code for display
3. Open TV to runtime app
4. Enter token manually (or scan QR in future)
5. Slideshow begins

### Daily Operation
- TV opens to `http://192.168.1.45:5051`
- Token loads from localStorage
- Playlist loads automatically
- Content rotates based on durations
- Playlist refreshes every minute

### Manual Controls
- Move mouse to show control bar
- Use Prev/Next buttons to navigate
- Click Fullscreen for fullscreen mode
- Click Reset to clear token and reconfigure

## Configuration

Environment variables (with defaults):
- `BACKEND_PORT` - Server port (default: 5051)
- `STATIC_DIR` - Frontend build directory (default: ./static)

Frontend API configuration (hardcoded):
- Display Admin API: `http://192.168.1.45:5050/api`
- Refresh interval: 60000ms (1 minute)

## API Dependencies

Display Runtime consumes these Display Admin APIs:

### GET /api/display/by-token/:token
Returns display info for a given token.
- **No authentication required**
- Used during setup and initial load

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Main Bar TV",
    "location": "Bar Area",
    "is_active": true
  }
}
```

### GET /api/preview/display/:id
Returns active playlist for display based on current time.
- **No authentication required** (public API)
- Used to load playlist content

Response:
```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": 1,
      "name": "Main Rotation",
      "description": "Default content"
    },
    "items": [
      {
        "id": 1,
        "title": "Welcome",
        "content_type": "announcement",
        "duration_seconds": 10,
        "text_content": "Welcome to our pub!",
        "bg_color": "#1a1a1a",
        "text_color": "#ffffff"
      }
    ]
  }
}
```

## Features Implemented

✅ Token-based authentication
✅ Token persistence in localStorage
✅ Auto-rotating slideshow
✅ All 6 content types supported
✅ Scheduling-aware playlist loading
✅ Auto-refresh playlist (60s interval)
✅ Fullscreen mode
✅ Manual navigation controls
✅ Progress indicator
✅ Display info in control bar
✅ Reset token functionality

## Future Enhancements

- QR code scanning for token entry
- Transition animations between content
- Error recovery and retry logic
- Network status indicator
- Content preloading for smoother transitions
- Touch-friendly controls for tablet displays
- Display statistics (uptime, content views)

## Troubleshooting

### "Invalid token" error
- Check that Display Admin is running on port 5050
- Verify token exists in Display Admin
- Check network connectivity to Pi

### "No active playlist assigned" error
- Create playlist in Display Admin
- Assign playlist to display
- Check scheduling rules (date/time/day filters)

### Content not loading
- Verify Display Admin is serving content
- Check uploaded images exist in uploads directory
- Verify internal app URLs are correct (5030, 5040)

### Token not persisting
- Check browser localStorage is enabled
- Try different browser (Chrome recommended for TVs)

## Development

### Testing Locally
1. Build frontend: `cd frontend && npm run build`
2. Copy to static: `cp -r build/* ../backend/static/`
3. Run backend: `cd ../backend && go run *.go`
4. Open browser to `http://localhost:5051`
5. Enter test token from Display Admin

### Building for Production
Same as testing - build on Pi and deploy to static directory.

## Related Documentation

- **Display Admin**: `games/display-admin/README.md`
- **Architecture**: `/docs/ARCHITECTURE.md`
- **Frontend patterns**: `/docs/FRONTEND.md`
- **Backend patterns**: `/docs/BACKEND.md`
