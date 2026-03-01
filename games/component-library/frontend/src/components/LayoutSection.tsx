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
            <div className="ah-container">
              <div className="ah-card">
                Default container (max-width: 1200px)
              </div>
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
              <div className="ah-container--narrow">
                <div className="ah-card">
                  Narrow container (max-width: 800px)
                </div>
              </div>
            </div>
            <div className="variant-item">
              <div className="variant-label">.ah-container--wide</div>
              <div className="ah-container--wide">
                <div className="ah-card">
                  Wide container (max-width: 1400px)
                </div>
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
            <div className="ah-card">
              <div className="ah-flex ah-flex-center">
                <div>Centered vertically</div>
              </div>
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
            <div className="ah-card">
              <div className="ah-flex ah-flex-between">
                <div>Left content</div>
                <div>Right content</div>
              </div>
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
            <div className="ah-card">
              <div className="ah-flex ah-flex-col ah-flex-center">
                <div>Item 1</div>
                <div>Item 2</div>
                <div>Item 3</div>
              </div>
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
