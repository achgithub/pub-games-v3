import React from 'react';

interface Props {
  token: string;
}

function StatusSection({ token }: Props) {
  return (
    <>
      <div className="ah-card">
        <h2>Status & Feedback</h2>
        <p className="ah-meta">
          Status indicators, badges, and feedback components.
        </p>
      </div>

      {/* Status Indicators */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Status Indicators</span>
            <code className="component-class">.ah-status</code>
          </div>
          <p className="component-purpose">
            Status pills for different states
          </p>
          <div className="component-preview">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span className="ah-status ah-status--active">Active</span>
              <span className="ah-status ah-status--waiting">Waiting</span>
              <span className="ah-status ah-status--disabled">Disabled</span>
              <span className="ah-status ah-status--eliminated">Eliminated</span>
              <span className="ah-status ah-status--complete">Complete</span>
              <span className="ah-status ah-status--in-progress">In Progress</span>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<span className="ah-status ah-status--active">Active</span>
<span className="ah-status ah-status--waiting">Waiting</span>
<span className="ah-status ah-status--disabled">Disabled</span>
<span className="ah-status ah-status--eliminated">Eliminated</span>
<span className="ah-status ah-status--complete">Complete</span>
<span className="ah-status ah-status--in-progress">In Progress</span>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Badges</span>
            <code className="component-class">.ah-badge</code>
          </div>
          <p className="component-purpose">
            Small labels for counts, notifications, and categories
          </p>
          <div className="component-preview">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span className="ah-badge ah-badge--success">Success</span>
              <span className="ah-badge ah-badge--error">Error</span>
              <span className="ah-badge ah-badge--warning">Warning</span>
              <span className="ah-badge ah-badge--info">Info</span>
              <span className="ah-badge ah-badge--neutral">Neutral</span>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<span className="ah-badge ah-badge--success">Success</span>
<span className="ah-badge ah-badge--error">Error</span>
<span className="ah-badge ah-badge--warning">Warning</span>
<span className="ah-badge ah-badge--info">Info</span>
<span className="ah-badge ah-badge--neutral">Neutral</span>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Player Indicators */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Player Indicators</span>
            <code className="component-class">.ah-player</code>
          </div>
          <p className="component-purpose">
            Player status indicators for games
          </p>
          <div className="component-preview">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="ah-player ah-player--current">Current Player (You)</div>
              <div className="ah-player ah-player--opponent">Opponent</div>
              <div className="ah-player ah-player--winner">Winner</div>
              <div className="ah-player ah-player--loser">Loser</div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-player ah-player--current">You</div>
<div className="ah-player ah-player--opponent">Opponent</div>
<div className="ah-player ah-player--winner">Winner</div>
<div className="ah-player ah-player--loser">Loser</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Status Dots */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Status Dots</span>
            <code className="component-class">.ah-status-dot</code>
          </div>
          <p className="component-purpose">
            Small colored dots for online/offline status
          </p>
          <div className="component-preview">
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ah-status-dot ah-status-dot--online"></span>
                Online
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ah-status-dot ah-status-dot--offline"></span>
                Offline
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ah-status-dot ah-status-dot--away"></span>
                Away
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ah-status-dot ah-status-dot--busy"></span>
                Busy
              </div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<span className="ah-status-dot ah-status-dot--online"></span>
<span className="ah-status-dot ah-status-dot--offline"></span>
<span className="ah-status-dot ah-status-dot--away"></span>
<span className="ah-status-dot ah-status-dot--busy"></span>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default StatusSection;
