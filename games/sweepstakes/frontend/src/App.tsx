import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

// --- Types ---

interface Competition {
  id: number;
  name: string;
  type: 'knockout' | 'race';
  status: 'open' | 'locked' | 'completed';
  description: string;
}

interface Draw {
  id: number;
  user_id: string;
  competition_id: number;
  entry_id: number;
  drawn_at: string;
  entry_name: string;
  entry_status: string;
  comp_name: string;
  comp_status: string;
  seed?: number;
  number?: number;
  position?: number;
}

interface CompDraw {
  id: number;
  user_id: string;
  entry_name: string;
  entry_status: string;
  seed?: number;
  number?: number;
  position?: number;
}

// --- Hooks ---

function useUrlParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId') || '',
      userName: params.get('userName') || params.get('userId') || 'Player',
      token: params.get('token') || '',
      impersonatedBy: params.get('impersonatedBy') || '',
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
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(path, { ...options, headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (res.status === 204) return null;
      return res.json();
    },
    [token]
  );
}

// --- Toast ---

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      backgroundColor: '#323232', color: 'white',
      padding: '12px 20px', borderRadius: 8, fontSize: 13,
      fontWeight: 500, zIndex: 9999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      pointerEvents: 'none', maxWidth: 320,
    }}>
      {message}
    </div>
  );
}

// --- Main App ---

type Tab = 'competitions' | 'my-picks';

function App() {
  const { userId, userName, token, impersonatedBy } = useUrlParams();
  const api = useApi(token);

  if (!userId || !token) {
    return (
      <div className="ah-container">
        <h2>Sweepstakes</h2>
        <p style={{ color: '#666' }}>Access this app through the lobby.</p>
        <button className="ah-lobby-btn" onClick={() => { window.location.href = `http://${window.location.hostname}:3001`; }}>
          Go to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="ah-container">
      <div className="ah-header">
        <h2 className="ah-header-title">Sweepstakes</h2>
        <button className="ah-lobby-btn" onClick={() => { window.location.href = `http://${window.location.hostname}:3001`; }}>
          ← Lobby
        </button>
      </div>

      {impersonatedBy && (
        <div className="ah-banner ah-banner--warning">
          Impersonating <strong>{userName}</strong> (as {impersonatedBy})
        </div>
      )}

      <SweepstakesApp userId={userId} userName={userName} api={api} />
    </div>
  );
}

// --- SweepstakesApp (inner) ---

function SweepstakesApp({ userId, userName, api }: {
  userId: string;
  userName: string;
  api: ReturnType<typeof useApi>;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('competitions');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [userDraws, setUserDraws] = useState<Draw[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [pickView, setPickView] = useState(false);  // show blind box selector
  const [revealed, setRevealed] = useState<{ name: string; seed?: number; number?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCompetitions = useCallback(async () => {
    try {
      const data = await api('/api/competitions');
      setCompetitions(data || []);
    } catch (err) {
      setError('Failed to load competitions');
    }
  }, [api]);

  const loadUserDraws = useCallback(async () => {
    try {
      const data = await api('/api/draws');
      setUserDraws(data || []);
    } catch (err) {
      console.error('Failed to load user draws', err);
    }
  }, [api]);

  useEffect(() => {
    loadCompetitions();
    loadUserDraws();
  }, [loadCompetitions, loadUserDraws]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const openPickView = (comp: Competition) => {
    setSelectedComp(comp);
    setRevealed(null);
    setPickView(true);
    setActiveTab('competitions');
  };

  const handleChooseBox = async (boxNumber: number) => {
    if (!selectedComp) return;
    if (!window.confirm(`Pick Box #${boxNumber}?`)) return;
    try {
      const data = await api(`/api/competitions/${selectedComp.id}/choose-blind-box`, {
        method: 'POST',
        body: JSON.stringify({ box_number: boxNumber }),
      });
      setRevealed({ name: data.entry_name, seed: data.seed, number: data.number });
      loadUserDraws();
      loadCompetitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Selection failed');
    }
  };

  const handleRandomPick = async () => {
    if (!selectedComp) return;
    if (!window.confirm('Pick a random box?')) return;
    try {
      const data = await api(`/api/competitions/${selectedComp.id}/random-pick`, { method: 'POST' });
      setRevealed({ name: data.entry_name, seed: data.seed, number: data.number });
      loadUserDraws();
      loadCompetitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Selection failed');
    }
  };

  return (
    <>
      {error && <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>{error}</div>}
      <Toast message={success} />

      {/* Blind box picker view (overlays tab content) */}
      {pickView && selectedComp && !revealed && (
        <PickBoxView
          comp={selectedComp}
          api={api}
          userId={userId}
          onChooseBox={handleChooseBox}
          onRandomPick={handleRandomPick}
          onBack={() => setPickView(false)}
        />
      )}

      {/* Reveal view after picking */}
      {pickView && revealed && (
        <div className="ah-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 48, margin: 0 }}>🎉</p>
          <h2 style={{ marginTop: 12 }}>You got: {revealed.name}!</h2>
          {revealed.seed != null && <p className="ah-meta">Seed #{revealed.seed}</p>}
          {revealed.number != null && <p className="ah-meta">#{revealed.number}</p>}
          <button className="ah-btn-primary" style={{ marginTop: 20 }} onClick={() => { setPickView(false); setRevealed(null); }}>
            Back to Competitions
          </button>
        </div>
      )}

      {/* Normal tab content */}
      {!pickView && (
        <>
          <div className="ah-tabs">
            {(['competitions', 'my-picks'] as Tab[]).map(tab => (
              <button
                key={tab}
                className={`ah-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'competitions' ? 'Competitions' : `My Picks (${userDraws.length})`}
              </button>
            ))}
          </div>

          {activeTab === 'competitions' && (
            <CompetitionsTab
              competitions={competitions}
              userDraws={userDraws}
              api={api}
              onPickBox={openPickView}
            />
          )}
          {activeTab === 'my-picks' && (
            <MyPicksTab userDraws={userDraws} />
          )}
        </>
      )}
    </>
  );
}

// --- CompetitionsTab ---

function CompetitionsTab({ competitions, userDraws, api, onPickBox }: {
  competitions: Competition[];
  userDraws: Draw[];
  api: ReturnType<typeof useApi>;
  onPickBox: (comp: Competition) => void;
}) {
  const [viewDrawsFor, setViewDrawsFor] = useState<number | null>(null);
  const [compDraws, setCompDraws] = useState<CompDraw[]>([]);

  const loadCompDraws = async (compId: number) => {
    if (viewDrawsFor === compId) { setViewDrawsFor(null); return; }
    const data = await api(`/api/competitions/${compId}/all-draws`).catch(() => []);
    setCompDraws(data || []);
    setViewDrawsFor(compId);
  };

  const userPickFor = (compId: number) => userDraws.find(d => d.competition_id === compId);

  if (competitions.length === 0) {
    return <div className="ah-card"><p style={{ color: '#666' }}>No active competitions right now.</p></div>;
  }

  return (
    <div>
      {competitions.map(comp => {
        const userPick = userPickFor(comp.id);
        const isViewingDraws = viewDrawsFor === comp.id;

        return (
          <div key={comp.id} className="ah-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 16 }}>{comp.name}</strong>
                <div style={{ marginTop: 4 }}>
                  <span style={{ ...badge, backgroundColor: statusColor(comp.status) }}>{comp.status}</span>
                  <span style={{ ...badge, backgroundColor: '#2196F3', marginLeft: 6 }}>{comp.type}</span>
                </div>
                {comp.description && <p className="ah-meta" style={{ marginTop: 6 }}>{comp.description}</p>}

                {userPick && (
                  <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#e8f5e9', borderRadius: 6 }}>
                    <span style={{ fontWeight: 600 }}>Your pick: {userPick.entry_name}</span>
                    {userPick.seed != null && <span className="ah-meta" style={{ marginLeft: 8 }}>Seed #{userPick.seed}</span>}
                    {userPick.number != null && <span className="ah-meta" style={{ marginLeft: 8 }}>#{userPick.number}</span>}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                {comp.status === 'open' && !userPick && (
                  <button className="ah-btn-primary" onClick={() => onPickBox(comp)}>
                    Pick Your Box
                  </button>
                )}
                {(comp.status === 'locked' || comp.status === 'completed') && (
                  <button className="ah-btn-outline" onClick={() => loadCompDraws(comp.id)}>
                    {isViewingDraws ? 'Hide Results' : 'View Results'}
                  </button>
                )}
              </div>
            </div>

            {isViewingDraws && (
              <div style={{ marginTop: 12 }}>
                <p className="ah-meta" style={{ marginBottom: 8 }}>All picks ({compDraws.length}):</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                  {compDraws.map((d, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', backgroundColor: '#f8f8f8', borderRadius: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{d.entry_name}</div>
                      <div className="ah-meta">{d.user_id}</div>
                      {d.position != null && d.position !== 999 && (
                        <div style={{ color: '#F57C00', fontWeight: 600, fontSize: 12, marginTop: 2 }}>
                          {posLabel(d.position)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- PickBoxView ---

function PickBoxView({ comp, api, userId, onChooseBox, onRandomPick, onBack }: {
  comp: Competition;
  api: ReturnType<typeof useApi>;
  userId: string;
  onChooseBox: (n: number) => void;
  onRandomPick: () => void;
  onBack: () => void;
}) {
  const [boxCount, setBoxCount] = useState(0);

  useEffect(() => {
    api(`/api/competitions/${comp.id}/available-count`)
      .then(data => setBoxCount(data?.count || 0))
      .catch(() => {});
  }, [api, comp.id]);

  return (
    <div>
      <button className="ah-btn-outline" style={{ marginBottom: 12 }} onClick={onBack}>← Back</button>

      <div className="ah-card" style={{ marginBottom: 16 }}>
        <h3 className="ah-section-title">{comp.name}</h3>
        <p className="ah-meta">{boxCount} boxes remaining</p>
        <button
          className="ah-btn-primary"
          style={{ marginTop: 8 }}
          onClick={onRandomPick}
        >
          Random Spin
        </button>
      </div>

      {boxCount > 0 ? (
        <>
          <p className="ah-meta" style={{ marginBottom: 8 }}>— or choose a box —</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
            {Array.from({ length: boxCount }, (_, i) => i + 1).map(n => (
              <div
                key={n}
                className="ah-card"
                style={{ textAlign: 'center', cursor: 'pointer', padding: '16px 8px' }}
                onClick={() => onChooseBox(n)}
              >
                <div style={{ fontSize: 32 }}>📦</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>#{n}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ah-card"><p style={{ color: '#666' }}>All boxes have been selected.</p></div>
      )}
    </div>
  );
}

// --- MyPicksTab ---

function MyPicksTab({ userDraws }: { userDraws: Draw[] }) {
  if (userDraws.length === 0) {
    return <div className="ah-card"><p style={{ color: '#666' }}>You haven't entered any competitions yet.</p></div>;
  }

  return (
    <div>
      {userDraws.map(draw => (
        <div key={draw.id} className="ah-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="ah-meta">{draw.comp_name}</p>
              <strong style={{ fontSize: 16 }}>{draw.entry_name}</strong>
              {draw.seed != null && <span className="ah-meta" style={{ marginLeft: 8 }}>Seed #{draw.seed}</span>}
              {draw.number != null && <span className="ah-meta" style={{ marginLeft: 8 }}>#{draw.number}</span>}
              {draw.position != null && draw.position !== 999 && (
                <p style={{ color: '#F57C00', fontWeight: 600, marginTop: 4 }}>{posLabel(draw.position)}</p>
              )}
            </div>
            <span style={{ ...badge, backgroundColor: statusColor(draw.comp_status) }}>{draw.comp_status}</span>
          </div>
          <p className="ah-meta" style={{ marginTop: 6 }}>
            Picked {new Date(draw.drawn_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// --- Helpers ---

function statusColor(status: string): string {
  switch (status) {
    case 'open': return '#4CAF50';
    case 'locked': return '#FF9800';
    case 'completed': return '#2196F3';
    case 'archived': return '#9E9E9E';
    default: return '#9E9E9E';
  }
}

function posLabel(pos: number): string {
  if (pos === 1) return '1st Place';
  if (pos === 2) return '2nd Place';
  if (pos === 3) return '3rd Place';
  if (pos === 999) return 'Last Place';
  return `${pos}th Place`;
}

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
  color: 'white',
};

export default App;
