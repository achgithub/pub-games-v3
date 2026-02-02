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

# Check if frontend needs rebuild
needs_rebuild() {
    local frontend_dir=$1
    local static_dir=$2

    # No build exists
    if [ ! -f "$static_dir/index.html" ]; then
        return 0
    fi

    # Find newest source file (src/, package.json, tsconfig.json)
    local newest_src=$(find "$frontend_dir/src" "$frontend_dir/package.json" "$frontend_dir/tsconfig.json" \
        -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1)

    if [ -z "$newest_src" ]; then
        return 0
    fi

    # Compare against build
    if [ "$newest_src" -nt "$static_dir/index.html" ]; then
        return 0
    fi

    return 1
}

# Build frontend if needed
build_frontend() {
    local name=$1
    local frontend_dir=$2
    local static_dir=$3

    # Check if build is needed
    if needs_rebuild "$frontend_dir" "$static_dir"; then
        echo -e "  ${YELLOW}Building frontend...${NC}"

        cd "$frontend_dir"

        # Install/update dependencies if package.json changed or node_modules missing
        if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
            echo "  Installing npm dependencies..."
            npm install --silent
        fi

        # Build
        npm run build --silent

        # Copy to static dir
        if [ -d "build" ]; then
            mkdir -p "$static_dir"
            cp -r build/* "$static_dir/"
            echo -e "  ${GREEN}✓ Frontend built${NC}"
        else
            echo -e "  ${RED}✗ Frontend build failed${NC}"
            cd "$BASE_DIR"
            return 1
        fi

        cd "$BASE_DIR"
    else
        echo -e "  ${GREEN}✓ Frontend up to date${NC}"
    fi
    return 0
}

# Start a service (single port: backend serves frontend)
start_service() {
    local name=$1
    local backend_dir=$2
    local frontend_dir=$3
    local port=$4
    local pid_file="$PID_DIR/${name}.pid"
    local log_file="$LOG_DIR/${name}.log"

    echo -e "${BLUE}════════════════════════════════════${NC}"
    echo -e "${BLUE}$name (port $port)${NC}"
    echo -e "${BLUE}════════════════════════════════════${NC}"

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

    # Build frontend if directory exists
    if [ -n "$frontend_dir" ] && [ -d "$frontend_dir" ]; then
        local static_dir="$backend_dir/static"
        if ! build_frontend "$name" "$frontend_dir" "$static_dir"; then
            return 1
        fi
    fi

    # Start backend
    echo -e "  ${YELLOW}Starting backend...${NC}"
    cd "$backend_dir"
    nohup go run *.go > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    cd "$BASE_DIR"

    # Wait for startup
    if wait_for_port $port 30 "$name"; then
        echo -e "  ${GREEN}✓ Running (PID: $pid)${NC}"
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
if ! start_service "Identity Shell" \
    "$BASE_DIR/identity-shell/backend" \
    "$BASE_DIR/identity-shell/frontend" \
    3001; then
    echo -e "${RED}✗ Identity Shell failed - cannot continue${NC}"
    exit 1
fi

echo ""

# Start Tic-Tac-Toe (optional)
if [ -d "$BASE_DIR/games/tic-tac-toe/backend" ]; then
    start_service "Tic-Tac-Toe" \
        "$BASE_DIR/games/tic-tac-toe/backend" \
        "$BASE_DIR/games/tic-tac-toe/frontend" \
        4001
    echo ""
fi

# Start Dots (optional)
if [ -d "$BASE_DIR/games/dots/backend" ]; then
    start_service "Dots" \
        "$BASE_DIR/games/dots/backend" \
        "$BASE_DIR/games/dots/frontend" \
        4011
    echo ""
fi

# Start Smoke Test (optional)
if [ -d "$BASE_DIR/static-apps/smoke-test/backend" ]; then
    start_service "Smoke Test" \
        "$BASE_DIR/static-apps/smoke-test/backend" \
        "$BASE_DIR/static-apps/smoke-test/frontend" \
        5010
    echo ""
fi

# Start Leaderboard (optional)
if [ -d "$BASE_DIR/static-apps/leaderboard/backend" ]; then
    start_service "Leaderboard" \
        "$BASE_DIR/static-apps/leaderboard/backend" \
        "$BASE_DIR/static-apps/leaderboard/frontend" \
        5030
    echo ""
fi

# Start Sweepstakes (optional)
if [ -d "$BASE_DIR/games/sweepstakes/backend" ]; then
    start_service "Sweepstakes" \
        "$BASE_DIR/games/sweepstakes/backend" \
        "$BASE_DIR/games/sweepstakes/frontend" \
        4031
    echo ""
fi

# Start Season Scheduler (optional)
if [ -d "$BASE_DIR/games/season-scheduler/backend" ]; then
    start_service "Season Scheduler" \
        "$BASE_DIR/games/season-scheduler/backend" \
        "$BASE_DIR/games/season-scheduler/frontend" \
        5040
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
if lsof -Pi :4011 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Dots:${NC}            http://localhost:4011"
fi
if lsof -Pi :5010 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Smoke Test:${NC}      http://localhost:5010"
fi
if lsof -Pi :5030 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Leaderboard:${NC}     http://localhost:5030"
fi
if lsof -Pi :4031 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Sweepstakes:${NC}     http://localhost:4031"
fi
if lsof -Pi :5040 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "  ${BLUE}Season Scheduler:${NC} http://localhost:5040"
fi
echo ""
echo "Commands:"
echo "  Status: ./status_services.sh"
echo "  Stop:   ./stop_services.sh"
echo "  Logs:   tail -f logs/<service>.log"
echo ""
