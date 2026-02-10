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

type Tab = 'games' | 'rounds' | 'matches' | 'predictions';

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

  if (!userId || !token) {
    return (
      <div style={s.container}>
        <h2>Game Admin</h2>
        <p style={{ color: '#666' }}>Access this app through the lobby.</p>
      </div>
    );
  }

  if (loading) return <div style={s.container}><p style={{ color: '#666' }}>Loading...</p></div>;

  if (authError) {
    return (
      <div style={s.container}>
        <h2>Game Admin</h2>
        <div style={s.errorBanner}>{authError}</div>
        <p style={{ color: '#666' }}>You need the game_admin or super_user role to access this app.</p>
      </div>
    );
  }

  const isReadOnly = config?.permissionLevel === 'read-only';

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>🎮 Game Admin — LMS</h2>
        {isReadOnly && <span style={s.readOnlyBadge}>Read-only</span>}
      </div>

      <div style={s.tabs}>
        {(['games', 'rounds', 'matches', 'predictions'] as Tab[]).map(tab => (
          <button
            key={tab}
            style={{ ...s.tab, ...(activeTab === tab ? s.activeTab : {}) }}
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
      {activeTab === 'matches' && selectedGameId && selectedRound && (
        <MatchesTab gameId={selectedGameId} round={selectedRound} api={api} isReadOnly={isReadOnly} />
      )}
      {activeTab === 'predictions' && selectedGameId && (
        <PredictionsTab gameId={selectedGameId} round={selectedRound} api={api} />
      )}
      {(activeTab === 'rounds' || activeTab === 'matches' || activeTab === 'predictions') && !selectedGameId && (
        <div style={s.card}><p style={{ color: '#666' }}>Select a game above to continue.</p></div>
      )}
      {activeTab === 'matches' && selectedGameId && !selectedRound && (
        <div style={s.card}><p style={{ color: '#666' }}>Select a round above to see matches.</p></div>
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
      <label style={s.label}>Game: </label>
      <select
        value={selectedGameId}
        onChange={e => onSelect(e.target.value)}
        style={s.select}
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
      {error && <div style={s.errorBanner} onClick={() => setError(null)}>{error}</div>}
      {success && <div style={s.successBanner}>{success}</div>}

      {!isReadOnly && (
        <div style={s.card}>
          <h3 style={s.sectionTitle}>Create New Game</h3>
          <input
            style={s.input}
            placeholder="Game name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <div style={{ marginTop: 8 }}>
            <label style={s.label}>Postponement rule: </label>
            <select value={postponeRule} onChange={e => setPostponeRule(e.target.value as 'loss' | 'win')} style={s.select}>
              <option value="loss">Loss (P-P = eliminated)</option>
              <option value="win">Win (P-P = voided, re-pick)</option>
            </select>
          </div>
          <button style={{ ...s.primaryBtn, marginTop: 12 }} onClick={createGame} disabled={!newName.trim()}>
            Create Game
          </button>
        </div>
      )}

      <h3 style={s.sectionTitle}>All Games</h3>
      {games.length === 0 ? (
        <div style={s.card}><p style={{ color: '#666' }}>No games yet.</p></div>
      ) : (
        games.map(game => (
          <div key={game.id} style={{ ...s.card, borderLeft: String(game.id) === currentGameId ? '4px solid #2196F3' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{game.name}</strong>
                {String(game.id) === currentGameId && <span style={s.currentBadge}> CURRENT</span>}
                <p style={s.meta}>Status: {game.status} · P-P rule: {game.postponementRule}</p>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {String(game.id) !== currentGameId && (
                    <button style={s.outlineBtn} onClick={() => setCurrent(game.id)}>Set Current</button>
                  )}
                  <button style={s.outlineBtn} onClick={() => { onGameSelect(String(game.id)); }}>Manage</button>
                  {game.status === 'active' && (
                    <button style={{ ...s.outlineBtn, color: '#F44336', borderColor: '#F44336' }} onClick={() => completeGame(game.id)}>
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
      {error && <div style={s.errorBanner} onClick={() => setError(null)}>{error}</div>}
      {success && <div style={s.successBanner}>{success}</div>}

      {!isReadOnly && (
        <div style={s.card}>
          <h3 style={s.sectionTitle}>Create Round</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...s.input, width: 80 }}
              placeholder="Round #"
              type="number"
              value={newRoundNum}
              onChange={e => setNewRoundNum(e.target.value)}
            />
            <input
              style={s.input}
              placeholder="Deadline (e.g. Sat 18 Jan 12:00)"
              value={newDeadline}
              onChange={e => setNewDeadline(e.target.value)}
            />
          </div>
          <button
            style={{ ...s.primaryBtn, marginTop: 10 }}
            onClick={createRound}
            disabled={!newRoundNum || !newDeadline}
          >
            Create Round
          </button>
        </div>
      )}

      <h3 style={s.sectionTitle}>Rounds</h3>
      {rounds.length === 0 ? (
        <div style={s.card}><p style={{ color: '#666' }}>No rounds yet.</p></div>
      ) : (
        rounds.map(round => (
          <div key={round.roundNumber} style={{
            ...s.card,
            borderLeft: selectedRound === String(round.roundNumber) ? '4px solid #2196F3' : undefined,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Round {round.roundNumber}</strong>
                <span style={{ ...s.statusDot, color: statusColor(round.status) }}> {round.status}</span>
                <p style={s.meta}>Deadline: {round.deadline} · {round.predCount} picks</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.outlineBtn} onClick={() => onRoundSelect(String(round.roundNumber))}>
                  Matches
                </button>
                {!isReadOnly && round.status !== 'open' && (
                  <button style={{ ...s.outlineBtn, color: '#4CAF50', borderColor: '#4CAF50' }}
                    onClick={() => updateStatus(round.roundNumber, 'open')}>
                    Open
                  </button>
                )}
                {!isReadOnly && round.status === 'open' && (
                  <button style={{ ...s.outlineBtn, color: '#F44336', borderColor: '#F44336' }}
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

// --- MatchesTab ---

function MatchesTab({ gameId, round, api, isReadOnly }: {
  gameId: string;
  round: string;
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    api(`/api/lms/matches/${gameId}/${round}`)
      .then(data => setMatches(data.matches || []))
      .catch(err => setError(err.message));
  }, [api, gameId, round]);

  useEffect(() => { load(); }, [load]);

  const uploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('gameId', gameId);
    formData.append('round', round);
    try {
      const data = await api('/api/lms/matches/upload', { method: 'POST', body: formData });
      setSuccess(`Uploaded ${data.inserted} matches`);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const setResult = async (matchId: number) => {
    const result = results[matchId];
    if (!result) return;
    try {
      const data = await api(`/api/lms/matches/${matchId}/result`, {
        method: 'PUT',
        body: JSON.stringify({ result }),
      });
      setSuccess(`Result set. ${data.predictionsProcessed} predictions processed.`);
      load();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      {error && <div style={s.errorBanner} onClick={() => setError(null)}>{error}</div>}
      {success && <div style={s.successBanner}>{success}</div>}

      {!isReadOnly && (
        <div style={s.card}>
          <h3 style={s.sectionTitle}>Upload Matches (CSV)</h3>
          <p style={s.meta}>Format: match_number, date, location, home_team, away_team (with header row)</p>
          <input type="file" accept=".csv" onChange={uploadCSV} style={{ marginTop: 8 }} />
        </div>
      )}

      <h3 style={s.sectionTitle}>Matches — Round {round}</h3>
      {matches.length === 0 ? (
        <div style={s.card}><p style={{ color: '#666' }}>No matches yet. Upload a CSV to add matches.</p></div>
      ) : (
        matches.map(match => (
          <div key={match.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong>#{match.matchNumber}: {match.homeTeam} vs {match.awayTeam}</strong>
                <p style={s.meta}>{match.date} · {match.location}</p>
                {match.result && (
                  <p style={{ ...s.meta, fontWeight: 600, color: '#333' }}>Result: {match.result}</p>
                )}
              </div>
              {!isReadOnly && match.status !== 'completed' && match.status !== 'postponed' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                  <input
                    style={{ ...s.input, width: 90 }}
                    placeholder="e.g. 2 - 1"
                    value={results[match.id] || ''}
                    onChange={e => setResults(prev => ({ ...prev, [match.id]: e.target.value }))}
                  />
                  <button
                    style={s.outlineBtn}
                    onClick={() => setResult(match.id)}
                    disabled={!results[match.id]}
                  >
                    Set Result
                  </button>
                </div>
              )}
              {(match.status === 'completed' || match.status === 'postponed') && (
                <span style={{ ...s.meta, flexShrink: 0, marginLeft: 12, fontStyle: 'italic' }}>
                  {match.status}
                </span>
              )}
            </div>
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
      {error && <div style={s.errorBanner} onClick={() => setError(null)}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={s.label}>Round: </label>
        <input
          style={{ ...s.input, width: 80 }}
          placeholder="All"
          value={filterRound}
          onChange={e => setFilterRound(e.target.value)}
        />
        <button style={s.outlineBtn} onClick={load}>Refresh</button>
      </div>

      {predictions.length === 0 ? (
        <div style={s.card}><p style={{ color: '#666' }}>No predictions found.</p></div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHeader}>
            <span style={{ flex: 2 }}>Player</span>
            <span style={{ flex: 1 }}>Round</span>
            <span style={{ flex: 2 }}>Pick</span>
            <span style={{ flex: 2 }}>Match</span>
            <span style={{ flex: 1 }}>Result</span>
            <span style={{ flex: 1 }}>Status</span>
          </div>
          {predictions.map((p, idx) => (
            <div key={idx} style={{ ...s.tableRow, backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
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

// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: 16,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#333',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  readOnlyBadge: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #FFE0B2',
  },
  tabs: {
    display: 'flex',
    marginBottom: 20,
    borderBottom: '2px solid #e0e0e0',
  },
  tab: {
    padding: '8px 20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: '#666',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    fontWeight: 500,
  },
  activeTab: { color: '#2196F3', borderBottom: '2px solid #2196F3' },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 12px' },
  meta: { color: '#666', fontSize: 13, margin: '4px 0' },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    border: '1px solid #FFCDD2',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    color: '#C62828',
    cursor: 'pointer',
    fontSize: 13,
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    border: '1px solid #C8E6C9',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    color: '#2E7D32',
    fontSize: 13,
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    flex: 1,
    minWidth: 0,
  },
  select: {
    padding: '7px 10px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  label: { fontSize: 13, color: '#666', marginRight: 4 },
  primaryBtn: {
    padding: '9px 20px',
    border: 'none',
    borderRadius: 7,
    backgroundColor: '#2196F3',
    color: 'white',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  outlineBtn: {
    padding: '7px 14px',
    border: '1px solid #2196F3',
    borderRadius: 7,
    backgroundColor: 'white',
    color: '#2196F3',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
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
  table: {
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  tableHeader: {
    display: 'flex',
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    gap: 8,
    borderBottom: '1px solid #e0e0e0',
  },
  tableRow: {
    display: 'flex',
    padding: '10px 16px',
    gap: 8,
    borderBottom: '1px solid #f0f0f0',
    alignItems: 'center',
  },
};

export default App;
