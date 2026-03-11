import React, { useState } from 'react';

interface Guess {
  id: number;
  gameId: string;
  turnNumber: number;
  playerId: string;
  guessCode: string;
  bulls: number;
  cows: number;
  guessedAt: string;
}

interface SoloPlayerBoardProps {
  gameId: string;
  token: string;
  userId: string;
  mode: string;
  secretCode?: string;
  guesses: Guess[];
  maxGuesses: number;
  status: string;
  winner?: string;
  onSubmitGuess: (guess: string) => Promise<void>;
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

export default function SoloPlayerBoard({
  gameId,
  token,
  userId,
  mode,
  secretCode,
  guesses,
  maxGuesses,
  status,
  winner,
  onSubmitGuess,
}: SoloPlayerBoardProps) {
  const codeLength = mode === 'colors' ? 4 : 5;
  const [currentGuess, setCurrentGuess] = useState<string[]>(new Array(codeLength).fill(''));
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = mode === 'colors' ? COLORS : NUMBERS.map(n => ({ code: n, name: n, colorClass: '' }));
  const isGameOver = status !== 'active';

  const handleOptionClick = (value: string) => {
    if (isGameOver) return;

    // Check for duplicates
    if (currentGuess.includes(value)) {
      setError('No duplicates allowed');
      setTimeout(() => setError(null), 2000);
      return;
    }

    setError(null);
    const newGuess = [...currentGuess];
    newGuess[selectedPosition] = value;
    setCurrentGuess(newGuess);

    // Move to next empty position
    const nextEmpty = newGuess.findIndex((c, i) => i > selectedPosition && c === '');
    if (nextEmpty !== -1) {
      setSelectedPosition(nextEmpty);
    } else if (selectedPosition < codeLength - 1) {
      setSelectedPosition(selectedPosition + 1);
    }
  };

  const handlePositionClick = (index: number) => {
    if (!isGameOver) {
      setSelectedPosition(index);
    }
  };

  const handleClear = () => {
    if (!isGameOver) {
      setCurrentGuess(new Array(codeLength).fill(''));
      setSelectedPosition(0);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (currentGuess.some(c => c === '')) {
      setError('Complete your guess first');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmitGuess(currentGuess.join(''));
      setCurrentGuess(new Array(codeLength).fill(''));
      setSelectedPosition(0);
    } catch (err: any) {
      setError(err.message || 'Failed to submit guess');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCodePeg = (value: string, index: number, className = '') => {
    const option = mode === 'colors' ? COLORS.find(c => c.code === value) : null;
    return (
      <div
        key={index}
        className={`bc-code-peg ${option ? option.colorClass : ''} ${className}`}
      >
        {mode === 'numbers' && value}
      </div>
    );
  };

  const renderFeedback = (bulls: number, cows: number) => {
    return (
      <div className="bc-feedback">
        <span className="bc-badge bc-badge--bulls">{bulls} ✓</span>
        <span className="bc-badge bc-badge--cows">{cows} ~</span>
      </div>
    );
  };

  return (
    <div className="ah-container ah-container--narrow">
      {/* Game Over Banner */}
      {isGameOver && (
        <div className={`ah-banner ${status === 'won' ? 'ah-banner--success' : 'ah-banner--error'} ah-mb`}>
          {status === 'won' ? (
            <>🎉 You cracked the code: <strong>{secretCode}</strong></>
          ) : (
            <>😔 The code was: <strong>{secretCode}</strong></>
          )}
        </div>
      )}

      {/* Current Guess Input */}
      {!isGameOver && (
        <div className="ah-card ah-mb">
          <h3 className="ah-header">
            <span>Your Guess ({guesses.length}/{maxGuesses})</span>
          </h3>

          <div className="bc-code-row ah-mb-lg">
            {currentGuess.map((value, index) => (
              <button
                key={index}
                className={`bc-code-peg ${selectedPosition === index ? 'bc-code-peg--selected' : ''} ${
                  value && mode === 'colors' ? options.find(o => o.code === value)?.colorClass || '' : ''
                }`}
                onClick={() => handlePositionClick(index)}
              >
                {mode === 'numbers' && value ? value : ''}
                {!value && <span className="bc-code-peg-placeholder">?</span>}
              </button>
            ))}
          </div>

          <div className="bc-options-grid ah-mb-lg">
            {options.map((option) => (
              <button
                key={option.code}
                className={`bc-option-btn ${mode === 'colors' ? option.colorClass : ''} ${
                  currentGuess.includes(option.code) ? 'bc-option-btn--used' : ''
                }`}
                onClick={() => handleOptionClick(option.code)}
                disabled={currentGuess.includes(option.code)}
              >
                {mode === 'numbers' ? option.code : ''}
              </button>
            ))}
          </div>

          {error && (
            <div className="ah-banner ah-banner--error ah-mb">
              {error}
            </div>
          )}

          <div className="ah-btn-group">
            <button className="ah-btn-outline" onClick={handleClear}>
              Clear
            </button>
            <button
              className="ah-btn-primary"
              onClick={handleSubmit}
              disabled={submitting || currentGuess.some(c => c === '')}
            >
              {submitting ? 'Submitting...' : 'Submit Guess'}
            </button>
          </div>
        </div>
      )}

      {/* Guess History */}
      <div className="ah-card">
        <h3 className="ah-header">
          <span>Guess History</span>
        </h3>

        {guesses.length === 0 ? (
          <p className="ah-meta">No guesses yet</p>
        ) : (
          <div>
            {[...guesses].reverse().map(guess => (
              <div key={guess.id} className="bc-guess-row">
                <span className="bc-guess-number">#{guess.turnNumber}</span>
                <div className="bc-code-row bc-code-row--sm">
                  {guess.guessCode.split('').map((value, idx) => renderCodePeg(value, idx, 'bc-code-peg--sm'))}
                </div>
                {renderFeedback(guess.bulls, guess.cows)}
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <p className="ah-meta ah-mt-lg">
          <strong>Legend:</strong> ✓ Bulls (correct position) | ~ Cows (wrong position)
        </p>
      </div>
    </div>
  );
}
