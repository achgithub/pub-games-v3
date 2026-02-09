#!/bin/bash

# PubGames V3 - New Static App Creator
# Creates a new static app (iframe-embedded) from the template
#
# Usage: ./new_static_app.sh --name my-app --number 5 --icon 🎮

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$BASE_DIR/static-apps/template"

# Command-line arguments
ARG_APP_NAME=""
ARG_DISPLAY_NAME=""
ARG_APP_NUMBER=""
ARG_DESCRIPTION=""
ARG_ICON=""
ARG_SKIP_CONFIRM=false
ARG_INTERACTIVE=true

# Usage function
usage() {
    echo -e "${BLUE}🎮 PubGames V3 - New Static App Creator${NC}"
    echo "==========================================="
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -n, --name NAME           App name (required, e.g., 'poker-night')"
    echo "  -d, --display DISPLAY     App display name (e.g., 'Poker Night')"
    echo "  -num, --number NUMBER     App number 1-99 (required)"
    echo "  -desc, --description DESC App description"
    echo "  -i, --icon ICON          App icon (emoji or text)"
    echo "  -y, --yes                Skip confirmation prompt"
    echo "  -h, --help               Show this help"
    echo ""
    echo "Interactive mode (no arguments):"
    echo "  Run without arguments to use interactive prompts"
    echo ""
    echo "Example (non-interactive):"
    echo "  $0 --name poker-night --display 'Poker Night' --number 5 --icon '🃏' --yes"
    echo ""
    echo "Port allocation:"
    echo "  Frontend: 50{NUMBER}0 (e.g., number 5 → 5050)"
    echo "  Backend:  50{NUMBER}1 (e.g., number 5 → 5051)"
    echo ""
    exit 0
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            ARG_APP_NAME="$2"
            ARG_INTERACTIVE=false
            shift 2
            ;;
        -d|--display)
            ARG_DISPLAY_NAME="$2"
            shift 2
            ;;
        -num|--number)
            ARG_APP_NUMBER="$2"
            ARG_INTERACTIVE=false
            shift 2
            ;;
        -desc|--description)
            ARG_DESCRIPTION="$2"
            shift 2
            ;;
        -i|--icon)
            ARG_ICON="$2"
            shift 2
            ;;
        -y|--yes)
            ARG_SKIP_CONFIRM=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}✗ Unknown option: $1${NC}"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Show header for interactive mode
if [ "$ARG_INTERACTIVE" = true ]; then
    echo -e "${BLUE}🎮 PubGames V3 - New Static App Creator${NC}"
    echo "==========================================="
    echo ""
    echo -e "${YELLOW}Input Rules:${NC}"
    echo "  • App name: lowercase, numbers, hyphens only (e.g., 'poker-night')"
    echo "  • Display name: letters, numbers, spaces, basic punctuation"
    echo "  • Avoid: < > \" ' \\ (these break Go syntax)"
    echo "  • Icon: emoji or 1-2 character symbol"
    echo ""
fi

# Check if template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}✗ Template directory not found: $TEMPLATE_DIR${NC}"
    exit 1
fi

# App Name
if [ -n "$ARG_APP_NAME" ]; then
    APP_NAME="$ARG_APP_NAME"
else
    read -p "App name (e.g., 'poker-night'): " APP_NAME
fi

if [ -z "$APP_NAME" ]; then
    echo -e "${RED}✗ App name is required${NC}"
    exit 1
fi

# Validate app name - only lowercase letters, numbers, hyphens
if ! [[ "$APP_NAME" =~ ^[a-z0-9-]+$ ]]; then
    echo -e "${RED}✗ Invalid app name. Use only lowercase letters, numbers, and hyphens${NC}"
    echo "  Example: poker-night, quiz-master, darts-league"
    exit 1
fi

# Display Name
if [ -n "$ARG_DISPLAY_NAME" ]; then
    APP_DISPLAY_NAME="$ARG_DISPLAY_NAME"
elif [ "$ARG_INTERACTIVE" = true ]; then
    read -p "App display name (e.g., 'Poker Night'): " APP_DISPLAY_NAME
fi

if [ -z "$APP_DISPLAY_NAME" ]; then
    # Convert app-name to App Name
    APP_DISPLAY_NAME=$(echo "$APP_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
fi

# Validate display name
if [[ "$APP_DISPLAY_NAME" =~ [\<\>\"\'\\] ]]; then
    echo -e "${RED}✗ Invalid display name. Cannot contain: < > \" ' \\${NC}"
    exit 1
fi

# App Number
if [ -n "$ARG_APP_NUMBER" ]; then
    APP_NUMBER="$ARG_APP_NUMBER"
elif [ "$ARG_INTERACTIVE" = true ]; then
    read -p "App number (1-99, e.g., 5): " APP_NUMBER
fi

if [ -z "$APP_NUMBER" ] || ! [[ "$APP_NUMBER" =~ ^[0-9]+$ ]] || [ "$APP_NUMBER" -lt 1 ] || [ "$APP_NUMBER" -gt 99 ]; then
    echo -e "${RED}✗ Invalid app number. Must be between 1 and 99${NC}"
    exit 1
fi

# App Description
if [ -n "$ARG_DESCRIPTION" ]; then
    APP_DESCRIPTION="$ARG_DESCRIPTION"
elif [ "$ARG_INTERACTIVE" = true ]; then
    read -p "App description: " APP_DESCRIPTION
fi

if [ -z "$APP_DESCRIPTION" ]; then
    APP_DESCRIPTION="A PubGames static application"
fi

# Validate description
if [[ "$APP_DESCRIPTION" =~ [\<\>\"\'\\] ]]; then
    echo -e "${RED}✗ Invalid description. Cannot contain: < > \" ' \\${NC}"
    exit 1
fi

# Icon
if [ -n "$ARG_ICON" ]; then
    APP_ICON="$ARG_ICON"
elif [ "$ARG_INTERACTIVE" = true ]; then
    read -p "App icon (emoji, e.g., 🎮): " APP_ICON
fi

if [ -z "$APP_ICON" ]; then
    APP_ICON="🎮"
fi

# Validate icon
if [[ "$APP_ICON" =~ [\<\>\"\'\\] ]]; then
    echo -e "${RED}✗ Invalid icon. Cannot contain: < > \" ' \\${NC}"
    exit 1
fi

ICON_LENGTH=$(echo -n "$APP_ICON" | wc -m)
if [ "$ICON_LENGTH" -gt 10 ]; then
    echo -e "${RED}✗ Icon too long. Use a single emoji or 1-2 character symbol${NC}"
    exit 1
fi

# Calculate ports (5000+ range for static apps)
FRONTEND_PORT="50${APP_NUMBER}0"
BACKEND_PORT="50${APP_NUMBER}1"

# Database name (convert app-name to app_name for PostgreSQL)
DB_NAME="${APP_NAME//-/_}_db"

# Show summary
echo ""
echo -e "${YELLOW}Creating new static app with:${NC}"
echo "  Name: $APP_NAME"
echo "  Display Name: $APP_DISPLAY_NAME"
echo "  Description: $APP_DESCRIPTION"
echo "  Icon: $APP_ICON"
echo "  App Number: $APP_NUMBER"
echo "  Frontend Port: $FRONTEND_PORT"
echo "  Backend Port: $BACKEND_PORT"
echo "  Database: $DB_NAME"
echo ""

# Confirmation prompt
if [ "$ARG_SKIP_CONFIRM" = false ]; then
    read -p "Continue? (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ]; then
        echo "Cancelled"
        exit 0
    fi
fi

APP_DIR="$BASE_DIR/static-apps/$APP_NAME"

# Check if app already exists
if [ -d "$APP_DIR" ]; then
    echo -e "${RED}✗ App directory already exists: $APP_DIR${NC}"
    exit 1
fi

# Copy template
echo ""
echo -e "${YELLOW}Copying template...${NC}"
cp -r "$TEMPLATE_DIR" "$APP_DIR"
echo -e "${GREEN}✓ Template copied${NC}"

# Replace placeholders in go.mod
echo -e "${YELLOW}Updating go.mod...${NC}"
sed -i '' "s|module pubgames/template|module pubgames/$APP_NAME|g" "$APP_DIR/go.mod"
echo -e "${GREEN}✓ Updated go.mod${NC}"

# Replace placeholders in main.go
echo -e "${YELLOW}Updating main.go...${NC}"
sed -i '' "s|50X1|$BACKEND_PORT|g" "$APP_DIR/main.go"
sed -i '' "s|50X0|$FRONTEND_PORT|g" "$APP_DIR/main.go"
sed -i '' "s|PLACEHOLDER_APP_NAME|$APP_DISPLAY_NAME|g" "$APP_DIR/main.go"
sed -i '' "s|PLACEHOLDER_ICON|$APP_ICON|g" "$APP_DIR/main.go"
echo -e "${GREEN}✓ Updated main.go${NC}"

# Replace placeholders in database.go
echo -e "${YELLOW}Updating database.go...${NC}"
sed -i '' "s|template_db|$DB_NAME|g" "$APP_DIR/database.go"
echo -e "${GREEN}✓ Updated database.go${NC}"

# Replace placeholders in handlers.go
echo -e "${YELLOW}Updating handlers.go...${NC}"
sed -i '' "s|PLACEHOLDER_APP_NAME|$APP_DISPLAY_NAME|g" "$APP_DIR/handlers.go"
echo -e "${GREEN}✓ Updated handlers.go${NC}"

# Replace placeholders in package.json
echo -e "${YELLOW}Updating package.json...${NC}"
sed -i '' "s|pubgames-template|pubgames-$APP_NAME|g" "$APP_DIR/package.json"
sed -i '' "s|Template static app for PubGames V3|$APP_DESCRIPTION|g" "$APP_DIR/package.json"
sed -i '' "s|PORT=50X0|PORT=$FRONTEND_PORT|g" "$APP_DIR/package.json"
echo -e "${GREEN}✓ Updated package.json${NC}"

# Replace placeholders in src/App.js
echo -e "${YELLOW}Updating src/App.js...${NC}"
sed -i '' "s|PLACEHOLDER_BACKEND_PORT|$BACKEND_PORT|g" "$APP_DIR/src/App.js"
sed -i '' "s|PLACEHOLDER_APP_NAME|$APP_DISPLAY_NAME|g" "$APP_DIR/src/App.js"
sed -i '' "s|PLACEHOLDER_ICON|$APP_ICON|g" "$APP_DIR/src/App.js"
echo -e "${GREEN}✓ Updated src/App.js${NC}"

# Update README.md
echo -e "${YELLOW}Updating README.md...${NC}"
sed -i '' "s|Static App Template|$APP_DISPLAY_NAME|g" "$APP_DIR/README.md"
sed -i '' "s|50X0|$FRONTEND_PORT|g" "$APP_DIR/README.md"
sed -i '' "s|50X1|$BACKEND_PORT|g" "$APP_DIR/README.md"
sed -i '' "s|template_db|$DB_NAME|g" "$APP_DIR/README.md"
echo -e "${GREEN}✓ Updated README.md${NC}"

# Update public/index.html
echo -e "${YELLOW}Updating public/index.html...${NC}"
sed -i '' "s|PLACEHOLDER_APP_NAME|$APP_DISPLAY_NAME|g" "$APP_DIR/public/index.html"
echo -e "${GREEN}✓ Updated public/index.html${NC}"

# Create database setup script
echo -e "${YELLOW}Creating database setup script...${NC}"
cat > "$BASE_DIR/scripts/setup_${APP_NAME}_db.sh" << 'SCRIPT_EOF'
#!/bin/bash
# Database setup for APP_DISPLAY_NAME_PLACEHOLDER
# Run this on the Pi to create the app's database

set -e

echo "Creating database: DB_NAME_PLACEHOLDER"

sudo -u postgres psql -p 5555 << 'EOF'
-- Create database
CREATE DATABASE DB_NAME_PLACEHOLDER;

-- Grant database privileges to pubgames user
GRANT ALL PRIVILEGES ON DATABASE DB_NAME_PLACEHOLDER TO activityhub;

-- Connect to the database and set schema permissions
\c DB_NAME_PLACEHOLDER

-- Grant schema permissions (required for PostgreSQL 15+)
GRANT ALL ON SCHEMA public TO activityhub;
GRANT CREATE ON SCHEMA public TO activityhub;

-- Set database owner
ALTER DATABASE DB_NAME_PLACEHOLDER OWNER TO activityhub;

EOF

echo "✅ Database DB_NAME_PLACEHOLDER created successfully"
echo "   User 'activityhub' has full access"
SCRIPT_EOF

# Replace placeholders in the setup script
sed -i '' "s|APP_DISPLAY_NAME_PLACEHOLDER|$APP_DISPLAY_NAME|g" "$BASE_DIR/scripts/setup_${APP_NAME}_db.sh"
sed -i '' "s|DB_NAME_PLACEHOLDER|$DB_NAME|g" "$BASE_DIR/scripts/setup_${APP_NAME}_db.sh"
chmod +x "$BASE_DIR/scripts/setup_${APP_NAME}_db.sh"

echo -e "${GREEN}✓ Created scripts/setup_${APP_NAME}_db.sh${NC}"

echo ""
echo "==========================================="
echo -e "${GREEN}✓ New static app created successfully!${NC}"
echo ""
echo "App location: $APP_DIR"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT"
echo "Database: $DB_NAME"
echo ""
echo -e "${YELLOW}Next steps (on Pi):${NC}"
echo "1. Create database:"
echo "   cd ~/pub-games-v3"
echo "   ./scripts/setup_${APP_NAME}_db.sh"
echo ""
echo "2. Install dependencies:"
echo "   cd ~/pub-games-v3/static-apps/$APP_NAME"
echo "   go mod download"
echo "   npm install"
echo ""
echo "3. Start services:"
echo "   go run *.go        # Backend"
echo "   npm start           # Frontend (in another terminal)"
echo ""
echo -e "${YELLOW}Don't forget to:${NC}"
echo "- Register app in Identity Shell's apps registry"
echo "- Test iframe embedding from shell"
echo "- Customize database schema in database.go"
echo "- Implement your business logic in handlers.go"
echo ""
