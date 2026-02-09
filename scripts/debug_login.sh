#!/bin/bash
# Debug login issues - check database and test authentication

set -e

echo "🔍 Debugging login issues..."
echo ""

# Check if PostgreSQL is running
echo "1. Checking PostgreSQL connection..."
if PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ PostgreSQL is connected"
else
    echo "   ❌ PostgreSQL connection failed"
    exit 1
fi

echo ""
echo "2. Checking users table..."
PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -c "
SELECT
    email,
    name,
    is_admin,
    LENGTH(code_hash) as hash_len,
    created_at
FROM users
ORDER BY created_at DESC;"

echo ""
echo "3. Checking for admin@test.com specifically..."
ADMIN_EXISTS=$(PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -tAc "
SELECT COUNT(*) FROM users WHERE email = 'admin@test.com';
")

if [ "$ADMIN_EXISTS" = "0" ]; then
    echo "   ❌ admin@test.com NOT FOUND"
    echo ""
    echo "   Run: ./scripts/create_admin_test.sh"
else
    echo "   ✅ admin@test.com exists"
    PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -c "
    SELECT email, name, is_admin FROM users WHERE email = 'admin@test.com';"
fi

echo ""
echo "4. Testing identity-shell backend endpoint..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ Identity shell is running on port 3001"
else
    echo "   ❌ Identity shell is NOT responding"
    echo ""
    echo "   Check: tail -f logs/identity-shell.log"
    exit 1
fi

echo ""
echo "5. Testing login with existing user (test@pubgames.local)..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@pubgames.local","code":"123456"}')

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Login successful with test@pubgames.local"
    echo "   Response: $RESPONSE_BODY"
else
    echo "   ❌ Login failed (HTTP $HTTP_CODE)"
    echo "   Response: $RESPONSE_BODY"
fi

echo ""
echo "6. Testing login with admin@test.com (if exists)..."
if [ "$ADMIN_EXISTS" != "0" ]; then
    ADMIN_LOGIN=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@test.com","code":"123456"}')

    ADMIN_HTTP_CODE=$(echo "$ADMIN_LOGIN" | tail -n1)
    ADMIN_RESPONSE=$(echo "$ADMIN_LOGIN" | head -n-1)

    if [ "$ADMIN_HTTP_CODE" = "200" ]; then
        echo "   ✅ Login successful with admin@test.com"
        echo "   Response: $ADMIN_RESPONSE"
    else
        echo "   ❌ Login failed (HTTP $ADMIN_HTTP_CODE)"
        echo "   Response: $ADMIN_RESPONSE"
        echo ""
        echo "   Possible issues:"
        echo "   - Backend code not rebuilt after changes"
        echo "   - Old backend still running"
        echo ""
        echo "   Solution: Rebuild and restart identity-shell"
    fi
else
    echo "   ⏭️  Skipped (user doesn't exist)"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "Summary:"
echo "  - Database: $([ "$ADMIN_EXISTS" != "0" ] && echo "✅ Ready" || echo "⚠️  Need to create admin@test.com")"
echo "  - Backend:  $(curl -s http://localhost:3001/api/health > /dev/null 2>&1 && echo "✅ Running" || echo "❌ Not running")"
echo ""
