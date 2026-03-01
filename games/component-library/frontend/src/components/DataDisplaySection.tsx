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

      {/* Table */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Table</span>
            <code className="component-class">.ah-table</code>
          </div>
          <p className="component-purpose">
            Data table with header and row styling
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
