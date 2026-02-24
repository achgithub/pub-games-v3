# Activity Hub Style Guide

Reference implementation: `games/smoke-test/`

## Philosophy

1. **Shared CSS first** - Use Activity Hub CSS classes from identity-shell
2. **Minimal custom CSS** - Only add app-specific styles when necessary
3. **No inline styles** - Use CSS classes for maintainability
4. **Consistent patterns** - Follow smoke-test as the reference
5. **Visual alignment with lobby** - Apps should feel integrated with the lobby experience

## Key Visual Consistency

All apps now match lobby styling:
- **Header bar**: Full-width white bar with app title (left) and lobby button (right)
- **Background**: `#FAFAFA` (matches lobby)
- **Cards**: 8px border-radius, `#F0F0F0` borders (matches lobby sections)
- **Layout**: Header bar at top, content in centered container below
- **Buttons**: Dark lobby button style matches lobby's logout button

## Loading Shared CSS

Every app must load the shared CSS dynamically in `index.tsx`:

```typescript
// games/{app}/frontend/src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles from identity-shell
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
```

## Base App.css

Every app should have minimal `App.css` with **only app-specific styles**:

```css
/* App-specific utilities */
.full-width {
  width: 100%;
}

/* Counter display (example from smoke-test) */
.counter-display {
  text-align: center;
  margin-bottom: 16px;
}

/* Only add styles specific to your app */
```

**Do NOT include:**
- Body styles (background, font, color) - handled by shared CSS
- Box-sizing reset - handled by shared CSS
- Any styles that could be shared across apps

**Only add:**
- App-specific component styles
- Utility classes needed only for your app
- Game-specific layouts (boards, scores, etc.)

## Available Activity Hub Classes

### Layout

```tsx
// App Header Bar (full-width, at top of page)
<header className="ah-app-header">
  <div className="ah-app-header-left">
    <h1 className="ah-app-title">App Title</h1>
  </div>
  <div className="ah-app-header-right">
    {/* Buttons, controls, etc. */}
  </div>
</header>

// Containers (centered, with padding - goes BELOW header)
<div className="ah-container">           {/* max-width: 900px */}
<div className="ah-container--wide">     {/* max-width: 1200px */}
<div className="ah-container--narrow">   {/* max-width: 600px */}

// Card (white background, rounded, shadow)
<div className="ah-card">
  Content here
</div>
```

### App Header Bar (Standard Pattern)

**All apps should use this header bar pattern** - matches lobby styling:

```tsx
<>
  {/* App Header Bar (full-width, matches lobby) */}
  <header className="ah-app-header">
    <div className="ah-app-header-left">
      <h1 className="ah-app-title">🎮 App Name</h1>
    </div>
    <div className="ah-app-header-right">
      <button
        className="ah-lobby-btn"
        onClick={() => window.location.href = `http://${window.location.hostname}:3001`}
      >
        ← Lobby
      </button>
    </div>
  </header>

  {/* Content in centered container */}
  <div className="ah-container ah-container--narrow">
    <div className="ah-card">
      <p className="ah-meta">Welcome, {userName}!</p>
      {/* App content here */}
    </div>
  </div>
</>
```

**Key points:**
- Header bar is full-width (outside container)
- White background with bottom border
- App title on left, lobby button right-justified
- Content goes in centered `.ah-container` below header
- Apply to all states: normal, loading, error

### Flexbox Utilities

Common flexbox patterns to avoid inline styles:

```tsx
// Basic flex container
<div className="ah-flex">
  <span>Item 1</span>
  <span>Item 2</span>
</div>

// Vertically centered items (common for rows with icons + text)
<div className="ah-flex-center">
  <Icon />
  <span>Text</span>
</div>

// Centered on both axes
<div className="ah-flex-center-justify">
  <span>Centered content</span>
</div>

// Space between (nav bars, headers)
<div className="ah-flex-between">
  <span>Left</span>
  <span>Right</span>
</div>

// Flex with wrapping
<div className="ah-flex-wrap">
  <button>Tag 1</button>
  <button>Tag 2</button>
</div>

// Flex column
<div className="ah-flex-col">
  <div>Row 1</div>
  <div>Row 2</div>
</div>

// Flex column with centered items
<div className="ah-flex-col-center">
  <Icon />
  <p>Text below</p>
</div>
```

**Usage in dynamic rendering** (e.g., game grids):

```tsx
// BEFORE (inline styles - triggers warnings)
<div style={{ display: 'flex', alignItems: 'center' }}>
  {cells}
</div>

// AFTER (shared utility class)
<div className="ah-flex-center">
  {cells}
</div>
```

### Typography

```tsx
<h3 className="ah-section-title">Section Header</h3>
<p className="ah-meta">Secondary text (gray, 14px)</p>
<span className="ah-label">Label text:</span>
```

### Buttons

```tsx
// Primary action
<button className="ah-btn-primary" onClick={handleAction}>
  Action
</button>

// Secondary action
<button className="ah-btn-outline" onClick={handleCancel}>
  Cancel
</button>

// Destructive action
<button className="ah-btn-danger" onClick={handleDelete}>
  Delete
</button>

// Back button
<button className="ah-btn-back" onClick={goBack}>
  ← Back
</button>

// Lobby button (styled like back, but with margin-left: auto)
<button className="ah-lobby-btn" onClick={goToLobby}>
  ← Lobby
</button>
```

### Forms

```tsx
<input
  type="text"
  className="ah-input"
  placeholder="Enter value"
  value={value}
  onChange={e => setValue(e.target.value)}
/>

<select className="ah-select" value={selected} onChange={e => setSelected(e.target.value)}>
  <option value="">Select...</option>
  <option value="a">Option A</option>
</select>
```

### Tabs

```tsx
const [activeTab, setActiveTab] = useState('tab1');

<div className="ah-tabs">
  <button
    className={`ah-tab ${activeTab === 'tab1' ? 'active' : ''}`}
    onClick={() => setActiveTab('tab1')}
  >
    Tab 1
  </button>
  <button
    className={`ah-tab ${activeTab === 'tab2' ? 'active' : ''}`}
    onClick={() => setActiveTab('tab2')}
  >
    Tab 2
  </button>
</div>
```

### Banners

```tsx
<div className="ah-banner ah-banner--error">Error message</div>
<div className="ah-banner ah-banner--success">Success message</div>
<div className="ah-banner ah-banner--warning">Warning message</div>
<div className="ah-banner ah-banner--info">Info message</div>
```

### Tables

```tsx
<div className="ah-table">
  <div className="ah-table-header">
    <div style={{ flex: 2 }}>Name</div>
    <div style={{ flex: 1 }}>Score</div>
    <div style={{ flex: 1 }}>Status</div>
  </div>
  {rows.map(row => (
    <div key={row.id} className="ah-table-row">
      <div style={{ flex: 2 }}>{row.name}</div>
      <div style={{ flex: 1 }}>{row.score}</div>
      <div style={{ flex: 1 }}>{row.status}</div>
    </div>
  ))}
</div>
```

## Common Patterns

### Auth Check

```tsx
if (!userId || !token) {
  return (
    <>
      <header className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">🎮 App Name</h1>
        </div>
      </header>
      <div className="ah-container ah-container--narrow">
        <div className="ah-card">
          <p className="ah-meta">
            Missing authentication. Please access this app through the Activity Hub.
          </p>
          <button
            className="ah-btn-primary"
            onClick={() => window.location.href = `http://${window.location.hostname}:3001`}
          >
            Go to Lobby
          </button>
        </div>
      </div>
    </>
  );
}
```

### Loading State

```tsx
if (loading) {
  return (
    <>
      <header className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">🎮 App Name</h1>
        </div>
      </header>
      <div className="ah-container ah-container--narrow">
        <div className="ah-card">
          <p className="ah-meta">Loading...</p>
        </div>
      </div>
    </>
  );
}
```

## When to Add Custom CSS

Only add custom CSS in `App.css` when:

1. **App-specific components** that don't fit Activity Hub patterns
2. **Utility classes** specific to your app (e.g., `.full-width { width: 100%; }`)
3. **Game-specific visuals** (e.g., game board layouts, score displays)

### Good Example (smoke-test)

```css
/* App-specific utilities */
.full-width {
  width: 100%;
}

/* Counter display - app-specific component */
.counter-display {
  text-align: center;
  margin-bottom: 16px;
}

.counter-value {
  font-size: 48px;
  font-weight: 700;
  color: #2196F3;
  line-height: 1;
  margin-bottom: 8px;
}

/* Activity log - app-specific component */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.activity-item {
  padding: 8px 12px;
  background: #F5F5F5;
  border-radius: 6px;
  font-size: 14px;
}
```

### Bad Examples

```css
/* DON'T redefine things that exist in Activity Hub CSS */
.my-button {
  padding: 10px 20px;
  background: #2196F3;
  color: white;
  /* Just use .ah-btn-primary instead! */
}

/* DON'T use overly specific styles */
.app-header-container-wrapper-inner {
  /* Too specific, use .ah-header instead */
}
```

## Color Palette

Use these colors from the Activity Hub design system:

```css
/* Primary */
--blue-500: #2196F3;  /* Primary buttons, accents */
--blue-600: #1976D2;  /* Primary hover */

/* Neutral */
--background: #FAFAFA;     /* Body background (matches lobby) */
--card-white: #FFFFFF;     /* Card backgrounds */
--border-light: #F0F0F0;   /* Card borders, dividers */
--gray-200: #E0E0E0;       /* Secondary borders */
--gray-400: #999;          /* Secondary text */
--gray-500: #78716C;       /* Meta text */
--gray-600: #666;          /* Body text */
--gray-900: #1C1917;       /* Headings, dark text */
--gray-dark: #333;         /* Hover states */

/* Success */
--green-50: #F0FDF4;
--green-600: #16A34A;
--green-700: #166534;

/* Error */
--red-50: #FEF2F2;
--red-100: #FEE2E2;
--red-600: #DC2626;
--red-700: #991B1B;

/* Warning */
--yellow-50: #FFFBEB;
--yellow-200: #FDE68A;
--yellow-800: #92400E;
```

## Component Structure

Good structure separates content from presentation:

**Bad:**
```tsx
<div style={{ padding: '16px', background: 'white', borderRadius: '8px' }}>
  <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Title</h2>
  <p style={{ color: '#78716C', fontSize: '14px' }}>Description</p>
</div>
```

**Good:**
```tsx
<div className="ah-card">
  <h3 className="ah-section-title">Title</h3>
  <p className="ah-meta">Description</p>
</div>
```

## Responsive Design

Activity Hub CSS includes mobile-friendly breakpoints. Avoid fixed widths:

**Bad:**
```css
.my-container {
  width: 800px; /* Won't work on mobile */
}
```

**Good:**
```css
.my-container {
  max-width: 800px;
  width: 100%;
}

/* Or just use .ah-container */
```

## Testing Consistency

After updating an app's styles:

1. **Compare with smoke-test** - Does it have the same visual feel?
2. **Check mobile** - Resize browser to ~375px width
3. **Test all states** - Loading, error, empty, populated
4. **Verify lobby button** - Should look and behave the same across apps
5. **Check tabs** - Should have same hover/active states

## Migration Checklist

When updating an existing app to follow this guide:

- [ ] Add shared CSS loading in `index.tsx`
- [ ] Add `.ah-app-header` bar at top (outside container)
- [ ] Use `.ah-app-title` for app name in header
- [ ] Add `.ah-lobby-btn` in header right section
- [ ] Wrap content in `.ah-container` (below header)
- [ ] Replace `<div style={{...}}>` with Activity Hub classes
- [ ] Replace custom button styles with `.ah-btn-*` classes
- [ ] Use `.ah-card` for content sections
- [ ] Use `.ah-section-title` for section headers
- [ ] Use `.ah-meta` for secondary text
- [ ] Remove body/box-sizing styles from `App.css` (now in shared CSS)
- [ ] Move any remaining necessary styles to `App.css`
- [ ] Remove unused custom CSS
- [ ] Apply header pattern to all states (normal, auth error, loading)
- [ ] Test on mobile width

## Reference Files

- **Definitive example**: `games/smoke-test/frontend/src/App.tsx`
- **Shared CSS source**: `identity-shell/backend/static/activity-hub.css`
- **Pattern documentation**: This file

## New Activity Hub Classes (2026)

### Game Board Utilities

For grid-based games (tic-tac-toe, dots, etc.):

```tsx
// Basic game board
<div className="ah-game-board ah-game-board--3x3">
  <div className="ah-game-cell">Cell 1</div>
  <div className="ah-game-cell">Cell 2</div>
  <div className="ah-game-cell">Cell 3</div>
  {/* ... more cells */}
</div>

// Board variants
<div className="ah-game-board--3x3">  {/* 3x3 grid */}
<div className="ah-game-board--4x4">  {/* 4x4 grid */}
<div className="ah-game-board--5x5">  {/* 5x5 grid */}
<div className="ah-game-board--6x6">  {/* 6x6 grid */}
<div className="ah-game-board--dots"> {/* Dots game layout */}

// Cell states
<div className="ah-game-cell disabled">  {/* Disabled cell */}
<div className="ah-game-cell active">    {/* Active/selected cell */}
```

**Example** (Tic-Tac-Toe):
```tsx
<div className="ah-game-board ah-game-board--3x3">
  {board.map((cell, i) => (
    <button
      key={i}
      className={`ah-game-cell ${cell ? 'disabled' : ''} ${myTurn ? 'active' : ''}`}
      onClick={() => handleClick(i)}
      disabled={!myTurn || cell}
    >
      {cell}
    </button>
  ))}
</div>
```

### Loading & Animations

```tsx
// Spinners
<div className="ah-spinner"></div>                {/* Default size */}
<div className="ah-spinner ah-spinner--small"></div>  {/* Small */}
<div className="ah-spinner ah-spinner--large"></div>  {/* Large */}

// Loading container (centered)
<div className="ah-loading-container">
  <div className="ah-spinner ah-spinner--large"></div>
  <p className="ah-loading-text">Loading game...</p>
</div>

// Skeleton loaders
<div className="ah-skeleton ah-skeleton--title"></div>
<div className="ah-skeleton ah-skeleton--text"></div>
<div className="ah-skeleton ah-skeleton--circle" style={{ width: 40, height: 40 }}></div>

// Animations
<div className="ah-pulse">Pulsing element</div>
<div className="ah-fade-in">Fades in</div>
<div className="ah-slide-down">Slides down</div>
<div className="ah-box-complete">Box complete (dots game)</div>
```

### Modals & Dialogs

```tsx
{showModal && (
  <div className="ah-modal-overlay" onClick={() => setShowModal(false)}>
    <div className="ah-modal" onClick={(e) => e.stopPropagation()}>
      <div className="ah-modal-header">
        <h3 className="ah-modal-title">Modal Title</h3>
        <span className="ah-modal-close" onClick={() => setShowModal(false)}>×</span>
      </div>
      <div className="ah-modal-body">
        <p>Modal content goes here.</p>
      </div>
      <div className="ah-modal-footer">
        <button className="ah-btn-outline" onClick={() => setShowModal(false)}>
          Cancel
        </button>
        <button className="ah-btn-primary" onClick={handleConfirm}>
          Confirm
        </button>
      </div>
    </div>
  </div>
)}

// Modal sizes
<div className="ah-modal ah-modal--small">   {/* Small modal */}
<div className="ah-modal ah-modal--large">   {/* Large modal */}
```

### Status Indicators

```tsx
// Status badges
<div className="ah-status ah-status--active">Active</div>
<div className="ah-status ah-status--waiting">Waiting</div>
<div className="ah-status ah-status--disabled">Disabled</div>
<div className="ah-status ah-status--eliminated">Eliminated</div>
<div className="ah-status ah-status--complete">Complete</div>
<div className="ah-status ah-status--in-progress">In Progress</div>

// Player indicators (for games)
<div className="ah-player ah-player--current">
  <span>You</span>
  <span>Score: 5</span>
</div>
<div className="ah-player ah-player--opponent">
  <span>Opponent</span>
  <span>Score: 3</span>
</div>
<div className="ah-player ah-player--winner">
  <span>Winner!</span>
</div>

// Status dots
<span className="ah-status-dot ah-status-dot--online"></span>
<span className="ah-status-dot ah-status-dot--offline"></span>
<span className="ah-status-dot ah-status-dot--away"></span>
<span className="ah-status-dot ah-status-dot--busy"></span>
```

## CSS Class Reference (Complete List)

### Layout
- `.ah-container` - Default container (max-width: 1024px)
- `.ah-container--narrow` - Narrow container (max-width: 640px)
- `.ah-container--wide` - Wide container (max-width: 1280px)
- `.ah-app-header` - App header bar (full-width)
- `.ah-app-header-left` - Left section of header
- `.ah-app-header-right` - Right section of header
- `.ah-app-title` - App title in header
- `.ah-header` - Generic header with flex layout
- `.ah-header-title` - Header title text

### Flexbox Utilities
- `.ah-flex` - Basic flex container (`display: flex`)
- `.ah-flex-center` - Flex with vertically centered items (`display: flex; align-items: center`)
- `.ah-flex-center-justify` - Flex with centered items (both axes)
- `.ah-flex-between` - Flex with space-between justification
- `.ah-flex-wrap` - Flex with flex-wrap enabled
- `.ah-flex-col` - Flex column layout
- `.ah-flex-col-center` - Flex column with centered items
- `.ah-flex-col-center-justify` - Flex column with centered items (both axes)

### Cards & Sections
- `.ah-card` - Card component with shadow and border
- `.ah-section-title` - Section title text (uppercase, small)

### Buttons
- `.ah-btn-primary` - Primary action button (blue gradient)
- `.ah-btn-outline` - Secondary outline button
- `.ah-btn-danger` - Destructive action button (red)
- `.ah-btn-back` - Back/cancel button
- `.ah-lobby-btn` - Lobby button (in header)

### Forms
- `.ah-input` - Text input field
- `.ah-select` - Select dropdown
- `.ah-label` - Form label text
- `.ah-meta` - Helper/meta text (gray, 14px)

### Banners
- `.ah-banner` - Banner base
- `.ah-banner--error` - Error banner (red)
- `.ah-banner--warning` - Warning banner (amber)
- `.ah-banner--success` - Success banner (green)
- `.ah-banner--info` - Info banner (blue)

### Tabs
- `.ah-tabs` - Tab container
- `.ah-tab` - Individual tab
- `.ah-tab.active` - Active tab state

### Tables
- `.ah-table` - Table container
- `.ah-table-header` - Table header row
- `.ah-table-row` - Table data row

### Game Elements
- `.ah-game-board` - Game board base (grid)
- `.ah-game-board--3x3` - 3x3 grid
- `.ah-game-board--4x4` - 4x4 grid
- `.ah-game-board--5x5` - 5x5 grid
- `.ah-game-board--6x6` - 6x6 grid
- `.ah-game-board--dots` - Dots game grid
- `.ah-game-cell` - Game cell/tile
- `.ah-game-cell.disabled` - Disabled cell
- `.ah-game-cell.active` - Active/selected cell

### Loading
- `.ah-spinner` - Loading spinner (default)
- `.ah-spinner--small` - Small spinner
- `.ah-spinner--large` - Large spinner
- `.ah-loading-container` - Centered loading container
- `.ah-loading-text` - Loading text
- `.ah-skeleton` - Skeleton loader base
- `.ah-skeleton--text` - Text skeleton
- `.ah-skeleton--title` - Title skeleton
- `.ah-skeleton--circle` - Circle skeleton

### Modals
- `.ah-modal-overlay` - Modal backdrop
- `.ah-modal` - Modal container (default size)
- `.ah-modal--small` - Small modal
- `.ah-modal--large` - Large modal
- `.ah-modal-header` - Modal header section
- `.ah-modal-title` - Modal title
- `.ah-modal-close` - Close button (×)
- `.ah-modal-body` - Modal content section
- `.ah-modal-footer` - Modal action buttons section

### Status
- `.ah-status` - Status badge base
- `.ah-status--active` - Active status (green)
- `.ah-status--waiting` - Waiting status (amber)
- `.ah-status--disabled` - Disabled status (gray)
- `.ah-status--eliminated` - Eliminated status (red)
- `.ah-status--complete` - Complete status (blue)
- `.ah-status--in-progress` - In progress status (blue)
- `.ah-player` - Player indicator base
- `.ah-player--current` - Current player
- `.ah-player--opponent` - Opponent player
- `.ah-player--winner` - Winner indicator
- `.ah-player--loser` - Loser indicator
- `.ah-status-dot` - Status dot indicator
- `.ah-status-dot--online` - Online (green)
- `.ah-status-dot--offline` - Offline (gray)
- `.ah-status-dot--away` - Away (amber)
- `.ah-status-dot--busy` - Busy (red)

### Animations
- `.ah-pulse` - Pulse animation (0.5s)
- `.ah-box-complete` - Box complete animation (0.3s)
- `.ah-fade-in` - Fade in animation (0.2s)
- `.ah-slide-down` - Slide down animation (0.3s)

## Enforcement

As of 2026, Activity Hub has automated enforcement mechanisms:

1. **ESLint Plugin** - Warns about hardcoded colors and suggests Activity Hub classes
2. **Pre-commit Hooks** - Blocks commits missing shared CSS loading
3. **App Template Generator** - New apps automatically follow standards

To enable enforcement in your app:

```bash
# Install ESLint plugin
cd games/{app}/frontend
npm install --save-dev file:../../../lib/eslint-plugin-activity-hub

# Add to .eslintrc.js
{
  "extends": ["react-app", "plugin:activity-hub/recommended"]
}

# Run linter
npm run lint
```

## Questions?

When in doubt, check smoke-test. If smoke-test doesn't have the pattern you need, consider:
1. Can an existing Activity Hub class be used differently?
2. Should this be added to Activity Hub CSS for all apps?
3. Or is this truly app-specific and belongs in App.css?

See also:
- **Migration guide**: `docs/MIGRATION-TO-ACTIVITY-HUB-CSS.md`
- **Reference app**: `games/smoke-test/`
- **CSS source**: `lib/activity-hub-common/styles/activity-hub-src.css`
