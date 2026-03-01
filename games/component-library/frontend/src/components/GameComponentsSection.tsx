import React from 'react';

interface Props {
  token: string;
}

function GameComponentsSection({ token }: Props) {
  return (
    <>
      <div className="ah-card">
        <h2>Game Components</h2>
        <p className="ah-meta">
          Specialized components for game boards and cells.
        </p>
      </div>

      {/* 3x3 Game Board */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">3×3 Game Board</span>
            <code className="component-class">.ah-game-board--3x3</code>
          </div>
          <p className="component-purpose">
            3×3 grid for games like Tic-Tac-Toe
          </p>
          <div className="component-preview">
            <div className="ah-game-board ah-game-board--3x3">
              <button className="ah-game-cell">X</button>
              <button className="ah-game-cell"></button>
              <button className="ah-game-cell">O</button>
              <button className="ah-game-cell"></button>
              <button className="ah-game-cell">X</button>
              <button className="ah-game-cell"></button>
              <button className="ah-game-cell">O</button>
              <button className="ah-game-cell"></button>
              <button className="ah-game-cell">X</button>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-game-board ah-game-board--3x3">
  <button className="ah-game-cell">X</button>
  <button className="ah-game-cell">O</button>
  {/* ... 9 cells total */}
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* 4x4 Game Board */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">4×4 Game Board</span>
            <code className="component-class">.ah-game-board--4x4</code>
          </div>
          <p className="component-purpose">
            4×4 grid for larger game boards
          </p>
          <div className="component-preview">
            <div className="ah-game-board ah-game-board--4x4">
              {Array.from({ length: 16 }).map((_, i) => (
                <button key={i} className="ah-game-cell">
                  {i % 3 === 0 ? '●' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-game-board ah-game-board--4x4">
  {/* 16 cells */}
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* 5x5 Game Board */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">5×5 Game Board</span>
            <code className="component-class">.ah-game-board--5x5</code>
          </div>
          <p className="component-purpose">
            5×5 grid for games like Dots
          </p>
          <div className="component-preview">
            <div className="ah-game-board ah-game-board--5x5">
              {Array.from({ length: 25 }).map((_, i) => (
                <button key={i} className="ah-game-cell">
                  {i % 5 === 0 ? '•' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<div className="ah-game-board ah-game-board--5x5">
  {/* 25 cells */}
</div>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Game Cell States */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Game Cell States</span>
            <code className="component-class">.ah-game-cell</code>
          </div>
          <p className="component-purpose">
            Game cell with active and disabled states
          </p>
          <div className="component-preview">
            <div className="ah-game-board ah-game-board--3x3">
              <button className="ah-game-cell">Default</button>
              <button className="ah-game-cell active">Active</button>
              <button className="ah-game-cell disabled">Disabled</button>
            </div>
          </div>
          <div className="component-code">
            <pre><code>{`<button className="ah-game-cell">Default</button>
<button className="ah-game-cell active">Active</button>
<button className="ah-game-cell disabled">Disabled</button>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Board Size Reference */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Available Board Sizes</span>
          </div>
          <p className="component-purpose">
            All available game board size variants
          </p>
          <div className="component-preview">
            <ul className="ah-list">
              <li className="ah-list-item">
                <code>.ah-game-board--3x3</code> - 3×3 grid (9 cells)
              </li>
              <li className="ah-list-item">
                <code>.ah-game-board--4x4</code> - 4×4 grid (16 cells)
              </li>
              <li className="ah-list-item">
                <code>.ah-game-board--5x5</code> - 5×5 grid (25 cells)
              </li>
              <li className="ah-list-item">
                <code>.ah-game-board--6x6</code> - 6×6 grid (36 cells)
              </li>
              <li className="ah-list-item">
                <code>.ah-game-board--dots</code> - Dots game variant
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default GameComponentsSection;
