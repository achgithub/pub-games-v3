import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Types ---

interface Config {
  appName: string;
  permissionLevel: 'full' | 'read-only';
  currentGameId: string;
}

interface FixtureFile {
  id: number;
  name: string;
  matchCount: number;
  updatedAt: string;
}

interface LMSGame {
  id: number;
  name: string;
  status: string;
  fixtureFileId: number;
  fixtureName: string;
}

interface Round {
  id: number;
  label: number;
  startDate: string;
  endDate: string;
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

// --- Hooks ---

function useUrlParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return { userId: params.get('userId') || '', token: params.get('token') || '' };
  }, []);
}

function useApi(token: string) {
  return useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> || {}),
      };
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

type Tab = 'fixtures' | 'games' | 'rounds' | 'results' | 'predictions';

function App() {
  const { userId, token } = useUrlParams();
  const api = useApi(token);

  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('fixtures');
  const [selectedGameId, setSelectedGameId] = useState<string>('');

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
        {(['fixtures', 'games', 'rounds', 'results', 'predictions'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`ah-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Game selector for tabs that need it */}
      {(activeTab === 'rounds' || activeTab === 'results' || activeTab === 'predictions') && (
        <GameSelector
          selectedGameId={selectedGameId}
          onSelect={setSelectedGameId}
          api={api}
        />
      )}

      {activeTab === 'fixtures' && (
        <FixturesTab api={api} isReadOnly={isReadOnly} />
      )}
      {activeTab === 'games' && (
        <GamesTab api={api} isReadOnly={isReadOnly} onGameSelect={setSelectedGameId} />
      )}
      {activeTab === 'rounds' && selectedGameId && (
        <RoundsTab gameId={selectedGameId} api={api} isReadOnly={isReadOnly} />
      )}
      {activeTab === 'results' && selectedGameId && (
        <ResultsTab gameId={selectedGameId} api={api} isReadOnly={isReadOnly} />
      )}
      {activeTab === 'predictions' && selectedGameId && (
        <PredictionsTab gameId={selectedGameId} api={api} />
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
      <select value={selectedGameId} onChange={e => onSelect(e.target.value)} className="ah-select">
        <option value="">— select game —</option>
        {games.map(g => (
          <option key={g.id} value={String(g.id)}>
            {g.name} ({g.status}) · {g.fixtureName || 'no fixture'}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- FixturesTab ---

function FixturesTab({ api, isReadOnly }: { api: ReturnType<typeof useApi>; isReadOnly: boolean }) {
  const [fixtures, setFixtures] = useState<FixtureFile[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<FixtureFile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [uploadName, setUploadName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadFixtures = useCallback(() => {
    api('/api/lms/fixtures').then(data => setFixtures(data.fixtures || [])).catch(err => setError(err.message));
  }, [api]);

  useEffect(() => { loadFixtures(); }, [loadFixtures]);

  const loadMatches = (fixture: FixtureFile) => {
    setSelectedFixture(fixture);
    api(`/api/lms/fixtures/${fixture.id}/matches`)
      .then(data => setMatches(data.matches || []))
      .catch(err => setError(err.message));
  };

  const uploadFixture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadName.trim()) return;
    const formData = new FormData();
    formData.append('name', uploadName.trim());
    formData.append('file', file);
    try {
      const data = await api('/api/lms/fixtures/upload', { method: 'POST', body: formData });
      setSuccess(`"${data.name}" uploaded — ${data.upserted} matches`);
      setUploadName('');
      loadFixtures();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  // Group selected fixture's matches by round
  const byRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    (acc[m.roundNumber] = acc[m.roundNumber] || []).push(m);
    return acc;
  }, {});
  const roundNumbers = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="ah-banner ah-banner--success">{success}</div>}

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Upload Fixture File (CSV)</h3>
          <p className="ah-meta">Format: match_number, round_number, date, location, home_team, away_team[, result]</p>
          <p className="ah-meta">Re-uploading with the same name updates existing matches. Results in the CSV are stored but status is only set to Completed when you confirm results in the Results tab.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input
              className="ah-input"
              style={{ flex: 1, minWidth: 180 }}
              placeholder="Fixture file name (e.g. Premier League 2025/26)"
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
            />
            <input
              type="file"
              accept=".csv"
              disabled={!uploadName.trim()}
              onChange={uploadFixture}
              style={{ alignSelf: 'center' }}
            />
          </div>
        </div>
      )}

      <h3 className="ah-section-title">Fixture Files</h3>
      {fixtures.length === 0 ? (
        <div className="ah-card"><p style={{ color: '#666' }}>No fixture files yet. Upload a CSV above.</p></div>
      ) : (
        fixtures.map(f => (
          <div key={f.id} className="ah-card" style={{
            borderLeft: selectedFixture?.id === f.id ? '4px solid #2196F3' : undefined,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{f.name}</strong>
                <p className="ah-meta">{f.matchCount} matches · updated {f.updatedAt}</p>
              </div>
              <button className="ah-btn-outline" onClick={() => loadMatches(f)}>
                {selectedFixture?.id === f.id ? 'Hide' : 'View'}
              </button>
            </div>

            {selectedFixture?.id === f.id && matches.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {roundNumbers.map(roundNum => (
                  <div key={roundNum}>
                    <p className="ah-section-title" style={{ marginTop: 8 }}>Round {roundNum}</p>
                    {byRound[roundNum].map(m => (
                      <div key={m.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <strong>#{m.matchNumber}</strong> {m.homeTeam} vs {m.awayTeam}
                        <span className="ah-label" style={{ marginLeft: 8 }}>{m.date} · {m.location}</span>
                        {m.result && <span style={{ marginLeft: 8, color: '#4CAF50', fontWeight: 600 }}>{m.result}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// --- GamesTab ---

function GamesTab({ api, isReadOnly, onGameSelect }: {
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
  onGameSelect: (id: string) => void;
}) {
  const [games, setGames] = useState<LMSGame[]>([]);
  const [fixtures, setFixtures] = useState<FixtureFile[]>([]);
  const [currentGameId, setCurrentGameId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newFixtureId, setNewFixtureId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    api('/api/lms/games').then(data => {
      setGames(data.games || []);
      setCurrentGameId(data.currentGameId || '');
    }).catch(err => setError(err.message));
    api('/api/lms/fixtures').then(data => setFixtures(data.fixtures || [])).catch(() => {});
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const createGame = async () => {
    if (!newName.trim() || !newFixtureId) return;
    try {
      await api('/api/lms/games', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          fixtureFileId: parseInt(newFixtureId),
        }),
      });
      setNewName('');
      setNewFixtureId('');
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
          {fixtures.length === 0 ? (
            <div className="ah-banner ah-banner--warning">Upload a fixture file first (Fixtures tab) before creating a game.</div>
          ) : (
            <>
              <input
                className="ah-input"
                style={{ width: '100%' }}
                placeholder="Game name (e.g. Andy's Friends 2025)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <div style={{ marginTop: 8 }}>
                <label className="ah-label">Fixture file: </label>
                <select
                  value={newFixtureId}
                  onChange={e => setNewFixtureId(e.target.value)}
                  className="ah-select"
                >
                  <option value="">— select —</option>
                  {fixtures.map(f => (
                    <option key={f.id} value={String(f.id)}>{f.name}</option>
                  ))}
                </select>
              </div>
              <button
                className="ah-btn-primary"
                style={{ marginTop: 12 }}
                onClick={createGame}
                disabled={!newName.trim() || !newFixtureId}
              >
                Create Game
              </button>
            </>
          )}
        </div>
      )}

      <h3 className="ah-section-title">All Games</h3>
      {games.length === 0 ? (
        <div className="ah-card"><p style={{ color: '#666' }}>No games yet.</p></div>
      ) : (
        games.map(game => (
          <div key={game.id} className="ah-card" style={{
            borderLeft: String(game.id) === currentGameId ? '4px solid #2196F3' : undefined,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{game.name}</strong>
                {String(game.id) === currentGameId && <span style={s.currentBadge}>CURRENT</span>}
                <p className="ah-meta">Status: {game.status} · Fixture: {game.fixtureName || '—'}</p>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {String(game.id) !== currentGameId && (
                    <button className="ah-btn-outline" onClick={() => setCurrent(game.id)}>Set Current</button>
                  )}
                  <button className="ah-btn-outline" onClick={() => onGameSelect(String(game.id))}>Rounds</button>
                  {game.status === 'active' && (
                    <button className="ah-btn-danger" onClick={() => completeGame(game.id)}>Complete</button>
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

// Returns the next Wednesday on or after today, formatted as YYYY-MM-DD.
// If today is Wednesday, returns next week's Wednesday.
function nextWednesday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 3=Wed
  const daysUntilWed = ((3 - day + 7) % 7) || 7; // always at least 1 day away
  d.setDate(d.getDate() + daysUntilWed);
  return d.toISOString().slice(0, 10);
}

// Returns the Tuesday 6 days after a given YYYY-MM-DD Wednesday date.
function followingTuesday(startDate: string): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

// --- RoundsTab ---

function RoundsTab({ gameId, api, isReadOnly }: {
  gameId: string;
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
}) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    api(`/api/lms/rounds/${gameId}`)
      .then(data => {
        const r: Round[] = data.rounds || [];
        setRounds(r);
        // Pre-fill defaults for next round
        const nextLabel = r.length > 0 ? Math.max(...r.map((x: Round) => x.label)) + 1 : 1;
        const start = nextWednesday();
        setNewLabel(String(nextLabel));
        setNewStartDate(start);
        setNewEndDate(followingTuesday(start));
      })
      .catch(err => setError(err.message));
  }, [api, gameId]);

  useEffect(() => { load(); }, [load]);

  // When start date changes, auto-update end date to +6 days
  const handleStartDateChange = (val: string) => {
    setNewStartDate(val);
    if (val) setNewEndDate(followingTuesday(val));
  };

  const createRound = async () => {
    if (!newLabel || !newStartDate || !newEndDate) return;
    try {
      await api('/api/lms/rounds', {
        method: 'POST',
        body: JSON.stringify({
          gameId: parseInt(gameId),
          label: parseInt(newLabel),
          startDate: newStartDate,
          endDate: newEndDate,
        }),
      });
      setSuccess(`Round ${newLabel} created`);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const updateStatus = async (label: number, status: string) => {
    try {
      await api(`/api/lms/rounds/${gameId}/${label}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setSuccess(`Round ${label} → ${status}`);
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
          <p className="ah-meta">Matches whose date falls within the window are automatically included.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <div>
              <label className="ah-label">Round #</label>
              <input
                className="ah-input"
                style={{ width: 72 }}
                type="number"
                min="1"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="ah-label">From (Wed)</label>
              <input
                className="ah-input"
                type="date"
                value={newStartDate}
                onChange={e => handleStartDateChange(e.target.value)}
              />
            </div>
            <div>
              <label className="ah-label">To (Tue)</label>
              <input
                className="ah-input"
                type="date"
                value={newEndDate}
                onChange={e => setNewEndDate(e.target.value)}
              />
            </div>
          </div>
          <button
            className="ah-btn-primary"
            style={{ marginTop: 10 }}
            onClick={createRound}
            disabled={!newLabel || !newStartDate || !newEndDate}
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
          <div key={round.label} className="ah-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Round {round.label}</strong>
                <span style={{ ...s.statusDot, color: statusColor(round.status) }}> {round.status}</span>
                <p className="ah-meta">{round.startDate} → {round.endDate} · {round.predCount} picks</p>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {round.status !== 'open' && (
                    <button className="ah-btn-outline" style={{ color: '#4CAF50', borderColor: '#4CAF50' }}
                      onClick={() => updateStatus(round.label, 'open')}>
                      Open
                    </button>
                  )}
                  {round.status === 'open' && (
                    <button className="ah-btn-danger" onClick={() => updateStatus(round.label, 'closed')}>
                      Close
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

// --- ResultsTab ---

function ResultsTab({ gameId, api, isReadOnly }: {
  gameId: string;
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
}) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [resultInputs, setResultInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<{ survived: number; eliminated: number } | null>(null);

  // Load rounds for this game
  useEffect(() => {
    api(`/api/lms/rounds/${gameId}`)
      .then(data => {
        const r: Round[] = data.rounds || [];
        setRounds(r);
        // Default to the highest round label
        if (r.length > 0) setSelectedRound(String(r[r.length - 1].label));
      })
      .catch(err => setError(err.message));
  }, [api, gameId]);

  // Load matches when round changes (by label)
  useEffect(() => {
    if (!selectedRound) return;
    api(`/api/lms/matches/${gameId}/${selectedRound}`)
      .then(data => { setMatches(data.matches || []); setResultInputs({}); setProcessResult(null); })
      .catch(err => setError(err.message));
  }, [api, gameId, selectedRound]);

  const setResult = async (matchId: number) => {
    const result = resultInputs[matchId];
    if (!result) return;
    try {
      await api(`/api/lms/matches/${matchId}/result`, {
        method: 'PUT',
        body: JSON.stringify({ result }),
      });
      setSuccess('Result saved');
      setResultInputs(prev => { const next = { ...prev }; delete next[matchId]; return next; });
      // Reload matches to show updated result
      const data = await api(`/api/lms/matches/${gameId}/${selectedRound}`);
      setMatches(data.matches || []);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const processRound = async () => {
    try {
      const data = await api(`/api/lms/rounds/${gameId}/${selectedRound}/process`, { method: 'POST' });
      setProcessResult({ survived: data.survived, eliminated: data.eliminated });
      setSuccess(`Round ${selectedRound} processed — ${data.survived} survived, ${data.eliminated} eliminated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process round');
    }
  };

  const missingResults = matches.filter(m => !m.result || m.result.trim() === '').length;
  const canProcess = matches.length > 0 && missingResults === 0;

  const statusColor = (status: string) => {
    if (status === 'completed') return '#4CAF50';
    if (status === 'postponed') return '#FF9800';
    return '#999';
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="ah-banner ah-banner--success">{success}</div>}

      {/* Round selector */}
      <div style={{ marginBottom: 16 }}>
        <label className="ah-label">Round: </label>
        <select value={selectedRound} onChange={e => setSelectedRound(e.target.value)} className="ah-select">
          <option value="">— select round —</option>
          {rounds.map(r => (
            <option key={r.label} value={String(r.label)}>
              Round {r.label} ({r.startDate} → {r.endDate}) [{r.status}]
            </option>
          ))}
        </select>
      </div>

      {selectedRound && matches.length === 0 && (
        <div className="ah-card"><p style={{ color: '#666' }}>No matches in the Round {selectedRound} date window. Check the fixture file is uploaded with dates in that range.</p></div>
      )}

      {matches.length > 0 && (
        <>
          {matches.map(match => (
            <div key={match.id} className="ah-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <strong>#{match.matchNumber}: {match.homeTeam} vs {match.awayTeam}</strong>
                  <p className="ah-meta">{match.date} · {match.location}</p>
                  {match.result && (
                    <p className="ah-meta" style={{ fontWeight: 600, color: '#333' }}>Result: {match.result}</p>
                  )}
                  {match.status !== 'upcoming' && (
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
                      placeholder="2 - 1"
                      value={resultInputs[match.id] || ''}
                      onChange={e => setResultInputs(prev => ({ ...prev, [match.id]: e.target.value }))}
                    />
                    <button
                      className="ah-btn-outline"
                      onClick={() => setResult(match.id)}
                      disabled={!resultInputs[match.id]}
                    >
                      {match.result ? 'Update' : 'Set'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {!isReadOnly && (
            <div className="ah-card" style={{ marginTop: 8 }}>
              {missingResults > 0 && (
                <p className="ah-meta" style={{ color: '#E65100', marginBottom: 8 }}>
                  {missingResults} match{missingResults > 1 ? 'es' : ''} still need{missingResults === 1 ? 's' : ''} a result before processing.
                </p>
              )}
              <button
                className="ah-btn-primary"
                onClick={processRound}
                disabled={!canProcess}
              >
                Process Round {selectedRound}
              </button>
              {processResult && (
                <p className="ah-meta" style={{ marginTop: 8, color: '#333' }}>
                  ✅ {processResult.survived} survived · ❌ {processResult.eliminated} eliminated
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- PredictionsTab ---

function PredictionsTab({ gameId, api }: { gameId: string; api: ReturnType<typeof useApi> }) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [filterRound, setFilterRound] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ gameId });
    if (filterRound) params.set('round', filterRound);
    api(`/api/lms/predictions?${params}`)
      .then(data => setPredictions(data.predictions || []))
      .catch(err => setError(err.message));
  }, [api, gameId, filterRound]);

  useEffect(() => { load(); }, [load]);

  const statusIcon = (p: any) => {
    if (p.bye) return <span style={{ color: '#2196F3' }}>Bye</span>;
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

// --- App-specific styles (shared styles use .ah-* classes) ---

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
