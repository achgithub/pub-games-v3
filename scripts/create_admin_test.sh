#!/bin/bash
# Create admin@test.com user for testing admin functionality

set -e

echo "🔧 Creating admin@test.com user..."

# Check if user already exists
EXISTING=$(PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -tAc "SELECT email FROM users WHERE email = 'admin@test.com';")

if [ -n "$EXISTING" ]; then
    echo "⚠️  User admin@test.com already exists"
    echo "Current details:"
    PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -c "SELECT email, name, is_admin FROM users WHERE email = 'admin@test.com';"

    echo ""
    read -p "Update to admin privileges? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -c "UPDATE users SET is_admin = TRUE, name = 'Admin Test' WHERE email = 'admin@test.com';"
        echo "✅ User updated to admin"
    else
        echo "No changes made"
    fi
else
    # Insert new user with bcrypt hash of "123456"
    PGPASSWORD=pubgames psql -h 127.0.0.1 -p 5555 -U activityhub -d activity_hub -c "
    INSERT INTO users (email, name, code_hash, is_admin)
    VALUES (
        'admin@test.com',
        'Admin Test',
        '\$2a\$10\$uwXWNdFfI9GWqzaGuh3PPunUuKmK52mjpLihTmr5cMlwOEJlmTRd6',
        TRUE
    );
    "
    echo "✅ User admin@test.com created successfully"
fi

echo ""
echo "Login credentials:"
echo "  Email:    admin@test.com"
echo "  Password: 123456"
echo "  Admin:    Yes"
echo ""
echo "Test in Identity Shell at http://localhost:3001"
