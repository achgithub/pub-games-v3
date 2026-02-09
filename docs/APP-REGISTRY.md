# App Registry System

**Status**: Phase B Complete
**Database**: `activity_hub.applications` table

## Overview

The app registry system provides dynamic management of mini-apps without code changes. Apps are stored in PostgreSQL and can be:
- Enabled/disabled dynamically
- Assigned role requirements for visibility
- Reordered for display
- Updated without redeploying services

## Database Schema

```sql
CREATE TABLE applications (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('internal', 'iframe')),
    description TEXT,
    category VARCHAR(20) NOT NULL CHECK (category IN ('game', 'utility', 'admin')),
    url VARCHAR(255),
    backend_port INTEGER,
    realtime VARCHAR(20) DEFAULT 'none',
    min_players INTEGER,
    max_players INTEGER,
    required_roles TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | VARCHAR(50) | Unique app identifier (e.g., "tic-tac-toe") |
| `name` | VARCHAR(100) | Display name |
| `icon` | VARCHAR(10) | Emoji or icon character |
| `type` | VARCHAR(20) | "internal" (built-in) or "iframe" (embedded) |
| `description` | TEXT | Short description for app cards |
| `category` | VARCHAR(20) | "game", "utility", or "admin" |
| `url` | VARCHAR(255) | URL template for iframe apps (use `{host}` placeholder) |
| `backend_port` | INTEGER | Port number for app backend |
| `realtime` | VARCHAR(20) | Real-time strategy: "sse", "none", etc. |
| `min_players` | INTEGER | Minimum players for multiplayer games |
| `max_players` | INTEGER | Maximum players for multiplayer games |
| `required_roles` | TEXT[] | Roles needed to see this app (empty = public) |
| `enabled` | BOOLEAN | Whether app is active |
| `display_order` | INTEGER | Sort order for display (lower = first) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp (auto-updated) |

## Migration

Run migration script on Pi to create table and seed data:

```bash
cd ~/pub-games-v3
./scripts/migrate_add_applications.sh
```

This will:
1. Create `applications` table with indexes
2. Seed with existing apps from apps.json
3. Set up auto-updating timestamp trigger

## Role-Based Visibility

Apps can require specific roles for visibility:

```sql
-- Make an app visible only to setup admins
UPDATE applications
SET required_roles = ARRAY['setup_admin']
WHERE id = 'setup-admin-app';

-- Make an app visible to both admin types
UPDATE applications
SET required_roles = ARRAY['setup_admin', 'game_admin']
WHERE id = 'admin-panel';

-- Make an app public (visible to everyone)
UPDATE applications
SET required_roles = '{}'
WHERE id = 'tic-tac-toe';
```

## API Endpoints

### Public Endpoints

#### GET /api/apps
Returns apps visible to the requesting user based on their roles.

**Request:**
```bash
# Without authentication - returns public apps only
curl http://localhost:3001/api/apps

# With authentication - returns apps user has access to
curl -H "Authorization: Bearer demo-token-admin@pubgames.local" \
     http://localhost:3001/api/apps
```

**Response:**
```json
{
  "apps": [
    {
      "id": "lobby",
      "name": "Lobby",
      "icon": "🏠",
      "type": "internal",
      "description": "View online users and challenges",
      "category": "utility",
      "requiredRoles": [],
      "enabled": true,
      "displayOrder": 1
    },
    {
      "id": "tic-tac-toe",
      "name": "Tic-Tac-Toe",
      "icon": "⭕",
      "type": "iframe",
      "description": "Classic grid game - first to 3 wins!",
      "category": "game",
      "url": "http://{host}:4001",
      "backendPort": 4001,
      "realtime": "sse",
      "requiredRoles": [],
      "enabled": true,
      "displayOrder": 2
    }
  ]
}
```

### Admin Endpoints

All admin endpoints require `setup_admin` role.

#### GET /api/admin/apps
Returns all apps (including disabled) for admin management.

**Request:**
```bash
curl -H "Authorization: Bearer demo-token-admin@pubgames.local" \
     http://localhost:3001/api/admin/apps
```

**Response:** Same format as public endpoint, but includes disabled apps and timestamps.

#### PUT /api/admin/apps/:id
Update an existing app.

**Request:**
```bash
curl -X PUT http://localhost:3001/api/admin/apps/tic-tac-toe \
  -H "Authorization: Bearer demo-token-admin@pubgames.local" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tic-Tac-Toe",
    "icon": "⭕",
    "description": "Updated description!",
    "category": "game",
    "url": "http://{host}:4001",
    "backendPort": 4001,
    "realtime": "sse",
    "minPlayers": 0,
    "maxPlayers": 0,
    "requiredRoles": [],
    "enabled": true,
    "displayOrder": 2
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "App updated successfully"
}
```

#### POST /api/admin/apps/:id/enable
Enable a disabled app.

**Request:**
```bash
curl -X POST http://localhost:3001/api/admin/apps/tic-tac-toe/enable \
  -H "Authorization: Bearer demo-token-admin@pubgames.local"
```

**Response:**
```json
{
  "success": true,
  "message": "App enabled successfully"
}
```

#### POST /api/admin/apps/:id/disable
Disable an app without deleting it.

**Request:**
```bash
curl -X POST http://localhost:3001/api/admin/apps/tic-tac-toe/disable \
  -H "Authorization: Bearer demo-token-admin@pubgames.local"
```

**Response:**
```json
{
  "success": true,
  "message": "App disabled successfully"
}
```

## Adding New Apps

### Via SQL

```sql
INSERT INTO applications (
    id, name, icon, type, description, category,
    url, backend_port, realtime, display_order, required_roles
) VALUES (
    'my-new-app',
    'My New App',
    '🎮',
    'iframe',
    'A brand new game!',
    'game',
    'http://{host}:4099',
    4099,
    'sse',
    100,
    '{}'  -- Public app (no role requirements)
);
```

### Via Admin API (Future)

A Setup Admin App will provide a UI for adding apps without SQL.

## App Lifecycle

1. **Creation**: App added to database (via SQL or future admin UI)
2. **Enabled**: App visible to users with required roles
3. **Disabled**: App hidden from all users (but not deleted)
4. **Updated**: Metadata changes (description, roles, order, etc.)
5. **Registry Reload**: Identity-shell automatically reloads after changes

## Caching

- Apps are loaded from database on identity-shell startup
- Cached in memory for fast access
- Automatically reloaded after admin updates
- Mutex-protected for thread safety

## Frontend Integration

### Checking App Visibility

Frontend should request `/api/apps` with user's auth token:

```typescript
const response = await fetch('http://localhost:3001/api/apps', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const { apps } = await response.json();

// Apps array contains only apps user can access
apps.forEach(app => {
  // Render app card
});
```

### Handling Required Roles

Frontend doesn't need to check roles - the backend filters apps automatically:
- Public apps (no `required_roles`) are shown to everyone
- Admin apps are only returned to users with matching roles

## Testing

```bash
# Test public access (no auth)
curl http://localhost:3001/api/apps | jq '.apps | length'

# Test admin access
curl -H "Authorization: Bearer demo-token-admin@pubgames.local" \
     http://localhost:3001/api/apps | jq '.apps | length'

# Test admin endpoints
curl -H "Authorization: Bearer demo-token-admin@pubgames.local" \
     http://localhost:3001/api/admin/apps | jq .

# Disable an app
curl -X POST http://localhost:3001/api/admin/apps/smoke-test/disable \
  -H "Authorization: Bearer demo-token-admin@pubgames.local"

# Verify it's hidden from public list
curl http://localhost:3001/api/apps | jq '.apps[] | select(.id=="smoke-test")'
# Should return nothing

# Re-enable it
curl -X POST http://localhost:3001/api/admin/apps/smoke-test/enable \
  -H "Authorization: Bearer demo-token-admin@pubgames.local"
```

## Migration from apps.json

The old `apps.json` file is preserved but no longer used. Identity-shell now reads from database. To add the old apps back or reset:

```bash
# Run migration again (uses ON CONFLICT DO NOTHING, safe to re-run)
./scripts/migrate_add_applications.sh
```

## Future Enhancements

- **App Creation API**: POST endpoint to create new apps
- **App Deletion**: Soft delete with restore capability
- **User Preferences**: Save favorite apps, custom ordering per user
- **App Categories**: Filter apps by category in UI
- **App Stats**: Track usage, popularity
- **Version Management**: Track app versions, changelogs
- **Health Checks**: Monitor app backend availability

## Notes

- Apps are ordered by `display_order` then `name`
- `{host}` placeholder in URLs is replaced by frontend
- Disabled apps are completely hidden (not shown as "coming soon")
- Role requirements are OR-based (user needs ANY of the listed roles)
- Empty `required_roles` means public (no authentication needed)
