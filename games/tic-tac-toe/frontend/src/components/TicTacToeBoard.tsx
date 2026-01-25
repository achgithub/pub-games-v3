import React from 'react';

interface TicTacToeBoardProps {
  board: string[];
  onCellClick: (position: number) => void;
  myTurn: boolean;
  mySymbol: string;
  disabled: boolean;
}

const TicTacToeBoard: React.FC<TicTacToeBoardProps> = ({
  board,
  onCellClick,
  myTurn,
  mySymbol,
  disabled,
}) => {
  const handleClick = (position: number) => {
    // Only allow click if it's my turn, cell is empty, and not disabled
    if (!myTurn || board[position] !== '' || disabled) {
      return;
    }
    onCellClick(position);
  };

  const renderCell = (position: number) => {
    const value = board[position];
    const isEmpty = value === '';
    const isClickable = myTurn && isEmpty && !disabled;

    return (
      <button
        key={position}
        className={`ttt-cell ${value ? `ttt-cell-${value.toLowerCase()}` : ''} ${isClickable ? 'ttt-cell-clickable' : ''}`}
        onClick={() => handleClick(position)}
        disabled={!isClickable}
        aria-label={`Cell ${position + 1}, ${value || 'empty'}`}
      >
        {value && <span className="ttt-symbol">{value}</span>}
        {isEmpty && isClickable && (
          <span className="ttt-symbol ttt-symbol-preview">{mySymbol}</span>
        )}
      </button>
    );
  };

  return (
    <div className="ttt-board">
      <div className="ttt-row">
        {renderCell(0)}
        {renderCell(1)}
        {renderCell(2)}
      </div>
      <div className="ttt-row">
        {renderCell(3)}
        {renderCell(4)}
        {renderCell(5)}
      </div>
      <div className="ttt-row">
        {renderCell(6)}
        {renderCell(7)}
        {renderCell(8)}
      </div>
    </div>
  );
};

export default TicTacToeBoard;
