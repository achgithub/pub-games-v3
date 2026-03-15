#!/bin/bash
# SessionStart Hook: Runs when Claude Code session starts
# Output (stdout) gets injected into Claude's context
# stderr goes to logs only

echo "🚀 [SESSION-START] Enforcement system loading..." >&2

# ============================================================
# INJECT ENFORCEMENT RULES INTO CONTEXT
# ============================================================

# Detect platform
IS_MAC=false
if [[ "$(uname)" == "Darwin" ]]; then
  IS_MAC=true
fi

# Output to Claude's context (stdout):
cat <<'EOF'

## 🛡️ Enforcement System Active

**Permission Logging:** All tool uses logged to `.claude/logs/permissions.log`
- Review periodically: `tail -f .claude/logs/permissions.log`
- Learning mode: Starts permissive, add deny rules over time

**Active Blocking Rules:**
EOF

# Platform-specific rules
if $IS_MAC; then
  cat <<'EOF'
- ❌ **git push** blocked on Mac (user pushes manually)

**Mac/Pi Workflow:**
1. Write code on Mac (this machine)
2. Commit locally (Claude does this)
3. User pushes manually
4. Pull on Pi and build/test there
EOF
fi

cat <<'EOF'

**Add Custom Rules:**
- Edit `.claude/hooks/permission-request.sh` for conditional logic
- Or add to `.claude/settings.json` permissions.deny for simple blocks

**Hook files:** `.claude/hooks/*.sh`
EOF
