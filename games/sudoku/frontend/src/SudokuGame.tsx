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
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not-started' | 'in-progress' | 'completed'>('all');

  // Check completion whenever board changes
  useEffect(() => {
    // Only check if we have a valid board (9x9)
    if (board.length === 9 && board[0]?.length === 9 && isComplete(board)) {
      setIsPuzzleComplete(true);
      // TODO: Save completion to backend
    }
  }, [board]);

  const handleCellClick = (row: number, col: number) => {
    // Guard against invalid board access
    if (!puzzle[row]) return;

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

    // Guard against invalid board access
    if (!puzzle[row] || !board[row]) return classes.join(' ');

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
    // Guard against invalid board access
    if (!board[row]) return null;

    const cellValue = board[row][col];
    const key = `${row}-${col}`;
    const cellNotes = notes[key];

    if (cellValue !== 0) {
      return <div className="sudoku-cell-value">{cellValue}</div>;
    }

    // Show notes if any exist (regardless of current mode)
    if (cellNotes && cellNotes.size > 0) {
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
    // Filter puzzles
    const filteredPuzzles = PUZZLE_LIBRARY.filter(p => {
      if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false;
      // Status filter would check against saved progress (future feature)
      // For now, all puzzles are "not-started"
      if (statusFilter !== 'all' && statusFilter !== 'not-started') return false;
      return true;
    });

    return (
      <div className="sudoku-container">
        <h2 className="sudoku-library-title">Sudoku Library</h2>

        {/* Filters */}
        <div className="sudoku-filters">
          <div className="sudoku-filter-group">
            <label>Difficulty:</label>
            <select
              className="ah-select-fixed"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="sudoku-filter-group">
            <label>Status:</label>
            <select
              className="ah-select-fixed"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Puzzle List */}
        <div className="sudoku-library-list">
          {filteredPuzzles.map(puzzleData => (
            <div
              key={puzzleData.id}
              className="sudoku-puzzle-row"
              onClick={() => handleSelectPuzzle(puzzleData)}
            >
              <div className="sudoku-puzzle-number">#{puzzleData.id}</div>
              <div className="sudoku-puzzle-info">
                <span className="sudoku-puzzle-name">{puzzleData.name}</span>
                <span className={`sudoku-puzzle-difficulty ${puzzleData.difficulty}`}>
                  {puzzleData.difficulty.toUpperCase()}
                </span>
              </div>
              <div className="sudoku-puzzle-status">Not Started</div>
            </div>
          ))}
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
        <div className="sudoku-number-picker">
          <div className="sudoku-picker-title">
            {notesMode ? 'Select Note' : 'Select Number'}
          </div>
          <div className="sudoku-picker-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                className="sudoku-picker-btn"
                onClick={() => handleNumberSelect(num)}
              >
                {num}
              </button>
            ))}
          </div>
          <button className="ah-btn-outline sudoku-picker-clear" onClick={handleClearCell}>
            Clear
          </button>
          <button className="ah-btn-outline sudoku-picker-close" onClick={() => setShowNumberPicker(false)}>
            Close
          </button>
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
    </div>
  );
};

export default SudokuGame;
