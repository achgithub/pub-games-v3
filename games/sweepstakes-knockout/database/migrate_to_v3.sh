#!/bin/bash

# Migration to Sweepstakes Knockout v3 Schema
# Applies Groups/Competitors pattern like LMS Manager

set -e

DB_HOST="${DB_HOST:-192.168.1.29}"
DB_PORT="${DB_PORT:-5555}"
DB_USER="${DB_USER:-activityhub}"
DB_NAME="sweepstakes_knockout_db"

echo "========================================="
echo "Sweepstakes Knockout v3 Migration"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will DROP ALL TABLES and recreate them."
echo "    All existing data will be lost."
echo ""
echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Applying schema_v3.sql..."

PGPASSWORD=pubgames psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema_v3.sql

echo ""
echo "✅ Migration complete!"
echo ""
echo "Schema v3 features:"
echo "  • Groups (like LMS Manager)"
echo "  • Competitors within groups (like Teams)"
echo "  • Winning positions configured at game creation"
echo "  • Global player pool"
