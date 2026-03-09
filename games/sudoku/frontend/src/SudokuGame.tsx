import React, { useState, useEffect } from 'react';

interface SudokuGameProps {
  userId: string;
  userName: string;
  token: string;
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
  puzzleNumber: number;
  difficulty: 'easy' | 'medium' | 'hard';
  puzzleGrid: number[][];
  clueCount?: number;
}

interface ProgressData {
  puzzleId: number;
  completed: boolean;
  startedAt: string;
  lastAccessed: string;
}

const SudokuGame: React.FC<SudokuGameProps> = ({ userId, userName, token }) => {
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

  // Backend integration states
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [userProgress, setUserProgress] = useState<Map<number, ProgressData>>(new Map());
  const [loading, setLoading] = useState(true);

  // Check completion whenever board changes
  useEffect(() => {
    // Only check if we have a valid board (9x9)
    if (board.length === 9 && board[0]?.length === 9 && isComplete(board)) {
      setIsPuzzleComplete(true);
    }
  }, [board]);

  // Load puzzles and user progress on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load all puzzles
        const puzzlesRes = await fetch('/api/puzzles');
        const puzzlesData = await puzzlesRes.json();

        // Load user progress
        const progressRes = await fetch('/api/progress', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const progressData = await progressRes.json();

        // Build progress map
        const progressMap = new Map<number, ProgressData>();
        progressData.progress?.forEach((p: ProgressData) => {
          progressMap.set(p.puzzleId, p);
        });

        setPuzzles(puzzlesData.puzzles || []);
        setUserProgress(progressMap);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  // Auto-save progress (debounced)
  useEffect(() => {
    if (!currentPuzzle || board.length === 0) return;

    const timeoutId = setTimeout(async () => {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            puzzleId: currentPuzzle.id,
            currentState: board,
            notes: Object.fromEntries(
              Object.entries(notes).map(([key, value]) => [key, Array.from(value)])
            ),
            completed: isPuzzleComplete,
          }),
        });
      } catch (err) {
        console.error('Failed to save progress:', err);
      }
    }, 2000); // Save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [board, notes, isPuzzleComplete, currentPuzzle, token]);

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

  const handleSelectPuzzle = async (puzzleData: Puzzle) => {
    try {
      // First, fetch the full puzzle data (including grid)
      const puzzleRes = await fetch(`/api/puzzles/${puzzleData.id}`);
      const fullPuzzle = await puzzleRes.json();

      // Check if user has saved progress
      const savedProgress = userProgress.get(puzzleData.id);

      if (savedProgress && !savedProgress.completed) {
        // Load saved state from backend
        try {
          const res = await fetch(`/api/progress?puzzleId=${puzzleData.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();

          setCurrentPuzzle(fullPuzzle);
          setPuzzle(fullPuzzle.puzzleGrid);
          setBoard(data.currentState || fullPuzzle.puzzleGrid);
          setNotes(
            data.notes
              ? Object.fromEntries(
                  Object.entries(data.notes).map(([key, arr]) => [key, new Set(arr as number[])])
                )
              : {}
          );
          setIsPuzzleComplete(false);
        } catch (err) {
          console.error('Failed to load progress:', err);
          // Fall back to fresh puzzle
          setCurrentPuzzle(fullPuzzle);
          setPuzzle(fullPuzzle.puzzleGrid);
          setBoard(fullPuzzle.puzzleGrid.map((row: number[]) => [...row]));
          setNotes({});
        }
      } else {
        // Start fresh
        setCurrentPuzzle(fullPuzzle);
        setPuzzle(fullPuzzle.puzzleGrid);
        setBoard(fullPuzzle.puzzleGrid.map((row: number[]) => [...row]));
        setNotes({});
        setIsPuzzleComplete(savedProgress?.completed || false);
      }

      setSelectedCell(null);
    } catch (err) {
      console.error('Failed to load puzzle:', err);
    }
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
    // Get puzzle status
    const getPuzzleStatus = (puzzleId: number): 'not-started' | 'in-progress' | 'completed' => {
      const progress = userProgress.get(puzzleId);
      if (!progress) return 'not-started';
      return progress.completed ? 'completed' : 'in-progress';
    };

    // Filter puzzles
    const filteredPuzzles = puzzles.filter(p => {
      if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false;
      if (statusFilter !== 'all' && getPuzzleStatus(p.id) !== statusFilter) return false;
      return true;
    });

    if (loading) {
      return (
        <div className="sudoku-container">
          <h2 className="sudoku-library-title">Sudoku Library</h2>
          <p className="ah-meta">Loading puzzles...</p>
        </div>
      );
    }

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
          {filteredPuzzles.length === 0 ? (
            <p className="ah-meta">No puzzles found. Adjust filters or ask an admin to create puzzles.</p>
          ) : (
            filteredPuzzles.map(puzzleData => {
              const status = getPuzzleStatus(puzzleData.id);
              const statusText = status === 'not-started' ? 'Not Started' : status === 'in-progress' ? 'In Progress' : 'Completed';

              return (
                <div
                  key={puzzleData.id}
                  className="sudoku-puzzle-row"
                  onClick={() => handleSelectPuzzle(puzzleData)}
                >
                  <div className="sudoku-puzzle-number">#{puzzleData.puzzleNumber}</div>
                  <div className="sudoku-puzzle-info">
                    <span className="sudoku-puzzle-name">Puzzle #{puzzleData.puzzleNumber}</span>
                    <span className={`sudoku-puzzle-difficulty ${puzzleData.difficulty}`}>
                      {puzzleData.difficulty.toUpperCase()}
                    </span>
                  </div>
                  <div className="sudoku-puzzle-status">{statusText}</div>
                </div>
              );
            })
          )}
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
          <h2>Puzzle #{currentPuzzle.puzzleNumber}</h2>
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
