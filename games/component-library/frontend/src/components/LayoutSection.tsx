import React from 'react';

interface Props {
  token: string;
}

function LayoutSection({ token }: Props) {
  return (
    <>
      <div className="ah-card">
        <h2>Layout & Structure</h2>
        <p className="ah-meta">
          Container and flexbox utilities for page layout and content organization.
        </p>
      </div>

      {/* Containers */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Container</span>
            <code className="component-class">.ah-container</code>
          </div>
          <p className="component-purpose">
            Main content container with responsive max-width and padding
          </p>
          <div className="component-preview">
            <div className="ah-container" style={{ background: '#e3f2fd', padding: '20px' }}>
              Default container (max-width: 1200px)
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-container">
  Content here
</div>`}</code></pre>
          </div>
          <div className="component-variants">
            <h4 className="component-variants-title">Variants:</h4>
            <div className="variant-item">
              <div className="variant-label">.ah-container--narrow</div>
              <div className="ah-container--narrow" style={{ background: '#e8f5e9', padding: '15px' }}>
                Narrow container (max-width: 800px)
              </div>
            </div>
            <div className="variant-item">
              <div className="variant-label">.ah-container--wide</div>
              <div className="ah-container--wide" style={{ background: '#fff3e0', padding: '15px' }}>
                Wide container (max-width: 1400px)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flexbox Utilities */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Flex Center</span>
            <code className="component-class">.ah-flex.ah-flex-center</code>
          </div>
          <p className="component-purpose">
            Flexbox utility for centering content vertically
          </p>
          <div className="component-preview">
            <div className="ah-flex ah-flex-center" style={{ background: '#f3e5f5', padding: '20px', minHeight: '100px' }}>
              <div>Centered vertically</div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-flex ah-flex-center">
  <div>Centered content</div>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Flex Between</span>
            <code className="component-class">.ah-flex.ah-flex-between</code>
          </div>
          <p className="component-purpose">
            Flexbox utility for space-between layout
          </p>
          <div className="component-preview">
            <div className="ah-flex ah-flex-between" style={{ background: '#e0f2f1', padding: '20px' }}>
              <div>Left content</div>
              <div>Right content</div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-flex ah-flex-between">
  <div>Left</div>
  <div>Right</div>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Flex Column</span>
            <code className="component-class">.ah-flex.ah-flex-col</code>
          </div>
          <p className="component-purpose">
            Flexbox column layout with optional centering
          </p>
          <div className="component-preview">
            <div className="ah-flex ah-flex-col ah-flex-center" style={{ background: '#fce4ec', padding: '20px', minHeight: '150px' }}>
              <div>Item 1</div>
              <div>Item 2</div>
              <div>Item 3</div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-flex ah-flex-col ah-flex-center">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default LayoutSection;
