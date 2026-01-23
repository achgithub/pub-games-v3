#!/bin/bash
# Quick script to check users table

echo "📊 Checking users in database..."
echo ""

PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U pubgames -d pubgames -c "SELECT email, name, is_admin, length(code_hash) as hash_length FROM users;"

echo ""
echo "If you see users above, the schema was applied correctly."
echo "Hash length should be 60 for bcrypt hashes."
