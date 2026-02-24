import React, { useState } from 'react';
import Die from './Die';

const ROLL_DURATION_MS = 2800; // animation (2s) + max stagger (400ms) + buffer

function App() {
  const [diceCount, setDiceCount] = useState(2);
  // Keep 6 values always; slice to diceCount for display
  const [values, setValues] = useState<number[]>(Array(6).fill(1));
  const [rollKey, setRollKey] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ values: number[]; total: number } | null>(null);

  const roll = async () => {
    if (rolling) return;
    setRolling(true);
    setResult(null);

    try {
      const res = await fetch(`/api/roll?count=${diceCount}`);
      const data: { values: number[] } = await res.json();

      // Pad to 6 so every Die slot always has a valid value
      const padded = [...data.values];
      while (padded.length < 6) padded.push(1);

      setValues(padded);
      setRollKey(k => k + 1);

      setTimeout(() => {
        setResult({
          values: data.values,
          total: data.values.reduce((a, b) => a + b, 0),
        });
        setRolling(false);
      }, ROLL_DURATION_MS);
    } catch {
      setRolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center gap-8 p-8 select-none">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white tracking-tight mb-1">Roll the Dice</h1>
        <p className="text-green-400 text-sm">Animation POC &mdash; for bingo ball study</p>
      </div>

      {/* Dice count picker */}
      <div className="flex items-center gap-3">
        <span className="text-green-300 text-sm font-medium w-10">Dice:</span>
        {[1, 2, 3, 4, 5, 6].map(n => (
          <button
            key={n}
            onClick={() => { setDiceCount(n); setResult(null); }}
            disabled={rolling}
            className={[
              'w-11 h-11 rounded-full font-bold text-base transition-all duration-150',
              'disabled:cursor-not-allowed disabled:opacity-60',
              diceCount === n
                ? 'bg-yellow-400 text-gray-900 scale-110 shadow-lg'
                : 'bg-green-700 text-green-200 hover:bg-green-600 hover:scale-105',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Dice display — green baize panel */}
      <div className="flex flex-wrap gap-10 justify-center items-center px-10 py-8 bg-green-800 rounded-2xl border border-green-700 shadow-inner min-h-40">
        {values.slice(0, diceCount).map((v, i) => (
          <Die
            key={i}
            value={v}
            rollKey={rollKey}
            delay={i * 80}
          />
        ))}
      </div>

      {/* Result — fades in after dice settle */}
      <div className="h-24 flex flex-col items-center justify-center">
        {result && (
          <div className="text-center result-fade-in">
            <p className="text-green-400 text-xs uppercase tracking-widest mb-1">Total</p>
            <p className="text-7xl font-bold text-white leading-none tabular-nums">
              {result.total}
            </p>
            {diceCount > 1 && (
              <p className="text-green-400 text-sm mt-2">
                {result.values.join(' \u00b7 ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Roll button */}
      <button
        onClick={roll}
        disabled={rolling}
        className={[
          'px-14 py-5 rounded-full text-2xl font-bold tracking-wide transition-all duration-200 shadow-xl',
          rolling
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed scale-95'
            : 'bg-yellow-400 text-gray-900 hover:bg-yellow-300 hover:scale-105 active:scale-95',
        ].join(' ')}
      >
        {rolling ? 'Rolling...' : 'Roll!'}
      </button>
    </div>
  );
}

export default App;
