import React, { useState, useEffect, useRef } from 'react';

interface SudokuGameProps {
  userId: string;
  userName: string;
}

// Helper: Check if a number is valid in a position
function isValid(board: number[][], row: number, col: number, num: number): boolean {
  // Check row
  for (let x = 0; x < 9; x++) {
    if (x !== col && board[row][x] === num) return false;
  }

  // Check column
  for (let x = 0; x < 9; x++) {
    if (x !== row && board[x][col] === num) return false;
  }

  // Check 3x3 box
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const r = startRow + i;
      const c = startCol + j;
      if (r !== row || c !== col) {
        if (board[r][c] === num) return false;
      }
    }
  }

  return true;
}

// Helper: Check if puzzle is complete and valid
function isComplete(board: number[][]): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const num = board[row][col];
      if (num === 0) return false;
      if (!isValid(board, row, col, num)) return false;
    }
  }
  return true;
}

// Sample puzzle (easy difficulty)
const SAMPLE_PUZZLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

const SudokuGame: React.FC<SudokuGameProps> = ({ userId, userName }) => {
  const [puzzle, setPuzzle] = useState<number[][]>(SAMPLE_PUZZLE);
  const [board, setBoard] = useState<number[][]>(SAMPLE_PUZZLE.map(row => [...row]));
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isPuzzleComplete, setIsPuzzleComplete] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (!isPaused && !isPuzzleComplete) {
      timerRef.current = setInterval(() => {
        setElapsedTime(t => t + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, isPuzzleComplete]);

  // Handle visibility change (pause when tab is hidden or mobile disconnects)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Check completion whenever board changes
  useEffect(() => {
    if (isComplete(board)) {
      setIsPuzzleComplete(true);
      // TODO: Save completion to backend
    }
  }, [board]);

  const handleCellChange = (row: number, col: number, value: string) => {
    // Ignore if cell is prefilled
    if (puzzle[row][col] !== 0) return;

    const num = value === '' ? 0 : parseInt(value, 10);
    if (num < 0 || num > 9 || isNaN(num)) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = num;
    setBoard(newBoard);
  };

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell([row, col]);
  };

  const handleReset = () => {
    if (window.confirm('Reset puzzle? All progress will be lost.')) {
      setBoard(puzzle.map(row => [...row]));
      setElapsedTime(0);
      setIsPaused(false);
      setIsPuzzleComplete(false);
      setSelectedCell(null);
    }
  };

  const handleNewGame = () => {
    // For now, just reset. Later: fetch new puzzle from backend
    setBoard(SAMPLE_PUZZLE.map(row => [...row]));
    setPuzzle(SAMPLE_PUZZLE.map(row => [...row]));
    setElapsedTime(0);
    setIsPaused(false);
    setIsPuzzleComplete(false);
    setSelectedCell(null);
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCellClass = (row: number, col: number): string => {
    const classes = ['sudoku-cell'];

    if (puzzle[row][col] !== 0) {
      classes.push('prefilled');
    } else if (board[row][col] !== 0) {
      classes.push('user-filled');

      // Check for conflicts
      if (!isValid(board, row, col, board[row][col])) {
        classes.push('conflict');
      }
    }

    if (selectedCell && selectedCell[0] === row && selectedCell[1] === col) {
      classes.push('selected');
    }

    return classes.join(' ');
  };

  return (
    <div className="sudoku-container">
      {/* Timer */}
      <div className={`sudoku-timer ${isPaused ? 'paused' : ''}`}>
        {formatTime(elapsedTime)}
        {isPaused && ' (PAUSED)'}
      </div>

      {/* Completion message */}
      {isPuzzleComplete && (
        <div className="sudoku-complete">
          🎉 Puzzle Complete! Time: {formatTime(elapsedTime)}
        </div>
      )}

      {/* Board */}
      <div className="sudoku-board">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={getCellClass(rowIndex, colIndex)}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              <input
                type="number"
                min="1"
                max="9"
                value={cell === 0 ? '' : cell}
                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                disabled={puzzle[rowIndex][colIndex] !== 0 || isPuzzleComplete}
                readOnly={puzzle[rowIndex][colIndex] !== 0}
              />
            </div>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="sudoku-controls">
        {!isPuzzleComplete && (
          <button
            className="ah-btn-outline"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        )}
        <button
          className="ah-btn-outline"
          onClick={handleReset}
        >
          Reset
        </button>
        <button
          className="ah-btn-primary"
          onClick={handleNewGame}
        >
          New Game
        </button>
      </div>

      {/* Instructions */}
      <div className="ah-card sudoku-instructions">
        <h3>How to Play</h3>
        <ul>
          <li>Fill in the empty cells with numbers 1-9</li>
          <li>Each row must contain 1-9 without repeating</li>
          <li>Each column must contain 1-9 without repeating</li>
          <li>Each 3×3 box must contain 1-9 without repeating</li>
          <li>Conflicting numbers are highlighted in red</li>
          <li>Timer pauses automatically when tab is hidden</li>
        </ul>
      </div>
    </div>
  );
};

export default SudokuGame;
