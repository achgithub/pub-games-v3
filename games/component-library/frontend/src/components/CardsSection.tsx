import React from 'react';

interface Props {
  token: string;
}

function CardsSection({ token }: Props) {
  return (
    <>
      <div className="ah-card">
        <h2>Cards & Banners</h2>
        <p className="ah-meta">
          Content surfaces and notification banners.
        </p>
      </div>

      {/* Card */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Card</span>
            <code className="component-class">.ah-card</code>
          </div>
          <p className="component-purpose">
            Standard content card with padding and border radius
          </p>
          <div className="component-preview">
            <div className="ah-card">
              <h3 className="ah-section-title">Card Title</h3>
              <p>
                This is a card component. It's used to group related content
                and provide visual separation.
              </p>
              <button className="ah-btn-primary">Action</button>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-card">
  <h3 className="ah-section-title">Card Title</h3>
  <p>Card content goes here.</p>
  <button className="ah-btn-primary">Action</button>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Banners */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Banners</span>
            <code className="component-class">.ah-banner</code>
          </div>
          <p className="component-purpose">
            Notification banners with different severity levels
          </p>
          <div className="component-preview">
            <div className="ah-banner ah-banner--info">
              <strong>Info:</strong> This is an informational message.
            </div>
            <br />
            <div className="ah-banner ah-banner--success">
              <strong>Success:</strong> Operation completed successfully!
            </div>
            <br />
            <div className="ah-banner ah-banner--warning">
              <strong>Warning:</strong> Please review this before proceeding.
            </div>
            <br />
            <div className="ah-banner ah-banner--error">
              <strong>Error:</strong> Something went wrong. Please try again.
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-banner ah-banner--info">
  <strong>Info:</strong> Message here
</div>

<div className="ah-banner ah-banner--success">
  <strong>Success:</strong> Message here
</div>

<div className="ah-banner ah-banner--warning">
  <strong>Warning:</strong> Message here
</div>

<div className="ah-banner ah-banner--error">
  <strong>Error:</strong> Message here
</div>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default CardsSection;
