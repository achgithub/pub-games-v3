import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = '/api';

function App() {
  // Get params from URL
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('gameId');
  const userId = params.get('userId');
  const userName = params.get('userName') || userId || 'Player';

  const [game, setGame] = useState(null);
  const [connected, setConnected] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Get player number
  const getPlayerNum = useCallback(() => {
    if (!game) return 0;
    if (userId === game.player1Id) return 1;
    if (userId === game.player2Id) return 2;
    return 0;
  }, [game, userId]);

  // Check if it's my turn
  const isMyTurn = useCallback(() => {
    if (!game || game.status !== 'active') return false;
    return game.currentTurn === getPlayerNum();
  }, [game, getPlayerNum]);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    if (!gameId || !userId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE}/game/${gameId}/stream?userId=${encodeURIComponent(userId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('SSE connected');
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE message:', data.type, data);

        switch (data.type) {
          case 'connected':
            setConnected(true);
            break;
          case 'game_state':
          case 'move_update':
            setGame(data.payload.game || data.payload);
            if (data.payload.message) {
              setMessage(data.payload.message);
              setTimeout(() => setMessage(''), 3000);
            }
            break;
          case 'opponent_connected':
            setOpponentConnected(true);
            break;
          case 'opponent_disconnected':
            setOpponentConnected(false);
            break;
          case 'game_ended':
            setGame(data.payload.game);
            setMessage(data.payload.message);
            break;
          case 'error':
            setError(data.payload.message);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    es.onerror = () => {
      console.log('SSE error/closed');
      setConnected(false);
      es.close();

      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Reconnecting SSE...');
        connectSSE();
      }, 2000);
    };
  }, [gameId, userId]);

  // Initial connection
  useEffect(() => {
    if (gameId && userId) {
      connectSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [gameId, userId, connectSSE]);

  // Make a move
  const makeMove = async (row, col, horizontal) => {
    if (!isMyTurn()) return;

    try {
      const response = await fetch(`${API_BASE}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerId: userId,
          row,
          col,
          horizontal,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Move failed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Move error:', err);
      setMessage('Network error');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Forfeit game
  const forfeit = async () => {
    if (!window.confirm('Are you sure you want to forfeit?')) return;

    try {
      await fetch(`${API_BASE}/game/${gameId}/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error('Forfeit error:', err);
    }
  };

  // Claim win
  const claimWin = async () => {
    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/claim-win`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Cannot claim win');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Claim win error:', err);
    }
  };

  // Return to lobby
  const returnToLobby = () => {
    const shellUrl = `http://${window.location.hostname}:3001/lobby`;
    window.location.href = shellUrl;
  };

  // Render loading state
  if (!gameId || !userId) {
    return (
      <div className="app error">
        <h2>Missing Parameters</h2>
        <p>This game must be accessed through the Identity Shell.</p>
        <button className="btn-lobby" onClick={returnToLobby}>Return to Lobby</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <h2>Error</h2>
        <p>{error}</p>
        <button className="btn-lobby" onClick={returnToLobby}>Return to Lobby</button>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="app loading">
        <h2>🔵 Connecting to game...</h2>
        <p>Please wait</p>
      </div>
    );
  }

  const playerNum = getPlayerNum();
  const isPlayer1 = playerNum === 1;
  const myScore = isPlayer1 ? game.player1Score : game.player2Score;
  const opponentScore = isPlayer1 ? game.player2Score : game.player1Score;
  const myName = isPlayer1 ? game.player1Name : game.player2Name;
  const opponentName = isPlayer1 ? game.player2Name : game.player1Name;
  const gameEnded = game.status === 'completed';

  return (
    <div className="app">
      <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● Connected' : '○ Reconnecting...'}
      </div>

      <div className="header">
        <h1>🔵 Dots & Boxes</h1>
        {!gameEnded && (
          <div className={`status ${isMyTurn() ? 'your-turn' : 'waiting'}`}>
            {isMyTurn() ? "Your turn!" : `Waiting for ${opponentName}...`}
          </div>
        )}
        {!gameEnded && !opponentConnected && (
          <div className="opponent-status disconnected">
            ⚠️ Opponent disconnected
          </div>
        )}
      </div>

      <div className="scores">
        <div className={`score player1 ${game.currentTurn === 1 && !gameEnded ? 'active' : ''}`}>
          <div className="name">{isPlayer1 ? `${myName} (You)` : opponentName}</div>
          <div className="value">{game.player1Score}</div>
        </div>
        <div className={`score player2 ${game.currentTurn === 2 && !gameEnded ? 'active' : ''}`}>
          <div className="name">{isPlayer1 ? opponentName : `${myName} (You)`}</div>
          <div className="value">{game.player2Score}</div>
        </div>
      </div>

      {!gameEnded ? (
        <>
          <DotsBoard
            game={game}
            onLineClick={makeMove}
            canMove={isMyTurn()}
            playerNum={playerNum}
          />

          {message && (
            <div className={`message ${message.includes('Box') ? 'success' : 'info'}`}>
              {message}
            </div>
          )}

          <div className="controls">
            <button className="btn-forfeit" onClick={forfeit}>Forfeit</button>
            {!opponentConnected && (
              <button className="btn-claim" onClick={claimWin}>Claim Win</button>
            )}
            <button className="btn-lobby" onClick={returnToLobby}>Leave Game</button>
          </div>
        </>
      ) : (
        <div className="game-over">
          <h2>Game Over!</h2>
          <div className="final-score">
            {game.player1Name}: {game.player1Score} - {game.player2Name}: {game.player2Score}
          </div>
          <p>{message}</p>
          <div className="controls">
            <button className="btn-lobby" onClick={returnToLobby}>Return to Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}

// DotsBoard component
function DotsBoard({ game, onLineClick, canMove, playerNum }) {
  const size = game.gridSize;

  // Helper to find a line
  const findLine = (row, col, horizontal) => {
    return game.lines.find(l => l.row === row && l.col === col && l.horizontal === horizontal);
  };

  // Helper to find a box
  const findBox = (row, col) => {
    return game.boxes.find(b => b.row === row && b.col === col);
  };

  // Build grid
  const rows = [];
  for (let row = 0; row < size * 2 - 1; row++) {
    const cells = [];
    const isLineRow = row % 2 === 0;

    for (let col = 0; col < size * 2 - 1; col++) {
      const isLineCol = col % 2 === 0;
      const key = `${row}-${col}`;

      if (isLineRow && isLineCol) {
        // Dot
        cells.push(<div key={key} className="dot" />);
      } else if (isLineRow && !isLineCol) {
        // Horizontal line
        const lineRow = Math.floor(row / 2);
        const lineCol = Math.floor(col / 2);
        const line = findLine(lineRow, lineCol, true);
        const drawn = line && line.drawnBy > 0;
        const playerClass = drawn ? `player${line.drawnBy}` : '';

        cells.push(
          <div
            key={key}
            className={`line horizontal ${drawn ? 'drawn' : ''} ${playerClass}`}
            onClick={() => !drawn && canMove && onLineClick(lineRow, lineCol, true)}
          />
        );
      } else if (!isLineRow && isLineCol) {
        // Vertical line
        const lineRow = Math.floor(row / 2);
        const lineCol = Math.floor(col / 2);
        const line = findLine(lineRow, lineCol, false);
        const drawn = line && line.drawnBy > 0;
        const playerClass = drawn ? `player${line.drawnBy}` : '';

        cells.push(
          <div
            key={key}
            className={`line vertical ${drawn ? 'drawn' : ''} ${playerClass}`}
            onClick={() => !drawn && canMove && onLineClick(lineRow, lineCol, false)}
          />
        );
      } else {
        // Box
        const boxRow = Math.floor(row / 2);
        const boxCol = Math.floor(col / 2);
        const box = findBox(boxRow, boxCol);
        const owned = box && box.ownedBy > 0;
        const playerClass = owned ? `player${box.ownedBy}` : '';

        cells.push(
          <div key={key} className={`box ${playerClass}`}>
            {owned && (box.ownedBy === 1 ? '🔴' : '🔵')}
          </div>
        );
      }
    }

    rows.push(
      <div key={row} style={{ display: 'flex', alignItems: 'center' }}>
        {cells}
      </div>
    );
  }

  return (
    <div className="game-board">
      <div className="grid">{rows}</div>
    </div>
  );
}

export default App;
