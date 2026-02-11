import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Types ---

interface Config {
  appName: string;
  permissionLevel: 'full' | 'read-only';
  currentGameId: string;
}

interface LMSGame {
  id: number;
  name: string;
  status: string;
  winnerCount: number;
  postponementRule: string;
  startDate: string;
}

interface Round {
  id: number;
  roundNumber: number;
  deadline: string;
  status: string;
  predCount: number;
}

interface Match {
  id: number;
  matchNumber: number;
  roundNumber: number;
  date: string;
  location: string;
  homeTeam: string;
  awayTeam: string;
  result: string;
  status: string;
}

interface Prediction {
  userId: string;
  roundNumber: number;
  predictedTeam: string;
  isCorrect: boolean | null;
  voided: boolean;
  homeTeam: string;
  awayTeam: string;
  result: string;
}

// --- Hooks ---

function useUrlParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId') || '',
      token: params.get('token') || '',
    };
  }, []);
}

function useApi(token: string) {
  return useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> || {}),
      };
      // Don't set Content-Type for FormData (browser sets it with boundary)
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(path, { ...options, headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    [token]
  );
}

// --- Main App ---

type Tab = 'games' | 'rounds' | 'results' | 'predictions';

function App() {
  const { userId, token } = useUrlParams();
  const api = useApi(token);

  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('games');

  // Shared game selection
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<string>('');

  useEffect(() => {
    if (!token || !userId) { setLoading(false); return; }
    api('/api/config')
      .then(data => { setConfig(data); setSelectedGameId(data.currentGameId || ''); })
      .catch(err => setAuthError(err.message))
      .finally(() => setLoading(false));
  }, [token, userId, api]);

  const goToLobby = () => { window.location.href = `http://${window.location.hostname}:3001`; };

  if (!userId || !token) {
    return (
      <div className="ah-container">
        <h2>Game Admin</h2>
        <p style={{ color: '#666' }}>Access this app through the lobby.</p>
      </div>
    );
  }

  if (loading) return <div className="ah-container"><p style={{ color: '#666' }}>Loading...</p></div>;

  if (authError) {
    return (
      <div className="ah-container">
        <h2>Game Admin</h2>
        <div className="ah-banner ah-banner--error">{authError}</div>
        <p style={{ color: '#666' }}>You need the game_admin or super_user role to access this app.</p>
      </div>
    );
  }

  const isReadOnly = config?.permissionLevel === 'read-only';

  return (
    <div className="ah-container">
      <div className="ah-header">
        <h2 className="ah-header-title">🎮 Game Admin — LMS</h2>
        {isReadOnly && <span style={s.readOnlyBadge}>Read-only</span>}
        <button className="ah-lobby-btn" onClick={goToLobby}>← Lobby</button>
      </div>

      <div className="ah-tabs">
        {(['games', 'rounds', 'results', 'predictions'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`ah-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Game selector (shown for rounds/matches/predictions) */}
      {activeTab !== 'games' && (
        <GameSelector
          selectedGameId={selectedGameId}
          onSelect={(id) => { setSelectedGameId(id); setSelectedRound(''); }}
          api={api}
        />
      )}

      {activeTab === 'games' && (
        <GamesTab api={api} token={token} isReadOnly={isReadOnly} onGameSelect={setSelectedGameId} />
      )}
      {activeTab === 'rounds' && selectedGameId && (
        <RoundsTab gameId={selectedGameId} api={api} isReadOnly={isReadOnly}
          selectedRound={selectedRound} onRoundSelect={setSelectedRound} />
      )}
      {activeTab === 'results' && selectedGameId && (
        <ResultsTab gameId={selectedGameId} api={api} isReadOnly={isReadOnly} />
      )}
      {activeTab === 'predictions' && selectedGameId && (
        <PredictionsTab gameId={selectedGameId} round={selectedRound} api={api} />
      )}
      {(activeTab === 'rounds' || activeTab === 'results' || activeTab === 'predictions') && !selectedGameId && (
        <div className="ah-card"><p style={{ color: '#666' }}>Select a game above to continue.</p></div>
      )}
    </div>
  );
}

// --- GameSelector ---

function GameSelector({ selectedGameId, onSelect, api }: {
  selectedGameId: string;
  onSelect: (id: string) => void;
  api: ReturnType<typeof useApi>;
}) {
  const [games, setGames] = useState<LMSGame[]>([]);
  useEffect(() => {
    api('/api/lms/games').then(data => setGames(data.games || [])).catch(() => {});
  }, [api]);

  return (
    <div style={{ marginBottom: 16 }}>
      <label className="ah-label">Game: </label>
      <select
        value={selectedGameId}
        onChange={e => onSelect(e.target.value)}
        className="ah-select"
      >
        <option value="">— select game —</option>
        {games.map(g => (
          <option key={g.id} value={String(g.id)}>
            {g.name} ({g.status})
          </option>
        ))}
      </select>
    </div>
  );
}

// --- GamesTab ---

function GamesTab({ api, token, isReadOnly, onGameSelect }: {
  api: ReturnType<typeof useApi>;
  token: string;
  isReadOnly: boolean;
  onGameSelect: (id: string) => void;
}) {
  const [games, setGames] = useState<LMSGame[]>([]);
  const [currentGameId, setCurrentGameId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [postponeRule, setPostponeRule] = useState<'loss' | 'win'>('loss');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    api('/api/lms/games').then(data => {
      setGames(data.games || []);
      setCurrentGameId(data.currentGameId || '');
    }).catch(err => setError(err.message));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const createGame = async () => {
    if (!newName.trim()) return;
    try {
      await api('/api/lms/games', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), postponementRule: postponeRule }),
      });
      setNewName('');
      setSuccess('Game created');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const setCurrent = async (id: number) => {
    try {
      await api(`/api/lms/games/${id}/set-current`, { method: 'PUT' });
      setCurrentGameId(String(id));
      setSuccess('Current game updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const completeGame = async (id: number) => {
    if (!window.confirm('Mark this game as completed?')) return;
    try {
      await api(`/api/lms/games/${id}/complete`, { method: 'PUT' });
      setSuccess('Game completed');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="ah-banner ah-banner--success">{success}</div>}

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Create New Game</h3>
          <input
            className="ah-input"
            style={{ width: '100%' }}
            placeholder="Game name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <div style={{ marginTop: 8 }}>
            <label className="ah-label">Postponement rule: </label>
            <select value={postponeRule} onChange={e => setPostponeRule(e.target.value as 'loss' | 'win')} className="ah-select">
              <option value="loss">Loss (P-P = eliminated)</option>
              <option value="win">Win (P-P = voided, re-pick)</option>
            </select>
          </div>
          <button className="ah-btn-primary" style={{ marginTop: 12 }} onClick={createGame} disabled={!newName.trim()}>
            Create Game
          </button>
        </div>
      )}

      <h3 className="ah-section-title">All Games</h3>
      {games.length === 0 ? (
        <div className="ah-card"><p style={{ color: '#666' }}>No games yet.</p></div>
      ) : (
        games.map(game => (
          <div key={game.id} className="ah-card" style={{ borderLeft: String(game.id) === currentGameId ? '4px solid #2196F3' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{game.name}</strong>
                {String(game.id) === currentGameId && <span style={s.currentBadge}> CURRENT</span>}
                <p className="ah-meta">Status: {game.status} · P-P rule: {game.postponementRule}</p>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {String(game.id) !== currentGameId && (
                    <button className="ah-btn-outline" onClick={() => setCurrent(game.id)}>Set Current</button>
                  )}
                  <button className="ah-btn-outline" onClick={() => { onGameSelect(String(game.id)); }}>Manage</button>
                  {game.status === 'active' && (
                    <button className="ah-btn-danger" onClick={() => completeGame(game.id)}>
                      Complete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// --- RoundsTab ---

function RoundsTab({ gameId, api, isReadOnly, selectedRound, onRoundSelect }: {
  gameId: string;
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
  selectedRound: string;
  onRoundSelect: (r: string) => void;
}) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [newRoundNum, setNewRoundNum] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    api(`/api/lms/rounds/${gameId}`)
      .then(data => setRounds(data.rounds || []))
      .catch(err => setError(err.message));
  }, [api, gameId]);

  useEffect(() => { load(); }, [load]);

  const createRound = async () => {
    if (!newRoundNum || !newDeadline) return;
    try {
      await api('/api/lms/rounds', {
        method: 'POST',
        body: JSON.stringify({ gameId: parseInt(gameId), roundNumber: parseInt(newRoundNum), deadline: newDeadline }),
      });
      setNewRoundNum('');
      setNewDeadline('');
      setSuccess('Round created');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const updateStatus = async (roundNumber: number, status: string) => {
    try {
      await api(`/api/lms/rounds/${gameId}/${roundNumber}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setSuccess(`Round ${roundNumber} is now ${status}`);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const statusColor = (status: string) => {
    if (status === 'open') return '#4CAF50';
    if (status === 'closed') return '#F44336';
    return '#999';
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="ah-banner ah-banner--success">{success}</div>}

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Create Round</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="ah-input"
              style={{ width: 80 }}
              placeholder="Round #"
              type="number"
              value={newRoundNum}
              onChange={e => setNewRoundNum(e.target.value)}
            />
            <input
              className="ah-input"
              style={{ flex: 1 }}
              placeholder="Deadline (e.g. Sat 18 Jan 12:00)"
              value={newDeadline}
              onChange={e => setNewDeadline(e.target.value)}
            />
          </div>
          <button
            className="ah-btn-primary"
            style={{ marginTop: 10 }}
            onClick={createRound}
            disabled={!newRoundNum || !newDeadline}
          >
            Create Round
          </button>
        </div>
      )}

      <h3 className="ah-section-title">Rounds</h3>
      {rounds.length === 0 ? (
        <div className="ah-card"><p style={{ color: '#666' }}>No rounds yet.</p></div>
      ) : (
        rounds.map(round => (
          <div key={round.roundNumber} className="ah-card" style={{
            borderLeft: selectedRound === String(round.roundNumber) ? '4px solid #2196F3' : undefined,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Round {round.roundNumber}</strong>
                <span style={{ ...s.statusDot, color: statusColor(round.status) }}> {round.status}</span>
                <p className="ah-meta">Deadline: {round.deadline} · {round.predCount} picks</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isReadOnly && round.status !== 'open' && (
                  <button className="ah-btn-outline" style={{ color: '#4CAF50', borderColor: '#4CAF50' }}
                    onClick={() => updateStatus(round.roundNumber, 'open')}>
                    Open
                  </button>
                )}
                {!isReadOnly && round.status === 'open' && (
                  <button className="ah-btn-danger"
                    onClick={() => updateStatus(round.roundNumber, 'closed')}>
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// --- ResultsTab ---

function ResultsTab({ gameId, api, isReadOnly }: {
  gameId: string;
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultInputs, setResultInputs] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    api(`/api/lms/matches/${gameId}`)
      .then(data => setMatches(data.matches || []))
      .catch(err => setError(err.message));
  }, [api, gameId]);

  useEffect(() => { load(); }, [load]);

  const uploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('gameId', gameId);
    try {
      const data = await api('/api/lms/matches/upload', { method: 'POST', body: formData });
      setSuccess(`Uploaded: ${data.upserted} matches${data.evaluated ? `, ${data.evaluated} predictions evaluated` : ''}`);
      load();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const setResult = async (matchId: number) => {
    const result = resultInputs[matchId];
    if (!result) return;
    try {
      const data = await api(`/api/lms/matches/${matchId}/result`, {
        method: 'PUT',
        body: JSON.stringify({ result }),
      });
      setSuccess(`Result set. ${data.predictionsProcessed} predictions processed.`);
      setResultInputs(prev => { const next = { ...prev }; delete next[matchId]; return next; });
      load();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  // Group matches by round number
  const byRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    (acc[m.roundNumber] = acc[m.roundNumber] || []).push(m);
    return acc;
  }, {});
  const roundNumbers = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  const statusColor = (status: string) => {
    if (status === 'completed') return '#4CAF50';
    if (status === 'postponed') return '#FF9800';
    return '#999';
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="ah-banner ah-banner--success">{success}</div>}

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Upload Matches (CSV)</h3>
          <p className="ah-meta">Format: match_number, round_number, date, location, home_team, away_team[, result]</p>
          <p className="ah-meta">Round and result are read from the CSV — no pre-selection needed. Results trigger prediction evaluation.</p>
          <input type="file" accept=".csv" onChange={uploadCSV} style={{ marginTop: 8 }} />
        </div>
      )}

      {matches.length === 0 ? (
        <div className="ah-card"><p style={{ color: '#666' }}>No matches yet. Upload a CSV to add matches.</p></div>
      ) : (
        roundNumbers.map(roundNum => (
          <div key={roundNum}>
            <h3 className="ah-section-title" style={{ marginTop: 16 }}>Round {roundNum}</h3>
            {byRound[roundNum].map(match => (
              <div key={match.id} className="ah-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <strong>#{match.matchNumber}: {match.homeTeam} vs {match.awayTeam}</strong>
                    <p className="ah-meta">{match.date} · {match.location}</p>
                    {match.result && (
                      <p className="ah-meta" style={{ fontWeight: 600, color: '#333' }}>Result: {match.result}</p>
                    )}
                    {match.status !== 'pending' && (
                      <p className="ah-meta" style={{ color: statusColor(match.status), fontWeight: 500 }}>
                        {match.status}
                      </p>
                    )}
                  </div>
                  {!isReadOnly && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                      <input
                        className="ah-input"
                        style={{ width: 90 }}
                        placeholder="e.g. 2 - 1"
                        value={resultInputs[match.id] || ''}
                        onChange={e => setResultInputs(prev => ({ ...prev, [match.id]: e.target.value }))}
                      />
                      <button
                        className="ah-btn-outline"
                        onClick={() => setResult(match.id)}
                        disabled={!resultInputs[match.id]}
                      >
                        {match.status === 'pending' ? 'Set' : 'Edit'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// --- PredictionsTab ---

function PredictionsTab({ gameId, round, api }: {
  gameId: string;
  round: string;
  api: ReturnType<typeof useApi>;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [filterRound, setFilterRound] = useState(round);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ gameId });
    if (filterRound) params.set('round', filterRound);
    api(`/api/lms/predictions?${params}`)
      .then(data => setPredictions(data.predictions || []))
      .catch(err => setError(err.message));
  }, [api, gameId, filterRound]);

  useEffect(() => { load(); }, [load]);

  const statusIcon = (p: Prediction) => {
    if (p.voided) return <span style={{ color: '#FF9800' }}>Voided</span>;
    if (p.isCorrect === null) return <span style={{ color: '#999' }}>Pending</span>;
    if (p.isCorrect) return <span style={{ color: '#4CAF50' }}>✅ Survived</span>;
    return <span style={{ color: '#F44336' }}>❌ Eliminated</span>;
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label className="ah-label">Round: </label>
        <input
          className="ah-input"
          style={{ width: 80 }}
          placeholder="All"
          value={filterRound}
          onChange={e => setFilterRound(e.target.value)}
        />
        <button className="ah-btn-outline" onClick={load}>Refresh</button>
      </div>

      {predictions.length === 0 ? (
        <div className="ah-card"><p style={{ color: '#666' }}>No predictions found.</p></div>
      ) : (
        <div className="ah-table">
          <div className="ah-table-header">
            <span style={{ flex: 2 }}>Player</span>
            <span style={{ flex: 1 }}>Round</span>
            <span style={{ flex: 2 }}>Pick</span>
            <span style={{ flex: 2 }}>Match</span>
            <span style={{ flex: 1 }}>Result</span>
            <span style={{ flex: 1 }}>Status</span>
          </div>
          {predictions.map((p, idx) => (
            <div key={idx} className="ah-table-row">
              <span style={{ flex: 2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.userId}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{p.roundNumber}</span>
              <span style={{ flex: 2, fontSize: 13, fontWeight: 500 }}>{p.predictedTeam}</span>
              <span style={{ flex: 2, fontSize: 12, color: '#666' }}>{p.homeTeam} v {p.awayTeam}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#666' }}>{p.result || '—'}</span>
              <span style={{ flex: 1, fontSize: 12 }}>{statusIcon(p)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Game Admin-specific styles (shared styles use .ah-* classes) ---

const s: Record<string, React.CSSProperties> = {
  readOnlyBadge: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #FFE0B2',
  },
  currentBadge: {
    backgroundColor: '#E3F2FD',
    color: '#1565C0',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    marginLeft: 8,
  },
  statusDot: { fontSize: 13, fontWeight: 500 },
};

export default App;
