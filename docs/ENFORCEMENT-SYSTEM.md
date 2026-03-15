# Claude Code Enforcement System

## Overview

A two-phase system for preventing standards violations in Claude Code conversations:

**Phase 1: Template Setup** - Install hook infrastructure that proves it works
**Phase 2: Add Rules** - Incrementally add project-specific validation logic

**Source Repository**: `~/Documents/Projects/claude-code-enforcement/`

This is a **standalone project** (separate Git repo) providing enforcement tools for ANY project, not just pub-games-v3.

## Why This Approach?

**Problem**: Documentation alone doesn't prevent violations as conversations grow or context compacts. Claude may forget/ignore standards mid-chat.

**Solution**: Systemic enforcement via hooks that persist across conversations and survive context growth.

## Phase 1: Bootstrap (Universal Template)

### What It Does

Installs Claude Code hooks that:
- ✅ Run BEFORE code is written (can block violations)
- ✅ Run AFTER code is written (can validate/undo)
- ✅ Run when Claude tries to stop (final checks)
- ✅ Run at session start (re-inject rules)
- ✅ Persist across conversations (not in context)
- ✅ Start as templates (just log, no enforcement yet)

### Installation

**In pub-games-v3 (or any project):**

```bash
# From project root
cd ~/Documents/Projects/pub-games-v3

# Run bootstrap script from standalone repo
~/Documents/Projects/claude-code-enforcement/bootstrap-enforcement.sh
```

**Or add to PATH for convenience:**

```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$HOME/Documents/Projects/claude-code-enforcement:$PATH"

# Then from any project:
cd ~/Documents/Projects/your-project
bootstrap-enforcement.sh
```

This creates:
```
.claude/
├── settings.json              # Hook configuration
├── hooks/
│   ├── pre-write.sh          # Runs BEFORE Write/Edit (template)
│   ├── post-write.sh         # Runs AFTER Write/Edit (template)
│   ├── pre-stop.sh           # Runs when Claude stops (template)
│   └── session-start.sh      # Runs at session start (template)
└── README.md                  # Hook documentation
```

### Testing Phase 1

After running bootstrap:

1. **Restart Claude Code** (required to load new settings)
2. **Try editing a file** - you'll see hook messages like:
   ```
   🔍 [PRE-WRITE] Claude wants to Edit: path/to/file.tsx
   ✅ [PRE-WRITE] No violations detected - allowing operation
   📝 [POST-WRITE] Claude completed Edit: path/to/file.tsx
   ✅ [POST-WRITE] Validation passed
   ```
3. **Verify hooks are working** - if you see messages, Phase 1 is complete!

**Success criteria**: Hook messages appear in Claude Code interface when files are edited.

---

## Phase 2: Add Project-Specific Rules

Once hooks are working, add enforcement logic incrementally.

### Example: Block Forbidden Files

Edit `.claude/hooks/pre-write.sh`:

```bash
#!/bin/bash
TOOL_NAME="$1"
FILE_PATH="$2"

echo "🔍 [PRE-WRITE] Claude wants to $TOOL_NAME: $FILE_PATH" >&2

# Block CSS files in src/ (except *-board.css)
if [[ "$FILE_PATH" =~ src/.*\.css$ ]] && [[ ! "$FILE_PATH" =~ -board\.css$ ]]; then
  echo "❌ BLOCKED: No CSS files in src/. Use shared styles." >&2
  exit 2
fi

# Block .js files (must be .tsx)
if [[ "$FILE_PATH" =~ src/.*\.jsx?$ ]]; then
  echo "❌ BLOCKED: Use .tsx, not .js/.jsx" >&2
  exit 2
fi

echo "✅ [PRE-WRITE] No violations detected - allowing operation" >&2
exit 0
```

### Example: Validate Before Stopping

Edit `.claude/hooks/pre-stop.sh`:

```bash
#!/bin/bash
echo "🛑 [PRE-STOP] Running final validation..." >&2

# Check if git repo is clean
if ! git diff --quiet 2>/dev/null; then
  echo "⚠️  WARNING: Uncommitted changes exist" >&2
fi

# Run linter (example)
if command -v eslint &> /dev/null; then
  if ! eslint src/ --quiet 2>/dev/null; then
    echo "❌ BLOCKED: ESLint errors found. Fix before stopping." >&2
    exit 2
  fi
fi

echo "✅ [PRE-STOP] Validation passed - allowing stop" >&2
exit 0
```

### Example: Inject Critical Rules at Session Start

Edit `.claude/hooks/session-start.sh`:

```bash
#!/bin/bash
echo "🚀 [SESSION-START] Loading project standards..." >&2

# Output goes into Claude's context
cat <<'EOF'

⚠️ CRITICAL PROJECT STANDARDS (Enforced by Hooks):

1. NO CSS FILES in src/ (except *-board.css)
   - Use shared Activity Hub classes (.ah-*)
   - Reference: Component Library (port 5010)

2. NO .js/.jsx FILES in src/
   - Must use TypeScript: .tsx

3. BUILD WORKFLOW:
   - Mac: Write code + commit ONLY
   - Pi: Build + test (user does this, not Claude)

These rules are ENFORCED. Violations will be blocked.
EOF
```

---

## Hook Types Reference

### PreToolUse Hook (`pre-write.sh`)

**When**: BEFORE Claude executes Write/Edit tool

**Use for**:
- Blocking forbidden file types
- Checking file paths/names
- Preventing violations before code is written

**Exit codes**:
- `0` = Allow operation
- `2` = Block operation (Claude gets feedback)

**Example**: Block creation of `App.css`

### PostToolUse Hook (`post-write.sh`)

**When**: AFTER Claude executes Write/Edit tool (file already written)

**Use for**:
- Validating file content
- Running linters/formatters
- Undoing bad writes

**Exit codes**:
- `0` = Keep the write
- `2` = Undo the write

**Example**: Validate no inline styles in .tsx files

### Stop Hook (`pre-stop.sh`)

**When**: Claude tries to stop/complete the conversation

**Use for**:
- Final validation before finishing
- Running tests
- Checking for uncommitted changes

**Exit codes**:
- `0` = Allow stopping
- `2` = Block stopping (Claude continues)

**Example**: Ensure all tests pass before stopping

### SessionStart Hook (`session-start.sh`)

**When**: Conversation starts (or after context compaction)

**Use for**:
- Re-injecting critical rules into context
- Environment checks
- Displaying reminders

**Output**: stdout goes into Claude's context, stderr to logs

**Example**: Display critical standards at session start

---

## Pub-Games-v3 Specific Rules (Phase 2)

### Standards to Enforce

1. **CSS Architecture**:
   - ❌ No `App.css`, `index.css`, `styles.css` in `games/*/frontend/src/`
   - ✅ Only `*-board.css` allowed (game rendering only)
   - ✅ Must use Activity Hub classes (`.ah-*`)

2. **TypeScript**:
   - ❌ No `.js` or `.jsx` in `games/*/frontend/src/`
   - ✅ Must use `.tsx`

3. **Build Workflow**:
   - ❌ No `npm build`, `npm install`, `go build` on Mac
   - ✅ Mac = code + commit only
   - ✅ Pi = build + test

4. **SQL Migrations**:
   - ❌ No `localhost` in URLs
   - ✅ Use `{host}` placeholder

5. **Shared CSS Loading**:
   - ✅ `index.tsx` must load Activity Hub CSS from identity-shell:3001

### Implementation Plan

**PreToolUse (`pre-write.sh`)**:
- Block CSS files (except `*-board.css`)
- Block `.js/.jsx` files
- Check SQL files for `localhost`

**PostToolUse (`post-write.sh`)**:
- Warn on excessive inline styles
- Check for CSS imports in `.tsx` files

**Stop (`pre-stop.sh`)**:
- Run git pre-commit hooks (validate before committing)
- Check for common violations

**SessionStart (`session-start.sh`)**:
- Display Mac/Pi workflow reminder
- List forbidden patterns
- Reference Component Library

---

## Testing Strategy

### Phase 1 Testing (Template)

✅ Verify hooks fire by editing any file
✅ Confirm messages appear in Claude Code
✅ Test that hooks don't block anything yet

### Phase 2 Testing (With Rules)

**Test blocking works**:
1. Ask Claude to create `App.css` → should be blocked
2. Ask Claude to create `App.js` → should be blocked
3. Watch Claude adjust approach after block

**Test validation works**:
1. Ask Claude to edit file with violations
2. Hook blocks it
3. Claude fixes and tries again
4. Hook allows it

**Test Stop hook**:
1. Complete a task
2. Stop hook runs final checks
3. If violations exist → blocked, Claude continues
4. If clean → allowed, conversation ends

---

## Benefits

### For Solo Developer

- ✅ **Catches violations before code is written** (saves time/money)
- ✅ **Persists across conversations** (doesn't degrade with context)
- ✅ **Enforces consistency** (Claude can't deviate without being blocked)
- ✅ **Incremental** (start simple, add rules as needed)
- ✅ **Reusable** (bootstrap any new project)

### For Future Team

- ✅ **Same standards for everyone** (commit hooks to repo)
- ✅ **Self-documenting** (rules are code, not just docs)
- ✅ **Automatic** (no manual enforcement needed)

---

## FAQ

**Q: Do hooks run on Pi?**
A: No. Hooks run where Claude Code runs (Mac). Pi doesn't have Claude Code.

**Q: Can I disable hooks temporarily?**
A: Yes. Rename `.claude/settings.json` to `.claude/settings.json.disabled`

**Q: What if I need to violate a rule?**
A: Edit the hook script to allow the exception, or disable hooks temporarily.

**Q: Do hooks work in other projects?**
A: Each project needs its own `.claude/` directory. Run `bootstrap-enforcement.sh` in each project.

**Q: Are hooks committed to Git?**
A: Your choice. Commit them to share with team, or add `.claude/` to `.gitignore` for personal use.

**Q: What if hook blocks something incorrectly?**
A: Edit `.claude/hooks/pre-write.sh` to fix the rule logic.

---

## Next Steps

### For Pub-Games-v3 (Now)

1. ✅ Run `./scripts/bootstrap-enforcement.sh`
2. ✅ Restart Claude Code
3. ✅ Test that hooks fire (Phase 1 complete)
4. 🔲 Add pub-games-v3 rules to hooks (Phase 2)
5. 🔲 Test with real violations

### For Future Projects

1. Navigate to new project: `cd ~/Documents/Projects/your-new-project`
2. Run bootstrap: `~/Documents/Projects/claude-code-enforcement/bootstrap-enforcement.sh`
3. Add project-specific rules incrementally
4. Done!

---

## References

- **Enforcement System Repo**: `~/Documents/Projects/claude-code-enforcement/`
  - Comprehensive README with examples
  - Detailed usage guide: `docs/USAGE.md`
  - Example rules: `examples/` directory
- Official Claude Code Hooks Docs: https://docs.anthropic.com/claude-code/hooks
- Pub-Games-v3 Standards: `CLAUDE.md` and `docs/` directory
- Component Library: Port 5010 (living style guide)
