import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Types ---

interface Config {
  appName: string;
  isImpersonating: boolean;
  impersonatedBy: string;
  impersonatedEmail: string;
}

interface Game {
  id: number;
  name: string;
  status: string;
  winnerCount: number;
}

interface Round {
  id: number;
  label: number;
  startDate: string;
  endDate: string;
  status: string;
  hasPredicted: boolean;
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

interface MatchesResponse {
  matches: Match[];
  myPrediction: { matchId: number; predictedTeam: string } | null;
}

interface Prediction {
  roundNumber: number;
  startDate: string;
  endDate: string;
  predictedTeam: string;
  isCorrect: boolean | null;
  voided: boolean;
  bye: boolean;
  homeTeam: string;
  awayTeam: string;
  result: string;
  date: string;
}

interface Player {
  userId: string;
  isActive: boolean;
  joinedAt: string;
}

// --- Hooks ---

function useUrlParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId') || '',
      userName: params.get('userName') || params.get('userId') || 'Player',
      token: params.get('token') || '',
    };
  }, []);
}

function useApi(token: string) {
  return useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> || {}),
      };
      const res = await fetch(path, { ...options, headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }
      return res.json();
    },
    [token]
  );
}

// --- Main App ---

function App() {
  const { userId, token } = useUrlParams();
  const api = useApi(token);

  const [config, setConfig] = useState<Config | null>(null);
  const [game, setGame] = useState<Game | null | undefined>(undefined); // undefined = not loaded
  const [myStatus, setMyStatus] = useState<{ inGame: boolean; isActive: boolean; gameID: number | null } | null>(null);
  const [openRounds, setOpenRounds] = useState<Round[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [usedTeams, setUsedTeams] = useState<string[]>([]);
  const [standings, setStandings] = useState<Player[]>([]);
  const [currentView, setCurrentView] = useState<'predict' | 'history' | 'standings'>('predict');
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [roundMatches, setRoundMatches] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Show success message briefly
  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  // Load initial data
  useEffect(() => {
    if (!token || !userId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [configData, gameData] = await Promise.all([
          api('/api/config'),
          api('/api/games/current'),
        ]);
        setConfig(configData);
        setGame(gameData.game);
        if (gameData.game) {
          const statusData = await api('/api/games/status');
          setMyStatus(statusData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, userId, api]);

  // Load view-specific data
  useEffect(() => {
    if (!token || !myStatus?.inGame) return;
    (async () => {
      try {
        if (currentView === 'predict') {
          const [roundsData, teamsData] = await Promise.all([
            api('/api/rounds/open'),
            api('/api/predictions/used-teams'),
          ]);
          setOpenRounds(roundsData.rounds || []);
          setUsedTeams(teamsData.teams || []);
        } else if (currentView === 'history') {
          const data = await api('/api/predictions');
          setPredictions(data.predictions || []);
        } else if (currentView === 'standings') {
          const data = await api('/api/standings');
          setStandings(data.players || []);
        }
      } catch {
        // silently ignore view-data errors
      }
    })();
  }, [currentView, token, myStatus?.inGame, api]);

  // Load matches for selected round
  useEffect(() => {
    if (selectedRound === null || !game) return;
    api(`/api/matches/${game.id}/round/${selectedRound.id}`)
      .then(setRoundMatches)
      .catch(() => {});
  }, [selectedRound, game, api]);

  const handleJoinGame = async () => {
    setSubmitting(true);
    try {
      await api('/api/games/join', { method: 'POST' });
      const statusData = await api('/api/games/status');
      setMyStatus(statusData);
      showSuccess('You joined the game!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePredict = async (matchId: number, team: string, roundId: number) => {
    setSubmitting(true);
    try {
      await api('/api/predictions', {
        method: 'POST',
        body: JSON.stringify({ matchId, roundId, team }),
      });
      showSuccess(`Pick submitted: ${team}`);
      // Refresh predict view data
      const [roundsData, teamsData, matchData] = await Promise.all([
        api('/api/rounds/open'),
        api('/api/predictions/used-teams'),
        game && selectedRound ? api(`/api/matches/${game.id}/round/${selectedRound.id}`) : Promise.resolve(null),
      ]);
      setOpenRounds(roundsData.rounds || []);
      setUsedTeams(teamsData.teams || []);
      if (matchData) setRoundMatches(matchData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit pick');
    } finally {
      setSubmitting(false);
    }
  };

  const goToLobby = () => { window.location.href = `http://${window.location.hostname}:3001`; };

  // --- Render ---

  if (!userId || !token) {
    return (
      <div className="ah-container ah-container--narrow">
        <h2>Last Man Standing</h2>
        <p style={{ color: '#666', marginTop: 20 }}>
          Access this game through the lobby.
        </p>
        <button className="ah-btn-primary" onClick={goToLobby}>
          Go to Lobby
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="ah-container ah-container--narrow"><p style={{ color: '#666' }}>Loading...</p></div>;
  }

  return (
    <div className="ah-container ah-container--narrow">
      {/* Impersonation Banner */}
      {config?.isImpersonating && (
        <div className="ah-banner ah-banner--warning">
          ⚠️ Viewing as <strong>{config.impersonatedEmail}</strong>
          {' '}(impersonated by {config.impersonatedBy})
        </div>
      )}

      <div className="ah-header">
        <h2 style={s.title}>🏆 Last Man Standing</h2>
        <button className="ah-lobby-btn" onClick={goToLobby}>← Lobby</button>
      </div>

      {error && (
        <div className="ah-banner ah-banner--error" onClick={() => setError(null)}>
          {error} — click to dismiss
        </div>
      )}
      {successMsg && <div className="ah-banner ah-banner--success">{successMsg}</div>}

      {/* No Game */}
      {game === null && (
        <div className="ah-card">
          <p>No active game at the moment. Check back soon!</p>
        </div>
      )}

      {/* Game exists — not joined */}
      {game && myStatus && !myStatus.inGame && (
        <div className="ah-card">
          <h3 style={{ marginTop: 0 }}>{game.name}</h3>
          <p style={{ color: '#666' }}>You haven't joined this game yet.</p>
          <button onClick={handleJoinGame} disabled={submitting} className="ah-btn-primary">
            {submitting ? 'Joining...' : 'Join Game'}
          </button>
        </div>
      )}

      {/* Eliminated player */}
      {game && myStatus?.inGame && !myStatus.isActive && (
        <div className="ah-card">
          <h3 style={{ marginTop: 0 }}>{game.name}</h3>
          <div style={s.eliminatedBadge}>☠️ You have been eliminated</div>
          <button
            className="ah-btn-outline"
            style={{ marginTop: 16 }}
            onClick={() => setCurrentView('standings')}
          >
            View Standings
          </button>
        </div>
      )}

      {/* Active player */}
      {game && myStatus?.inGame && myStatus.isActive && (
        <>
          <div style={s.gameHeader}>
            <span style={s.gameTitle}>{game.name}</span>
            <span style={s.activeBadge}>Active ✅</span>
          </div>

          {/* Tabs */}
          <div className="ah-tabs">
            {(['predict', 'history', 'standings'] as const).map(view => (
              <button
                key={view}
                className={`ah-tab${currentView === view ? ' active' : ''}`}
                onClick={() => { setCurrentView(view); setSelectedRound(null); setRoundMatches(null); }}
              >
                {view === 'predict' ? 'Make Pick' : view === 'history' ? 'My Picks' : 'Standings'}
              </button>
            ))}
          </div>

          {/* Predict View */}
          {currentView === 'predict' && (
            <div>
              {selectedRound === null ? (
                <>
                  {openRounds.length === 0 ? (
                    <div className="ah-card"><p style={{ color: '#666' }}>No rounds are open for picks right now.</p></div>
                  ) : (
                    <>
                      <h3 className="ah-section-title">Open Rounds</h3>
                      {openRounds.map(round => (
                        <div key={round.id} className="ah-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>Round {round.label}</strong>
                              <p className="ah-meta">{round.startDate} → {round.endDate}</p>
                              {round.hasPredicted && (
                                <span style={s.pickedBadge}>Pick submitted ✓</span>
                              )}
                            </div>
                            <button
                              className="ah-btn-outline"
                              onClick={() => setSelectedRound(round)}
                            >
                              {round.hasPredicted ? 'Change Pick' : 'Make Pick'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <div>
                  <button className="ah-btn-back" style={{ marginBottom: 16 }} onClick={() => { setSelectedRound(null); setRoundMatches(null); }}>
                    ← Back
                  </button>
                  <h3 className="ah-section-title">Round {selectedRound.label} — Pick your team</h3>
                  <p className="ah-meta">{selectedRound.startDate} → {selectedRound.endDate}</p>
                  {usedTeams.length > 0 && (
                    <p className="ah-meta">Already used: {usedTeams.join(', ')}</p>
                  )}
                  {roundMatches?.myPrediction && (
                    <div className="ah-banner ah-banner--info">
                      Current pick: <strong>{roundMatches.myPrediction.predictedTeam}</strong>
                    </div>
                  )}
                  {!roundMatches ? (
                    <p style={{ color: '#666' }}>Loading matches...</p>
                  ) : roundMatches.matches.length === 0 ? (
                    <div className="ah-card"><p style={{ color: '#666' }}>No matches for this round yet.</p></div>
                  ) : (
                    roundMatches.matches.map(match => {
                      const myPick = roundMatches.myPrediction?.predictedTeam;
                      return (
                        <div key={match.id} className="ah-card">
                          <p className="ah-meta">{match.date} · {match.location}</p>
                          <div style={s.teamRow}>
                            <TeamBtn
                              team={match.homeTeam}
                              isUsed={usedTeams.includes(match.homeTeam) && myPick !== match.homeTeam}
                              isSelected={myPick === match.homeTeam}
                              disabled={submitting}
                              onSelect={() => handlePredict(match.id, match.homeTeam, selectedRound!.id)}
                            />
                            <span style={s.vs}>vs</span>
                            <TeamBtn
                              team={match.awayTeam}
                              isUsed={usedTeams.includes(match.awayTeam) && myPick !== match.awayTeam}
                              isSelected={myPick === match.awayTeam}
                              disabled={submitting}
                              onSelect={() => handlePredict(match.id, match.awayTeam, selectedRound!.id)}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* History View */}
          {currentView === 'history' && (
            <div>
              <h3 className="ah-section-title">My Picks</h3>
              {predictions.length === 0 ? (
                <div className="ah-card"><p style={{ color: '#666' }}>No picks made yet.</p></div>
              ) : (
                predictions.map(pred => (
                  <div key={pred.roundNumber} className="ah-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>Round {pred.roundNumber}</strong>
                        <p className="ah-meta" style={{ margin: '2px 0 0' }}>{pred.startDate} → {pred.endDate}</p>
                      </div>
                      <PredStatus isCorrect={pred.isCorrect} voided={pred.voided} bye={pred.bye} />
                    </div>
                    <p className="ah-meta">
                      Picked: <strong>{pred.predictedTeam}</strong>
                    </p>
                    <p className="ah-meta">
                      {pred.homeTeam} vs {pred.awayTeam}
                      {pred.result ? ` · Result: ${pred.result}` : ' · Pending'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Standings View */}
          {currentView === 'standings' && (
            <div>
              <h3 className="ah-section-title">Standings</h3>
              <div style={s.standingsTable}>
                {standings.map((player, idx) => (
                  <div
                    key={player.userId}
                    style={{ ...s.standingsRow, ...(player.userId === userId ? s.myRow : {}) }}
                  >
                    <span style={s.rank}>{idx + 1}</span>
                    <span style={s.playerName}>{player.userId}</span>
                    <span style={player.isActive ? s.activeStatus : s.eliminatedStatus}>
                      {player.isActive ? '✅ Active' : '☠️ Out'}
                    </span>
                  </div>
                ))}
                {standings.length === 0 && (
                  <div style={{ padding: 16, color: '#666' }}>No players yet.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Sub-components ---

interface TeamBtnProps {
  team: string;
  isUsed: boolean;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function TeamBtn({ team, isUsed, isSelected, disabled, onSelect }: TeamBtnProps) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled || isUsed}
      style={{
        flex: 1,
        padding: '12px 8px',
        border: `2px solid ${isSelected ? '#2196F3' : isUsed ? '#ddd' : '#e0e0e0'}`,
        borderRadius: 8,
        backgroundColor: isSelected ? '#E3F2FD' : isUsed ? '#f9f9f9' : 'white',
        color: isUsed && !isSelected ? '#bbb' : '#333',
        cursor: isUsed && !isSelected ? 'not-allowed' : 'pointer',
        fontWeight: isSelected ? 700 : 400,
        fontSize: 14,
        textAlign: 'center' as const,
      }}
    >
      {team}
      {isSelected && <div style={{ fontSize: 11, color: '#1565C0', marginTop: 2 }}>Your pick ✓</div>}
      {isUsed && !isSelected && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>Already used</div>}
    </button>
  );
}

function PredStatus({ isCorrect, voided, bye }: { isCorrect: boolean | null; voided: boolean; bye: boolean }) {
  if (bye) return <span style={{ color: '#1565C0', fontSize: 13 }}>Bye 🔄</span>;
  if (voided) return <span style={{ color: '#FF9800', fontSize: 13 }}>Voided</span>;
  if (isCorrect === null) return <span style={{ color: '#999', fontSize: 13 }}>Pending</span>;
  if (isCorrect) return <span style={{ color: '#4CAF50', fontSize: 13 }}>✅ Correct</span>;
  return <span style={{ color: '#F44336', fontSize: 13 }}>❌ Wrong</span>;
}

// --- LMS-specific styles (shared styles use .ah-* classes) ---

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  gameHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gameTitle: { fontSize: 18, fontWeight: 600 },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
  },
  eliminatedBadge: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    display: 'inline-block',
  },
  pickedBadge: {
    backgroundColor: '#E3F2FD',
    color: '#1565C0',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
  },
  teamRow: { display: 'flex', gap: 10, alignItems: 'stretch' },
  vs: { color: '#999', fontSize: 13, alignSelf: 'center', flexShrink: 0 },
  standingsTable: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  standingsRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f5f5f5',
    gap: 12,
  },
  myRow: { backgroundColor: '#E3F2FD' },
  rank: { width: 24, textAlign: 'center', color: '#999', fontSize: 13, fontWeight: 600, flexShrink: 0 },
  playerName: { flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  activeStatus: { color: '#2E7D32', fontSize: 13, fontWeight: 500, flexShrink: 0 },
  eliminatedStatus: { color: '#C62828', fontSize: 13, fontWeight: 500, flexShrink: 0 },
};

export default App;
