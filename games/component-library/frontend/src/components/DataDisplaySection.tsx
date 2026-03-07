import React from 'react';

interface Props {
  token: string;
}

function DataDisplaySection({ token }: Props) {
  return (
    <>
      <div className="ah-card">
        <h2>Data Display</h2>
        <p className="ah-meta">
          Tables, lists, grids, and other data presentation components.
        </p>
      </div>

      {/* Flex Table */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Flex Table</span>
            <code className="component-class">.ah-table</code>
          </div>
          <p className="component-purpose">
            Flex-based table with header and row styling (for flex layouts)
          </p>
          <div className="component-preview">
            <table className="ah-table">
              <thead className="ah-table-header">
                <tr>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="ah-table-row">
                  <td>Player 1</td>
                  <td>100</td>
                  <td>Active</td>
                </tr>
                <tr className="ah-table-row">
                  <td>Player 2</td>
                  <td>85</td>
                  <td>Active</td>
                </tr>
                <tr className="ah-table-row">
                  <td>Player 3</td>
                  <td>72</td>
                  <td>Waiting</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="component-code">
            <pre><code>{`<table className="ah-table">
  <thead className="ah-table-header">
    <tr>
      <th>Name</th>
      <th>Score</th>
    </tr>
  </thead>
  <tbody>
    <tr className="ah-table-row">
      <td>Player 1</td>
      <td>100</td>
    </tr>
  </tbody>
</table>`}</code></pre>
          </div>
        </div>
      </div>

      {/* HTML Table */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">HTML Table</span>
            <code className="component-class">.ah-html-table</code>
          </div>
          <p className="component-purpose">
            Traditional HTML table with striped rows and hover effects. Use for data-heavy views.
          </p>
          <div className="component-preview">
            <table className="ah-html-table">
              <thead>
                <tr>
                  <th>App Name</th>
                  <th>URL</th>
                  <th>Port</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Tic-Tac-Toe</td>
                  <td>/games/tic-tac-toe</td>
                  <td>4001</td>
                  <td>Active</td>
                </tr>
                <tr>
                  <td>Dots</td>
                  <td>/games/dots</td>
                  <td>4011</td>
                  <td>Active</td>
                </tr>
                <tr>
                  <td>LMS Manager</td>
                  <td>/games/lms-manager</td>
                  <td>4021</td>
                  <td>Active</td>
                </tr>
                <tr>
                  <td>Sweepstakes</td>
                  <td>/games/sweepstakes-knockout</td>
                  <td>4031</td>
                  <td>Active</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="component-code">
            <pre><code>{`<table className="ah-html-table">
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
      <th>Column 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data 1</td>
      <td>Data 2</td>
      <td>Data 3</td>
    </tr>
    <tr>
      <td>Data 4</td>
      <td>Data 5</td>
      <td>Data 6</td>
    </tr>
  </tbody>
</table>

/* Optional: Icon column */
<table className="ah-html-table">
  <tbody>
    <tr>
      <td className="icon">🎮</td>
      <td>Content here</td>
    </tr>
  </tbody>
</table>`}</code></pre>
          </div>
          <p className="component-purpose mt-3 text-sm">
            <strong>Features:</strong> Striped rows (alternating background), hover effects,
            proper spacing, responsive. Optional <code>.icon</code> class for icon columns (50px width, centered).
          </p>
        </div>
      </div>

      {/* List */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">List</span>
            <code className="component-class">.ah-list</code>
          </div>
          <p className="component-purpose">
            Styled list with consistent item spacing
          </p>
          <div className="component-preview">
            <ul className="ah-list">
              <li className="ah-list-item">First item</li>
              <li className="ah-list-item">Second item</li>
              <li className="ah-list-item">Third item</li>
              <li className="ah-list-item">Fourth item</li>
            </ul>
          </div>
          <div className="component-code">
            <pre><code>{`<ul className="ah-list">
  <li className="ah-list-item">Item 1</li>
  <li className="ah-list-item">Item 2</li>
  <li className="ah-list-item">Item 3</li>
</ul>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Grid Auto */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Auto Grid</span>
            <code className="component-class">.ah-grid-auto</code>
          </div>
          <p className="component-purpose">
            Responsive grid that auto-fits items
          </p>
          <div className="component-preview">
            <div className="ah-grid-auto">
              <div className="ah-card">Grid Item 1</div>
              <div className="ah-card">Grid Item 2</div>
              <div className="ah-card">Grid Item 3</div>
              <div className="ah-card">Grid Item 4</div>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-grid-auto">
  <div className="ah-card">Item 1</div>
  <div className="ah-card">Item 2</div>
  <div className="ah-card">Item 3</div>
</div>`}</code></pre>
          </div>
          <div className="component-variants">
            <h4 className="component-variants-title">Variants:</h4>
            <div className="variant-item">
              <div className="variant-label">.ah-grid-auto--narrow (min: 200px)</div>
              <div className="ah-grid-auto--narrow">
                <div className="ah-card">Narrow 1</div>
                <div className="ah-card">Narrow 2</div>
                <div className="ah-card">Narrow 3</div>
              </div>
            </div>
            <div className="variant-item">
              <div className="variant-label">.ah-grid-auto--wide (min: 350px)</div>
              <div className="ah-grid-auto--wide">
                <div className="ah-card">Wide 1</div>
                <div className="ah-card">Wide 2</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Header */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Detail Header</span>
            <code className="component-class">.ah-detail-header</code>
          </div>
          <p className="component-purpose">
            Header for detail views with title and metadata
          </p>
          <div className="component-preview">
            <div className="ah-detail-header">
              <h2>Game Name</h2>
              <p className="ah-meta">Created: 2026-03-01 | Players: 4</p>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-detail-header">
  <h2>Title</h2>
  <p className="ah-meta">Metadata here</p>
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Meta Text */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Meta Text</span>
            <code className="component-class">.ah-meta</code>
          </div>
          <p className="component-purpose">
            Small, light-colored text for metadata and secondary information
          </p>
          <div className="component-preview">
            <p className="ah-meta">This is metadata text used for timestamps, descriptions, and other secondary information.</p>
          </div>
          <div className="component-code">
            <pre><code>{`<p className="ah-meta">
  Secondary information here
</p>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default DataDisplaySection;
