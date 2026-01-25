#!/bin/bash

# PubGames V3 - Start Services Script
# Single port per app architecture

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$BASE_DIR/.pids"
LOG_DIR="$BASE_DIR/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

echo -e "${BLUE}🚀 PubGames V3 - Starting Services${NC}"
echo "========================================"
echo ""

# Check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# Wait for port to be listening
wait_for_port() {
    local port=$1
    local timeout=$2
    local name=$3
    local count=0

    while [ $count -lt $timeout ]; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    return 1
}

# Start a service (single port: backend serves frontend)
start_service() {
    local name=$1
    local backend_dir=$2
    local port=$3
    local pid_file="$PID_DIR/${name}.pid"
    local log_file="$LOG_DIR/${name}.log"

    echo -e "${YELLOW}Starting $name (port $port)...${NC}"

    # Check if already running
    if [ -f "$pid_file" ]; then
        local old_pid=$(cat "$pid_file")
        if ps -p $old_pid > /dev/null 2>&1; then
            echo -e "  ${YELLOW}Already running (PID: $old_pid)${NC}"
            return 0
        fi
        rm -f "$pid_file"
    fi

    # Check port
    if ! check_port $port; then
        echo -e "  ${RED}✗ Port $port already in use${NC}"
        return 1
    fi

    # Start backend
    cd "$backend_dir"
    nohup go run *.go > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    cd "$BASE_DIR"

    # Wait for startup
    if wait_for_port $port 30 "$name"; then
        echo -e "  ${GREEN}✓ Started (PID: $pid)${NC}"
        return 0
    else
        echo -e "  ${RED}✗ Failed to start${NC}"
        echo "  Check log: $log_file"
        kill $pid 2>/dev/null
        rm -f "$pid_file"
        return 1
    fi
}

# Start Identity Shell (required)
if ! start_service "identity-shell" "$BASE_DIR/identity-shell/backend" 3001; then
    echo -e "${RED}✗ Identity Shell failed - cannot continue${NC}"
    exit 1
fi

echo ""

# Start Tic-Tac-Toe (optional)
if [ -d "$BASE_DIR/games/tic-tac-toe/backend" ]; then
    start_service "tic-tac-toe" "$BASE_DIR/games/tic-tac-toe/backend" 4001
    echo ""
fi

# Start Smoke Test (optional)
if [ -d "$BASE_DIR/static-apps/smoke-test" ]; then
    start_service "smoke-test" "$BASE_DIR/static-apps/smoke-test" 5010
    echo ""
fi

echo "========================================"
echo -e "${GREEN}✓ Services started${NC}"
echo ""
echo "Access:"
echo -e "  ${BLUE}Identity Shell:${NC}  http://localhost:3001"
if lsof -Pi :4001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Tic-Tac-Toe:${NC}     http://localhost:4001"
fi
if lsof -Pi :5010 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Smoke Test:${NC}      http://localhost:5010"
fi
echo ""
echo "Commands:"
echo "  Status: ./status_services.sh"
echo "  Stop:   ./stop_services.sh"
echo "  Logs:   tail -f logs/<service>.log"
echo ""
