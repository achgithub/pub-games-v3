# Database Setup Scripts

## Overview

PubGames V3 uses:
- **PostgreSQL** - Persistent data (users, game history, etc.)
- **Redis** - Ephemeral/live data (game state, leaderboards, etc.)

## Setup on Raspberry Pi

### 1. Install Dependencies

```bash
# PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Redis
sudo apt-get install redis-server
```

### 2. Run Setup Script

```bash
cd /path/to/pub-games-v3/scripts
chmod +x setup_databases.sh
./setup_databases.sh
```

This script will:
- Create `pubgames` PostgreSQL database
- Create `pubgames` PostgreSQL user (password: `pubgames`)
- Initialize schema from `schema.sql`
- Start and enable Redis service
- Create default users (admin@pubgames.local, test@pubgames.local)

### 3. Verify Setup

```bash
# Test PostgreSQL connection
PGPASSWORD=pubgames psql -h localhost -U pubgames -d pubgames -c "\dt"

# Test Redis connection
redis-cli ping
```

## Default Users

After setup, two users are available:

| Email | Password | Admin |
|-------|----------|-------|
| admin@pubgames.local | 123456 | Yes |
| test@pubgames.local | 123456 | No |

**⚠️ CHANGE THESE PASSWORDS IN PRODUCTION**

## Database Schema

See `schema.sql` for the complete schema definition.

### Tables

- **users** - User accounts and authentication
- **user_presence** - Real-time presence tracking

### Future Tables (as apps are built)

- **games** - Game definitions
- **matches** - Game match instances
- **match_players** - Players in matches
- **leaderboards** - Game-specific leaderboards

## Environment Variables

Services connect using environment variables:

```bash
DB_HOST=localhost
DB_USER=pubgames
DB_PASS=pubgames
DB_NAME=pubgames
```

See `identity-shell/backend/.env.example` for a template.

## Redis Usage

Redis stores ephemeral data with appropriate TTLs:

- Live game state (e.g., tic-tac-toe board)
- Active session data
- Real-time leaderboards
- Pub/sub for live updates

No Redis setup script needed - it works out of the box after installation.

## Manual Database Operations

### Add a new user

```sql
-- Hash password first using bcrypt (use Go or online tool)
-- Then insert:
INSERT INTO users (email, name, code_hash, is_admin)
VALUES ('user@example.com', 'User Name', '$2a$12$hash...', FALSE);
```

### Reset database

```bash
# Drop and recreate
sudo -u postgres psql -c "DROP DATABASE pubgames;"
sudo -u postgres psql -c "CREATE DATABASE pubgames;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE pubgames TO pubgames;"

# Re-run schema
PGPASSWORD=pubgames psql -h localhost -U pubgames -d pubgames -f schema.sql
```

## Troubleshooting

### PostgreSQL connection refused

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start if needed
sudo systemctl start postgresql
```

### Redis connection refused

```bash
# Check if Redis is running
sudo systemctl status redis-server

# Start if needed
sudo systemctl start redis-server
```

### Permission denied

```bash
# Make sure user 'pubgames' has proper permissions
sudo -u postgres psql -d pubgames -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pubgames;"
sudo -u postgres psql -d pubgames -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pubgames;"
```
