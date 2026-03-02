# Activity Hub Shared CSS

**Single source of truth for all Activity Hub styling.**

All apps load this CSS dynamically from identity-shell at `http://{host}:3001/shared/activity-hub.css`.

## Source Files

- **`activity-hub-src.css`** - Source CSS with Tailwind directives
- **Build output** → `../../identity-shell/backend/static/activity-hub.css`

## Build Process

```bash
cd lib/activity-hub-common/styles
npm run build
```

This compiles the source with Tailwind CSS and outputs to `identity-shell/backend/static/activity-hub.css`.

## Development Workflow

1. **Mac**: Edit `activity-hub-src.css` → commit → push
2. **Pi**: Pull → build CSS
3. **Mac**: SCP built file back → commit → push
4. **Pi**: Discard local changes → pull committed version

See `docs/DEPLOYMENT.md` for detailed workflow.

## Recent Updates (2026-03-02)

### New Utility Classes
- `.ah-player-grid` - Player/item selection grid (auto-fill, max-height 300px)
- `.ah-player-grid-item` - Individual grid item with hover state
- `.ah-filter-box` - Light container for search/filter UI

### Enhancements
- `.ah-tabs` - Added `overflow-x: auto` for horizontal scrolling
- `.ah-tab` - Added `flex-shrink: 0` and `white-space: nowrap` to prevent wrapping
- `.ah-header` - Added `justify-between` for right-aligned buttons
- `.ah-list-item` - Already has `justify-between` built-in (confirmed)

## Key Classes by Category

### Layout
- `.ah-container`, `.ah-container--narrow`, `.ah-container--wide`
- `.ah-flex`, `.ah-flex-col`, `.ah-flex-center`, `.ah-flex-between`
- `.ah-grid-auto` - Auto-fill grid

### Cards & Sections
- `.ah-card` - Basic white card with border/shadow
- `.ah-section` - Collapsible section wrapper
- `.ah-section-header` - Clickable header (has `justify-between`)
- `.ah-section-title` - Section title text
- `.ah-section-toggle` - Toggle arrow (rotates when collapsed)
- `.ah-section-content` - Collapsible content wrapper

### Buttons
- `.ah-btn-primary`, `.ah-btn-outline`, `.ah-btn-danger`
- `.ah-btn-back`, `.ah-btn-danger-sm`
- `.ah-lobby-btn`

### Forms
- `.ah-input`, `.ah-select`, `.ah-label`
- `.ah-inline-form` - Horizontal form layout

### Navigation
- `.ah-tabs` - Tab container (scrollable)
- `.ah-tab` - Individual tab
- `.ah-tab.active` - Active tab state

### Data Display
- `.ah-table`, `.ah-table-header`, `.ah-table-row`
- `.ah-list`, `.ah-list-item` (has `justify-between`)
- `.ah-player-grid`, `.ah-player-grid-item`

### Status & Feedback
- `.ah-banner`, `.ah-banner--info`, `.ah-banner--error`, `.ah-banner--success`
- `.ah-status`, `.ah-status--active`, `.ah-status--waiting`, `.ah-status--complete`
- `.ah-player-active`, `.ah-player-eliminated`

### App Structure
- `.ah-app-header` - Sticky header bar
- `.ah-app-header-left`, `.ah-app-header-right`
- `.ah-app-title`
- `.ah-header` - Section header (has `justify-between`)
- `.ah-header-title`

### Game Components
- `.ah-game-board` - Game board grid
- `.ah-game-cell` - Individual cell

### Patterns
- `.ah-filter-box` - Search/filter container
- `.ah-detail-header` - Detail view header pattern

## Usage Guidelines

### DO
- ✅ Use only Activity Hub classes (`.ah-*`)
- ✅ Check Component Library first
- ✅ Add new patterns to shared CSS when needed
- ✅ Document new classes in this README

### DON'T
- ❌ Create app-specific CSS files
- ❌ Use excessive inline styles
- ❌ Hardcode colors (use CSS classes)
- ❌ Import CSS in TypeScript files

## Reference

**Component Library** (port 5010) provides live examples of all classes with copy-paste code snippets.

**CSS Source**: Check `activity-hub-src.css` for implementation details and Tailwind configuration.
