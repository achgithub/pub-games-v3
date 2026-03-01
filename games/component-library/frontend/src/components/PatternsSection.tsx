import React, { useState } from 'react';

interface Props {
  token: string;
}

function PatternsSection({ token }: Props) {
  const [sectionOpen, setSectionOpen] = useState(true);

  return (
    <>
      <div className="ah-card">
        <h2>Common Patterns</h2>
        <p className="ah-meta">
          Reusable patterns and component combinations used across apps.
        </p>
      </div>

      {/* Collapsible Section */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Collapsible Section</span>
            <code className="component-class">.ah-section</code>
          </div>
          <p className="component-purpose">
            Expandable/collapsible content section with toggle
          </p>
          <div className="component-preview">
            <div className="ah-section">
              <div className="ah-section-header" onClick={() => setSectionOpen(!sectionOpen)}>
                <h3 className="ah-section-title">Section Title</h3>
                <span className={`ah-section-toggle ${!sectionOpen ? 'collapsed' : ''}`}>▼</span>
              </div>
              {sectionOpen && (
                <div className="ah-section-content">
                  <p>
                    This is collapsible content. Click anywhere on the header to
                    expand or collapse this section. The triangle rotates when collapsed.
                  </p>
                  <button className="ah-btn-primary">Action Button</button>
                </div>
              )}
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-section">
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
