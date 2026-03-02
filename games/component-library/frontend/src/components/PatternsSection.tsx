import React, { useState } from 'react';

interface Props {
  token: string;
}

function PatternsSection({ token }: Props) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [sectionWithButton, setSectionWithButton] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <>
      <div className="ah-card">
        <h2>Common Patterns</h2>
        <p className="ah-meta">
          Reusable patterns and component combinations used across apps.
        </p>
      </div>

      {/* Collapsible Section - Basic */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Collapsible Section - Basic</span>
            <code className="component-class">.ah-section</code>
          </div>
          <p className="component-purpose">
            Expandable/collapsible content section with toggle arrow on RIGHT side
          </p>

          {/* Best Practices Banner */}
          <div className="ah-banner ah-banner--info" style={{ marginBottom: '1rem' }}>
            <strong>✅ Best Practice:</strong> Arrow must be a <strong>separate element</strong> on the <strong>right side</strong>.
            Uses <code>.ah-section-header</code> with <code>justify-between</code> to position title left and arrow right.
          </div>

          <div className="component-preview">
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => setSectionOpen(!sectionOpen)}>
                <h3 className="ah-section-title">Section Title</h3>
                <span className={`ah-section-toggle ${!sectionOpen ? 'collapsed' : ''}`}>▼</span>
              </div>
              {sectionOpen && (
                <div className="ah-section-content">
                  <p className="ah-meta">
                    This is collapsible content. Click anywhere on the header to
                    expand or collapse this section. The triangle rotates 90° when collapsed.
                  </p>
                  <div className="ah-inline-form">
                    <input type="text" className="ah-input" placeholder="Add item..." />
                    <button className="ah-btn-primary">Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-card ah-section">
  <div className="ah-section-header"
       onClick={() => setOpen(!open)}>
    <h3 className="ah-section-title">Title</h3>
    <span className={\`ah-section-toggle \${!open ? 'collapsed' : ''}\`}>
      ▼
    </span>
  </div>
  {open && (
    <div className="ah-section-content">
      Content here
    </div>
  )}
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Collapsible Section with Action Button */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Collapsible Section - With Action Button</span>
          </div>
          <p className="component-purpose">
            Collapsible section with action button in header (e.g., "Add Players", "Next Round")
          </p>

          <div className="component-preview">
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => setSectionWithButton(!sectionWithButton)}>
                <h3 className="ah-section-title">Participants (3)</h3>
                <div className="ah-flex-center" style={{ gap: '0.5rem' }}>
                  {!sectionWithButton && (
                    <button
                      className="ah-btn-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddForm(!showAddForm);
                      }}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                      {showAddForm ? 'Cancel' : '+ Add Player'}
                    </button>
                  )}
                  <span className={`ah-section-toggle ${!sectionWithButton ? 'collapsed' : ''}`}>▼</span>
                </div>
              </div>
              {sectionWithButton && (
                <div className="ah-section-content">
                  {showAddForm && (
                    <div className="ah-banner ah-banner--info" style={{ marginBottom: '1rem' }}>
                      Add player form would appear here
                    </div>
                  )}
                  <ul className="ah-list">
                    <li className="ah-list-item">
                      <span>Alice</span>
                      <button className="ah-btn-danger-sm">Remove</button>
                    </li>
                    <li className="ah-list-item">
                      <span>Bob</span>
                      <button className="ah-btn-danger-sm">Remove</button>
                    </li>
                    <li className="ah-list-item">
                      <span>Charlie</span>
                      <button className="ah-btn-danger-sm">Remove</button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-section-header" onClick={toggleSection}>
  <h3 className="ah-section-title">Participants (3)</h3>
  <div className="ah-flex-center" style={{ gap: '0.5rem' }}>
    {!collapsed && (
      <button
        className="ah-btn-outline"
        onClick={(e) => {
          e.stopPropagation(); // Prevent section toggle
          handleAction();
        }}
      >
        + Add Player
      </button>
    )}
    <span className={\`ah-section-toggle \${collapsed ? 'collapsed' : ''}\`}>
      ▼
    </span>
  </div>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Anti-Pattern Warning */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">❌ Anti-Pattern: Arrow Inside Title</span>
          </div>
          <p className="component-purpose">
            <strong style={{ color: '#DC2626' }}>DO NOT DO THIS</strong> - Arrow embedded in title text (wrong!)
          </p>

          <div className="ah-banner ah-banner--error" style={{ marginBottom: '1rem' }}>
            <strong>Why this is wrong:</strong>
            <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
              <li>Arrow appears on LEFT side instead of RIGHT</li>
              <li>Breaks visual consistency across apps</li>
              <li>Doesn't use proper <code>.ah-section-toggle</code> class</li>
              <li>Rotation logic mixed into title instead of separate element</li>
            </ul>
          </div>

          <div className="component-preview" style={{ opacity: 0.6 }}>
            <div className="ah-card ah-section">
              <div className="ah-section-header">
                <h3 className="ah-section-title">
                  {sectionOpen ? '▼' : '▶'} Section Title (WRONG!)
                </h3>
              </div>
            </div>
          </div>
          <div className="component-code">
            <pre style={{ background: '#FEE2E2', borderColor: '#DC2626' }}><code>{`❌ WRONG - Don't do this:
<h3 className="ah-section-title">
  {collapsed ? '▶' : '▼'} Title
</h3>

✅ CORRECT - Do this:
<h3 className="ah-section-title">Title</h3>
<span className={\`ah-section-toggle \${collapsed ? 'collapsed' : ''}\`}>
  ▼
</span>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Detail Header Pattern */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Detail View Header</span>
          </div>
          <p className="component-purpose">
            Common pattern for detail pages with back button and metadata
          </p>
          <div className="component-preview">
            <div className="ah-card">
              <button className="ah-btn-back">← Back</button>
              <div className="ah-detail-header">
                <h2>Game Name</h2>
                <p className="ah-meta">Created: 2026-03-01 | Status: Active</p>
              </div>
              <div className="ah-flex ah-flex-between">
                <button className="ah-btn-primary">Start Game</button>
                <button className="ah-btn-danger">Delete</button>
              </div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-card">
  <button className="ah-btn-back">← Back</button>
  <div className="ah-detail-header">
    <h2>Title</h2>
    <p className="ah-meta">Metadata</p>
  </div>
  <div className="ah-flex ah-flex-between">
    <button className="ah-btn-primary">Action</button>
    <button className="ah-btn-danger">Delete</button>
  </div>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Form + Button Pattern */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Form Card Pattern</span>
          </div>
          <p className="component-purpose">
            Common pattern for forms in cards with submit button
          </p>
          <div className="component-preview">
            <div className="ah-card">
              <h3 className="ah-section-title">Create New Item</h3>
              <form onSubmit={(e) => e.preventDefault()}>
                <label className="ah-label">
                  Name
                  <input type="text" className="ah-input" placeholder="Enter name" />
                </label>
                <label className="ah-label">
                  Category
                  <select className="ah-select">
                    <option>Option 1</option>
                    <option>Option 2</option>
                  </select>
                </label>
                <button type="submit" className="ah-btn-primary full-width">
                  Create
                </button>
              </form>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-card">
  <h3 className="ah-section-title">Form Title</h3>
  <form>
    <label className="ah-label">
      Field
      <input className="ah-input" />
    </label>
    <button className="ah-btn-primary full-width">
      Submit
    </button>
  </form>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Empty State Pattern */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Empty State Pattern</span>
          </div>
          <p className="component-purpose">
            Pattern for showing empty states with call to action
          </p>
          <div className="component-preview">
            <div className="ah-card">
              <div className="ah-flex ah-flex-col ah-flex-center">
                <h1>📭</h1>
                <h3>No Items Yet</h3>
                <p className="ah-meta">
                  Get started by creating your first item.
                </p>
                <button className="ah-btn-primary">Create First Item</button>
              </div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-card">
  <div className="ah-flex ah-flex-col ah-flex-center">
    <h1>📭</h1>
    <h3>No Items Yet</h3>
    <p className="ah-meta">Message here</p>
    <button className="ah-btn-primary">
      Create First Item
    </button>
  </div>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* List with Actions Pattern */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">List with Actions</span>
          </div>
          <p className="component-purpose">
            Common pattern for lists with inline actions
          </p>
          <div className="component-preview">
            <div className="ah-card">
              <h3 className="ah-section-title">Players</h3>
              <ul className="ah-list">
                {['Alice', 'Bob', 'Charlie'].map((name, i) => (
                  <li key={i} className="ah-list-item">
                    <div className="ah-flex ah-flex-between">
                      <span>{name}</span>
                      <button className="ah-btn-danger-sm">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-card">
  <h3 className="ah-section-title">Title</h3>
  <ul className="ah-list">
    <li className="ah-list-item">
      <div className="ah-flex ah-flex-between">
        <span>Item name</span>
        <button className="ah-btn-danger-sm">
          Remove
        </button>
      </div>
    </li>
  </ul>
</div>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default PatternsSection;
