import React, { useEffect, useState } from 'react';
import SudokuGame from './SudokuGame';

function App() {
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    // Parse URL parameters (required by Activity Hub)
    const params = new URLSearchParams(window.location.search);
    const userIdParam = params.get('userId') || 'guest';
    const userNameParam = params.get('userName') || 'Guest';
    const tokenParam = params.get('token') || '';

    setUserId(userIdParam);
    setUserName(userNameParam);
    setToken(tokenParam);
  }, []);

  return (
    <>
      {/* App Header Bar */}
      <div className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">🔢 Sudoku</h1>
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
      </div>

      <div className="ah-container ah-container--narrow">
        <SudokuGame userId={userId} userName={userName} token={token} />
      </div>
    </>
  );
}

export default App;
