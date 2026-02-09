# Roles System

**Status**: Phase A Complete
**Database**: `activity_hub.users` table

## Overview

The roles system provides fine-grained access control for admin functionality. Regular users have no roles (empty array), while admin users can have one or more specialized roles.

## Role Types

| Role | Description | Access |
|------|-------------|--------|
| `setup_admin` | System configuration | Setup Admin App (system settings, user management) |
| `game_admin` | Activity management | Game Admin App (schedule games, manage activities) |
| (no roles) | Regular user | All regular games and utilities |

## Database Schema

```sql
-- users table includes:
roles TEXT[] DEFAULT '{}'  -- Array of role strings

-- Index for efficient lookups:
CREATE INDEX idx_users_roles ON users USING GIN(roles);
```

## API Responses

### Login Response

```json
{
  "success": true,
  "token": "demo-token-admin@test.com",
  "user": {
    "email": "admin@test.com",
    "name": "Admin User",
    "is_admin": true,
    "roles": ["setup_admin", "game_admin"]
  }
}
```

### Validate Response

```json
{
  "valid": true,
  "user": {
    "email": "admin@test.com",
    "name": "Admin User",
    "is_admin": true,
    "roles": ["setup_admin", "game_admin"]
  }
}
```

Regular users will have `"roles": []` (empty array).

## Migration

Run the migration script on Pi to add roles column:

```bash
cd ~/pub-games-v3
./scripts/migrate_add_roles.sh
```

This will:
1. Add `roles` column (TEXT[] type)
2. Create GIN index for performance
3. Migrate existing `is_admin=true` users to have both admin roles

## Usage in Frontend

Check if user has a specific role:

```typescript
const user = authResponse.user;

// Check for specific role
if (user.roles?.includes('setup_admin')) {
  // Show Setup Admin App
}

if (user.roles?.includes('game_admin')) {
  // Show Game Admin App
}

// Regular users have empty roles array
if (!user.roles || user.roles.length === 0) {
  // Regular user - show only public games
}
```

## Usage in Backend

Query users by role:

```sql
-- Find all setup admins
SELECT email, name FROM users WHERE 'setup_admin' = ANY(roles);

-- Find users with any admin role
SELECT email, name FROM users WHERE roles <> '{}';

-- Regular users only
SELECT email, name FROM users WHERE roles = '{}';
```

## Adding New Roles

To add a new role:

1. Update documentation (this file)
2. Add role to user via SQL:
   ```sql
   UPDATE users
   SET roles = array_append(roles, 'new_role_name')
   WHERE email = 'user@example.com';
   ```
3. Update frontend to check for new role
4. Create corresponding mini-app (if needed)

## Backward Compatibility

The `is_admin` boolean column is preserved:
- Frontend can still check `is_admin` for general admin status
- Backend returns both `is_admin` and `roles`
- Migration sets `is_admin=true` users to have both admin roles

This ensures existing code continues to work while new code can use granular roles.

## Future Roles

Potential future roles:
- `user_admin` - User management only
- `content_admin` - Manage announcements, content
- `stats_viewer` - Read-only access to statistics
- `tournament_organizer` - Organize tournaments

Add as needed based on admin app requirements.

## Testing

Test with existing admin users:

```bash
# On Pi, check admin user roles
psql -U activityhub -p 5555 -d activity_hub -c "
SELECT email, name, is_admin, roles
FROM users
WHERE is_admin = true;
"

# Test login
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","code":"123456"}' | jq .

# Should see: "roles": ["setup_admin", "game_admin"]
```

## Notes

- Roles are stored as PostgreSQL TEXT[] (array of strings)
- Empty array means regular user (no admin privileges)
- GIN index enables efficient role membership queries
- All existing admin users migrated to have both admin roles
- Frontend must handle `null` or `undefined` roles gracefully (treat as empty array)
