#!/bin/bash
# PostToolUse Hook: Runs AFTER Claude writes/edits files
# Exit 0 = keep the write
# Exit 2 = undo the write

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

echo "📝 [POST-WRITE] Claude completed $TOOL_NAME: $FILE_PATH" >&2

# ============================================================
# ADD YOUR VALIDATION RULES HERE
# ============================================================
#
# Example: Check file content
# if grep -q "FORBIDDEN_PATTERN" "$FILE_PATH" 2>/dev/null; then
#   echo "❌ BLOCKED: File contains forbidden pattern" >&2
#   exit 2
# fi
#
# Example: Run linter on TypeScript files
# if [[ "$FILE_PATH" =~ \.tsx?$ ]]; then
#   if command -v eslint &> /dev/null; then
#     if ! eslint "$FILE_PATH" --quiet 2>/dev/null; then
#       echo "⚠️  WARNING: ESLint errors detected" >&2
#       # Uncomment to block:
#       # exit 2
#     fi
#   fi
# fi
#
# Example: Check file size
# if [ -f "$FILE_PATH" ]; then
#   SIZE=$(wc -l < "$FILE_PATH" | tr -d ' ')
#   if [ "$SIZE" -gt 500 ]; then
#     echo "⚠️  WARNING: File is $SIZE lines (consider refactoring)" >&2
#   fi
# fi

echo "✅ [POST-WRITE] Validation passed" >&2
exit 0
