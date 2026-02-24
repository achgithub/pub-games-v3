# Migration Guide: Activity Hub CSS

This guide explains how to migrate existing apps to use the shared Activity Hub CSS system.

## Why Migrate?

- **Consistency**: All apps will have a unified look and feel
- **Maintainability**: Update styles once, apply everywhere
- **Reduced code**: Less custom CSS per app (~50-70% reduction)
- **Standards enforcement**: Automated tooling prevents drift

## Migration Checklist

For each app, follow these steps:

### 1. Add Dynamic CSS Loading

**File**: `games/{app}/frontend/src/index.tsx`

**Add this code** before rendering:

```typescript
// Inject shared Activity Hub styles from identity-shell
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);
```

**Complete example**:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
```

### 2. Replace Inline Styles with Activity Hub Classes

**Common patterns to replace**:

#### Containers

**Before**:
```typescript
<div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
```

**After**:
```typescript
<div className="ah-container ah-container--narrow">
```

Options:
- `.ah-container` - Default (max-width: 1024px)
- `.ah-container--narrow` - Narrow (max-width: 640px)
- `.ah-container--wide` - Wide (max-width: 1280px)

#### Buttons

**Before**:
```typescript
<button style={{
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  padding: '12px 30px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer'
}}>
  Click Me
</button>
```

**After**:
```typescript
<button className="ah-btn-primary">
  Click Me
</button>
```

Button classes:
- `.ah-btn-primary` - Primary action (blue gradient)
- `.ah-btn-outline` - Secondary action (outlined)
- `.ah-btn-danger` - Destructive action (red)
- `.ah-btn-back` - Back/cancel button

#### Cards

**Before**:
```typescript
<div style={{
  background: 'white',
  padding: 16,
  borderRadius: 12,
  border: '1px solid #e7e5e4',
  marginBottom: 12
}}>
```

**After**:
```typescript
<div className="ah-card">
```

#### Modals

**Before**:
```typescript
<div style={{
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}>
  <div style={{
    background: 'white',
    borderRadius: 12,
    padding: 24,
    maxWidth: 400
  }}>
    <h3>Title</h3>
    <p>Content</p>
    <button>OK</button>
  </div>
</div>
```

**After**:
```typescript
<div className="ah-modal-overlay">
  <div className="ah-modal">
    <div className="ah-modal-header">
      <h3 className="ah-modal-title">Title</h3>
    </div>
    <div className="ah-modal-body">
      <p>Content</p>
    </div>
    <div className="ah-modal-footer">
      <button className="ah-btn-primary">OK</button>
    </div>
  </div>
</div>
```

#### Status Indicators

**Before**:
```typescript
<div style={{
  padding: '8px 16px',
  borderRadius: 999,
  background: '#d4edda',
  color: '#155724',
  fontSize: 14
}}>
  Active
</div>
```

**After**:
```typescript
<div className="ah-status ah-status--active">
  Active
</div>
```

Status variants:
- `.ah-status--active` - Green (active/success)
- `.ah-status--waiting` - Amber (pending)
- `.ah-status--disabled` - Gray (inactive)
- `.ah-status--eliminated` - Red (error/eliminated)

#### Banners

**Before**:
```typescript
<div style={{
  background: '#f8d7da',
  color: '#721c24',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid #f5c6cb'
}}>
  Error message
</div>
```

**After**:
```typescript
<div className="ah-banner ah-banner--error">
  Error message
</div>
```

Banner variants:
- `.ah-banner--error` - Red
- `.ah-banner--warning` - Amber
- `.ah-banner--success` - Green
- `.ah-banner--info` - Blue

### 3. Update Custom CSS Files

**File**: `games/{app}/frontend/src/App.css` (or `styles/*.css`)

**Keep**:
- Game-specific styling (board layouts, custom animations, unique components)

**Remove**:
- Button styles (now `.ah-btn-*`)
- Container/padding styles (now `.ah-container`)
- Modal styles (now `.ah-modal-*`)
- Banner/alert styles (now `.ah-banner-*`)
- Generic typography (now `.ah-meta`, `.ah-label`)

**Example cleanup**:

Before (200+ lines):
```css
.my-app-container { padding: 40px; max-width: 600px; margin: 0 auto; }
.my-app-button { background: #2196F3; color: white; padding: 12px 24px; ... }
.my-app-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); ... }
.my-app-card { background: white; padding: 16px; border-radius: 12px; ... }
/* 150 more lines of generic UI styles */

/* Game-specific board styling */
.my-game-board { display: grid; grid-template-columns: repeat(3, 1fr); ... }
.my-game-cell { width: 100px; height: 100px; ... }
```

After (~50 lines):
```css
/* App-specific styles only */
/* Common UI now uses Activity Hub classes (.ah-*) */

/* Game-specific board styling */
.my-game-board { display: grid; grid-template-columns: repeat(3, 1fr); ... }
.my-game-cell { width: 100px; height: 100px; ... }
```

### 4. Test After Migration

1. **Build the frontend**:
   ```bash
   cd games/{app}/frontend
   npm run build
   cp -r build/* ../backend/static/
   ```

2. **Run ESLint** (check for violations):
   ```bash
   npm run lint
   ```

3. **Visual check**:
   - Launch app on Pi
   - Verify all buttons, modals, cards render correctly
   - Check responsiveness on mobile
   - Test all interactive elements

4. **Functionality check**:
   - Ensure no functionality broken
   - Test all user flows
   - Verify game-specific features work

## Common Pitfalls

### ❌ Pitfall 1: Not loading CSS dynamically

**Problem**: CSS loaded via `import` instead of dynamic injection

**Symptom**: App not styled or missing Activity Hub classes

**Fix**: Add dynamic CSS loading to `index.tsx` (Step 1 above)

### ❌ Pitfall 2: Mixing inline styles with classes

**Problem**: Adding Activity Hub class but keeping inline styles

**Bad**:
```typescript
<button className="ah-btn-primary" style={{ background: '#FF0000' }}>
  Click
</button>
```

**Good**:
```typescript
<button className="ah-btn-primary">
  Click
</button>
```

Or if custom styling needed:
```typescript
<button className="ah-btn-primary custom-special-button">
  Click
</button>
```

### ❌ Pitfall 3: Removing game-specific styles

**Problem**: Deleting CSS that defines unique game mechanics

**Keep these**:
- Board layouts (`.game-board`, `.game-cell`)
- Game-specific animations
- Custom visualizations (lines, markers, etc.)
- Responsive rules for game elements

**Remove these**:
- Generic button styles
- Container/layout styles
- Modal overlays
- Alert/banner styles

### ❌ Pitfall 4: Hardcoded colors

**Problem**: Using hex colors in code instead of Activity Hub classes

**Bad**:
```typescript
<div style={{ color: '#2196F3' }}>Text</div>
```

**Good**:
```typescript
<span className="ah-meta">Text</span>
```

Or use CSS custom properties:
```css
.my-custom-element {
  color: var(--brand-500);
}
```

## Complete Migration Example

### Before: Old App

**index.tsx**:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
```

**App.tsx**:
```typescript
function App() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
      <h2>My Game</h2>
      <button
        style={{
          background: '#2196F3',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer'
        }}
        onClick={() => setShowModal(true)}
      >
        Start Game
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12 }}>
            <h3>Ready?</h3>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**App.css** (200 lines of generic styles)

### After: Migrated App

**index.tsx**:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
```

**App.tsx**:
```typescript
function App() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="ah-container ah-container--narrow">
      <h2>My Game</h2>
      <button
        className="ah-btn-primary"
        onClick={() => setShowModal(true)}
      >
        Start Game
      </button>

      {showModal && (
        <div className="ah-modal-overlay">
          <div className="ah-modal ah-modal--small">
            <div className="ah-modal-header">
              <h3 className="ah-modal-title">Ready?</h3>
            </div>
            <div className="ah-modal-footer">
              <button className="ah-btn-primary" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**App.css** (~20 lines - game-specific only)

## Activity Hub Class Reference

### Layout
- `.ah-container` - Main container (default width)
- `.ah-container--narrow` - Narrow container
- `.ah-container--wide` - Wide container

### Cards & Sections
- `.ah-card` - Card component with shadow
- `.ah-header` - Header with flex layout
- `.ah-header-title` - Header title text

### Buttons
- `.ah-btn-primary` - Primary action button
- `.ah-btn-outline` - Secondary outline button
- `.ah-btn-danger` - Destructive action button
- `.ah-btn-back` - Back/cancel button

### Forms
- `.ah-input` - Text input field
- `.ah-select` - Select dropdown
- `.ah-label` - Form label text
- `.ah-meta` - Helper/meta text

### Status & Feedback
- `.ah-banner` - Banner base
  - `.ah-banner--error` - Error banner
  - `.ah-banner--warning` - Warning banner
  - `.ah-banner--success` - Success banner
  - `.ah-banner--info` - Info banner
- `.ah-status` - Status badge base
  - `.ah-status--active` - Active status
  - `.ah-status--waiting` - Waiting status
  - `.ah-status--disabled` - Disabled status
  - `.ah-status--eliminated` - Eliminated status

### Modals
- `.ah-modal-overlay` - Modal backdrop
- `.ah-modal` - Modal container
  - `.ah-modal--small` - Small modal
  - `.ah-modal--large` - Large modal
- `.ah-modal-header` - Modal header
- `.ah-modal-title` - Modal title
- `.ah-modal-body` - Modal content
- `.ah-modal-footer` - Modal actions
- `.ah-modal-close` - Close button (×)

### Tables
- `.ah-table` - Table container
- `.ah-table-header` - Table header row
- `.ah-table-row` - Table data row

### Tabs
- `.ah-tabs` - Tab container
- `.ah-tab` - Individual tab
- `.ah-tab.active` - Active tab

### Game Elements
- `.ah-game-board` - Game board base
  - `.ah-game-board--3x3` - 3x3 grid
  - `.ah-game-board--4x4` - 4x4 grid
  - `.ah-game-board--dots` - Dots game grid
- `.ah-game-cell` - Game cell/tile
  - `.ah-game-cell.disabled` - Disabled cell
  - `.ah-game-cell.active` - Active/selected cell

### Loading
- `.ah-spinner` - Loading spinner
  - `.ah-spinner--small` - Small spinner
  - `.ah-spinner--large` - Large spinner
- `.ah-loading-container` - Centered loading container
- `.ah-loading-text` - Loading text
- `.ah-skeleton` - Skeleton loader
  - `.ah-skeleton--text` - Text skeleton
  - `.ah-skeleton--title` - Title skeleton

### Animations
- `.ah-pulse` - Pulse animation
- `.ah-box-complete` - Box complete animation (dots game)
- `.ah-fade-in` - Fade in animation
- `.ah-slide-down` - Slide down animation

## Getting Help

- Check `games/smoke-test/` for reference implementation
- Check `games/tic-tac-toe/` for migration example
- See `docs/STYLE-GUIDE.md` for comprehensive class documentation
- Run `npm run lint` to check for violations

## Benefits After Migration

✅ **90% reduction** in custom CSS
✅ **Consistent** visual design across all apps
✅ **Faster development** - no custom styles needed
✅ **Automatic updates** - change CSS once, apply everywhere
✅ **Enforced standards** - pre-commit hooks prevent drift
✅ **Better maintainability** - single source of truth
