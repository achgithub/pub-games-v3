#!/bin/bash
# Stop Hook: Runs when Claude tries to stop/complete
# Exit 0 = allow stopping
# Exit 2 = block stopping (Claude must continue)

echo "🛑 [PRE-STOP] Claude is trying to stop..." >&2

# ============================================================
# ADD YOUR FINAL VALIDATION HERE
# ============================================================
#
# Example: Check for uncommitted changes
# if ! git diff --quiet 2>/dev/null; then
#   echo "⚠️  WARNING: Uncommitted changes exist" >&2
#   # Uncomment to block until changes are committed:
#   # echo "❌ BLOCKED: Commit changes before stopping" >&2
#   # exit 2
# fi
#
# Example: Run tests before allowing stop
# if command -v npm &> /dev/null; then
#   if [ -f package.json ]; then
#     if ! npm test --silent 2>/dev/null; then
#       echo "❌ BLOCKED: Tests failing - fix before stopping" >&2
#       exit 2
#     fi
#   fi
# fi
#
# Example: Check build succeeds
# if command -v go &> /dev/null; then
#   if [ -f go.mod ]; then
#     if ! go build ./... 2>/dev/null; then
#       echo "❌ BLOCKED: Build failing - fix before stopping" >&2
#       exit 2
#     fi
#   fi
# fi

echo "✅ [PRE-STOP] Validation passed - allowing stop" >&2
exit 0
