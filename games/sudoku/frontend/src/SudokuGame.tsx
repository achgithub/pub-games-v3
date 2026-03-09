import React, { useState, useEffect } from 'react';

interface SudokuGameProps {
  userId: string;
  userName: string;
}

interface CellNotes {
  [key: string]: Set<number>; // "row-col": Set of note numbers
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

// Puzzle library with different difficulties
interface Puzzle {
  id: number;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  grid: number[][];
}

const PUZZLE_LIBRARY: Puzzle[] = [
  {
    id: 1,
    name: 'Easy Puzzle 1',
    difficulty: 'easy',
    grid: [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ]
  },
  {
    id: 2,
    name: 'Easy Puzzle 2',
    difficulty: 'easy',
    grid: [
      [0, 0, 0, 2, 6, 0, 7, 0, 1],
      [6, 8, 0, 0, 7, 0, 0, 9, 0],
      [1, 9, 0, 0, 0, 4, 5, 0, 0],
      [8, 2, 0, 1, 0, 0, 0, 4, 0],
      [0, 0, 4, 6, 0, 2, 9, 0, 0],
      [0, 5, 0, 0, 0, 3, 0, 2, 8],
      [0, 0, 9, 3, 0, 0, 0, 7, 4],
      [0, 4, 0, 0, 5, 0, 0, 3, 6],
      [7, 0, 3, 0, 1, 8, 0, 0, 0]
    ]
  },
  {
    id: 3,
    name: 'Medium Puzzle 1',
    difficulty: 'medium',
    grid: [
      [0, 2, 0, 6, 0, 8, 0, 0, 0],
      [5, 8, 0, 0, 0, 9, 7, 0, 0],
      [0, 0, 0, 0, 4, 0, 0, 0, 0],
      [3, 7, 0, 0, 0, 0, 5, 0, 0],
      [6, 0, 0, 0, 0, 0, 0, 0, 4],
      [0, 0, 8, 0, 0, 0, 0, 1, 3],
      [0, 0, 0, 0, 2, 0, 0, 0, 0],
      [0, 0, 9, 8, 0, 0, 0, 3, 6],
      [0, 0, 0, 3, 0, 6, 0, 9, 0]
    ]
  },
  {
    id: 4,
    name: 'Medium Puzzle 2',
    difficulty: 'medium',
    grid: [
      [0, 0, 0, 0, 0, 0, 6, 8, 0],
      [0, 0, 0, 0, 7, 3, 0, 0, 9],
      [3, 0, 9, 0, 0, 0, 0, 4, 5],
      [4, 9, 0, 0, 0, 0, 0, 0, 0],
      [8, 0, 3, 0, 5, 0, 9, 0, 2],
      [0, 0, 0, 0, 0, 0, 0, 3, 6],
      [9, 6, 0, 0, 0, 0, 3, 0, 8],
      [7, 0, 0, 6, 8, 0, 0, 0, 0],
      [0, 2, 8, 0, 0, 0, 0, 0, 0]
    ]
  },
  {
    id: 5,
    name: 'Hard Puzzle 1',
    difficulty: 'hard',
    grid: [
      [0, 0, 0, 6, 0, 0, 4, 0, 0],
      [7, 0, 0, 0, 0, 3, 6, 0, 0],
      [0, 0, 0, 0, 9, 1, 0, 8, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 5, 0, 1, 8, 0, 0, 0, 3],
      [0, 0, 0, 3, 0, 6, 0, 4, 5],
      [0, 4, 0, 2, 0, 0, 0, 6, 0],
      [9, 0, 3, 0, 0, 0, 0, 0, 0],
      [0, 2, 0, 0, 0, 0, 1, 0, 0]
    ]
  }
];

const SudokuGame: React.FC<SudokuGameProps> = ({ userId, userName }) => {
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [puzzle, setPuzzle] = useState<number[][]>([]);
  const [board, setBoard] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [isPuzzleComplete, setIsPuzzleComplete] = useState(false);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<CellNotes>({});
  const [showNumberPicker, setShowNumberPicker] = useState(false);

  // Check completion whenever board changes
  useEffect(() => {
    if (isComplete(board)) {
      setIsPuzzleComplete(true);
      // TODO: Save completion to backend
    }
  }, [board]);

  const handleCellClick = (row: number, col: number) => {
    // Ignore if cell is prefilled
    if (puzzle[row][col] !== 0) return;

    setSelectedCell([row, col]);
    setShowNumberPicker(true);
  };

  const handleNumberSelect = (num: number) => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;

    if (notesMode) {
      // Toggle note for this cell
      const key = `${row}-${col}`;
      const cellNotes = new Set(notes[key] || []);
      if (cellNotes.has(num)) {
        cellNotes.delete(num);
      } else {
        cellNotes.add(num);
      }
      setNotes({ ...notes, [key]: cellNotes });
    } else {
      // Set the number
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = num;
      setBoard(newBoard);

      // Clear notes for this cell
      const key = `${row}-${col}`;
      if (notes[key]) {
        const newNotes = { ...notes };
        delete newNotes[key];
        setNotes(newNotes);
      }
    }

    setShowNumberPicker(false);
  };

  const handleClearCell = () => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 0;
    setBoard(newBoard);

    // Clear notes for this cell
    const key = `${row}-${col}`;
    if (notes[key]) {
      const newNotes = { ...notes };
      delete newNotes[key];
      setNotes(newNotes);
    }

    setShowNumberPicker(false);
  };

  const handleSelectPuzzle = (puzzleData: Puzzle) => {
    setCurrentPuzzle(puzzleData);
    setPuzzle(puzzleData.grid.map(row => [...row]));
    setBoard(puzzleData.grid.map(row => [...row]));
    setIsPuzzleComplete(false);
    setSelectedCell(null);
    setNotes({});
  };

  const handleBackToLibrary = () => {
    setCurrentPuzzle(null);
    setPuzzle([]);
    setBoard([]);
    setIsPuzzleComplete(false);
    setSelectedCell(null);
    setNotes({});
  };

  const handleReset = () => {
    if (window.confirm('Reset puzzle? All progress will be lost.')) {
      setBoard(puzzle.map(row => [...row]));
      setIsPuzzleComplete(false);
      setSelectedCell(null);
      setNotes({});
    }
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

  const renderCellContent = (row: number, col: number) => {
    const cellValue = board[row][col];
    const key = `${row}-${col}`;
    const cellNotes = notes[key];

    if (cellValue !== 0) {
      return <div className="sudoku-cell-value">{cellValue}</div>;
    }

    if (cellNotes && cellNotes.size > 0 && !notesMode) {
      return (
        <div className="sudoku-cell-notes">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <span key={n} className={cellNotes.has(n) ? 'visible' : 'hidden'}>
              {n}
            </span>
          ))}
        </div>
      );
    }

    return null;
  };

  // If no puzzle selected, show library
  if (!currentPuzzle) {
    return (
      <div className="sudoku-container">
        <h2 className="sudoku-library-title">Puzzle Library</h2>
        <p className="sudoku-library-subtitle">Select a puzzle to play</p>

        <div className="sudoku-library-grid">
          {PUZZLE_LIBRARY.map(puzzleData => (
            <div
              key={puzzleData.id}
              className="sudoku-puzzle-card"
              onClick={() => handleSelectPuzzle(puzzleData)}
            >
              <div className="sudoku-puzzle-icon">🔢</div>
              <h3 className="sudoku-puzzle-name">{puzzleData.name}</h3>
              <span className={`sudoku-puzzle-difficulty ${puzzleData.difficulty}`}>
                {puzzleData.difficulty.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        <div className="ah-card sudoku-instructions">
          <h3>About Sudoku</h3>
          <p>
            Sudoku is a logic-based number puzzle. Fill the 9×9 grid so that each row,
            column, and 3×3 box contains the numbers 1-9 without repetition.
          </p>
          <ul>
            <li><strong>Easy:</strong> More numbers filled in, good for beginners</li>
            <li><strong>Medium:</strong> Moderate challenge, requires some strategy</li>
            <li><strong>Hard:</strong> Fewer clues, requires advanced techniques</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="sudoku-container">
      {/* Puzzle Header */}
      <div className="sudoku-header">
        <button className="ah-btn-outline" onClick={handleBackToLibrary}>
          ← Library
        </button>
        <div className="sudoku-current-puzzle">
          <h2>{currentPuzzle.name}</h2>
          <span className={`sudoku-puzzle-difficulty ${currentPuzzle.difficulty}`}>
            {currentPuzzle.difficulty.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Completion message */}
      {isPuzzleComplete && (
        <div className="sudoku-complete">
          🎉 Puzzle Complete!
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
              {renderCellContent(rowIndex, colIndex)}
            </div>
          ))
        )}
      </div>

      {/* Number Picker Popup */}
      {showNumberPicker && selectedCell && (
        <div className="sudoku-number-picker-overlay" onClick={() => setShowNumberPicker(false)}>
          <div className="sudoku-number-picker" onClick={(e) => e.stopPropagation()}>
            <div className="sudoku-picker-title">
              {notesMode ? 'Select Note' : 'Select Number'}
            </div>
            <div className="sudoku-picker-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                const [row, col] = selectedCell;
                const isUsedInRow = board[row].includes(num);
                const isUsedInCol = board.some(r => r[col] === num);
                const boxRow = Math.floor(row / 3) * 3;
                const boxCol = Math.floor(col / 3) * 3;
                const isUsedInBox = [0, 1, 2].some(r =>
                  [0, 1, 2].some(c => board[boxRow + r][boxCol + c] === num)
                );
                const isDisabled = isUsedInRow || isUsedInCol || isUsedInBox;

                return (
                  <button
                    key={num}
                    className={`sudoku-picker-btn ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => handleNumberSelect(num)}
                    disabled={isDisabled && !notesMode}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
            <button className="ah-btn-outline sudoku-picker-clear" onClick={handleClearCell}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="sudoku-controls">
        <button
          className={`ah-btn-outline ${notesMode ? 'active' : ''}`}
          onClick={() => setNotesMode(!notesMode)}
        >
          {notesMode ? '✏️ Notes Mode' : '🔢 Number Mode'}
        </button>
        <button
          className="ah-btn-outline"
          onClick={handleReset}
        >
          Reset Puzzle
        </button>
      </div>

      {/* Instructions */}
      <div className="ah-card sudoku-instructions">
        <h3>How to Play</h3>
        <ul>
          <li>Tap a cell to select a number from the popup</li>
          <li>Each row must contain 1-9 without repeating</li>
          <li>Each column must contain 1-9 without repeating</li>
          <li>Each 3×3 box must contain 1-9 without repeating</li>
          <li>Used numbers in the popup are greyed out</li>
          <li>Toggle Notes Mode to add small reminder numbers</li>
          <li>Conflicting numbers are highlighted in red</li>
        </ul>
      </div>
    </div>
  );
};

export default SudokuGame;
