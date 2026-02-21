# Activity Hub Style Guide

Reference implementation: `games/smoke-test/`

## Philosophy

1. **Shared CSS first** - Use Activity Hub CSS classes from identity-shell
2. **Minimal custom CSS** - Only add app-specific styles when necessary
3. **No inline styles** - Use CSS classes for maintainability
4. **Consistent patterns** - Follow smoke-test as the reference

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

Every app should have minimal base CSS in `App.css`:

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: #F5F5F4;
  color: #1C1917;
}

* {
  box-sizing: border-box;
}

/* Add app-specific styles below */
```

## Available Activity Hub Classes

### Layout

```tsx
// Containers (centered, with padding)
<div className="ah-container">           {/* max-width: 900px */}
<div className="ah-container--wide">     {/* max-width: 1200px */}
<div className="ah-container--narrow">   {/* max-width: 600px */}

// Card (white background, rounded, shadow)
<div className="ah-card">
  Content here
</div>
```

### Header

```tsx
<div className="ah-card">
  <div className="ah-header">
    <h2 className="ah-header-title">🎮 App Name</h2>
    <button className="ah-lobby-btn" onClick={goToLobby}>
      ← Lobby
    </button>
  </div>
  <p className="ah-meta">Welcome, {userName}!</p>
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
    <div className="ah-container ah-container--narrow">
      <div className="ah-card">
        <h2 className="ah-header-title">🎮 App Name</h2>
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
  );
}
```

### Loading State

```tsx
if (loading) {
  return (
    <div className="ah-container ah-container--narrow">
      <div className="ah-card">
        <p className="ah-meta">Loading...</p>
      </div>
    </div>
  );
}
```

### App Header with Lobby Button

```tsx
<div className="ah-card">
  <div className="ah-header">
    <h2 className="ah-header-title">🎮 App Name</h2>
    <button
      className="ah-lobby-btn"
      onClick={() => window.location.href = `http://${window.location.hostname}:3001`}
    >
      ← Lobby
    </button>
  </div>
  <p className="ah-meta">Descriptive subtitle or welcome message</p>
</div>
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

/* Counter display */
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
--blue-500: #2196F3;
--blue-600: #1976D2;

/* Neutral */
--stone-50: #FAFAF9;
--stone-100: #F5F5F4;
--stone-200: #E7E5E4;
--stone-300: #D6D3D1;
--stone-400: #A8A29E;
--stone-500: #78716C;
--stone-900: #1C1917;

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
- [ ] Replace `<div style={{...}}>` with Activity Hub classes
- [ ] Use `.ah-header` and `.ah-header-title` for app headers
- [ ] Replace custom button styles with `.ah-btn-*` classes
- [ ] Use `.ah-card` for content sections
- [ ] Use `.ah-section-title` for section headers
- [ ] Use `.ah-meta` for secondary text
- [ ] Move any remaining necessary styles to `App.css`
- [ ] Remove unused custom CSS
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
