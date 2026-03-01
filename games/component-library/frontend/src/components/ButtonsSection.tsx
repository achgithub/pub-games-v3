import React from 'react';

interface Props {
  token: string;
}

function ButtonsSection({ token }: Props) {
  return (
    <>
      <div className="ah-card">
        <h2>Buttons</h2>
        <p className="ah-meta">
          All button variants used throughout Activity Hub applications.
        </p>
      </div>

      <div className="component-grid">
        {/* Primary Button */}
        <div className="grid-item">
          <div className="component-header">
            <span className="component-name">Primary Button</span>
          </div>
          <code className="component-class">.ah-btn-primary</code>
          <div className="component-preview">
            <button className="ah-btn-primary">Primary Action</button>
            <br /><br />
            <button className="ah-btn-primary" disabled>Disabled</button>
          </div>
          <div className="component-code">
            <pre><code>{`<button className="ah-btn-primary">
  Primary Action
</button>`}</code></pre>
          </div>
        </div>

        {/* Outline Button */}
        <div className="grid-item">
          <div className="component-header">
            <span className="component-name">Outline Button</span>
          </div>
          <code className="component-class">.ah-btn-outline</code>
          <div className="component-preview">
            <button className="ah-btn-outline">Secondary Action</button>
            <br /><br />
            <button className="ah-btn-outline" disabled>Disabled</button>
          </div>
          <div className="component-code">
            <pre><code>{`<button className="ah-btn-outline">
  Secondary Action
</button>`}</code></pre>
          </div>
        </div>

        {/* Danger Button */}
        <div className="grid-item">
          <div className="component-header">
            <span className="component-name">Danger Button</span>
          </div>
          <code className="component-class">.ah-btn-danger</code>
          <div className="component-preview">
            <button className="ah-btn-danger">Delete</button>
            <br /><br />
            <button className="ah-btn-danger" disabled>Disabled</button>
          </div>
          <div className="component-code">
            <pre><code>{`<button className="ah-btn-danger">
  Delete
</button>`}</code></pre>
          </div>
        </div>

        {/* Small Danger Button */}
        <div className="grid-item">
          <div className="component-header">
            <span className="component-name">Small Danger Button</span>
          </div>
          <code className="component-class">.ah-btn-danger-sm</code>
          <div className="component-preview">
            <button className="ah-btn-danger-sm">Remove</button>
          </div>
          <div className="component-code">
            <pre><code>{`<button className="ah-btn-danger-sm">
  Remove
</button>`}</code></pre>
          </div>
        </div>

        {/* Back Button */}
        <div className="grid-item">
          <div className="component-header">
            <span className="component-name">Back Button</span>
          </div>
          <code className="component-class">.ah-btn-back</code>
          <div className="component-preview">
            <button className="ah-btn-back">← Back</button>
          </div>
          <div className="component-code">
            <pre><code>{`<button className="ah-btn-back">
  ← Back
</button>`}</code></pre>
          </div>
        </div>

        {/* Lobby Button */}
        <div className="grid-item">
          <div className="component-header">
            <span className="component-name">Lobby Button</span>
          </div>
          <code className="component-class">.ah-lobby-btn</code>
          <div className="component-preview">
            <button className="ah-lobby-btn">← Lobby</button>
          </div>
          <div className="component-code">
            <pre><code>{`<button className="ah-lobby-btn">
  ← Lobby
</button>`}</code></pre>
          </div>
          <p className="component-purpose" style={{ marginTop: '10px' }}>
            Used in app headers to return to main lobby
          </p>
        </div>
      </div>
    </>
  );
}

export default ButtonsSection;
