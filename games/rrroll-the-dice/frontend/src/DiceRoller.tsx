import React, { useState } from 'react';

interface DiceRollerProps {
  maxDice?: number;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ maxDice = 6 }) => {
  const [numDice, setNumDice] = useState(2);
  const [diceValues, setDiceValues] = useState<number[]>([1, 1]);
  const [isRolling, setIsRolling] = useState(false);

  const rollDice = () => {
    setIsRolling(true);

    // Animation: cycle through random values
    const duration = 2000; // 2 seconds
    const interval = 100; // Change every 100ms
    const cycles = duration / interval;
    let count = 0;

    const intervalId = setInterval(() => {
      setDiceValues(Array.from({ length: numDice }, () => Math.floor(Math.random() * 6) + 1));
      count++;

      if (count >= cycles) {
        clearInterval(intervalId);
        // Final roll
        const finalValues = Array.from({ length: numDice }, () => Math.floor(Math.random() * 6) + 1);
        setDiceValues(finalValues);
        setIsRolling(false);
      }
    }, interval);
  };

  const addDie = () => {
    if (numDice < maxDice) {
      const newNum = numDice + 1;
      setNumDice(newNum);
      setDiceValues([...diceValues, 1]);
    }
  };

  const removeDie = () => {
    if (numDice > 1) {
      const newNum = numDice - 1;
      setNumDice(newNum);
      setDiceValues(diceValues.slice(0, -1));
    }
  };

  return (
    <>
      {/* App Header Bar */}
      <div className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">🎲 Rrroll the Dice</h1>
        </div>
        <div className="ah-app-header-right">
          <button
            className="ah-lobby-btn"
            onClick={() => {
              window.location.href = `http://${window.location.hostname}:3001`;
            }}
          >
            ← Lobby
          </button>
        </div>
      </div>

      <div className="ah-container--narrow dice-roller-container">
        {/* Number of dice controls */}
      <div className="dice-controls">
        <div className="dice-control-buttons">
          <button
            className="ah-btn-outline"
            onClick={removeDie}
            disabled={numDice <= 1 || isRolling}
          >
            ▼
          </button>
          <span className="dice-count">
            {numDice} {numDice === 1 ? 'die' : 'dice'}
          </span>
          <button
            className="ah-btn-outline"
            onClick={addDie}
            disabled={numDice >= maxDice || isRolling}
          >
            ▲
          </button>
        </div>
      </div>

      {/* Dice display */}
      <div className="dice-container">
        {diceValues.map((value, index) => (
          <div key={index} className={`dice ${isRolling ? 'rolling' : ''}`}>
            <img
              src={`/dice/dice-${value}.png`}
              alt={`Dice showing ${value}`}
              onError={(e) => {
                // Fallback to emoji if image doesn't load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                if (target.nextSibling) return;
                const fallback = document.createElement('div');
                fallback.className = 'dice-fallback';
                fallback.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value - 1];
                target.parentElement?.appendChild(fallback);
              }}
            />
          </div>
        ))}
      </div>

      {/* Roll button */}
      <button
        className="ah-btn-primary dice-roll-button"
        onClick={rollDice}
        disabled={isRolling}
      >
        {isRolling ? 'Rolling...' : '🎲 Roll!'}
      </button>

      {/* Total */}
      {!isRolling && (
        <div className="dice-total">
          Total: {diceValues.reduce((a, b) => a + b, 0)}
        </div>
      )}
      </div>
    </>
  );
};

export default DiceRoller;
