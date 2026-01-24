#!/bin/bash
# Lobby system database migration
# Adds challenges table for challenge history tracking

echo "🔄 Running lobby system migration..."

# Run schema updates
psql -U pubgames -d pubgames -f "$(dirname "$0")/schema.sql"

if [ $? -eq 0 ]; then
    echo "✅ Lobby schema migration complete"
else
    echo "❌ Migration failed"
    exit 1
fi
