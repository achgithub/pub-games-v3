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

## Questions?

When in doubt, check smoke-test. If smoke-test doesn't have the pattern you need, consider:
1. Can an existing Activity Hub class be used differently?
2. Should this be added to Activity Hub CSS for all apps?
3. Or is this truly app-specific and belongs in App.css?
