#!/bin/bash

# PubGames V3 - Stop Services Script

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$BASE_DIR/.pids"

echo -e "${BLUE}🛑 PubGames V3 - Stopping Services${NC}"
echo "========================================"
echo ""

# Stop by PID file
stop_by_pid() {
    local pid_file=$1
    local name=$2

    if [ ! -f "$pid_file" ]; then
        return 0
    fi

    local pid=$(cat "$pid_file")

    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping $name (PID: $pid)...${NC}"
        kill $pid 2>/dev/null

        # Wait for graceful shutdown
        local count=0
        while ps -p $pid > /dev/null 2>&1 && [ $count -lt 5 ]; do
            sleep 1
            count=$((count + 1))
        done

        # Force kill if needed
        if ps -p $pid > /dev/null 2>&1; then
            kill -9 $pid 2>/dev/null
        fi

        echo -e "  ${GREEN}✓ Stopped${NC}"
    fi

    rm -f "$pid_file"
}

# Kill process on port
kill_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -ti:$port 2>/dev/null)

    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing $name on port $port...${NC}"
        kill -9 $pids 2>/dev/null
        echo -e "  ${GREEN}✓ Killed${NC}"
    fi
}

# Stop by PID files
if [ -d "$PID_DIR" ]; then
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            name=$(basename "$pid_file" .pid)
            stop_by_pid "$pid_file" "$name"
        fi
    done
fi

echo ""

# Clean up known ports (fallback)
echo "Cleaning up ports..."
kill_port 3001 "Identity Shell"
kill_port 4001 "Tic-Tac-Toe"
kill_port 4011 "Dots"
kill_port 5010 "Smoke Test"
kill_port 4031 "Sweepstakes"
kill_port 5030 "Leaderboard"
kill_port 5040 "Season Scheduler"

# Kill remaining Go processes from this project
pkill -f "go run.*pub-games-v3" 2>/dev/null

# Clean PID files
rm -f "$PID_DIR"/*.pid 2>/dev/null

echo ""
echo "========================================"
echo -e "${GREEN}✓ All services stopped${NC}"
echo ""
