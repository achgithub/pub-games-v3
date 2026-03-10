import React, { useState, useEffect, useCallback } from 'react';
import { useGameSocket, SSEEvent } from './hooks/useGameSocket';

interface Guess {
  id: number;
  gameId: string;
  guessNumber: number;
  guessCode: string;
  bulls: number;
  cows: number;
  guessedAt: string;
}

interface Game {
  id: string;
  mode: string;
  variant: string;
  secretCode?: string;
  codeMaker: string;
  codeBreaker: string;
  maxGuesses: number;
  status: string;
  winner?: string;
  guesses: Guess[];
}

interface GameBoardProps {
  gameId: string;
  token: string;
  userId: string;
  userName: string;
}

const COLORS = [
  { code: 'R', name: 'Red', colorClass: 'bc-color-red' },
  { code: 'B', name: 'Blue', colorClass: 'bc-color-blue' },
  { code: 'G', name: 'Green', colorClass: 'bc-color-green' },
  { code: 'Y', name: 'Yellow', colorClass: 'bc-color-yellow' },
  { code: 'O', name: 'Orange', colorClass: 'bc-color-orange' },
  { code: 'P', name: 'Purple', colorClass: 'bc-color-purple' },
];

const NUMBERS = ['0', '1', '2', '3', '4'];

export default function GameBoard({ gameId, token, userId, userName }: GameBoardProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [currentGuess, setCurrentGuess] = useState<string[]>(['', '', '', '']);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = useCallback(async () => {
    try {
      const host = window.location.hostname;
      const port = window.location.port || '4091';
      const response = await fetch(`http://${host}:${port}/api/game/${gameId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch game');
      }

      const data = await response.json();
      // Ensure guesses array exists
      if (!data.guesses) {
        data.guesses = [];
      }
      setGame(data);
    } catch (err) {
      console.error('Error fetching game:', err);
      setError('Failed to load game');
    }
  }, [gameId, token, userId]);

  // Handle SSE events
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'guess_made') {
      fetchGame(); // Refresh game state
    }
  }, [fetchGame]);

  const { connected } = useGameSocket(gameId, token, handleSSEEvent);

  // Fetch initial game state
  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  async function submitGuess() {
    if (currentGuess.some(c => c === '')) {
      setError('Please select all 4 positions');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const host = window.location.hostname;
      const port = window.location.port || '4091';
      const response = await fetch(`http://${host}:${port}/api/game/${gameId}/guess`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guess: currentGuess.join(''),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to submit guess');
      }

      // Clear current guess
      setCurrentGuess(['', '', '', '']);
      setSelectedPosition(0);

      // Refresh game state
      await fetchGame();
    } catch (err: any) {
      console.error('Error submitting guess:', err);
      setError(err.message || 'Failed to submit guess');
    } finally {
      setLoading(false);
    }
  }

  function selectOption(value: string) {
    // Check for duplicates - don't allow same value to be selected twice
    if (currentGuess.includes(value)) {
      setError(`Cannot use ${value} more than once`);
      return;
    }

    setError(null); // Clear any existing error
    const newGuess = [...currentGuess];
    newGuess[selectedPosition] = value;
    setCurrentGuess(newGuess);

    // Auto-advance to next position
    if (selectedPosition < 3) {
      setSelectedPosition(selectedPosition + 1);
    }
  }

  function clearGuess() {
    setCurrentGuess(['', '', '', '']);
    setSelectedPosition(0);
  }

  function getColorClass(code: string): string {
    const color = COLORS.find(c => c.code === code);
    return color ? color.colorClass : '';
  }

  function returnToLobby() {
    window.location.href = `http://${window.location.hostname}:3001`;
  }

  // Loading state
  if (!game) {
    return (
      <>
        <header className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">🐂 Bulls and Cows</h1>
          </div>
          <div className="ah-app-header-right">
            <button className="ah-lobby-btn" onClick={returnToLobby}>
              ← Lobby
            </button>
          </div>
        </header>
        <div className="ah-loading-container">
          <div className="ah-spinner ah-spinner--large"></div>
          <p className="ah-loading-text">Loading game...</p>
        </div>
      </>
    );
  }

  const isGameOver = game.status !== 'active';
  const mode = game.mode;

  return (
    <>
      {/* App Header Bar */}
      <header className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">🐂 Bulls and Cows</h1>
        </div>
        <div className="ah-app-header-right">
          <button className="ah-lobby-btn" onClick={returnToLobby}>
            ← Lobby
          </button>
        </div>
      </header>

      {/* Game Info Bar */}
      <div style={{ width: '100%', background: 'white', borderBottom: '1px solid #e7e5e4', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', maxWidth: '600px', margin: '0 auto', flexWrap: 'wrap' }}>
          <div className="ah-badge" style={{ fontSize: '14px', fontWeight: 500, padding: '6px 12px' }}>
            {mode === 'colors' ? 'Colors' : 'Numbers'}
          </div>
          <div className="ah-badge" style={{ fontSize: '14px', fontWeight: 500, padding: '6px 12px' }}>
            {game.guesses.length} / {game.maxGuesses} Guesses
          </div>
          {game.variant === '2player' && (
            <div className="ah-badge" style={{ fontSize: '14px', fontWeight: 500, padding: '6px 12px' }}>
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ah-container ah-container--narrow" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
        {/* Game Over Banner */}
        {isGameOver && (
          <div className={`ah-banner ${game.status === 'won' ? 'ah-banner--success' : 'ah-banner--error'}`} style={{ marginBottom: '16px' }}>
            {game.status === 'won' ? (
              <>🎉 Congratulations! You cracked the code: <strong>{game.secretCode}</strong></>
            ) : (
              <>😔 Game Over! The code was: <strong>{game.secretCode}</strong></>
            )}
          </div>
        )}

        {error && (
          <div className="ah-banner ah-banner--error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Current Guess Input */}
        {!isGameOver && (
          <div className="ah-card" style={{ marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Your Guess</h3>
            <div className="bc-guess-display">
              {currentGuess.map((value, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedPosition(index)}
                  className={`bc-peg ${selectedPosition === index ? 'selected' : ''} ${value && mode === 'colors' ? 'color-mode ' + getColorClass(value) : ''}`}
                >
                  {value || '?'}
                </div>
              ))}
            </div>

            {/* Selection Interface */}
            {mode === 'colors' ? (
              <div className="bc-color-grid" style={{ marginTop: '16px' }}>
                {COLORS.map(color => (
                  <button
                    key={color.code}
                    onClick={() => selectOption(color.code)}
                    className={`bc-color-btn ${color.colorClass}`}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bc-number-grid" style={{ marginTop: '16px' }}>
                {NUMBERS.map(num => (
                  <button
                    key={num}
                    onClick={() => selectOption(num)}
                    className="ah-btn-outline bc-number-btn"
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="bc-actions" style={{ marginTop: '16px' }}>
              <button
                className="ah-btn-primary"
                onClick={submitGuess}
                disabled={loading || currentGuess.some(c => c === '')}
                style={{ flex: 1 }}
              >
                {loading ? 'Submitting...' : 'Submit Guess'}
              </button>
              <button className="ah-btn-outline" onClick={clearGuess} style={{ minWidth: '80px' }}>
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Guess History */}
        <div className="ah-card">
          <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Guess History</h3>
          {game.guesses.length === 0 ? (
            <p className="ah-meta">No guesses yet</p>
          ) : (
            <div className="bc-history-scroll">
              {[...game.guesses].reverse().map(guess => (
                <div key={guess.id} className="ah-list-item" style={{ marginBottom: '8px' }}>
                  <div className="bc-history-item-content">
                    <div className="bc-guess-number">
                      #{guess.guessNumber}
                    </div>
                    <div className="bc-history-pegs">
                      {guess.guessCode.split('').map((char, i) => (
                        <div
                          key={i}
                          className={`bc-history-peg ${mode === 'colors' ? 'color-mode ' + getColorClass(char) : ''}`}
                        >
                          {char}
                        </div>
                      ))}
                    </div>
                    <div className="bc-feedback">
                      <div className="bc-bulls-badge">
                        ✓ {guess.bulls}
                      </div>
                      <div className="bc-cows-badge">
                        ~ {guess.cows}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="ah-card bc-legend" style={{ marginTop: '16px' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            <strong>Legend:</strong> ✓ Bulls (correct position) | ~ Cows (wrong position)
          </p>
        </div>
      </div>
    </>
  );
}
