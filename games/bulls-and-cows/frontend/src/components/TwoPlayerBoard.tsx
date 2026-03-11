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

interface TwoPlayerBoardProps {
  gameId: string;
  token: string;
  userId: string;
  mode: string;
  myCode: string;
  opponentLastGuess: Guess | null;
  myGuesses: Guess[];
  currentTurn: number;
  maxGuesses: number;
  status: string;
  winner?: string;
  waitingForOpponent: boolean;
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

export default function TwoPlayerBoard({
  gameId,
  token,
  userId,
  mode,
  myCode,
  opponentLastGuess,
  myGuesses,
  currentTurn,
  maxGuesses,
  status,
  winner,
  waitingForOpponent,
  onSubmitGuess,
}: TwoPlayerBoardProps) {
  const codeLength = mode === 'colors' ? 4 : 5;
  const [currentGuess, setCurrentGuess] = useState<string[]>(new Array(codeLength).fill(''));
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealingCode, setRevealingCode] = useState(false);

  const options = mode === 'colors' ? COLORS : NUMBERS.map(n => ({ code: n, name: n, colorClass: '' }));

  // Check if I've guessed this turn
  const myTurnGuess = myGuesses.find(g => g.turnNumber === currentTurn);
  const hasGuessedThisTurn = !!myTurnGuess;

  const handleOptionClick = (value: string) => {
    if (hasGuessedThisTurn || status !== 'active') return;

    // Check for duplicates
    if (currentGuess.includes(value)) {
      setError('No duplicates allowed');
      setTimeout(() => setError(null), 2000);
      return;
    }

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
    if (!hasGuessedThisTurn && status === 'active') {
      setSelectedPosition(index);
    }
  };

  const handleClear = () => {
    if (!hasGuessedThisTurn && status === 'active') {
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
      {/* My Code (Privacy Toggle) */}
      <div className="ah-card ah-mb">
        <h3 className="ah-header">
          <span>My Secret Code</span>
          <button
            className="ah-btn-outline ah-btn-sm bc-reveal-btn"
            onMouseDown={() => setRevealingCode(true)}
            onMouseUp={() => setRevealingCode(false)}
            onMouseLeave={() => setRevealingCode(false)}
            onTouchStart={() => setRevealingCode(true)}
            onTouchEnd={() => setRevealingCode(false)}
            title="Press and hold to reveal"
          >
            👁️
          </button>
        </h3>
        <div className="bc-code-row">
          {revealingCode
            ? myCode.split('').map((value, index) => renderCodePeg(value, index))
            : new Array(codeLength).fill('*').map((_, index) => (
                <div key={index} className="bc-code-peg bc-code-peg--hidden">
                  *
                </div>
              ))}
        </div>
      </div>

      {/* Opponent's Last Guess */}
      {opponentLastGuess && (
        <div className="ah-card ah-mb">
          <h3 className="ah-header">
            <span>Opponent's Progress</span>
          </h3>
          <div className="bc-opponent-progress">
            <span className="ah-meta">Last guess:</span>
            {renderFeedback(opponentLastGuess.bulls, opponentLastGuess.cows)}
          </div>
        </div>
      )}

      {/* My Guesses */}
      <div className="ah-card">
        <h3 className="ah-header">
          <span>My Guesses ({myGuesses.length}/{maxGuesses})</span>
        </h3>

        {/* Guess history */}
        <div className="ah-mb-lg">
          {myGuesses.map((guess, index) => (
            <div key={guess.id} className="bc-guess-row">
              <span className="bc-guess-number">#{guess.turnNumber}</span>
              <div className="bc-code-row bc-code-row--sm">
                {guess.guessCode.split('').map((value, idx) => renderCodePeg(value, idx, 'bc-code-peg--sm'))}
              </div>
              {renderFeedback(guess.bulls, guess.cows)}
            </div>
          ))}
        </div>

        {/* Current guess input */}
        {status === 'active' && !hasGuessedThisTurn && (
          <>
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
          </>
        )}

        {/* Waiting indicator */}
        {status === 'active' && hasGuessedThisTurn && (
          <div className="ah-banner bc-waiting-banner">
            ⏳ Waiting for opponent to guess...
          </div>
        )}

        {/* Game over */}
        {status !== 'active' && status !== 'code_setting' && (
          <div className={`ah-banner ${status === 'won' && winner === userId ? 'ah-banner--success' : ''}`}>
            {status === 'won' && winner === userId && '🎉 You won!'}
            {status === 'won' && winner !== userId && '😞 Opponent won'}
            {status === 'draw' && '🤝 Draw!'}
          </div>
        )}
      </div>
    </div>
  );
}
