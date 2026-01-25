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
    };
  }, []);
}

function App() {
  const { gameId, userId, userName } = useQueryParams();

  // Must have userId to play
  if (!userId) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Tic-Tac-Toe</h2>
        <p style={{ color: '#666', marginTop: 20 }}>
          Missing user information. Please access this game through the lobby.
        </p>
      </div>
    );
  }

  // Create user object from query params
  const user = {
    email: userId,
    name: userName,
  };

  return <TicTacToeGame gameId={gameId} user={user} />;
}

export default App;
