# Activity Hub Component Library

**Living style guide and reference for all Activity Hub CSS components.**

This is an admin-only development tool that showcases all Activity Hub CSS classes with live examples, code snippets, and interactive demos.

## Purpose

- **Reference**: Complete catalog of all Activity Hub components
- **Documentation**: Live examples with copy-paste code snippets
- **Testing**: Interactive demo to verify DB/Redis/SSE integration
- **Development**: Single source of truth for component usage

## Features

### Interactive Demo Tab
- Global counter (Redis)
- Activity log (PostgreSQL)
- Real-time updates (SSE)
- Demonstrates full Activity Hub stack

### Component Showcase Tabs
1. **Layout & Structure** - Containers, flexbox utilities
2. **Buttons** - All button variants with states
3. **Forms** - Inputs, selects, labels, inline forms
4. **Navigation** - Tabs, app headers, section headers
5. **Cards & Banners** - Content surfaces and notifications
6. **Data Display** - Tables, lists, grids, detail headers
7. **Status & Feedback** - Status indicators, badges, player states
8. **Loading States** - Spinners, skeletons, animations
9. **Modals** - Modal dialogs with size variants
10. **Game Components** - Game boards (3×3, 4×4, 5×5, 6×6)
11. **Common Patterns** - Reusable component combinations

## Access

- **Port**: 5010
- **Role Required**: Admin only
- **URL**: `http://192.168.1.29:5010/?userId=X&userName=Admin&token=XXX`

Only users with the `admin` role can access this app.

## Tech Stack

### Backend (Go)
- Go with `activity-hub-common` library
- PostgreSQL: `component_library_db` (interaction logs)
- Redis: Counter storage + pub/sub for SSE
- SSE: Real-time updates for interactive demo
- Auth: Admin-only middleware via `authlib.RequireRole("admin")`

### Frontend (React + TypeScript)
- React 18 with TypeScript
- Dynamic CSS loading from identity-shell (shared pattern)
- Tabbed interface for component organization
- Live, interactive component examples

## Database Setup

```bash
# On Pi
psql -h localhost -p 5555 -U activityhub -d activityhub

CREATE DATABASE component_library_db;
\c component_library_db

\i games/component-library/database/schema.sql
```

## Build & Deploy

### Frontend Build (on Pi)
```bash
cd ~/pub-games-v3/games/component-library/frontend
npm install
npm run build
cp -r build/* ../backend/static/
```

### Run Backend (on Pi)
```bash
cd ~/pub-games-v3/games/component-library/backend
go run *.go
```

The backend will listen on port 5010.

## Development Workflow

1. **Mac**: Edit source files, commit to Git
2. **User**: Push changes manually
3. **Pi**: Pull, build frontend, run backend
4. **Test**: Access via identity-shell with admin account

## Component Display Format

Each component section shows:
- **Component Name** and CSS class
- **Purpose** description
- **Live Preview** with interactive example
- **Code Snippet** for copy-paste
- **Variants** (if applicable)

## Usage as Reference

When building new apps:

1. Open Component Library
2. Find the component you need
3. Copy the code snippet
4. Paste into your app
5. Modify as needed

## Replaces Smoke-Test

This app replaces `games/smoke-test/` with enhanced functionality:
- ✅ All smoke-test features (interactive demo tab)
- ✅ Complete CSS component catalog
- ✅ Admin-only access (more appropriate for dev tool)
- ✅ Better organized with tabs
- ✅ Code examples for every component

After verification, smoke-test can be removed.

## Files Structure

```
games/component-library/
├── backend/
│   ├── main.go              # Entry point with admin middleware
│   ├── handlers.go          # API endpoints
│   ├── redis.go             # Redis connection
│   └── static/              # React build output
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.tsx        # Entry + dynamic CSS loading
│   │   ├── App.tsx          # Main component with tabs
│   │   ├── App.css          # App-specific styles
│   │   └── components/
│   │       ├── InteractiveDemo.tsx
│   │       ├── LayoutSection.tsx
│   │       ├── ButtonsSection.tsx
│   │       ├── FormsSection.tsx
│   │       ├── NavigationSection.tsx
│   │       ├── CardsSection.tsx
│   │       ├── DataDisplaySection.tsx
│   │       ├── StatusSection.tsx
│   │       ├── LoadingSection.tsx
│   │       ├── ModalsSection.tsx
│   │       ├── GameComponentsSection.tsx
│   │       └── PatternsSection.tsx
│   ├── package.json
│   └── tsconfig.json
└── database/
    └── schema.sql           # Database schema
```

## Testing Checklist

### Backend
- [ ] Database connection established
- [ ] Redis connection established
- [ ] Admin-only middleware blocks non-admin users
- [ ] Counter increments in Redis
- [ ] Activity logs to PostgreSQL
- [ ] SSE broadcasts counter updates

### Frontend
- [ ] Dynamic CSS loads from identity-shell
- [ ] All 12 tabs render correctly
- [ ] Interactive demo works (counter, activity, SSE)
- [ ] All component examples visible
- [ ] Code snippets display properly
- [ ] CSS class names shown for each component
- [ ] No inline styles (uses .ah-* classes)

### Integration
- [ ] Auth token required
- [ ] Admin role enforced
- [ ] Real-time updates work
- [ ] All Activity Hub classes render correctly
- [ ] Responsive on different screen sizes

## Future Enhancements

- Search/filter for specific components
- One-click code copy to clipboard
- Theme toggle (preview light/dark modes)
- Export functionality for code examples
- Live CSS playground/editor

## Notes

- This is a development tool, not a user-facing app
- Requires admin role for access
- Uses same patterns as all Activity Hub apps
- Serves as reference implementation
- Keep updated as new CSS classes are added

---

**Port**: 5010
**Database**: component_library_db
**Role**: admin
**Purpose**: Developer reference and style guide
