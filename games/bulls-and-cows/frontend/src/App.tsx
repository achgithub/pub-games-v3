import React, { useState, useEffect } from 'react';
import GameBoard from './GameBoard';

function App() {
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [mode, setMode] = useState<'colors' | 'numbers' | null>(null);
  const [variant, setVariant] = useState<'1player' | '2player' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    const userIdParam = params.get('userId') || '';
    const userNameParam = params.get('userName') || '';
    const tokenParam = params.get('token') || '';
    const gameIdParam = params.get('gameId') || null;

    setUserId(userIdParam);
    setUserName(userNameParam);
    setToken(tokenParam);

    // If gameId provided (2-player challenge), fetch game details
    if (gameIdParam) {
      fetchGameDetails(gameIdParam, tokenParam, userIdParam);
    }
  }, []);

  async function fetchGameDetails(gId: string, tok: string, uId: string) {
    try {
      const host = window.location.hostname;
      const port = window.location.port || '4091';
      const response = await fetch(`http://${host}:${port}/api/game/${gId}`, {
        headers: {
          'Authorization': `Bearer ${tok}`,
          'X-User-ID': uId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch game');
      }

      const game = await response.json();
      setGameId(gId);
      setMode(game.mode);
      setVariant(game.variant);
    } catch (err) {
      console.error('Error fetching game:', err);
      setError('Failed to load game. Please try again.');
    }
  }

  async function createGame(selectedMode: 'colors' | 'numbers', selectedVariant: '1player' | '2player') {
    setLoading(true);
    setError(null);

    try {
      const host = window.location.hostname;
      const port = window.location.port || '4091';
      const response = await fetch(`http://${host}:${port}/api/game`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: selectedMode,
          variant: selectedVariant,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create game');
      }

      const game = await response.json();
      setGameId(game.id);
      setMode(selectedMode);
      setVariant(selectedVariant);
    } catch (err) {
      console.error('Error creating game:', err);
      setError('Failed to create game. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleModeSelect(selectedMode: 'colors' | 'numbers') {
    setMode(selectedMode);
  }

  function handleVariantSelect(selectedVariant: '1player' | '2player') {
    setVariant(selectedVariant);
    createGame(mode!, selectedVariant);
  }

  function handleExit() {
    setGameId(null);
    setMode(null);
    setVariant(null);
  }

  // Show game board if we have all required info
  if (gameId && mode && variant && token && userId) {
    return (
      <GameBoard
        gameId={gameId}
        token={token}
        userId={userId}
        mode={mode}
        variant={variant}
        onExit={handleExit}
      />
    );
  }

  // Show mode selection
  return (
    <div className="ah-container">
      <div className="ah-header">
        <h1>🐂 Bulls and Cows</h1>
      </div>

      <div className="ah-card">
        <h2>Welcome, {userName}!</h2>
        <p>Crack the secret code by guessing the right combination.</p>
      </div>

      {error && (
        <div className="ah-banner ah-banner--error">
          {error}
        </div>
      )}

      {!mode && (
        <div className="ah-card">
          <h3>Select Mode</h3>
          <div className="bc-mode-grid">
            <button
              className="ah-btn-primary bc-mode-btn"
              onClick={() => handleModeSelect('colors')}
            >
              <div className="bc-mode-title">Colors</div>
              <div className="bc-mode-desc">
                6 colors (Red, Blue, Green, Yellow, Orange, Purple)
              </div>
            </button>
            <button
              className="ah-btn-primary bc-mode-btn"
              onClick={() => handleModeSelect('numbers')}
            >
              <div className="bc-mode-title">Numbers</div>
              <div className="bc-mode-desc">
                Digits 0-9
              </div>
            </button>
          </div>
        </div>
      )}

      {mode && !variant && (
        <div className="ah-card">
          <h3>Select Variant</h3>
          <div className="bc-mode-grid">
            <button
              className="ah-btn-primary bc-mode-btn"
              onClick={() => handleVariantSelect('1player')}
              disabled={loading}
            >
              <div className="bc-mode-title">1 Player</div>
              <div className="bc-mode-desc">
                Play against AI
              </div>
            </button>
            <button
              className="ah-btn-primary bc-mode-btn"
              onClick={() => handleVariantSelect('2player')}
              disabled={loading}
            >
              <div className="bc-mode-title">2 Player</div>
              <div className="bc-mode-desc">
                Challenge another player
              </div>
            </button>
          </div>
          <button
            className="ah-btn-outline"
            onClick={() => setMode(null)}
          >
            Back
          </button>
        </div>
      )}

      {/* How to Play */}
      <div className="ah-card bc-legend">
        <h3>How to Play</h3>
        <ol>
          <li>
            The code maker creates a secret code of 4 pegs
          </li>
          <li>
            The code breaker tries to guess the code
          </li>
          <li>
            After each guess, you get feedback:
            <ul>
              <li><strong>Bulls (✓)</strong>: Correct item in correct position</li>
              <li><strong>Cows (~)</strong>: Correct item in wrong position</li>
            </ul>
          </li>
          <li>You have 12 guesses to crack the code</li>
        </ol>
      </div>
    </div>
  );
}

export default App;
