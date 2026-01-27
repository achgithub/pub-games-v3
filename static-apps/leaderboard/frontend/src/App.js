import React, { useState, useEffect } from 'react';
import axios from 'axios';

// API is served from same origin (single port architecture)
const API_BASE = '/api';

// Game type display names
const GAME_NAMES = {
  'tic-tac-toe': 'Tic-Tac-Toe',
  'dots': 'Dots',
  'chess': 'Chess',
};

function App() {
  const [view, setView] = useState('standings');
  const [gameTypes, setGameTypes] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [standings, setStandings] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ app_name: 'Leaderboard', app_icon: '🏆' });

  // Load config
  useEffect(() => {
    axios.get(`${API_BASE}/config`)
      .then(res => setConfig(res.data))
      .catch(() => {});
  }, []);

  // Load game types
  useEffect(() => {
    axios.get(`${API_BASE}/standings`)
      .then(res => {
        const types = res.data.gameTypes || [];
        setGameTypes(types);
        if (types.length > 0 && !selectedGame) {
          setSelectedGame(types[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load game types:', err);
        setLoading(false);
      });
  }, []);

  // Load standings when game type changes
  useEffect(() => {
    if (!selectedGame) return;

    axios.get(`${API_BASE}/standings/${selectedGame}`)
      .then(res => setStandings(res.data || []))
      .catch(err => console.error('Failed to load standings:', err));

    axios.get(`${API_BASE}/recent/${selectedGame}`)
      .then(res => setRecentGames(res.data || []))
      .catch(err => console.error('Failed to load recent games:', err));
  }, [selectedGame]);

  const getGameName = (gameType) => GAME_NAMES[gameType] || gameType;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRankClass = (rank) => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-other';
  };

  if (loading) {
    return (
      <div className="App" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  return (
    <div className="App">
      <header style={{ borderBottom: '2px solid #e0e0e0', padding: '15px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>{config.app_icon} {config.app_name}</h1>
        </div>
      </header>

      <nav className="tabs">
        <button className={view === 'standings' ? 'active' : ''} onClick={() => setView('standings')}>
          Standings
        </button>
        <button className={view === 'recent' ? 'active' : ''} onClick={() => setView('recent')}>
          Recent Games
        </button>
      </nav>

      <main>
        {/* Game Type Selector */}
        {gameTypes.length > 0 ? (
          <div className="game-type-tabs">
            {gameTypes.map(gt => (
              <button
                key={gt}
                className={selectedGame === gt ? 'active' : ''}
                onClick={() => setSelectedGame(gt)}
              >
                {getGameName(gt)}
              </button>
            ))}
          </div>
        ) : (
          <div className="admin-section">
            <p className="info-text">No games recorded yet. Play some games to see the leaderboard!</p>
          </div>
        )}

        {/* Standings View */}
        {view === 'standings' && selectedGame && (
          <div className="admin-section">
            <h3>{getGameName(selectedGame)} Standings</h3>
            {standings.length === 0 ? (
              <p className="info-text">No standings yet for this game.</p>
            ) : (
              <>
                {/* Top 3 Stats */}
                <div className="stats-grid">
                  {standings.slice(0, 3).map((s, i) => (
                    <div key={s.playerId} className="stat-card">
                      <div className="stat-value">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </div>
                      <div className="stat-label">{s.playerName}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        {s.wins}W - {s.losses}L ({s.points} pts)
                      </div>
                    </div>
                  ))}
                </div>

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
          <div className="admin-section">
            <h3>Recent {getGameName(selectedGame)} Games</h3>
            {recentGames.length === 0 ? (
              <p className="info-text">No games recorded yet.</p>
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
      </main>
    </div>
  );
}

export default App;
