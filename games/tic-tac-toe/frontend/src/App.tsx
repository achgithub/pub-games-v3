import React, { useMemo } from 'react';
import { TicTacToeGame } from './components';

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

  // Must have userId and token to play
  if (!userId || !token) {
    return (
      <div className="ah-container ah-container--narrow" style={{ textAlign: 'center', marginTop: '40px' }}>
        <h2>Tic-Tac-Toe</h2>
        <p className="ah-meta" style={{ marginTop: '20px' }}>
          Missing authentication. Please access this game through the lobby.
        </p>
        <button
          onClick={() => {
            const shellUrl = `http://${window.location.hostname}:3001`;
            window.location.href = shellUrl;
          }}
          className="ah-btn-primary"
          style={{ marginTop: '20px' }}
        >
          Go to Lobby
        </button>
      </div>
    );
  }

  // Create user object from query params
  const user = {
    email: userId,
    name: userName,
  };

  return <TicTacToeGame gameId={gameId} user={user} token={token} />;
}

export default App;
