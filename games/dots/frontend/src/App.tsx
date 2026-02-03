import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const API_BASE = '/api';

// Types
interface Line {
  row: number;
  col: number;
  horizontal: boolean;
  drawnBy: number;
}

interface Box {
  row: number;
  col: number;
  ownedBy: number;
}

interface Game {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  gridSize: number;    // Legacy (deprecated)
  gridWidth: number;   // Number of dots horizontally
  gridHeight: number;  // Number of dots vertically
  lines: Line[];
  boxes: Box[];
  currentTurn: number;
  status: 'waiting' | 'active' | 'completed';
  winner: number;
}

interface SSEMessage {
  type: string;
  payload: {
    game?: Game;
    message?: string;
    [key: string]: unknown;
  };
}

// Parse query params from URL
function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      gameId: params.get('gameId'),
      userId: params.get('userId'),
      userName: params.get('userName') || params.get('userId') || 'Player',
      token: params.get('token'),
    };
  }, []);
}

function App() {
  const { gameId, userId, userName, token } = useQueryParams();

  // All hooks must be called before any conditional returns
  const [game, setGame] = useState<Game | null>(null);
  const [connected, setConnected] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [opponentEverConnected, setOpponentEverConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get player number
  const getPlayerNum = useCallback((): number => {
    if (!game) return 0;
    if (userId === game.player1Id) return 1;
    if (userId === game.player2Id) return 2;
    return 0;
  }, [game, userId]);

  // Check if it's my turn
  const isMyTurn = useCallback((): boolean => {
    if (!game || game.status !== 'active') return false;
    return game.currentTurn === getPlayerNum();
  }, [game, getPlayerNum]);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    if (!gameId || !userId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE}/game/${gameId}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('SSE connected');
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data: SSEMessage = JSON.parse(event.data);
        console.log('SSE message:', data.type, data);

        switch (data.type) {
          case 'connected':
            setConnected(true);
            break;
          case 'game_state':
          case 'move_update':
            setGame(data.payload.game || data.payload as unknown as Game);
            if (data.payload.message) {
              setMessage(data.payload.message);
              setTimeout(() => setMessage(''), 3000);
            }
            break;
          case 'opponent_connected':
            setOpponentConnected(true);
            setOpponentEverConnected(true);
            break;
          case 'opponent_disconnected':
            setOpponentConnected(false);
            break;
          case 'game_ended':
            if (data.payload.game) {
              setGame(data.payload.game);
            }
            setMessage(data.payload.message || '');
            break;
          case 'error':
            setError(data.payload.message || 'Unknown error');
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
  }, [gameId, userId, token]);

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
  }, [gameId, userId, token, connectSSE]);

  // Make a move
  const makeMove = async (row: number, col: number, horizontal: boolean) => {
    if (!isMyTurn()) return;

    try {
      const response = await fetch(`${API_BASE}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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

  // No userId - must access through shell
  if (!userId) {
    return (
      <div className="app error">
        <h2>Dots & Boxes</h2>
        <p>Missing user information. Please access this game through the lobby.</p>
        <button className="btn-lobby" onClick={returnToLobby}>Go to Lobby</button>
      </div>
    );
  }

  // No gameId - show friendly challenge prompt
  if (!gameId) {
    return (
      <div className="app error">
        <h2>Dots & Boxes</h2>
        <p>Challenge another player from the lobby to start a game!</p>
        <p style={{ fontSize: '0.9em', color: '#adb5bd', marginTop: '10px' }}>
          Go back to the lobby and click on a player to send a challenge.
        </p>
        <button className="btn-lobby" onClick={returnToLobby}>Go to Lobby</button>
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

  // Authentication check - must have userId and token
  if (!userId || !token) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Dots</h2>
        <p style={{ color: '#666', marginTop: 20 }}>
          Missing authentication. Please access this game through the lobby.
        </p>
        <button
          onClick={() => {
            const shellUrl = `http://${window.location.hostname}:3001`;
            window.location.href = shellUrl;
          }}
          style={{
            marginTop: 20,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            padding: '12px 30px',
            fontSize: 16,
            fontWeight: 500,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Go to Lobby
        </button>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="app loading">
        <h2>Connecting to game...</h2>
        <p>Please wait</p>
      </div>
    );
  }

  const playerNum = getPlayerNum();
  const isPlayer1 = playerNum === 1;
  const myName = isPlayer1 ? game.player1Name : game.player2Name;
  const opponentName = isPlayer1 ? game.player2Name : game.player1Name;
  const gameEnded = game.status === 'completed';

  return (
    <div className="app">
      <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● Connected' : '○ Reconnecting...'}
      </div>

      <div className="header">
        <h1>Dots & Boxes</h1>
        {!gameEnded && (
          <div className={`status ${isMyTurn() ? 'your-turn' : 'waiting'}`}>
            {isMyTurn() ? "Your turn!" : `Waiting for ${opponentName}...`}
          </div>
        )}
        {!gameEnded && !opponentConnected && (
          <div className="opponent-status disconnected">
            Opponent disconnected
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
          />

          {message && (
            <div className={`message ${message.includes('Box') ? 'success' : 'info'}`}>
              {message}
            </div>
          )}

          <div className="controls">
            <button className="btn-forfeit" onClick={forfeit}>Forfeit</button>
            {opponentEverConnected && !opponentConnected && (
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
interface DotsBoardProps {
  game: Game;
  onLineClick: (row: number, col: number, horizontal: boolean) => void;
  canMove: boolean;
}

function DotsBoard({ game, onLineClick, canMove }: DotsBoardProps) {
  // Use gridWidth/gridHeight, fall back to gridSize for backward compat
  const width = game.gridWidth || game.gridSize || 4;
  const height = game.gridHeight || game.gridSize || 4;

  // Helper to find a line
  const findLine = (row: number, col: number, horizontal: boolean): Line | undefined => {
    return game.lines.find(l => l.row === row && l.col === col && l.horizontal === horizontal);
  };

  // Helper to find a box
  const findBox = (row: number, col: number): Box | undefined => {
    return game.boxes.find(b => b.row === row && b.col === col);
  };

  // Build grid: height*2-1 rows, width*2-1 columns
  const gridRows: JSX.Element[] = [];
  for (let row = 0; row < height * 2 - 1; row++) {
    const cells: JSX.Element[] = [];
    const isLineRow = row % 2 === 0;

    for (let col = 0; col < width * 2 - 1; col++) {
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

    gridRows.push(
      <div key={row} style={{ display: 'flex', alignItems: 'center' }}>
        {cells}
      </div>
    );
  }

  return (
    <div className="game-board">
      <div className="grid">{gridRows}</div>
    </div>
  );
}

export default App;
