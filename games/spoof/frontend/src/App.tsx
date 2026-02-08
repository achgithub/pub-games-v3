import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

interface PlayerInfo {
  id: string;
  name: string;
  coinsInHand?: number;
  hasSelected: boolean;
  hasGuessed: boolean;
  guess?: number;
  isEliminated: boolean;
  order: number;
  coinsRemaining: number;
}

interface RoundData {
  roundNumber: number;
  guessingPlayerIndex: number;
  guessesThisRound: { [key: string]: number };
  usedGuesses: number[];
  totalCoins?: number;
  winnerThisRound?: string;
  eliminatedThisRound?: string;
}

interface GameState {
  id: string;
  challengeId: string;
  players: PlayerInfo[];
  status: string;
  currentRound: number;
  roundData?: RoundData;
  eliminatedIds: string[];
  winnerId?: string;
  startedAt: number;
  updatedAt: number;
}

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoins, setSelectedCoins] = useState<number>(0);
  const [guessInput, setGuessInput] = useState<string>('');

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');
  const userId = urlParams.get('userId');

  const host = window.location.hostname;
  const API_BASE = `http://${host}:4051/api`;

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch game state
  const fetchGame = useCallback(async () => {
    if (!gameId || !userId) {
      setError('Missing gameId or userId');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/game/${gameId}?userId=${userId}`);
      const data = await response.json();

      if (data.success && data.game) {
        setGameState(data.game);
        setError(null);
      } else {
        setError(data.error || 'Failed to load game');
      }
    } catch (err) {
      console.error('Failed to fetch game:', err);
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, [gameId, userId, API_BASE]);

  // Select coins (0-3)
  const handleSelectCoins = async () => {
    if (!gameId || !userId) return;

    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerId: userId,
          coinsInHand: selectedCoins,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Game will update via SSE
      } else {
        setError(data.error || 'Failed to select coins');
      }
    } catch (err) {
      console.error('Failed to select coins:', err);
      setError('Connection error');
    }
  };

  // Make a guess
  const handleMakeGuess = async () => {
    if (!gameId || !userId || !guessInput) return;

    const guess = parseInt(guessInput, 10);
    if (isNaN(guess)) return;

    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerId: userId,
          guess,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setGuessInput('');
        // Game will update via SSE
      } else {
        setError(data.error || 'Failed to make guess');
      }
    } catch (err) {
      console.error('Failed to make guess:', err);
      setError('Connection error');
    }
  };

  // Setup SSE for real-time updates
  useEffect(() => {
    if (!gameId) return;

    fetchGame();

    const eventSource = new EventSource(`${API_BASE}/game/${gameId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'game_update') {
        fetchGame();
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE connection lost, will auto-reconnect');
    };

    return () => {
      eventSource.close();
    };
  }, [gameId, API_BASE, fetchGame]);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading Spoof game...</div>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="app">
        <div className="error">
          <h2>Error</h2>
          <p>{error || 'Game not found'}</p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.id === userId);
  if (!currentPlayer) {
    return (
      <div className="app">
        <div className="error">You are not a player in this game</div>
      </div>
    );
  }

  const isActive = !currentPlayer.isEliminated;
  const activePlayers = gameState.players.filter(p => !p.isEliminated);
  const maxPossibleGuess = activePlayers.reduce((sum, p) => sum + p.coinsRemaining, 0);

  return (
    <div className="app">
      <header className="game-header">
        <h1>🪙 Spoof</h1>
        <div className="round-info">Round {gameState.currentRound}</div>
      </header>

      <div className="game-container">
        {/* Game Status */}
        <div className={`status-banner status-${gameState.status}`}>
          {gameState.status === 'coin_selection' && 'Select your coins (0-3)'}
          {gameState.status === 'guessing' && 'Make your guesses!'}
          {gameState.status === 'reveal' && 'Round Complete!'}
          {gameState.status === 'finished' && 'Game Over!'}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Players Display */}
        <div className="players-container">
          {gameState.players.map((player) => {
            const isCurrentUser = player.id === userId;
            const playerActive = !player.isEliminated;

            return (
              <div
                key={player.id}
                className={`player-card ${isCurrentUser ? 'current-user' : ''} ${
                  !playerActive ? 'eliminated' : ''
                }`}
              >
                <div className="player-header">
                  <span className="player-name">
                    {player.name} {isCurrentUser && '(You)'}
                  </span>
                  {!playerActive && <span className="eliminated-badge">Eliminated</span>}
                </div>

                <div className="player-stats">
                  <div className="stat">
                    <span className="stat-label">Coins left:</span>
                    <span className="stat-value">{player.coinsRemaining}</span>
                  </div>

                  {gameState.status !== 'coin_selection' && (
                    <div className="stat">
                      <span className="stat-label">
                        {gameState.status === 'reveal' || gameState.status === 'finished'
                          ? 'Had:'
                          : 'Status:'}
                      </span>
                      {gameState.status === 'reveal' || gameState.status === 'finished' ? (
                        <span className="stat-value">
                          {player.coinsInHand !== undefined ? (
                            <>
                              {Array.from({ length: player.coinsInHand }).map((_, i) => (
                                <span key={i} className="coin-icon">
                                  🪙
                                </span>
                              ))}
                              {player.coinsInHand === 0 && <span>Empty</span>}
                            </>
                          ) : (
                            '?'
                          )}
                        </span>
                      ) : (
                        <span className="stat-value">
                          {player.hasSelected ? '✓ Ready' : '⏳ Selecting...'}
                        </span>
                      )}
                    </div>
                  )}

                  {gameState.status === 'guessing' && player.hasGuessed && (
                    <div className="stat">
                      <span className="stat-label">Guessed:</span>
                      <span className="stat-value guess-value">{player.guess}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Coin Selection Phase */}
        {gameState.status === 'coin_selection' && isActive && !currentPlayer.hasSelected && (
          <div className="action-panel">
            <h3>Your Turn - Select Coins</h3>
            <p className="hint">Choose how many coins to hide in your hand (0-{currentPlayer.coinsRemaining})</p>

            <div className="coin-selector">
              {Array.from({ length: currentPlayer.coinsRemaining + 1 }).map((_, count) => (
                <button
                  key={count}
                  className={`coin-btn ${selectedCoins === count ? 'selected' : ''}`}
                  onClick={() => setSelectedCoins(count)}
                >
                  <span className="coin-count">{count}</span>
                  <div className="coin-visual">
                    {count === 0 ? (
                      <span className="empty-hand">Empty</span>
                    ) : (
                      Array.from({ length: count }).map((_, i) => (
                        <span key={i} className="coin">
                          🪙
                        </span>
                      ))
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button className="action-btn primary" onClick={handleSelectCoins}>
              Confirm Selection
            </button>
          </div>
        )}

        {/* Guessing Phase */}
        {gameState.status === 'guessing' && isActive && !currentPlayer.hasGuessed && (
          <div className="action-panel">
            <h3>Make Your Guess</h3>
            <p className="hint">
              Guess the total number of coins in all hands (0-{maxPossibleGuess})
            </p>

            {gameState.roundData && gameState.roundData.usedGuesses.length > 0 && (
              <div className="used-guesses">
                <strong>Already guessed:</strong> {gameState.roundData.usedGuesses.sort((a, b) => a - b).join(', ')}
              </div>
            )}

            <div className="guess-input-container">
              <input
                type="number"
                min="0"
                max={maxPossibleGuess}
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="Enter your guess"
                className="guess-input"
              />
              <button
                className="action-btn primary"
                onClick={handleMakeGuess}
                disabled={!guessInput || parseInt(guessInput) < 0 || parseInt(guessInput) > maxPossibleGuess}
              >
                Submit Guess
              </button>
            </div>
          </div>
        )}

        {/* Waiting State */}
        {((gameState.status === 'coin_selection' && currentPlayer.hasSelected) ||
          (gameState.status === 'guessing' && currentPlayer.hasGuessed)) && (
          <div className="waiting-panel">
            <div className="spinner">⏳</div>
            <p>Waiting for other players...</p>
          </div>
        )}

        {/* Reveal Phase */}
        {gameState.status === 'reveal' && gameState.roundData && (
          <div className="reveal-panel">
            <h2>Round {gameState.currentRound} Result</h2>

            <div className="total-coins">
              <strong>Total Coins:</strong>
              <span className="total-value">{gameState.roundData.totalCoins}</span>
            </div>

            {gameState.roundData.winnerThisRound && (
              <div className="round-result success">
                <h3>🎉 Winner!</h3>
                <p>
                  <strong>
                    {gameState.players.find(p => p.id === gameState.roundData?.winnerThisRound)?.name}
                  </strong>{' '}
                  guessed correctly and loses 1 coin!
                </p>
              </div>
            )}

            {gameState.roundData.eliminatedThisRound && (
              <div className="round-result eliminated">
                <h3>❌ Eliminated</h3>
                <p>
                  <strong>
                    {gameState.players.find(p => p.id === gameState.roundData?.eliminatedThisRound)?.name}
                  </strong>{' '}
                  had 0 coins and is out of the game
                </p>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={() => fetchGame()}
              style={{ marginTop: '1rem' }}
            >
              Next Round
            </button>
          </div>
        )}

        {/* Game Over */}
        {gameState.status === 'finished' && gameState.winnerId && (
          <div className="game-over">
            <h2>🏆 Game Over!</h2>
            <div className="winner-announcement">
              <strong>{gameState.players.find(p => p.id === gameState.winnerId)?.name}</strong> wins!
            </div>
            <button className="action-btn secondary" onClick={() => (window.location.href = '/')}>
              Return to Lobby
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
