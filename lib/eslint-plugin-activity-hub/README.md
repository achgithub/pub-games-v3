# ESLint Plugin - Activity Hub

Enforces Activity Hub styling standards across all apps.

## Installation

In your app's frontend directory:

```bash
npm install --save-dev file:../../../lib/eslint-plugin-activity-hub
```

## Configuration

Add to `.eslintrc.js`:

```javascript
module.exports = {
  extends: [
    'react-app',
    'plugin:activity-hub/recommended',
  ],
  plugins: ['activity-hub'],
};
```

Or configure rules individually:

```javascript
module.exports = {
  plugins: ['activity-hub'],
  rules: {
    'activity-hub/require-shared-css': 'error',
    'activity-hub/no-hardcoded-colors': 'warn',
    'activity-hub/prefer-ah-classes': 'warn',
  },
};
```

## Rules

### `require-shared-css` (error)

Ensures `index.tsx` files dynamically load Activity Hub CSS from identity-shell.

**Bad:**
```typescript
// Missing CSS loading
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
```

**Good:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);
```

### `no-hardcoded-colors` (warning)

Discourages hardcoded hex/rgb colors in favor of Activity Hub classes.

**Bad:**
```typescript
<button style={{ background: '#2196F3', color: '#fff' }}>
  Click me
</button>
```

**Good:**
```typescript
<button className="ah-btn-primary">
  Click me
</button>
```

### `prefer-ah-classes` (warning)

Detects common inline style patterns and suggests Activity Hub classes.

**Bad:**
```typescript
<div style={{ padding: 40, background: '#fff', borderRadius: 8 }}>
  Content
</div>
```

**Good:**
```typescript
<div className="ah-card">
  Content
</div>
```

## Running Linter

```bash
npm run lint
```

## Auto-fix

Some violations can be auto-fixed:

```bash
npm run lint -- --fix
```

Note: Most style-related issues require manual refactoring to use Activity Hub classes.
