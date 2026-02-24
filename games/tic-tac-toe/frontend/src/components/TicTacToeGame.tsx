import React, { useState } from 'react';
import TicTacToeBoard from './TicTacToeBoard';
import { useGameSocket } from '../hooks/useGameSocket';
import '../styles/tictactoe.css';

// User type from identity shell
interface User {
  email: string;
  name: string;
  is_admin?: boolean;
}

interface TicTacToeGameProps {
  gameId: string | null;
  user: User;
  token: string;
}

const TicTacToeGame: React.FC<TicTacToeGameProps> = ({ gameId, user, token }) => {
  const userId = user.email;
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  const {
    game,
    connected,
    ready,
    error,
    connectionStatus,
    retryCount,
    opponentDisconnected,
    claimWinAvailable,
    claimWinCountdown,
    makeMove,
    forfeit,
    claimWin,
    retry,
  } = useGameSocket(gameId, userId, token);

  // No gameId provided - show instructions
  if (!gameId) {
    return (
      <div className="ah-container ah-container--narrow" style={{ textAlign: 'center', marginTop: '40px' }}>
        <h2>Tic-Tac-Toe</h2>
        <p>Challenge another player from the lobby to start a game!</p>
        <p className="ah-meta">Go back to the lobby and click on a player to send a challenge.</p>
        <div style={{ marginTop: 30 }}>
          <button
            className="ah-btn-primary"
            onClick={() => {
              const shellUrl = `http://${window.location.hostname}:3001`;
              window.location.href = shellUrl;
            }}
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Loading/connecting state
  if (!game) {
    const getConnectionMessage = () => {
      switch (connectionStatus) {
        case 'connecting':
          return 'Connecting to game...';
        case 'reconnecting':
          return `Reconnecting... (attempt ${retryCount}/5)`;
        case 'failed':
          return 'Connection failed';
        default:
          return 'Connecting...';
      }
    };

    return (
      <div className="ah-container ah-container--narrow" style={{ textAlign: 'center', marginTop: '40px' }}>
        <div className={connectionStatus === 'failed' ? 'ah-banner ah-banner--error' : ''} style={{ fontSize: '18px', padding: '20px' }}>
          {getConnectionMessage()}
        </div>
        {connectionStatus === 'failed' && (
          <>
            <button className="ah-btn-primary" onClick={retry} style={{ marginTop: '20px' }}>
              Tap to Retry
            </button>
            <div style={{ marginTop: 15 }}>
              <button
                className="ah-btn-outline"
                onClick={() => {
                  const shellUrl = `http://${window.location.hostname}:3001`;
                  window.location.href = shellUrl;
                }}
              >
                Back to Lobby
              </button>
            </div>
          </>
        )}
        {error && connectionStatus !== 'failed' && (
          <div className="ah-banner ah-banner--error" style={{ marginTop: '10px' }}>{error}</div>
        )}
      </div>
    );
  }

  // Determine player info
  const isPlayer1 = userId === game.player1Id;
  const mySymbol = isPlayer1 ? game.player1Symbol : game.player2Symbol;
  const myName = isPlayer1 ? game.player1Name : game.player2Name;
  const opponentName = isPlayer1 ? game.player2Name : game.player1Name;
  const myScore = isPlayer1 ? game.player1Score : game.player2Score;
  const opponentScore = isPlayer1 ? game.player2Score : game.player1Score;

  // Determine turn
  const myPlayerNumber = isPlayer1 ? 1 : 2;
  const isMyTurn = game.currentTurn === myPlayerNumber;

  // Game status
  const gameEnded = game.status === 'completed';
  const iWon = game.winnerId === userId;
  const isDraw = gameEnded && game.winnerId === null;

  // Status message
  const getStatusMessage = () => {
    if (opponentDisconnected) {
      if (claimWinCountdown !== null && claimWinCountdown > 0) {
        return `Opponent disconnected - Claim win in ${claimWinCountdown}s`;
      }
      return 'Opponent disconnected';
    }
    if (connectionStatus === 'reconnecting') {
      return `Reconnecting... (${retryCount}/5)`;
    }
    if (!connected) {
      return 'Reconnecting...';
    }
    if (!ready) {
      return 'Waiting for opponent...';
    }
    if (gameEnded) {
      if (isDraw) {
        return "It's a draw!";
      }
      return iWon ? 'You won!' : 'You lost!';
    }
    return isMyTurn ? 'Your turn' : "Opponent's turn";
  };

  // Handle forfeit click
  const handleForfeitClick = () => {
    setShowForfeitConfirm(true);
  };

  // Confirm forfeit
  const handleConfirmForfeit = () => {
    forfeit();
    setShowForfeitConfirm(false);
  };

  // Cancel forfeit
  const handleCancelForfeit = () => {
    setShowForfeitConfirm(false);
  };

  return (
    <div className="ttt-container">
      {/* Header with scores */}
      <div className="ttt-header">
        <div className="ttt-player ttt-player-me">
          <span className="ttt-player-symbol">{mySymbol}</span>
          <span className="ttt-player-name">{myName} (You)</span>
          <span className="ttt-player-score">{myScore}</span>
        </div>

        <div className="ttt-vs">
          <span className="ttt-round">Round {game.currentRound}</span>
          <span className="ttt-first-to">First to {game.firstTo}</span>
        </div>

        <div className="ttt-player ttt-player-opponent">
          <span className="ttt-player-score">{opponentScore}</span>
          <span className="ttt-player-name">{opponentName}</span>
          <span className="ttt-player-symbol">{isPlayer1 ? game.player2Symbol : game.player1Symbol}</span>
        </div>
      </div>

      {/* Game board */}
      <TicTacToeBoard
        board={game.board}
        onCellClick={makeMove}
        myTurn={isMyTurn}
        mySymbol={mySymbol}
        disabled={!ready || !connected || gameEnded || opponentDisconnected}
      />

      {/* Everything below the board — no layout shift above */}
      <div className="ttt-below-board">
        {/* Status message */}
        <div className={`ttt-status ${isMyTurn && !gameEnded ? 'ttt-status-myturn' : ''} ${gameEnded ? (iWon ? 'ttt-status-won' : 'ttt-status-lost') : ''} ${opponentDisconnected ? 'ttt-status-disconnected' : ''} ${connectionStatus === 'reconnecting' ? 'ttt-status-reconnecting' : ''}`}>
          {getStatusMessage()}
        </div>

        {/* Claim Win button */}
        {opponentDisconnected && claimWinAvailable && !gameEnded && (
          <div>
            <button className="ah-btn-primary" onClick={claimWin}>
              Claim Win
            </button>
          </div>
        )}

        {error && <div className="ah-banner ah-banner--error">{error}</div>}

        {/* Game actions */}
        {!gameEnded && connected && ready && (
          <div>
            <button className="ah-btn-outline" onClick={handleForfeitClick}>
              Leave Game
            </button>
          </div>
        )}

        {/* Back to Lobby - shown when game ends */}
        {gameEnded && (
          <div>
            <button
              className="ah-btn-primary"
              onClick={() => {
                const shellUrl = `http://${window.location.hostname}:3001`;
                window.location.href = shellUrl;
              }}
            >
              Back to Lobby
            </button>
          </div>
        )}
      </div>

      {/* Forfeit confirmation modal */}
      {showForfeitConfirm && (
        <div className="ah-modal-overlay" onClick={handleCancelForfeit}>
          <div className="ah-modal ah-modal--small" onClick={(e) => e.stopPropagation()}>
            <div className="ah-modal-header">
              <h3 className="ah-modal-title">Leave Game?</h3>
            </div>
            <div className="ah-modal-body">
              <p>If you leave, your opponent wins.</p>
            </div>
            <div className="ah-modal-footer">
              <button className="ah-btn-outline" onClick={handleCancelForfeit}>
                Stay
              </button>
              <button className="ah-btn-danger" onClick={handleConfirmForfeit}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicTacToeGame;
