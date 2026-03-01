import React, { useState } from 'react';

interface Props {
  token: string;
}

function NavigationSection({ token }: Props) {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <>
      <div className="ah-card">
        <h2>Navigation</h2>
        <p className="ah-meta">
          Tabs, headers, and navigation components.
        </p>
      </div>

      {/* Tabs */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Tabs</span>
            <code className="component-class">.ah-tabs</code>
          </div>
          <p className="component-purpose">
            Tabbed navigation with active state
          </p>
          <div className="component-preview">
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
              <button
                className={`ah-tab ${activeTab === 'tab3' ? 'active' : ''}`}
                onClick={() => setActiveTab('tab3')}
              >
                Tab 3
              </button>
            </div>
            <div className="ah-card" style={{ marginTop: '20px' }}>
              <p>Content for {activeTab}</p>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-tabs">
  <button className="ah-tab active">Tab 1</button>
  <button className="ah-tab">Tab 2</button>
  <button className="ah-tab">Tab 3</button>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* App Header */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">App Header</span>
            <code className="component-class">.ah-app-header</code>
          </div>
          <p className="component-purpose">
            Sticky header bar for app pages
          </p>
          <div className="component-preview">
            <header className="ah-app-header">
              <div className="ah-app-header-left">
                <h1 className="ah-app-title">🎮 App Name</h1>
              </div>
              <div className="ah-app-header-right">
                <button className="ah-btn-primary">Action</button>
              </div>
            </header>
          </div>
          <div className="component-code">
            <pre><code>{`<header className="ah-app-header">
  <div className="ah-app-header-left">
    <h1 className="ah-app-title">🎮 App Name</h1>
  </div>
  <div className="ah-app-header-right">
    <button className="ah-btn-primary">Action</button>
  </div>
</header>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Header</span>
            <code className="component-class">.ah-header</code>
          </div>
          <p className="component-purpose">
            Section header with title and optional actions
          </p>
          <div className="component-preview">
            <div className="ah-header">
              <h2 className="ah-header-title">Section Title</h2>
              <button className="ah-btn-outline">Action</button>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-header">
  <h2 className="ah-header-title">Section Title</h2>
  <button className="ah-btn-outline">Action</button>
</div>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default NavigationSection;
