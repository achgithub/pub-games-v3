#!/bin/bash
# PermissionRequest Hook: Runs when Claude requests permission for ANY tool
# This hook LOGS all tool requests and can selectively BLOCK operations
# Exit 0 = allow, Exit 2 = block
#
# LEARNING MODE: This hook logs everything to help you build restrictions over time
# Review the log, then convert frequent violations to deny rules in settings.json

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Extract tool-specific arguments from tool_input
case "$TOOL_NAME" in
  Bash)
    TOOL_ARGS=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    ;;
  Write|Edit)
    TOOL_ARGS=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    ;;
  Read)
    TOOL_ARGS=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    ;;
  *)
    TOOL_ARGS=$(echo "$INPUT" | jq -r '.tool_input | to_entries | map("\(.key)=\(.value)") | join(", ") // empty')
    ;;
esac

# ============================================================
# LOGGING: Track all tool requests for review
# ============================================================

LOG_DIR="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/logs"
LOG_FILE="$LOG_DIR/permissions.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log entry: timestamp | tool | args
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] $TOOL_NAME | $TOOL_ARGS" >> "$LOG_FILE"

# ============================================================
# ENFORCEMENT RULES: Block specific operations
# ============================================================

# Detect if we're on Mac (editing machine)
IS_MAC=false
if [[ "$(uname)" == "Darwin" ]]; then
  IS_MAC=true
fi

# Block git push on Mac (user pushes manually per workflow)
if $IS_MAC && [[ "$TOOL_NAME" == "Bash" ]]; then
  BASH_CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  if [[ "$BASH_CMD" =~ ^git\ push ]]; then
    echo "❌ BLOCKED: git push on Mac" >&2
    echo "   Mac/Pi workflow: User pushes manually" >&2
    echo "   Commit locally, then push when ready" >&2
    exit 2
  fi
fi

# ============================================================
# ADD YOUR ENFORCEMENT RULES HERE
# ============================================================
#
# Example: Block npm on Mac (no npm installed)
# if $IS_MAC && [[ "$TOOL_NAME" == "Bash" ]] && [[ "$TOOL_ARGS" =~ ^npm ]]; then
#   echo "❌ BLOCKED: npm not available on Mac" >&2
#   echo "   Build/test on Pi after push" >&2
#   exit 2
# fi
#
# Example: Block go commands on Mac (no Go installed)
# if $IS_MAC && [[ "$TOOL_NAME" == "Bash" ]] && [[ "$TOOL_ARGS" =~ ^go\ ]]; then
#   echo "❌ BLOCKED: Go not available on Mac" >&2
#   echo "   Build/test on Pi after push" >&2
#   exit 2
# fi
#
# Example: Block creating JavaScript files
# if [[ "$TOOL_NAME" == "Write" ]] && [[ "$TOOL_ARGS" =~ \.jsx?$ ]]; then
#   echo "❌ BLOCKED: Use TypeScript (.ts/.tsx) instead" >&2
#   exit 2
# fi
#
# Review log periodically:
#   tail -f .claude/logs/permissions.log
#
# When you see violations, add rules above OR in settings.json:
#   {
#     "permissions": {
#       "deny": ["Bash(npm *)", "Write(*.js)"]
#     }
#   }

# Allow by default (learning mode)
exit 0
