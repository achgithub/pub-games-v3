import React, { useState, useEffect } from 'react';
import './App.css';

// API is served from same origin (single port architecture)
const API_BASE = '/api';

// Game type display names
const GAME_NAMES: Record<string, string> = {
  'tic-tac-toe': 'Tic-Tac-Toe',
  'dots': 'Dots & Boxes',
  'spoof': 'Spoof',
  'quiz': 'Quiz',
};

interface Standing {
  rank: number;
  playerId: string;
  playerName: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
  points: number;
}

interface GameResult {
  id: number;
  gameType: string;
  gameId: string;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  isDraw: boolean;
  score: string;
  duration: number;
  playedAt: string;
}

interface Config {
  app_name: string;
  app_icon: string;
  version: string;
}

function App() {
  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const filterGame = params.get('game'); // "dots", "tic-tac-toe", or null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const userId = params.get('userId'); // Future: for "My Stats" view
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const userName = params.get('userName'); // Future: for personalization
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const token = params.get('token'); // Future: for authenticated features

  const [view, setView] = useState<'standings' | 'recent'>('standings');
  const [gameTypes, setGameTypes] = useState<string[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [standings, setStandings] = useState<Standing[]>([]);
  const [recentGames, setRecentGames] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config>({
    app_name: 'Leaderboard',
    app_icon: '🏆',
    version: '1.0.0',
  });

  // Load config
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(() => {});
  }, []);

  // Load game types
  useEffect(() => {
    fetch(`${API_BASE}/standings`)
      .then(res => res.json())
      .then(data => {
        const types = data.gameTypes || [];
        setGameTypes(types);

        // If filtered mode, use that game
        if (filterGame && types.includes(filterGame)) {
          setSelectedGame(filterGame);
        }
        // Otherwise select first available
        else if (types.length > 0 && !selectedGame) {
          setSelectedGame(types[0]);
        }

        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load game types:', err);
        setLoading(false);
      });
  }, [filterGame, selectedGame]);

  // Load standings when game type changes
  useEffect(() => {
    if (!selectedGame) return;

    fetch(`${API_BASE}/standings/${selectedGame}`)
      .then(res => res.json())
      .then(data => setStandings(data || []))
      .catch(err => console.error('Failed to load standings:', err));

    fetch(`${API_BASE}/recent/${selectedGame}`)
      .then(res => res.json())
      .then(data => setRecentGames(data || []))
      .catch(err => console.error('Failed to load recent games:', err));
  }, [selectedGame]);

  const getGameName = (gameType: string): string => {
    return GAME_NAMES[gameType] || gameType;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRankClass = (rank: number): string => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-other';
  };

  if (loading) {
    return (
      <div className="ah-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Filtered mode (single game, no tabs)
  const isFilteredMode = filterGame !== null;

  return (
    <div className="ah-container ah-container--wide">
      {/* Header */}
      <div className="leaderboard-header">
        <h1>{config.app_icon} {isFilteredMode ? `${getGameName(selectedGame)} Leaderboard` : config.app_name}</h1>
      </div>

      {/* Tabs (only in full mode) */}
      {!isFilteredMode && (
        <div className="ah-tabs">
          <button
            className={`ah-tab ${view === 'standings' ? 'active' : ''}`}
            onClick={() => setView('standings')}
          >
            Standings
          </button>
          <button
            className={`ah-tab ${view === 'recent' ? 'active' : ''}`}
            onClick={() => setView('recent')}
          >
            Recent Games
          </button>
        </div>
      )}

      {/* Game Type Selector (only in full mode) */}
      {!isFilteredMode && gameTypes.length > 0 && (
        <div className="game-type-selector">
          {gameTypes.map(gt => (
            <button
              key={gt}
              className={`game-type-btn ${selectedGame === gt ? 'active' : ''}`}
              onClick={() => setSelectedGame(gt)}
            >
              {getGameName(gt)}
            </button>
          ))}
        </div>
      )}

      {/* No games recorded */}
      {gameTypes.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🎮</div>
          <div className="empty-state-text">No games recorded yet. Play some games to see the leaderboard!</div>
        </div>
      )}

      {/* Standings View */}
      {view === 'standings' && selectedGame && (
        <div>
          {!isFilteredMode && <h2>{getGameName(selectedGame)} Standings</h2>}

          {standings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">No standings yet for this game.</div>
            </div>
          ) : (
            <>
              {/* Top 3 Players */}
              {standings.length >= 3 && (
                <div className="top-players">
                  {standings.slice(0, 3).map((s, i) => (
                    <div key={s.playerId} className="top-player-card">
                      <div className="top-player-medal">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </div>
                      <div className="top-player-name">{s.playerName}</div>
                      <div className="top-player-stats">
                        {s.wins}W - {s.losses}L ({s.points} pts)
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full Table */}
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>W</th>
                    <th>L</th>
                    <th>D</th>
                    <th>Games</th>
                    <th>Win %</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(s => (
                    <tr key={s.playerId}>
                      <td>
                        <span className={`rank-badge ${getRankClass(s.rank)}`}>
                          {s.rank}
                        </span>
                      </td>
                      <td><strong>{s.playerName}</strong></td>
                      <td>{s.wins}</td>
                      <td>{s.losses}</td>
                      <td>{s.draws}</td>
                      <td>{s.totalGames}</td>
                      <td>{s.winRate.toFixed(0)}%</td>
                      <td><strong>{s.points}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Recent Games View */}
      {view === 'recent' && selectedGame && (
        <div>
          <h2>Recent {getGameName(selectedGame)} Games</h2>

          {recentGames.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎯</div>
              <div className="empty-state-text">No games recorded yet.</div>
            </div>
          ) : (
            <div>
              {recentGames.map(game => (
                <div key={game.id} className="recent-result">
                  <div className="result-players">
                    {game.isDraw ? (
                      <span className="result-draw">
                        {game.winnerName} vs {game.loserName} - Draw
                      </span>
                    ) : (
                      <>
                        <span className="result-winner">🏆 {game.winnerName}</span>
                        <span> beat </span>
                        <span className="result-loser">{game.loserName}</span>
                        {game.score && <span> ({game.score})</span>}
                      </>
                    )}
                  </div>
                  <div className="result-meta">
                    {formatDate(game.playedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
