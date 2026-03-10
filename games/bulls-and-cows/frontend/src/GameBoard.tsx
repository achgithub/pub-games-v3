import React, { useState, useEffect } from 'react';
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
  mode: string;
  variant: string;
  onExit: () => void;
}

const COLORS = [
  { code: 'R', name: 'Red', colorClass: 'bc-color-red' },
  { code: 'B', name: 'Blue', colorClass: 'bc-color-blue' },
  { code: 'G', name: 'Green', colorClass: 'bc-color-green' },
  { code: 'Y', name: 'Yellow', colorClass: 'bc-color-yellow' },
  { code: 'O', name: 'Orange', colorClass: 'bc-color-orange' },
  { code: 'P', name: 'Purple', colorClass: 'bc-color-purple' },
];

const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function GameBoard({ gameId, token, userId, mode, variant, onExit }: GameBoardProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [currentGuess, setCurrentGuess] = useState<string[]>(['', '', '', '']);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connected, lastEvent } = useGameSocket(gameId, token, handleSSEEvent);

  // Fetch initial game state
  useEffect(() => {
    fetchGame();
  }, [gameId]);

  // Handle SSE events
  function handleSSEEvent(event: SSEEvent) {
    if (event.type === 'guess_made') {
      fetchGame(); // Refresh game state
    }
  }

  async function fetchGame() {
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
      setGame(data);
    } catch (err) {
      console.error('Error fetching game:', err);
      setError('Failed to load game');
    }
  }

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

  if (!game) {
    return (
      <div className="ah-container">
        <div className="ah-card">
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  const isGameOver = game.status !== 'active';

  return (
    <div className="ah-container">
      {/* Header */}
      <div className="ah-header">
        <h1>🐂 Bulls and Cows</h1>
        <button className="ah-btn-outline" onClick={onExit}>Exit</button>
      </div>

      {/* Connection Status */}
      {variant === '2player' && (
        <div className="bc-status">
          {connected ? (
            <span className="bc-status-connected">🟢 Connected</span>
          ) : (
            <span className="bc-status-disconnected">🔴 Reconnecting...</span>
          )}
        </div>
      )}

      {/* Game Info */}
      <div className="ah-card">
        <div className="bc-game-info">
          <div>
            <strong>Mode:</strong> {mode === 'colors' ? 'Colors' : 'Numbers'}
          </div>
          <div>
            <strong>Guesses:</strong> {game.guesses.length} / {game.maxGuesses}
          </div>
          <div>
            <strong>Status:</strong> {game.status}
          </div>
        </div>
      </div>

      {/* Game Over Banner */}
      {isGameOver && (
        <div className={`ah-banner ${game.status === 'won' ? 'ah-banner--success' : 'ah-banner--error'}`}>
          {game.status === 'won' ? (
            <>🎉 Congratulations! You cracked the code: <strong>{game.secretCode}</strong></>
          ) : (
            <>😔 Game Over! The code was: <strong>{game.secretCode}</strong></>
          )}
        </div>
      )}

      {error && (
        <div className="ah-banner ah-banner--error">
          {error}
        </div>
      )}

      {!isGameOver && (
        <>
          {/* Current Guess Display */}
          <div className="ah-card">
            <h3>Your Guess</h3>
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
              <div className="bc-color-grid">
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
              <div className="bc-number-grid">
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
            <div className="bc-actions">
              <button
                className="ah-btn-primary"
                onClick={submitGuess}
                disabled={loading || currentGuess.some(c => c === '')}
              >
                {loading ? 'Submitting...' : 'Submit Guess'}
              </button>
              <button className="ah-btn-outline" onClick={clearGuess}>
                Clear
              </button>
            </div>
          </div>
        </>
      )}

      {/* Guess History */}
      <div className="ah-card">
        <h3>Guess History</h3>
        {game.guesses.length === 0 ? (
          <p className="ah-text-muted">No guesses yet</p>
        ) : (
          <div className="bc-history-scroll">
            {[...game.guesses].reverse().map(guess => (
              <div key={guess.id} className="ah-list-item">
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
      <div className="ah-card bc-legend">
        <strong>Legend:</strong> ✓ Bulls (correct position) | ~ Cows (wrong position)
      </div>
    </div>
  );
}
