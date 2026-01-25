#!/bin/bash

# PubGames V3 - Service Status Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$BASE_DIR/.pids"

echo -e "${BLUE}📊 PubGames V3 - Service Status${NC}"
echo "========================================"
echo ""

# Check service status
check_service() {
    local name=$1
    local port=$2
    local pid_file="$PID_DIR/${name}.pid"

    echo -n -e "${BLUE}$name${NC} (port $port): "

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port 2>/dev/null | head -1)
        echo -e "${GREEN}✓ RUNNING${NC} (PID: $pid)"
        return 0
    else
        echo -e "${RED}✗ STOPPED${NC}"
        # Clean stale PID file
        if [ -f "$pid_file" ]; then
            rm -f "$pid_file"
        fi
        return 1
    fi
}

# Check services
running=0

check_service "Identity Shell" 3001 && running=$((running + 1))
check_service "Tic-Tac-Toe" 4001 && running=$((running + 1))
check_service "Smoke Test" 5010 && running=$((running + 1))

echo ""
echo "========================================"
echo "Services running: $running"
echo ""

# Show URLs if running
if [ $running -gt 0 ]; then
    echo "Access:"
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${BLUE}Identity Shell:${NC}  http://localhost:3001"
    fi
    if lsof -Pi :4001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${BLUE}Tic-Tac-Toe:${NC}     http://localhost:4001"
    fi
    if lsof -Pi :5010 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${BLUE}Smoke Test:${NC}      http://localhost:5010"
    fi
    echo ""
fi

# Show log locations
if [ -d "$BASE_DIR/logs" ]; then
    echo "Logs: $BASE_DIR/logs/"
    echo "  View: tail -f logs/<service>.log"
    echo ""
fi
