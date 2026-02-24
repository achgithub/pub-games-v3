import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/dots.css';

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

interface User {
  email: string;
  name: string;
}

interface DotsGameProps {
  gameId: string | null;
  user: User;
  token: string;
}

const DotsGame: React.FC<DotsGameProps> = ({ gameId, user, token }) => {
  const userId = user.email;

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
          case 'move_update': {
            const updatedGame = data.payload.game || data.payload as unknown as Game;
            setGame(updatedGame);
            if (updatedGame.status === 'active') {
              setOpponentEverConnected(true);
            }
            if (data.payload.message) {
              setMessage(data.payload.message);
              setTimeout(() => setMessage(''), 3000);
            }
            break;
          }
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
  }, [gameId, userId, connectSSE]);

  // Make a move
  const makeMove = async (row: number, col: number, horizontal: boolean) => {
    if (!isMyTurn()) return;

    // Optimistically colour the line immediately so there's no grey delay
    const myPlayerNum = getPlayerNum();
    setGame(prev => {
      if (!prev) return prev;
      const updatedLines = prev.lines.map(l =>
        l.row === row && l.col === col && l.horizontal === horizontal
          ? { ...l, drawnBy: myPlayerNum }
          : l
      );
      return { ...prev, lines: updatedLines };
    });

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

  // No gameId - show friendly challenge prompt
  if (!gameId) {
    return (
      <div className="ah-container ah-container--narrow" style={{ textAlign: 'center', marginTop: '40px' }}>
        <h2>Dots & Boxes</h2>
        <p>Challenge another player from the lobby to start a game!</p>
        <p className="ah-meta" style={{ marginTop: '10px' }}>
          Go back to the lobby and click on a player to send a challenge.
        </p>
        <button className="ah-btn-primary" onClick={returnToLobby} style={{ marginTop: '20px' }}>
          Go to Lobby
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ah-container ah-container--narrow" style={{ textAlign: 'center', marginTop: '40px' }}>
        <h2>Error</h2>
        <div className="ah-banner ah-banner--error">{error}</div>
        <button className="ah-btn-primary" onClick={returnToLobby} style={{ marginTop: '20px' }}>
          Return to Lobby
        </button>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="ah-loading-container">
        <div className="ah-spinner ah-spinner--large"></div>
        <p className="ah-loading-text">Connecting to game...</p>
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
      <div className="header">
        <h1>Dots & Boxes</h1>
      </div>

      <div className="score">
        <div className={`player ${isPlayer1 ? 'active' : ''}`}>
          {myName}: {isPlayer1 ? game.player1Score : game.player2Score}
        </div>
        <div className={`player ${!isPlayer1 ? 'active' : ''}`}>
          {opponentName}: {isPlayer1 ? game.player2Score : game.player1Score}
        </div>
      </div>

      <DotsGrid
        game={game}
        playerNum={playerNum}
        isMyTurn={isMyTurn()}
        makeMove={makeMove}
      />

      <div className="below-grid">
        {!gameEnded && (
          <div className="turn-indicator">
            {isMyTurn() ? 'Your Turn' : `${opponentName}'s Turn`}
          </div>
        )}

        {message && <div className="ah-banner ah-banner--info">{message}</div>}

        {!opponentEverConnected && !gameEnded && (
          <div className="ah-banner ah-banner--warning">Waiting for opponent to connect...</div>
        )}

        {!opponentConnected && opponentEverConnected && !gameEnded && (
          <div className="ah-banner ah-banner--warning">
            Opponent disconnected. Waiting for reconnection...
            <button onClick={claimWin} className="ah-btn-primary" style={{ marginLeft: 10 }}>
              Claim Win
            </button>
          </div>
        )}

        {!gameEnded && (
          <div className="actions">
            <button onClick={forfeit} className="ah-btn-danger">
              Forfeit
            </button>
            <button onClick={returnToLobby} className="ah-btn-outline">
              Return to Lobby
            </button>
          </div>
        )}
      </div>

      {gameEnded && (
        <div className="game-over">
          <h2>
            {game.winner === playerNum
              ? '🎉 You Won!'
              : game.winner === 0
              ? "It's a Draw!"
              : '😢 You Lost'}
          </h2>
          <p>
            Final Score: {game.player1Score} - {game.player2Score}
          </p>
          <button onClick={returnToLobby} className="ah-btn-primary">
            Return to Lobby
          </button>
        </div>
      )}
    </div>
  );
};

// Render the grid
function DotsGrid({
  game,
  playerNum,
  isMyTurn,
  makeMove,
}: {
  game: Game;
  playerNum: number;
  isMyTurn: boolean;
  makeMove: (row: number, col: number, horizontal: boolean) => void;
}) {
  const gridWidth = game.gridWidth || 4;
  const gridHeight = game.gridHeight || 4;

  const hasLine = (row: number, col: number, horizontal: boolean): number => {
    const line = game.lines.find(
      (l) => l.row === row && l.col === col && l.horizontal === horizontal
    );
    return line ? line.drawnBy : 0;
  };

  const getBoxOwner = (row: number, col: number): number => {
    const box = game.boxes.find((b) => b.row === row && b.col === col);
    return box ? box.ownedBy : 0;
  };

  const handleLineClick = (row: number, col: number, horizontal: boolean) => {
    if (!isMyTurn || game.status !== 'active') return;
    if (hasLine(row, col, horizontal)) return;
    makeMove(row, col, horizontal);
  };

  const gridRows: JSX.Element[] = [];
  for (let row = 0; row < gridHeight; row++) {
    const cells: JSX.Element[] = [];

    for (let col = 0; col < gridWidth; col++) {
      // Dot
      cells.push(
        <div key={`dot-${row}-${col}`} className="dot"></div>
      );

      // Horizontal line (except after last column)
      if (col < gridWidth - 1) {
        const owner = hasLine(row, col, true);
        cells.push(
          <div
            key={`h-${row}-${col}`}
            className={`line horizontal ${owner ? `p${owner} drawn` : ''} ${
              isMyTurn && !owner ? 'clickable' : ''
            }`}
            onClick={() => handleLineClick(row, col, true)}
          />
        );
      }
    }

    gridRows.push(
      <div key={row} style={{ display: 'flex', alignItems: 'center' }}>
        {cells}
      </div>
    );

    // Row of vertical lines and boxes (except after last row)
    if (row < gridHeight - 1) {
      const boxRow: JSX.Element[] = [];
      for (let col = 0; col < gridWidth; col++) {
        // Vertical line
        const vOwner = hasLine(row, col, false);
        boxRow.push(
          <div
            key={`v-${row}-${col}`}
            className={`line vertical ${vOwner ? `p${vOwner} drawn` : ''} ${
              isMyTurn && !vOwner ? 'clickable' : ''
            }`}
            onClick={() => handleLineClick(row, col, false)}
          />
        );

        // Box (except after last column)
        if (col < gridWidth - 1) {
          const boxOwner = getBoxOwner(row, col);
          boxRow.push(
            <div
              key={`box-${row}-${col}`}
              className={`box ${boxOwner ? `p${boxOwner}` : ''}`}
            >
              {boxOwner ? (boxOwner === playerNum ? '😊' : '😐') : ''}
            </div>
          );
        }
      }

      gridRows.push(
        <div key={`boxrow-${row}`} style={{ display: 'flex', alignItems: 'center' }}>
          {boxRow}
        </div>
      );
    }
  }

  return (
    <div className="game-board">
      <div className="grid">{gridRows}</div>
    </div>
  );
}

export default DotsGame;
