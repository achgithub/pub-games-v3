import React, { useMemo } from 'react';
import GameBoard from './GameBoard';

// Parse query params from URL
function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      gameId: params.get('gameId'),
      userId: params.get('userId'),
      userName: params.get('userName') || 'Player',
      token: params.get('token'),
    };
  }, []);
}

function App() {
  const { gameId, userId, userName, token } = useQueryParams();

  // Must have userId and token to play
  if (!userId || !token) {
    return (
      <>
        <header className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">🐂 Bulls and Cows</h1>
          </div>
          <div className="ah-app-header-right">
            <button
              className="ah-lobby-btn"
              onClick={() => {
                window.location.href = `http://${window.location.hostname}:3001`;
              }}
            >
              ← Lobby
            </button>
          </div>
        </header>
        <div className="ah-container ah-container--narrow">
          <div className="ah-card">
            <p className="ah-meta">
              Missing authentication. Please access this game through the Activity Hub.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Must have gameId to play
  if (!gameId) {
    return (
      <>
        <header className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">🐂 Bulls and Cows</h1>
          </div>
          <div className="ah-app-header-right">
            <button
              className="ah-lobby-btn"
              onClick={() => {
                window.location.href = `http://${window.location.hostname}:3001`;
              }}
            >
              ← Lobby
            </button>
          </div>
        </header>
        <div className="ah-container ah-container--narrow">
          <div className="ah-card">
            <p className="ah-meta">
              No game found. Please start a new game from the lobby.
            </p>
          </div>
        </div>
      </>
    );
  }

  return <GameBoard gameId={gameId} token={token} userId={userId} userName={userName} />;
}

export default App;
