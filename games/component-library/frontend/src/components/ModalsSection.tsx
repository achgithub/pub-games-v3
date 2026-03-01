import React, { useState } from 'react';

interface Props {
  token: string;
}

function ModalsSection({ token }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showSmallModal, setShowSmallModal] = useState(false);
  const [showLargeModal, setShowLargeModal] = useState(false);

  return (
    <>
      <div className="ah-card">
        <h2>Modals</h2>
        <p className="ah-meta">
          Modal dialogs and overlays for focused interactions.
        </p>
      </div>

      {/* Modal Component */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Modal</span>
            <code className="component-class">.ah-modal</code>
          </div>
          <p className="component-purpose">
            Modal dialog with overlay, header, body, and footer
          </p>
          <div className="component-preview">
            <button className="ah-btn-primary" onClick={() => setShowModal(true)}>
              Show Default Modal
            </button>
            <br /><br />
            <button className="ah-btn-outline" onClick={() => setShowSmallModal(true)}>
              Show Small Modal
            </button>
            <br /><br />
            <button className="ah-btn-outline" onClick={() => setShowLargeModal(true)}>
              Show Large Modal
            </button>

            {/* Default Modal */}
            {showModal && (
              <div className="ah-modal-overlay" onClick={() => setShowModal(false)}>
                <div className="ah-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="ah-modal-header">
                    <h2 className="ah-modal-title">Modal Title</h2>
                    <button
                      className="ah-modal-close"
                      onClick={() => setShowModal(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="ah-modal-body">
                    <p>This is the modal content. It can contain any content you need.</p>
                    <p>The overlay can be clicked to close the modal.</p>
                  </div>
                  <div className="ah-modal-footer">
                    <button
                      className="ah-btn-outline"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="ah-btn-primary"
                      onClick={() => setShowModal(false)}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Small Modal */}
            {showSmallModal && (
              <div className="ah-modal-overlay" onClick={() => setShowSmallModal(false)}>
                <div className="ah-modal ah-modal--small" onClick={(e) => e.stopPropagation()}>
                  <div className="ah-modal-header">
                    <h2 className="ah-modal-title">Small Modal</h2>
                    <button
                      className="ah-modal-close"
                      onClick={() => setShowSmallModal(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="ah-modal-body">
                    <p>This is a smaller modal for simple confirmations.</p>
                  </div>
                  <div className="ah-modal-footer">
                    <button
                      className="ah-btn-primary"
                      onClick={() => setShowSmallModal(false)}
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Large Modal */}
            {showLargeModal && (
              <div className="ah-modal-overlay" onClick={() => setShowLargeModal(false)}>
                <div className="ah-modal ah-modal--large" onClick={(e) => e.stopPropagation()}>
                  <div className="ah-modal-header">
                    <h2 className="ah-modal-title">Large Modal</h2>
                    <button
                      className="ah-modal-close"
                      onClick={() => setShowLargeModal(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="ah-modal-body">
                    <p>This is a larger modal for content-heavy dialogs.</p>
                    <p>It provides more space for forms, tables, or detailed information.</p>
                    <div className="ah-card">
                      <h3>Example Content</h3>
                      <p>You can include cards and other components here.</p>
                    </div>
                  </div>
                  <div className="ah-modal-footer">
                    <button
                      className="ah-btn-outline"
                      onClick={() => setShowLargeModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="ah-btn-primary"
                      onClick={() => setShowLargeModal(false)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-modal-overlay">
  <div className="ah-modal">
    <div className="ah-modal-header">
      <h2 className="ah-modal-title">Title</h2>
      <button className="ah-modal-close">×</button>
    </div>
    <div className="ah-modal-body">
      Content here
    </div>
    <div className="ah-modal-footer">
      <button className="ah-btn-outline">Cancel</button>
      <button className="ah-btn-primary">Confirm</button>
    </div>
  </div>
</div>

{/* Variants */}
<div className="ah-modal ah-modal--small">...</div>
<div className="ah-modal ah-modal--large">...</div>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default ModalsSection;
