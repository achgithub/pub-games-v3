#!/bin/bash

# Script: create-app.sh
# Usage: ./scripts/create-app.sh app-name 4099
# Creates a fully-scaffolded Activity Hub app following all standards

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <app-name> <port>"
    echo "Example: $0 my-game 4099"
    exit 1
fi

APP_NAME="$1"
PORT="$2"
APP_NAME_DISPLAY="${APP_NAME//-/ }"
APP_NAME_DISPLAY="$(echo "$APP_NAME_DISPLAY" | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/games/$APP_NAME"
TEMPLATE_DIR="$ROOT_DIR/scripts/templates"

echo "Creating Activity Hub app: $APP_NAME"
echo "Port: $PORT"
echo "Display name: $APP_NAME_DISPLAY"
echo ""

# Check if app already exists
if [ -d "$APP_DIR" ]; then
    echo "Error: App directory already exists at $APP_DIR"
    exit 1
fi

# Create directory structure
echo "Creating directory structure..."
mkdir -p "$APP_DIR/backend/static"
mkdir -p "$APP_DIR/frontend/src"
mkdir -p "$APP_DIR/frontend/public"
mkdir -p "$APP_DIR/database"

# Process templates and create files
echo "Creating frontend files..."

# index.tsx
cat "$TEMPLATE_DIR/frontend-index.tsx.template" > "$APP_DIR/frontend/src/index.tsx"

# App.tsx
sed "s/{{APP_NAME}}/$APP_NAME_DISPLAY/g" "$TEMPLATE_DIR/frontend-app.tsx.template" > "$APP_DIR/frontend/src/App.tsx"

# App.css
cat "$TEMPLATE_DIR/frontend-app.css.template" > "$APP_DIR/frontend/src/App.css"

# react-app-env.d.ts
cat "$TEMPLATE_DIR/frontend-react-app-env.d.ts.template" > "$APP_DIR/frontend/src/react-app-env.d.ts"

# package.json
sed "s/{{APP_NAME}}/$APP_NAME/g" "$TEMPLATE_DIR/frontend-package.json.template" > "$APP_DIR/frontend/package.json"

# tsconfig.json
cat "$TEMPLATE_DIR/frontend-tsconfig.json.template" > "$APP_DIR/frontend/tsconfig.json"

# public/index.html
cat > "$APP_DIR/frontend/public/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Activity Hub App" />
    <title>Activity Hub</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

# .gitignore for frontend
cat > "$APP_DIR/frontend/.gitignore" << 'EOF'
# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*
EOF

echo "Creating backend files..."

# main.go
sed -e "s/{{APP_NAME}}/$APP_NAME/g" -e "s/{{PORT}}/$PORT/g" "$TEMPLATE_DIR/backend-main.go.template" > "$APP_DIR/backend/main.go"

# go.mod
sed "s/{{APP_NAME}}/$APP_NAME/g" "$TEMPLATE_DIR/backend-go.mod.template" > "$APP_DIR/backend/go.mod"

echo "Creating database files..."

# schema.sql
sed "s/{{APP_NAME}}/$APP_NAME/g" "$TEMPLATE_DIR/database-schema.sql.template" > "$APP_DIR/database/schema.sql"

echo "Creating README..."

# README.md
HOST='${HOST:-localhost}'
sed -e "s/{{APP_NAME}}/$APP_NAME/g" \
    -e "s/{{APP_NAME_DISPLAY}}/$APP_NAME_DISPLAY/g" \
    -e "s/{{PORT}}/$PORT/g" \
    -e "s/{{HOST}}/$HOST/g" \
    "$TEMPLATE_DIR/app-readme.md.template" > "$APP_DIR/README.md"

echo ""
echo "✅ App created successfully at: $APP_DIR"
echo ""
echo "Next steps:"
echo ""
echo "1. Review and customize the generated files"
echo ""
echo "2. On Pi - Install dependencies and build:"
echo "   cd ~/pub-games-v3/games/$APP_NAME/frontend"
echo "   npm install"
echo "   npm run build"
echo "   cp -r build/* ../backend/static/"
echo ""
echo "3. On Pi - Create database (if needed):"
echo "   psql -U activityhub -h localhost -p 5555 -d postgres -c \"CREATE DATABASE ${APP_NAME}_db;\""
echo "   psql -U activityhub -h localhost -p 5555 -d ${APP_NAME}_db -f games/$APP_NAME/database/schema.sql"
echo ""
echo "4. On Pi - Run backend:"
echo "   cd ~/pub-games-v3/games/$APP_NAME/backend"
echo "   go mod tidy"
echo "   go run *.go"
echo ""
echo "5. Register app in identity-shell/backend/apps.json and database"
echo "   (See README.md for SQL command)"
echo ""
echo "6. Test:"
echo "   curl http://localhost:$PORT/api/config"
echo ""
