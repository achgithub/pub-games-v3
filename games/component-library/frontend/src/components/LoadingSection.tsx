import React from 'react';

interface Props {
  token: string;
}

function LoadingSection({ token }: Props) {
  return (
    <>
      <div className="ah-card">
        <h2>Loading States</h2>
        <p className="ah-meta">
          Spinners, skeletons, and loading animations.
        </p>
      </div>

      {/* Spinners */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Spinner</span>
            <code className="component-class">.ah-spinner</code>
          </div>
          <p className="component-purpose">
            Loading spinner with size variants
          </p>
          <div className="component-preview">
            <div className="ah-flex ah-flex-center">
              <div className="ah-flex ah-flex-col ah-flex-center">
                <div className="ah-spinner ah-spinner--small"></div>
                <p className="ah-meta">Small</p>
              </div>
              <div className="ah-flex ah-flex-col ah-flex-center">
                <div className="ah-spinner"></div>
                <p className="ah-meta">Default</p>
              </div>
              <div className="ah-flex ah-flex-col ah-flex-center">
                <div className="ah-spinner ah-spinner--large"></div>
                <p className="ah-meta">Large</p>
              </div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-spinner ah-spinner--small"></div>
<div className="ah-spinner"></div>
<div className="ah-spinner ah-spinner--large"></div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Loading Container */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Loading Container</span>
            <code className="component-class">.ah-loading-container</code>
          </div>
          <p className="component-purpose">
            Centered loading state with spinner and text
          </p>
          <div className="component-preview">
            <div className="ah-loading-container">
              <div className="ah-spinner"></div>
              <p className="ah-loading-text">Loading data...</p>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-loading-container">
  <div className="ah-spinner"></div>
  <p className="ah-loading-text">Loading...</p>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Skeletons */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Skeleton Loaders</span>
            <code className="component-class">.ah-skeleton</code>
          </div>
          <p className="component-purpose">
            Placeholder elements for loading content
          </p>
          <div className="component-preview">
            <div className="ah-flex ah-flex-col">
              <div className="ah-skeleton ah-skeleton--title"></div>
              <div className="ah-skeleton ah-skeleton--text"></div>
              <div className="ah-skeleton ah-skeleton--text"></div>
              <div className="ah-flex ah-flex-center">
                <div className="ah-skeleton ah-skeleton--circle"></div>
                <div className="ah-skeleton ah-skeleton--text"></div>
              </div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-skeleton ah-skeleton--title"></div>
<div className="ah-skeleton ah-skeleton--text"></div>
<div className="ah-skeleton ah-skeleton--circle"></div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Animations */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Animations</span>
          </div>
          <p className="component-purpose">
            Utility animation classes for transitions
          </p>
          <div className="component-preview">
            <div className="ah-flex ah-flex-col">
              <div className="ah-card ah-pulse">
                <p>.ah-pulse - Pulsing animation</p>
              </div>
              <div className="ah-card ah-fade-in">
                <p>.ah-fade-in - Fade in animation</p>
              </div>
              <div className="ah-card ah-slide-down">
                <p>.ah-slide-down - Slide down animation</p>
              </div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-pulse">Pulsing element</div>
<div className="ah-fade-in">Fading in element</div>
<div className="ah-slide-down">Sliding down element</div>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoadingSection;
