#!/bin/bash
# PreToolUse Hook: Runs BEFORE Claude writes/edits files
# Exit 0 = allow operation
# Exit 2 = block operation (Claude gets feedback and must adjust)

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

echo "🔍 [PRE-WRITE] Claude wants to $TOOL_NAME: $FILE_PATH" >&2

# ============================================================
# ADD YOUR ENFORCEMENT RULES HERE
# ============================================================
#
# Example: Block specific file patterns
# if [[ "$FILE_PATH" =~ forbidden-pattern\.css$ ]]; then
#   echo "❌ BLOCKED: No CSS files allowed" >&2
#   exit 2
# fi
#
# Example: Block specific directories
# if [[ "$FILE_PATH" =~ ^src/forbidden/ ]]; then
#   echo "❌ BLOCKED: Cannot write to src/forbidden/" >&2
#   exit 2
# fi
#
# Example: Block by file extension
# if [[ "$FILE_PATH" =~ \.js$ ]]; then
#   echo "❌ BLOCKED: Use .ts instead of .js" >&2
#   exit 2
# fi

echo "✅ [PRE-WRITE] No violations detected - allowing operation" >&2
exit 0
