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
  submissionDeadline: string | null;
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

interface ManagedPlayer {
  id: number;
  managerEmail: string;
  name: string;
  createdAt: string;
}

interface ManagedGroup {
  id: number;
  managerEmail: string;
  name: string;
  description: string;
  createdAt: string;
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

type Module = 'setup' | 'lms' | 'sweepstakes' | 'quiz';
type LMSTab = 'fixtures' | 'games' | 'rounds' | 'results' | 'predictions';
type SweepTab = 'sw-competitions' | 'sw-entries';
type QuizTab = 'quiz-media' | 'quiz-questions' | 'quiz-packs';
type Tab = LMSTab | SweepTab | QuizTab;

function App() {
  const { userId, token } = useUrlParams();
  const api = useApi(token);

  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<Module>('lms');
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
        <p className="ah-meta">Access this app through the lobby.</p>
      </div>
    );
  }

  if (loading) return <div className="ah-container"><p className="ah-meta">Loading...</p></div>;

  if (authError) {
    return (
      <div className="ah-container">
        <h2>Game Admin</h2>
        <div className="ah-banner ah-banner--error">{authError}</div>
        <p className="ah-meta">You need the game_admin or super_user role to access this app.</p>
      </div>
    );
  }

  const isReadOnly = config?.permissionLevel === 'read-only';

  return (
    <>
      {/* App Header Bar */}
      <div className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">Game Admin</h1>
          {isReadOnly && <span className="ah-badge--warning">Read-only</span>}
        </div>
        <div className="ah-app-header-right">
          <button className="ah-lobby-btn" onClick={goToLobby}>← Lobby</button>
        </div>
      </div>

      <div className="ah-container">
        {/* Module switcher */}
        <div className="ah-tabs">
          {(['setup', 'lms', 'sweepstakes', 'quiz'] as Module[]).map(mod => (
            <button
              key={mod}
              className={`ah-tab${activeModule === mod ? ' active' : ''}`}
              onClick={() => {
                setActiveModule(mod);
                if (mod === 'lms') setActiveTab('fixtures');
                else if (mod === 'sweepstakes') setActiveTab('sw-competitions');
                else if (mod === 'quiz') setActiveTab('quiz-media');
              }}
            >
              {mod === 'setup' ? '⚙️ Setup' : mod === 'lms' ? 'Last Man Standing' : mod === 'sweepstakes' ? 'Sweepstakes' : 'Quiz'}
            </button>
          ))}
        </div>

      {/* Setup module */}
      {activeModule === 'setup' && <SetupTab api={api} isReadOnly={isReadOnly} />}

      {/* LMS module */}
      {activeModule === 'lms' && (
        <>
          <div className="ah-tabs">
            {(['fixtures', 'games', 'rounds', 'results', 'predictions'] as LMSTab[]).map(tab => (
              <button
                key={tab}
                className={`ah-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {(activeTab === 'rounds' || activeTab === 'results' || activeTab === 'predictions') && (
            <GameSelector selectedGameId={selectedGameId} onSelect={setSelectedGameId} api={api} />
          )}

          {activeTab === 'fixtures' && <FixturesTab api={api} isReadOnly={isReadOnly} />}
          {activeTab === 'games' && (
            <GamesTab api={api} isReadOnly={isReadOnly} onGameSelect={(id) => { setSelectedGameId(id); setActiveTab('rounds'); }} />
          )}
          {activeTab === 'rounds' && selectedGameId && <RoundsTab gameId={selectedGameId} api={api} isReadOnly={isReadOnly} />}
          {activeTab === 'results' && selectedGameId && <ResultsTab gameId={selectedGameId} api={api} isReadOnly={isReadOnly} />}
          {activeTab === 'predictions' && selectedGameId && <PredictionsTab gameId={selectedGameId} api={api} />}
          {(activeTab === 'rounds' || activeTab === 'results' || activeTab === 'predictions') && !selectedGameId && (
            <div className="ah-card"><p className="ah-meta">Select a game above to continue.</p></div>
          )}
        </>
      )}

      {/* Sweepstakes module */}
      {activeModule === 'sweepstakes' && (
        <>
          <div className="ah-tabs">
            {([['sw-competitions', 'Competitions'], ['sw-entries', 'Entries']] as [SweepTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                className={`ah-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'sw-competitions' && (
            <SweepCompetitionsTab
              api={api}
              isReadOnly={isReadOnly}
              onSelectComp={() => setActiveTab('sw-entries')}
            />
          )}
          {activeTab === 'sw-entries' && (
            <SweepEntriesTab api={api} isReadOnly={isReadOnly} />
          )}
        </>
      )}

      {/* Quiz module */}
      {activeModule === 'quiz' && (
        <>
          <div className="ah-tabs">
            {([['quiz-media', 'Media'], ['quiz-questions', 'Questions'], ['quiz-packs', 'Packs']] as [QuizTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                className={`ah-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'quiz-media' && <QuizMediaTab api={api} isReadOnly={isReadOnly} />}
          {activeTab === 'quiz-questions' && <QuizQuestionsTab api={api} isReadOnly={isReadOnly} />}
          {activeTab === 'quiz-packs' && <QuizPacksTab api={api} isReadOnly={isReadOnly} />}
        </>
      )}
    </div>
    </>
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
    <div className="mb-4">
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
      <Toast message={success} />

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Upload Fixture File (CSV)</h3>
          <p className="ah-meta">Format: match_number, round_number, date, location, home_team, away_team[, result]</p>
          <p className="ah-meta">Re-uploading with the same name updates existing matches. Results in the CSV are stored but status is only set to Completed when you confirm results in the Results tab.</p>
          <div className="ah-flex flex-wrap gap-2 mt-2">
            <input
              className="ah-input"
              className="flex-1" style={{ minWidth: 180 }}
              placeholder="Fixture file name (e.g. Premier League 2025/26)"
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
            />
            <input
              type="file"
              accept=".csv"
              disabled={!uploadName.trim()}
              onChange={uploadFixture}
              className="self-center"
            />
          </div>
        </div>
      )}

      <h3 className="ah-section-title">Fixture Files</h3>
      {fixtures.length === 0 ? (
        <div className="ah-card"><p className="ah-meta">No fixture files yet. Upload a CSV above.</p></div>
      ) : (
        fixtures.map(f => (
          <div key={f.id} className="ah-card" style={{
            borderLeft: selectedFixture?.id === f.id ? '4px solid #2196F3' : undefined,
          }}>
            <div className="ah-flex-between">
              <div>
                <strong>{f.name}</strong>
                <p className="ah-meta">{f.matchCount} matches · updated {f.updatedAt}</p>
              </div>
              <button className="ah-btn-outline" onClick={() => loadMatches(f)}>
                {selectedFixture?.id === f.id ? 'Hide' : 'View'}
              </button>
            </div>

            {selectedFixture?.id === f.id && matches.length > 0 && (
              <div className="mt-3">
                {roundNumbers.map(roundNum => (
                  <div key={roundNum}>
                    <p className="ah-section-title mt-2">Round {roundNum}</p>
                    {byRound[roundNum].map(m => (
                      <div key={m.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <strong>#{m.matchNumber}</strong> {m.homeTeam} vs {m.awayTeam}
                        <span className="ah-label ml-2">{m.date} · {m.location}</span>
                        {m.result && <span className="ml-2 text-green-600 font-semibold">{m.result}</span>}
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

  const deleteGame = async (id: number, name: string) => {
    if (!window.confirm(`Permanently delete "${name}" and ALL its rounds, predictions, and players? This cannot be undone.`)) return;
    try {
      await api(`/api/lms/games/${id}`, { method: 'DELETE' });
      setSuccess('Game deleted');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Create New Game</h3>
          {fixtures.length === 0 ? (
            <div className="ah-banner ah-banner--warning">Upload a fixture file first (Fixtures tab) before creating a game.</div>
          ) : (
            <>
              <input
                className="ah-input"
                className="w-full"
                placeholder="Game name (e.g. Andy's Friends 2025)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <div className="mt-2">
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
                className="mt-3"
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
        <div className="ah-card"><p className="ah-meta">No games yet.</p></div>
      ) : (
        games.map(game => (
          <div key={game.id} className="ah-card" style={{
            borderLeft: String(game.id) === currentGameId ? '4px solid #2196F3' : undefined,
          }}>
            <div className="ah-flex-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <strong>{game.name}</strong>
                {String(game.id) === currentGameId && <span className="ah-badge--info" className="ml-2">CURRENT</span>}
                <p className="ah-meta">Status: {game.status} · Fixture: {game.fixtureName || '—'}</p>
              </div>
              {!isReadOnly && (
                <div className="ah-flex flex-wrap flex-shrink-0 gap-2 justify-end">
                  {String(game.id) !== currentGameId && (
                    <button className="ah-btn-outline" onClick={() => setCurrent(game.id)}>Set Current</button>
                  )}
                  <button className="ah-btn-outline" onClick={() => onGameSelect(String(game.id))}>Rounds →</button>
                  {game.status === 'active' && (
                    <button className="ah-btn-danger" onClick={() => completeGame(game.id)}>Complete</button>
                  )}
                  <button className="ah-btn-danger" onClick={() => deleteGame(game.id, game.name)}>Delete</button>
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

// Returns the default submission deadline: 23:59 on the day before the start date (Tuesday night).
// Format: YYYY-MM-DDTHH:MM (for datetime-local input).
function defaultDeadline(startDate: string): string {
  if (!startDate) return '';
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10) + 'T23:59';
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
  const [newDeadline, setNewDeadline] = useState('');
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
        setNewDeadline(defaultDeadline(start));
      })
      .catch(err => setError(err.message));
  }, [api, gameId]);

  useEffect(() => { load(); }, [load]);

  // When start date changes, auto-update end date and deadline
  const handleStartDateChange = (val: string) => {
    setNewStartDate(val);
    if (val) {
      setNewEndDate(followingTuesday(val));
      setNewDeadline(defaultDeadline(val));
    }
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
          submissionDeadline: newDeadline || undefined,
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

  const deleteRound = async (label: number) => {
    if (!window.confirm(`Permanently delete Round ${label} and all its predictions?`)) return;
    try {
      await api(`/api/lms/rounds/${gameId}/${label}`, { method: 'DELETE' });
      setSuccess(`Round ${label} deleted`);
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
      <Toast message={success} />

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Create Round</h3>
          <p className="ah-meta">Matches whose date falls within the window are automatically included.</p>
          <div className="ah-flex flex-wrap gap-2 mt-2">
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
            <div>
              <label className="ah-label">Pick deadline (optional)</label>
              <input
                className="ah-input"
                type="datetime-local"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
              />
            </div>
          </div>
          <button
            className="ah-btn-primary"
            className="mt-2"
            onClick={createRound}
            disabled={!newLabel || !newStartDate || !newEndDate}
          >
            Create Round
          </button>
        </div>
      )}

      <h3 className="ah-section-title">Rounds</h3>
      {rounds.length === 0 ? (
        <div className="ah-card"><p className="ah-meta">No rounds yet.</p></div>
      ) : (
        rounds.map(round => (
          <div key={round.label} className="ah-card">
            <div className="ah-flex-between">
              <div>
                <strong>Round {round.label}</strong>
                <span style={{ color: statusColor(round.status), fontSize: 13, fontWeight: 500 }}> {round.status}</span>
                <p className="ah-meta">{round.startDate} → {round.endDate} · {round.predCount} picks</p>
                {round.submissionDeadline && (
                  <p className="ah-meta" className="text-orange-700">
                    Deadline: {new Date(round.submissionDeadline).toLocaleString()}
                  </p>
                )}
              </div>
              {!isReadOnly && (
                <div className="ah-flex flex-wrap gap-2 justify-end">
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
                  <button className="ah-btn-danger" onClick={() => deleteRound(round.label)}>Delete</button>
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
  const [processResult, setProcessResult] = useState<{ survived: number; eliminated: number; autoPicked: number } | null>(null);

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
      setProcessResult({ survived: data.survived, eliminated: data.eliminated, autoPicked: data.autoPicked || 0 });
      const autoMsg = data.autoPicked ? `, ${data.autoPicked} auto-picked` : '';
      setSuccess(`Round ${selectedRound} processed — ${data.survived} survived, ${data.eliminated} eliminated${autoMsg}`);
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
      <Toast message={success} />

      {/* Round selector */}
      <div className="mb-4">
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
        <div className="ah-card"><p className="ah-meta">No matches in the Round {selectedRound} date window. Check the fixture file is uploaded with dates in that range.</p></div>
      )}

      {matches.length > 0 && (
        <>
          {matches.map(match => (
            <div key={match.id} className="ah-card">
              <div className="ah-flex-between" style={{ alignItems: 'flex-start' }}>
                <div className="flex-1">
                  <strong>#{match.matchNumber}: {match.homeTeam} vs {match.awayTeam}</strong>
                  <p className="ah-meta">{match.date} · {match.location}</p>
                  {match.result && (
                    <p className="ah-meta" className="font-semibold text-gray-800">Result: {match.result}</p>
                  )}
                  {match.status !== 'upcoming' && (
                    <p className="ah-meta" style={{ color: statusColor(match.status), fontWeight: 500 }}>
                      {match.status}
                    </p>
                  )}
                </div>
                {!isReadOnly && (
                  <div className="ah-flex-center gap-2 flex-shrink-0 ml-3">
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
            <div className="ah-card" className="mt-2">
              {missingResults > 0 && (
                <p className="ah-meta" className="text-orange-700 mb-2">
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
                <p className="ah-meta" className="mt-2 text-gray-800">
                  ✅ {processResult.survived} survived · ❌ {processResult.eliminated} eliminated
                  {processResult.autoPicked > 0 && ` · 🤖 ${processResult.autoPicked} auto-picked`}
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
    if (p.bye) return <span className="text-blue-600">Bye</span>;
    if (p.voided) return <span className="text-orange-600">Voided</span>;
    if (p.isCorrect === null) return <span className="text-gray-500">Pending</span>;
    if (p.isCorrect) return <span className="text-green-600">✅ Survived</span>;
    return <span className="text-red-600">❌ Eliminated</span>;
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}

      <div className="ah-flex-center gap-3 mb-4">
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
        <div className="ah-card"><p className="ah-meta">No predictions found.</p></div>
      ) : (
        <div className="ah-table">
          <div className="ah-table-header">
            <span className="flex-2">Player</span>
            <span className="flex-1">Round</span>
            <span className="flex-2">Pick</span>
            <span className="flex-2">Match</span>
            <span className="flex-1">Result</span>
            <span className="flex-1">Status</span>
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

// --- SweepCompetitionsTab ---

interface SweepComp {
  id: number;
  name: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
}

function SweepCompetitionsTab({ api, isReadOnly, onSelectComp }: {
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
  onSelectComp: () => void;
}) {
  const [comps, setComps] = useState<SweepComp[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('knockout');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    api('/api/sweepstakes/competitions').then(d => setComps(d.competitions || [])).catch(err => setError(err.message));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const createComp = async () => {
    if (!newName.trim()) return;
    try {
      await api('/api/sweepstakes/competitions', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), type: newType, description: newDesc }),
      });
      setNewName(''); setNewDesc('');
      setSuccess('Competition created');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const updateStatus = async (comp: SweepComp, status: string) => {
    if (!window.confirm(`Set "${comp.name}" to ${status}?`)) return;
    try {
      await api(`/api/sweepstakes/competitions/${comp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...comp, status }),
      });
      setSuccess('Status updated');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteComp = async (id: number, name: string) => {
    if (!window.confirm(`Permanently delete "${name}" and all its data?`)) return;
    try {
      await api(`/api/sweepstakes/competitions/${id}`, { method: 'DELETE' });
      setSuccess('Competition deleted');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const swStatusColor = (status: string) => {
    if (status === 'open') return '#4CAF50';
    if (status === 'draft') return '#FF9800';
    if (status === 'locked') return '#F44336';
    if (status === 'completed') return '#2196F3';
    return '#9E9E9E';
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Create Competition</h3>
          <input
            className="ah-input"
            className="w-full"
            placeholder="Competition name (e.g. World Cup 2026)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <div className="ah-flex gap-2 mt-2">
            <div>
              <label className="ah-label">Type: </label>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="ah-select">
                <option value="knockout">Knockout</option>
                <option value="race">Race</option>
              </select>
            </div>
            <input
              className="ah-input"
              className="flex-1"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
          </div>
          <button className="ah-btn-primary" className="mt-2" onClick={createComp} disabled={!newName.trim()}>
            Create
          </button>
        </div>
      )}

      <h3 className="ah-section-title">All Competitions</h3>
      {comps.length === 0 ? (
        <div className="ah-card"><p className="ah-meta">No competitions yet.</p></div>
      ) : (
        comps.map(comp => (
          <div key={comp.id} className="ah-card">
            <div className="ah-flex-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <strong>{comp.name}</strong>
                <p className="ah-meta">
                  <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'white', backgroundColor: swStatusColor(comp.status), marginRight: 6 }}>{comp.status}</span>
                  {comp.type}
                </p>
                {comp.description && <p className="ah-meta">{comp.description}</p>}
              </div>
              {!isReadOnly && (
                <div className="ah-flex flex-wrap flex-shrink-0 gap-1 justify-end ml-3">
                  {comp.status === 'draft' && (
                    <button className="ah-btn-outline" style={{ color: '#4CAF50', borderColor: '#4CAF50' }} onClick={() => updateStatus(comp, 'open')}>Open</button>
                  )}
                  {comp.status === 'open' && (
                    <button className="ah-btn-danger" onClick={() => updateStatus(comp, 'locked')}>Lock</button>
                  )}
                  {comp.status === 'locked' && (
                    <button className="ah-btn-outline" onClick={() => updateStatus(comp, 'completed')}>Complete</button>
                  )}
                  <button className="ah-btn-outline" onClick={onSelectComp}>Entries →</button>
                  <button className="ah-btn-danger" onClick={() => deleteComp(comp.id, comp.name)}>Delete</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// --- SweepEntriesTab ---

interface SweepEntry {
  id: number;
  competition_id: number;
  name: string;
  seed?: number;
  number?: number;
  status: string;
  position?: number;
}

interface SweepDraw {
  id: number;
  user_id: string;
  entry_id: number;
  drawn_at: string;
  entry_name: string;
  entry_status: string;
  seed?: number;
  number?: number;
  position?: number;
}

function SweepEntriesTab({ api, isReadOnly }: {
  api: ReturnType<typeof useApi>;
  isReadOnly: boolean;
}) {
  const [comps, setComps] = useState<SweepComp[]>([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [entries, setEntries] = useState<SweepEntry[]>([]);
  const [draws, setDraws] = useState<SweepDraw[]>([]);
  const [showDraws, setShowDraws] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api('/api/sweepstakes/competitions').then(d => setComps(d.competitions || [])).catch(() => {});
  }, [api]);

  const loadEntries = useCallback((compId: string) => {
    if (!compId) return;
    api(`/api/sweepstakes/competitions/${compId}/entries`)
      .then(d => setEntries(d.entries || []))
      .catch(err => setError(err.message));
  }, [api]);

  const loadDraws = useCallback((compId: string) => {
    if (!compId) return;
    api(`/api/sweepstakes/competitions/${compId}/all-draws`)
      .then(d => setDraws(d.draws || []))
      .catch(err => setError(err.message));
  }, [api]);

  const selectComp = (id: string) => {
    setSelectedCompId(id);
    setShowDraws(false);
    if (id) { loadEntries(id); loadDraws(id); }
  };

  const uploadEntries = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompId) return;
    const formData = new FormData();
    formData.append('competition_id', selectedCompId);
    formData.append('file', file);
    try {
      const data = await api('/api/sweepstakes/entries/upload', { method: 'POST', body: formData });
      setSuccess(`${data.uploaded} entries uploaded${data.skipped ? `, ${data.skipped} skipped` : ''}`);
      loadEntries(selectedCompId);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const updatePosition = async (entryId: number, position: number | null) => {
    if (!selectedCompId) return;
    try {
      await api(`/api/sweepstakes/competitions/${selectedCompId}/update-position`, {
        method: 'POST',
        body: JSON.stringify({ entry_id: entryId, position }),
      });
      loadEntries(selectedCompId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteEntry = async (id: number) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api(`/api/sweepstakes/entries/${id}`, { method: 'DELETE' });
      setSuccess('Entry deleted');
      loadEntries(selectedCompId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      <div className="mb-4">
        <label className="ah-label">Competition: </label>
        <select value={selectedCompId} onChange={e => selectComp(e.target.value)} className="ah-select">
          <option value="">— select —</option>
          {comps.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name} ({c.status})</option>
          ))}
        </select>
      </div>

      {selectedCompId && !isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Upload Entries (CSV)</h3>
          <p className="ah-meta">Format: Name[, seed or number]. Re-uploading skips existing names.</p>
          <input type="file" accept=".csv" onChange={uploadEntries} className="mt-2" />
        </div>
      )}

      {selectedCompId && (
        <div className="mt-2">
          <div className="ah-flex gap-2 mb-3">
            <button className={`ah-tab${!showDraws ? ' active' : ''}`} onClick={() => setShowDraws(false)}>
              Entries ({entries.length})
            </button>
            <button className={`ah-tab${showDraws ? ' active' : ''}`} onClick={() => setShowDraws(true)}>
              Draws ({draws.length})
            </button>
          </div>

          {!showDraws && (
            entries.length === 0 ? (
              <div className="ah-card"><p className="ah-meta">No entries yet. Upload a CSV above.</p></div>
            ) : (
              <div className="ah-table">
                <div className="ah-table-header">
                  <span className="flex-grow">Name</span>
                  <span className="flex-1">Seed/No.</span>
                  <span className="flex-1">Status</span>
                  <span className="flex-1">Position</span>
                  {!isReadOnly && <span className="flex-1">Actions</span>}
                </div>
                {entries.map(entry => (
                  <div key={entry.id} className="ah-table-row">
                    <span style={{ flex: 3, fontSize: 13 }}>{entry.name}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{entry.seed ?? entry.number ?? '—'}</span>
                    <span style={{ flex: 1, fontSize: 12, color: entry.status === 'taken' ? '#4CAF50' : '#666' }}>{entry.status}</span>
                    <span className="flex-1">
                      {!isReadOnly ? (
                        <select
                          value={entry.position ?? ''}
                          onChange={e => updatePosition(entry.id, e.target.value ? parseInt(e.target.value) : null)}
                          style={{ padding: '3px 6px', fontSize: 12 }}
                        >
                          <option value="">—</option>
                          {[1,2,3,4,5,6,7,8,999].map(p => (
                            <option key={p} value={p}>{p === 999 ? 'Last' : `${p}${p===1?'st':p===2?'nd':p===3?'rd':'th'}`}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: '#666' }}>{entry.position ?? '—'}</span>
                      )}
                    </span>
                    {!isReadOnly && (
                      <span className="flex-1">
                        <button className="ah-btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => deleteEntry(entry.id)}>
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {showDraws && (
            draws.length === 0 ? (
              <div className="ah-card"><p className="ah-meta">No draws yet.</p></div>
            ) : (
              <div className="ah-table">
                <div className="ah-table-header">
                  <span className="flex-2">User</span>
                  <span className="flex-2">Entry</span>
                  <span className="flex-1">Position</span>
                  <span className="flex-1">Drawn</span>
                </div>
                {draws.map((d, idx) => (
                  <div key={idx} className="ah-table-row">
                    <span style={{ flex: 2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.user_id}</span>
                    <span style={{ flex: 2, fontSize: 13, fontWeight: 500 }}>{d.entry_name}</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#666' }}>{d.position ?? '—'}</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#666' }}>{new Date(d.drawn_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// --- Toast: fixed-position success message, no layout shift ---

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      backgroundColor: '#323232',
      color: 'white',
      padding: '12px 20px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      zIndex: 9999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
      maxWidth: 320,
    }}>
      {message}
    </div>
  );
}

// --- Quiz types ---

interface MediaFile {
  id: number;
  guid: string;
  filename: string;
  originalName: string;
  type: 'image' | 'audio';
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  label: string;
}

interface MediaClip {
  id: number;
  guid: string;
  mediaFileId: number;
  label: string;
  audioStartSec: number;
  audioDurationSec: number | null;
  mediaType: 'image' | 'audio';
  filename: string;
  filePath: string;
}

interface QuizQuestion {
  id: number;
  guid: string;
  text: string;
  answer: string;
  category: string;
  difficulty: string;
  type: string;
  imageId: number | null;
  audioId: number | null;
  imageClipId: number | null;
  audioClipId: number | null;
  requiresMedia: boolean;
  isTestContent: boolean;
  createdAt: string;
  imagePath: string;
  audioPath: string;
}

interface QuizPack {
  id: number;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  roundCount: number;
}

interface QuizRound {
  id: number;
  roundNumber: number;
  name: string;
  type: string;
  timeLimitSeconds: number;
  questionCount: number;
  questions: Array<{position: number; id: number; text: string; answer: string; type: string; imagePath: string; audioPath: string}>;
}

// --- QuizMediaTab ---

function QuizMediaTab({ api, isReadOnly }: { api: ReturnType<typeof useApi>; isReadOnly: boolean }) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [filter, setFilter] = useState<'all' | 'image' | 'audio'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // addClipFor: id of media_file currently showing the "add clip" form
  const [addClipFor, setAddClipFor] = useState<number | null>(null);
  const [clipForm, setClipForm] = useState({ label: '', audioStartSec: '0', audioDurationSec: '' });

  const load = useCallback(() => {
    const q = filter !== 'all' ? `?type=${filter}` : '';
    api(`/api/quiz/media${q}`).then(d => setFiles(d.files || [])).catch(err => setError(err.message));
    api('/api/quiz/clips').then(d => setClips(d.clips || [])).catch(() => {});
  }, [api, filter]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await api('/api/quiz/media/upload', { method: 'POST', body: formData });
      if (data.deduplicated) {
        setSuccess(`File already exists — reusing record: ${data.originalName}`);
      } else {
        setSuccess(`Uploaded: ${data.originalName}`);
      }
      load();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const deleteFile = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? Questions using this file will lose their media.`)) return;
    try {
      await api(`/api/quiz/media/${id}`, { method: 'DELETE' });
      setSuccess('File deleted');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const addClip = async (mediaFileId: number) => {
    if (!clipForm.label.trim()) { setError('Clip label required'); return; }
    try {
      const dur = clipForm.audioDurationSec.trim() ? parseFloat(clipForm.audioDurationSec) : null;
      await api('/api/quiz/clips', {
        method: 'POST',
        body: JSON.stringify({
          mediaFileId,
          label: clipForm.label.trim(),
          audioStartSec: parseFloat(clipForm.audioStartSec) || 0,
          audioDurationSec: dur,
        }),
      });
      setClipForm({ label: '', audioStartSec: '0', audioDurationSec: '' });
      setAddClipFor(null);
      setSuccess('Clip added');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add clip');
    }
  };

  const deleteClip = async (clipId: number) => {
    try {
      await api(`/api/quiz/clips/${clipId}`, { method: 'DELETE' });
      setSuccess('Clip deleted');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const clipsByFile = clips.reduce<Record<number, MediaClip[]>>((acc, c) => {
    (acc[c.mediaFileId] = acc[c.mediaFileId] || []).push(c);
    return acc;
  }, {});

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Upload Media</h3>
          <p className="ah-meta">Images: JPG, PNG, GIF, WebP (max 10MB). Audio: MP3, OGG, WAV, M4A (max 20MB).</p>
          <p className="ah-meta">Duplicate files are detected by content hash — re-uploading an identical file reuses the existing record.</p>
          <input type="file" accept="image/*,audio/*,.mp3,.ogg,.wav,.m4a" onChange={upload} className="mt-2" />
        </div>
      )}

      <div className="ah-flex-center flex-wrap gap-2 mb-3 mt-2">
        {(['all', 'image', 'audio'] as const).map(f => (
          <button
            key={f}
            className={`ah-tab${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          className="ah-btn-outline"
          style={{ marginLeft: 'auto', fontSize: 12 }}
          onClick={() => window.open('/api/quiz/clips/export', '_blank')}
        >
          Export Reference Sheet (CSV)
        </button>
      </div>

      {files.length === 0 ? (
        <div className="ah-card"><p className="ah-meta">No media files yet.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {files.map(f => {
            const fileClips = clipsByFile[f.id] || [];
            return (
              <div key={f.id} className="ah-card p-2">
                {f.type === 'image' ? (
                  <img
                    src={f.filePath}
                    alt={f.originalName}
                    style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#f5f5f5', borderRadius: 4, marginBottom: 8, gap: 4 }}>
                    <span style={{ fontSize: 24 }}>🎵</span>
                    <audio controls src={f.filePath} style={{ width: '95%' }} />
                  </div>
                )}
                <p style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.originalName}>
                  {f.originalName}
                </p>
                <p className="ah-meta">{(f.sizeBytes / 1024).toFixed(0)} KB</p>

                {/* Clips list */}
                {fileClips.length > 0 && (
                  <div style={{ marginTop: 6, borderTop: '1px solid #f0f0f0', paddingTop: 6 }}>
                    {fileClips.map(c => (
                      <div key={c.id} className="ah-flex-center gap-1 mb-1">
                        <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.guid}>
                          {c.label}
                        </span>
                        <button
                          style={{ fontSize: 10, padding: '1px 5px', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', background: 'white' }}
                          title={c.guid}
                          onClick={() => { navigator.clipboard.writeText(c.guid); setSuccess('GUID copied'); setTimeout(() => setSuccess(null), 2000); }}
                        >
                          GUID
                        </button>
                        {!isReadOnly && fileClips.length > 1 && (
                          <button
                            style={{ fontSize: 10, padding: '1px 5px', border: '1px solid #f44336', borderRadius: 3, cursor: 'pointer', background: 'white', color: '#f44336' }}
                            onClick={() => deleteClip(c.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add clip form (audio only) */}
                {!isReadOnly && f.type === 'audio' && (
                  addClipFor === f.id ? (
                    <div style={{ marginTop: 6, borderTop: '1px solid #f0f0f0', paddingTop: 6 }}>
                      <input className="ah-input" style={{ width: '100%', marginBottom: 4 }}
                        placeholder="Clip label" value={clipForm.label}
                        onChange={e => setClipForm(cf => ({ ...cf, label: e.target.value }))} />
                      <div className="ah-flex gap-1">
                        <input className="ah-input" className="flex-1" placeholder="Start (s)" type="number" step="0.1"
                          value={clipForm.audioStartSec}
                          onChange={e => setClipForm(cf => ({ ...cf, audioStartSec: e.target.value }))} />
                        <input className="ah-input" className="flex-1" placeholder="Dur (s)" type="number" step="0.1"
                          value={clipForm.audioDurationSec}
                          onChange={e => setClipForm(cf => ({ ...cf, audioDurationSec: e.target.value }))} />
                      </div>
                      <div className="ah-flex gap-1 mt-1">
                        <button className="ah-btn-primary" style={{ flex: 1, fontSize: 11, padding: '4px 0' }} onClick={() => addClip(f.id)}>Add</button>
                        <button className="ah-btn-outline" style={{ flex: 1, fontSize: 11, padding: '4px 0' }} onClick={() => setAddClipFor(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="ah-btn-outline" style={{ marginTop: 6, width: '100%', fontSize: 11 }}
                      onClick={() => { setAddClipFor(f.id); setClipForm({ label: '', audioStartSec: '0', audioDurationSec: '' }); }}>
                      + Add Clip
                    </button>
                  )
                )}

                {!isReadOnly && (
                  <button className="ah-btn-danger" style={{ marginTop: 6, width: '100%', padding: '4px 8px', fontSize: 12 }}
                    onClick={() => deleteFile(f.id, f.originalName)}>
                    Delete File
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- QuizQuestionsTab ---

function QuizQuestionsTab({ api, isReadOnly }: { api: ReturnType<typeof useApi>; isReadOnly: boolean }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [filterType, setFilterType] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    text: '', answer: '', category: '', difficulty: 'medium', type: 'text',
    imageClipId: '', audioClipId: '', requiresMedia: false, isTestContent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = filterType ? `?type=${filterType}` : '';
    api(`/api/quiz/questions${q}`).then(d => setQuestions(d.questions || [])).catch(err => setError(err.message));
    api('/api/quiz/clips').then(d => setClips(d.clips || [])).catch(() => {});
  }, [api, filterType]);

  useEffect(() => { load(); }, [load]);

  const imageClips = clips.filter(c => c.mediaType === 'image');
  const audioClips = clips.filter(c => c.mediaType === 'audio');

  const resetForm = () => {
    setForm({ text: '', answer: '', category: '', difficulty: 'medium', type: 'text', imageClipId: '', audioClipId: '', requiresMedia: false, isTestContent: false });
    setEditingId(null);
  };

  const startEdit = (q: QuizQuestion) => {
    setForm({
      text: q.text, answer: q.answer, category: q.category, difficulty: q.difficulty,
      type: q.type,
      imageClipId: q.imageClipId ? String(q.imageClipId) : '',
      audioClipId: q.audioClipId ? String(q.audioClipId) : '',
      requiresMedia: q.requiresMedia,
      isTestContent: q.isTestContent,
    });
    setEditingId(q.id);
  };

  const save = async () => {
    if (!form.text.trim() || !form.answer.trim()) { setError('Text and answer required'); return; }
    const body = {
      text: form.text.trim(), answer: form.answer.trim(), category: form.category.trim(),
      difficulty: form.difficulty, type: form.type,
      imageClipId: form.imageClipId ? parseInt(form.imageClipId) : null,
      audioClipId: form.audioClipId ? parseInt(form.audioClipId) : null,
      requiresMedia: form.requiresMedia,
      isTestContent: form.isTestContent,
    };
    try {
      if (editingId) {
        await api(`/api/quiz/questions/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        setSuccess('Question updated');
      } else {
        await api('/api/quiz/questions', { method: 'POST', body: JSON.stringify(body) });
        setSuccess('Question created');
      }
      resetForm();
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteQ = async (id: number) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api(`/api/quiz/questions/${id}`, { method: 'DELETE' });
      setSuccess('Question deleted');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await api('/api/quiz/questions/import', { method: 'POST', body: formData });
      let msg = `Imported ${data.imported} question${data.imported !== 1 ? 's' : ''}`;
      if (data.skipped && data.skipped.length > 0) {
        msg += `. Skipped ${data.skipped.length}: ${data.skipped.map((s: {row: number; reason: string}) => `row ${s.row}: ${s.reason}`).join('; ')}`;
      }
      setImportResult(msg);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
    e.target.value = '';
  };

  const csvTemplate = 'text,answer,category,difficulty,type,image_guid,audio_guid,requires_media\n' +
    '"What is 2+2?",4,Maths,easy,text,,,false\n' +
    '"Name this song",Bohemian Rhapsody,Music,medium,music,,<audio-clip-guid>,true\n';
  const templateHref = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvTemplate);

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">{editingId ? 'Edit Question' : 'Add Question'}</h3>
          <textarea
            className="ah-input"
            style={{ width: '100%', height: 60, resize: 'vertical' }}
            placeholder="Question text"
            value={form.text}
            onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
          />
          <div className="ah-flex flex-wrap gap-2 mt-2">
            <input className="ah-input" className="flex-2" placeholder="Answer" value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} />
            <input className="ah-input" className="flex-1" placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            <select className="ah-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="text">Text</option>
              <option value="picture">Picture</option>
              <option value="music">Music</option>
            </select>
            <select className="ah-select" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="ah-flex flex-wrap gap-2 mt-2">
            {(form.type === 'picture' || form.type === 'text') && (
              <div>
                <label className="ah-label">Image clip: </label>
                <select className="ah-select" value={form.imageClipId} onChange={e => setForm(f => ({ ...f, imageClipId: e.target.value }))}>
                  <option value="">— none —</option>
                  {imageClips.map(c => <option key={c.id} value={c.id}>{c.label} — {c.filename}</option>)}
                </select>
              </div>
            )}
            {(form.type === 'music' || form.type === 'text') && (
              <div>
                <label className="ah-label">Audio clip: </label>
                <select className="ah-select" value={form.audioClipId} onChange={e => setForm(f => ({ ...f, audioClipId: e.target.value }))}>
                  <option value="">— none —</option>
                  {audioClips.map(c => <option key={c.id} value={c.id}>{c.label} — {c.filename}</option>)}
                </select>
              </div>
            )}
            <label className="ah-flex-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={form.requiresMedia} onChange={e => setForm(f => ({ ...f, requiresMedia: e.target.checked }))} />
              Requires media
            </label>
            <label className="ah-flex-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isTestContent} onChange={e => setForm(f => ({ ...f, isTestContent: e.target.checked }))} />
              Test content
            </label>
          </div>
          <div className="ah-flex gap-2 mt-2">
            <button className="ah-btn-primary" onClick={save}>{editingId ? 'Update' : 'Add Question'}</button>
            {editingId && <button className="ah-btn-outline" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      )}

      {/* CSV Import */}
      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Import Questions (CSV)</h3>
          <p className="ah-meta">
            Required columns: <code>text</code>, <code>answer</code>.
            Optional: <code>category</code>, <code>difficulty</code>, <code>type</code>, <code>image_guid</code>, <code>audio_guid</code>, <code>requires_media</code>.
            GUIDs come from the Media tab's Export Reference Sheet.
          </p>
          <div className="ah-flex-center flex-wrap gap-2 mt-2">
            <input type="file" accept=".csv" onChange={importCSV} />
            <a href={templateHref} download="quiz-questions-template.csv" className="ah-btn-outline" style={{ fontSize: 12, textDecoration: 'none', padding: '5px 10px' }}>
              Download Template
            </a>
          </div>
          {importResult && (
            <p className="ah-meta" className="mt-2 text-gray-800">{importResult}</p>
          )}
        </div>
      )}

      <div className="ah-flex gap-2 mb-3">
        {['', 'text', 'picture', 'music'].map(t => (
          <button key={t} className={`ah-tab${filterType === t ? ' active' : ''}`} onClick={() => setFilterType(t)}>
            {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {questions.length === 0 ? (
        <div className="ah-card"><p className="ah-meta">No questions yet.</p></div>
      ) : (
        questions.map(q => (
          <div key={q.id} className="ah-card">
            <div className="ah-flex-between" style={{ alignItems: 'flex-start' }}>
              <div className="flex-1">
                <p style={{ fontWeight: 500, fontSize: 14 }}>{q.text}</p>
                <p className="ah-meta">Answer: <strong>{q.answer}</strong> · {q.type} · {q.difficulty} {q.category && `· ${q.category}`}</p>
                {q.imagePath && <p className="ah-meta" style={{ color: '#1565C0' }}>Image attached</p>}
                {q.audioPath && <p className="ah-meta" className="text-orange-700">Audio attached</p>}
                {q.requiresMedia && !q.imageClipId && !q.audioClipId && (
                  <span className="ah-badge" style={{ backgroundColor: '#FFEBEE', color: '#C62828' }}>NEEDS CLIP</span>
                )}
                {q.isTestContent && <span className="ah-badge ml-2" style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>TEST</span>}
              </div>
              {!isReadOnly && (
                <div className="ah-flex gap-1 flex-shrink-0 ml-3">
                  <button className="ah-btn-outline" onClick={() => startEdit(q)}>Edit</button>
                  <button className="ah-btn-danger" onClick={() => deleteQ(q.id)}>Delete</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// --- QuizPacksTab ---

function QuizPacksTab({ api, isReadOnly }: { api: ReturnType<typeof useApi>; isReadOnly: boolean }) {
  const [packs, setPacks] = useState<QuizPack[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [rounds, setRounds] = useState<QuizRound[]>([]);
  const [newPackName, setNewPackName] = useState('');
  const [newPackDesc, setNewPackDesc] = useState('');
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundType, setNewRoundType] = useState('text');
  const [newRoundTimeLimit, setNewRoundTimeLimit] = useState('');
  const [editRoundId, setEditRoundId] = useState<number | null>(null);
  const [roundQuestionIds, setRoundQuestionIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPacks = useCallback(() => {
    api('/api/quiz/packs').then(d => setPacks(d.packs || [])).catch(err => setError(err.message));
    api('/api/quiz/questions').then(d => setQuestions(d.questions || [])).catch(() => {});
  }, [api]);

  useEffect(() => { loadPacks(); }, [loadPacks]);

  const loadRounds = useCallback((packId: number) => {
    api(`/api/quiz/packs/${packId}/rounds`).then(d => setRounds(d.rounds || [])).catch(err => setError(err.message));
  }, [api]);

  useEffect(() => { if (selectedPackId) loadRounds(selectedPackId); }, [selectedPackId, loadRounds]);

  const createPack = async () => {
    if (!newPackName.trim()) return;
    try {
      await api('/api/quiz/packs', { method: 'POST', body: JSON.stringify({ name: newPackName.trim(), description: newPackDesc.trim() }) });
      setNewPackName(''); setNewPackDesc('');
      setSuccess('Pack created');
      loadPacks();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deletePack = async (id: number, name: string) => {
    if (!window.confirm(`Delete pack "${name}" and all its rounds?`)) return;
    try {
      await api(`/api/quiz/packs/${id}`, { method: 'DELETE' });
      if (selectedPackId === id) { setSelectedPackId(null); setRounds([]); }
      setSuccess('Pack deleted');
      loadPacks();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const createRound = async () => {
    if (!selectedPackId || !newRoundName.trim()) return;
    const nextNum = rounds.length > 0 ? Math.max(...rounds.map(r => r.roundNumber)) + 1 : 1;
    const body: Record<string, unknown> = { roundNumber: nextNum, name: newRoundName.trim(), type: newRoundType };
    if (newRoundTimeLimit) body.timeLimitSeconds = parseInt(newRoundTimeLimit);
    try {
      await api(`/api/quiz/packs/${selectedPackId}/rounds`, { method: 'POST', body: JSON.stringify(body) });
      setNewRoundName(''); setNewRoundTimeLimit('');
      setSuccess('Round created');
      loadRounds(selectedPackId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteRound = async (roundId: number) => {
    if (!window.confirm('Delete this round?')) return;
    try {
      await api(`/api/quiz/packs/${selectedPackId}/rounds/${roundId}`, { method: 'DELETE' });
      setSuccess('Round deleted');
      if (selectedPackId) loadRounds(selectedPackId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const openRoundEdit = (round: QuizRound) => {
    setEditRoundId(round.id);
    setRoundQuestionIds(round.questions.map(q => q.id));
  };

  const saveRoundQuestions = async () => {
    if (!editRoundId || !selectedPackId) return;
    try {
      await api(`/api/quiz/packs/${selectedPackId}/rounds/${editRoundId}/questions`, {
        method: 'PUT', body: JSON.stringify({ questionIds: roundQuestionIds }),
      });
      setSuccess('Round questions saved');
      setEditRoundId(null);
      loadRounds(selectedPackId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const toggleQuestion = (qid: number) => {
    setRoundQuestionIds(prev =>
      prev.includes(qid) ? prev.filter(id => id !== qid) : [...prev, qid]
    );
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      {!isReadOnly && (
        <div className="ah-card">
          <h3 className="ah-section-title">Create Pack</h3>
          <div className="ah-flex gap-2">
            <input className="ah-input flex-2" placeholder="Pack name" value={newPackName} onChange={e => setNewPackName(e.target.value)} />
            <input className="ah-input flex-grow" placeholder="Description (optional)" value={newPackDesc} onChange={e => setNewPackDesc(e.target.value)} />
            <button className="ah-btn-primary" onClick={createPack} disabled={!newPackName.trim()}>Create</button>
          </div>
        </div>
      )}

      <div className="ah-flex flex-wrap gap-3">
        {/* Pack list */}
        <div style={{ flex: '1 1 220px' }}>
          <h3 className="ah-section-title">Packs</h3>
          {packs.length === 0 ? (
            <div className="ah-card"><p className="ah-meta">No packs yet.</p></div>
          ) : (
            packs.map(p => (
              <div key={p.id} className="ah-card"
                style={{ borderLeft: selectedPackId === p.id ? '4px solid #1565C0' : undefined, cursor: 'pointer' }}
                onClick={() => setSelectedPackId(p.id)}>
                <div className="ah-flex-between">
                  <div>
                    <strong>{p.name}</strong>
                    <p className="ah-meta">{p.roundCount} round{p.roundCount !== 1 ? 's' : ''}</p>
                    {p.description && <p className="ah-meta">{p.description}</p>}
                  </div>
                  {!isReadOnly && (
                    <button className="ah-btn-danger" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={e => { e.stopPropagation(); deletePack(p.id, p.name); }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rounds for selected pack */}
        {selectedPackId && (
          <div style={{ flex: '2 1 340px' }}>
            <h3 className="ah-section-title">Rounds in {packs.find(p => p.id === selectedPackId)?.name}</h3>

            {!isReadOnly && (
              <div className="ah-card mb-3">
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add Round</h4>
                <div className="ah-flex flex-wrap gap-2">
                  <input className="ah-input" className="flex-2" placeholder="Round name" value={newRoundName} onChange={e => setNewRoundName(e.target.value)} />
                  <select className="ah-select" value={newRoundType} onChange={e => setNewRoundType(e.target.value)}>
                    <option value="text">Text</option>
                    <option value="picture">Picture</option>
                    <option value="music">Music</option>
                  </select>
                  <input className="ah-input" style={{ width: 90 }} placeholder="Time (s)" type="number" value={newRoundTimeLimit} onChange={e => setNewRoundTimeLimit(e.target.value)} />
                  <button className="ah-btn-primary" onClick={createRound} disabled={!newRoundName.trim()}>Add</button>
                </div>
              </div>
            )}

            {rounds.length === 0 ? (
              <div className="ah-card"><p className="ah-meta">No rounds yet.</p></div>
            ) : (
              rounds.map(rd => (
                <div key={rd.id} className="ah-card">
                  <div className="ah-flex-between">
                    <div>
                      <strong>Round {rd.roundNumber}: {rd.name}</strong>
                      <p className="ah-meta">{rd.type} · {rd.questionCount} questions{rd.timeLimitSeconds ? ` · ${rd.timeLimitSeconds}s` : ''}</p>
                    </div>
                    {!isReadOnly && (
                      <div className="ah-flex gap-1">
                        <button className="ah-btn-outline" style={{ fontSize: 11 }} onClick={() => openRoundEdit(rd)}>
                          {editRoundId === rd.id ? 'Editing' : 'Edit Q'}
                        </button>
                        <button className="ah-btn-danger" style={{ fontSize: 11 }} onClick={() => deleteRound(rd.id)}>Del</button>
                      </div>
                    )}
                  </div>

                  {/* Inline question editor */}
                  {editRoundId === rd.id && (() => {
                    const usableQuestions = questions.filter(q => !(q.requiresMedia && !q.imageClipId && !q.audioClipId));
                    const excludedCount = questions.length - usableQuestions.length;
                    return (
                      <div style={{ marginTop: 12, borderTop: '1px solid #e0e0e0', paddingTop: 10 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Select questions (in order):</p>
                        {excludedCount > 0 && (
                          <p className="ah-meta" style={{ color: '#E65100', marginBottom: 6 }}>
                            {excludedCount} question{excludedCount !== 1 ? 's' : ''} hidden — marked as requiring media but no clip assigned.
                          </p>
                        )}
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {usableQuestions.map(q => (
                            <label key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 12 }}>
                              <input type="checkbox" checked={roundQuestionIds.includes(q.id)} onChange={() => toggleQuestion(q.id)} />
                              <span>
                                <strong>{q.text.length > 60 ? q.text.slice(0, 60) + '...' : q.text}</strong>
                                <span className="ah-meta"> — {q.answer} ({q.type})</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="ah-meta mt-1">{roundQuestionIds.length} selected (order = selection order)</p>
                        <div className="ah-flex gap-2 mt-2">
                          <button className="ah-btn-primary" onClick={saveRoundQuestions}>Save</button>
                          <button className="ah-btn-outline" onClick={() => setEditRoundId(null)}>Cancel</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- SetupTab ---

function SetupTab({ api, isReadOnly }: { api: ReturnType<typeof useApi>; isReadOnly: boolean }) {
  const [players, setPlayers] = useState<ManagedPlayer[]>([]);
  const [groups, setGroups] = useState<ManagedGroup[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPlayers = useCallback(() => {
    api('/api/setup/players')
      .then(data => setPlayers(data.players || []))
      .catch(err => setError(err.message));
  }, [api]);

  const loadGroups = useCallback(() => {
    api('/api/setup/groups')
      .then(data => setGroups(data.groups || []))
      .catch(err => setError(err.message));
  }, [api]);

  useEffect(() => {
    loadPlayers();
    loadGroups();
  }, [loadPlayers, loadGroups]);

  const addPlayer = async () => {
    if (!newPlayerName.trim()) return;
    try {
      await api('/api/setup/players', {
        method: 'POST',
        body: JSON.stringify({ name: newPlayerName.trim() }),
      });
      setSuccess(`Added player: ${newPlayerName}`);
      setNewPlayerName('');
      loadPlayers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player');
    }
  };

  const deletePlayer = async (id: number, name: string) => {
    if (!confirm(`Delete player "${name}"?`)) return;
    try {
      await api(`/api/setup/players/${id}`, { method: 'DELETE' });
      setSuccess(`Deleted player: ${name}`);
      loadPlayers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete player');
    }
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await api('/api/setup/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDescription.trim() }),
      });
      setSuccess(`Added group: ${newGroupName}`);
      setNewGroupName('');
      setNewGroupDescription('');
      loadGroups();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group');
    }
  };

  const deleteGroup = async (id: number, name: string) => {
    if (!confirm(`Delete group "${name}"?`)) return;
    try {
      await api(`/api/setup/groups/${id}`, { method: 'DELETE' });
      setSuccess(`Deleted group: ${name}`);
      loadGroups();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

  return (
    <div>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      {/* Info Section */}
      <div className="ah-card" style={{ backgroundColor: '#E3F2FD', borderColor: '#90CAF9' }}>
        <h3 className="ah-section-title" style={{ color: '#1565C0', marginBottom: 12 }}>Players & Groups Registry</h3>
        <p className="ah-meta m-0">
          Create reusable players and groups here. LMS Manager and Sweepstakes can import from this registry
          (feature coming soon). Players are global (not tied to groups). Groups are organizational containers.
        </p>
      </div>

      {/* Players Section */}
      <div className="ah-card">
        <h3 className="ah-section-title">Players ({players.length})</h3>

        {!isReadOnly && (
          <div className="ah-inline-form">
            <input
              className="ah-input"
              placeholder="Player name"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addPlayer()}
            />
            <button className="ah-btn-primary" onClick={addPlayer} disabled={!newPlayerName.trim()}>
              Add Player
            </button>
          </div>
        )}

        <div className="ah-list">
          {players.length === 0 ? (
            <p className="ah-meta">No players yet. Add one above.</p>
          ) : (
            players.map(p => (
              <div key={p.id} className="ah-list-item">
                <div>
                  <strong>{p.name}</strong>
                  <p className="ah-meta m-0">Added {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                {!isReadOnly && (
                  <button className="ah-btn-danger-sm" onClick={() => deletePlayer(p.id, p.name)}>
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Groups Section */}
      <div className="ah-card">
        <h3 className="ah-section-title">Groups ({groups.length})</h3>

        {!isReadOnly && (
          <div>
            <div className="ah-inline-form">
              <input
                className="ah-input"
                placeholder="Group name"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              />
              <input
                className="ah-input"
                placeholder="Description (optional)"
                value={newGroupDescription}
                onChange={e => setNewGroupDescription(e.target.value)}
              />
              <button className="ah-btn-primary" onClick={addGroup} disabled={!newGroupName.trim()}>
                Add Group
              </button>
            </div>
          </div>
        )}

        <div className="ah-list">
          {groups.length === 0 ? (
            <p className="ah-meta">No groups yet. Add one above.</p>
          ) : (
            groups.map(g => (
              <div key={g.id} className="ah-list-item">
                <div>
                  <strong>{g.name}</strong>
                  {g.description && <p className="ah-meta" className="m-0">{g.description}</p>}
                  <p className="ah-meta m-0">Added {new Date(g.createdAt).toLocaleDateString()}</p>
                </div>
                {!isReadOnly && (
                  <button className="ah-btn-danger-sm" onClick={() => deleteGroup(g.id, g.name)}>
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
