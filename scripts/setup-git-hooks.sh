#!/bin/bash

# Script: setup-git-hooks.sh
# Sets up Git hooks for Activity Hub development

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"
SOURCE_HOOKS_DIR="$ROOT_DIR/.githooks"

echo "Setting up Activity Hub Git hooks..."

# Check if .git directory exists
if [ ! -d "$ROOT_DIR/.git" ]; then
    echo "Error: Not in a Git repository"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Copy pre-commit hook
if [ -f "$SOURCE_HOOKS_DIR/pre-commit" ]; then
    cp "$SOURCE_HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
    chmod +x "$HOOKS_DIR/pre-commit"
    echo "✅ Installed pre-commit hook"
else
    echo "Error: pre-commit hook not found at $SOURCE_HOOKS_DIR/pre-commit"
    exit 1
fi

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "The pre-commit hook will now check for:"
echo "  - Activity Hub CSS loading in index.tsx files"
echo "  - Hardcoded colors (warnings)"
echo "  - Excessive inline styles (warnings)"
echo "  - .js/.jsx files in frontend/src (should be .ts/.tsx)"
echo ""
echo "To bypass hooks temporarily (not recommended):"
echo "  git commit --no-verify"
echo ""
