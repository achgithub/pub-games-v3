# Claude Code Enforcement System

Installed by: claude-code-enforcement/bootstrap-enforcement.sh
Installation date: $(date +%Y-%m-%d)

## What This Is

Hooks that run during Claude Code sessions to enforce project standards.

## Hooks Installed

### 1. PreToolUse Hook (`pre-write.sh`)
- **When**: BEFORE Claude writes/edits files
- **Purpose**: Block non-compliant operations before they happen
- **Exit 2**: Blocks the write, Claude gets feedback
- **Exit 0**: Allows the write

### 2. PostToolUse Hook (`post-write.sh`)
- **When**: AFTER Claude writes/edits files
- **Purpose**: Validate written files, can undo if needed
- **Exit 2**: Undoes the write
- **Exit 0**: Keeps the write

### 3. Stop Hook (`pre-stop.sh`)
- **When**: When Claude tries to stop/complete
- **Purpose**: Final validation before finishing
- **Exit 2**: Prevents stopping, Claude continues
- **Exit 0**: Allows stopping

### 4. SessionStart Hook (`session-start.sh`)
- **When**: At start of conversation
- **Purpose**: Initialize environment, inject critical rules
- **Output**: Goes into Claude's context

## Quick Start

1. **Restart Claude Code** (required to load hooks)
2. **Test**: Edit a file - you'll see hook messages
3. **Customize**: Add rules to `.claude/hooks/*.sh`

## Adding Rules

Edit hook scripts to add project-specific validation:

```bash
# Example in pre-write.sh:
if [[ "$FILE_PATH" =~ \.css$ ]]; then
  echo "❌ BLOCKED: No CSS files" >&2
  exit 2
fi
```

## Testing Hooks

Test hooks manually:
```bash
bash .claude/hooks/pre-write.sh Write path/to/file.txt
echo $?  # 0 = allowed, 2 = blocked
```

## Debugging

- Hook output appears in Claude Code interface
- Check `~/.claude/logs/` for detailed logs
- Add `echo` statements to hooks for debugging

## Disable Temporarily

Rename `settings.json`:
```bash
mv .claude/settings.json .claude/settings.json.disabled
```

Restart Claude Code to take effect.

## Documentation

Full documentation: https://github.com/YOUR-USERNAME/claude-code-enforcement
