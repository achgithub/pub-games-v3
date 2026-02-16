import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --- Types ---

interface Pack {
  id: number;
  name: string;
  description: string;
  roundCount: number;
}

interface Round {
  id: number;
  roundNumber: number;
  name: string;
  type: string;
  timeLimitSeconds: number;
  questionCount: number;
  questions: Question[];
}

interface Question {
  id: number;
  position: number;
  text: string;
  answer: string;
  type: string;
  imagePath: string;
  audioPath: string;
}

interface Player {
  id: number;
  userEmail: string;
  userName: string;
  teamId: number | null;
  teamName: string;
}

interface Team {
  id: number;
  name: string;
  joinCode: string;
}

interface AnswerEntry {
  id: number;
  playerId: number;
  teamId: number | null;
  playerEmail: string;
  playerName: string;
  teamName: string;
  answerText: string;
  isCorrect: boolean | null;
  points: number;
  isLikelyCorrect: boolean;
}

interface SessionInfo {
  id: number;
  name: string;
  mode: string;
  status: string;
  joinCode: string;
  packId: number;
}

type View = 'setup' | 'lobby' | 'control' | 'marking' | 'scores';

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

function App() {
  const { userId, token } = useUrlParams();
  const api = useApi(token);

  const [view, setView] = useState<View>('setup');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Session setup form
  const [newSessionName, setNewSessionName] = useState('');
  const [newPackId, setNewPackId] = useState('');
  const [newMode, setNewMode] = useState('team');
  const [newTeamNames, setNewTeamNames] = useState('Team A, Team B');

  // Quiz control state
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [questionLoaded, setQuestionLoaded] = useState(false);
  const [questionRevealed, setQuestionRevealed] = useState(false);
  const [answersClosed, setAnswersClosed] = useState(false);

  // Marking state
  const [markingAnswers, setMarkingAnswers] = useState<AnswerEntry[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState('');

  // Scores
  const [scores, setScores] = useState<Array<{teamId: number; name: string; total: number; roundPoints: number}>>([]);

  const lobbySSE = useRef<EventSource | null>(null);

  useEffect(() => {
    if (token) {
      api('/api/packs').then(d => setPacks(d.packs || [])).catch(() => {});
    }
  }, [api, token]);

  const connectLobbySSE = useCallback((sid: number) => {
    if (lobbySSE.current) lobbySSE.current.close();
    const es = new EventSource(`/api/sessions/${sid}/lobby-stream?token=${encodeURIComponent(token)}`);
    lobbySSE.current = es;
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'player_joined') {
          setPlayers(event.payload.players || []);
        }
      } catch {}
    };
    es.onerror = () => setTimeout(() => connectLobbySSE(sid), 3000);
  }, [token]);

  useEffect(() => () => { lobbySSE.current?.close(); }, []);

  const createSession = async () => {
    if (!newSessionName.trim() || !newPackId) return;
    setError(null);
    try {
      const data = await api('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: newSessionName.trim(), packId: parseInt(newPackId), mode: newMode }),
      });

      // Fetch full session details
      const detail = await api(`/api/sessions/${data.sessionId}`);
      setSession(detail.session);
      setRounds(detail.rounds || []);
      setPlayers(detail.players || []);
      setTeams(detail.teams || []);

      // Create teams if specified
      if (newMode === 'team' && newTeamNames.trim()) {
        const teamList = newTeamNames.split(',').map((t: string) => t.trim()).filter(Boolean);
        for (const teamName of teamList) {
          try {
            await api(`/api/sessions/${data.sessionId}/teams`, {
              method: 'POST',
              body: JSON.stringify({ name: teamName }),
            });
          } catch {}
        }
      }

      connectLobbySSE(data.sessionId);
      setView('lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const startQuiz = async () => {
    if (!session) return;
    try {
      await api(`/api/sessions/${session.id}/start`, { method: 'POST' });
      setSession(s => s ? { ...s, status: 'active' } : s);
      lobbySSE.current?.close();
      setView('control');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    }
  };

  const currentRound = rounds[currentRoundIdx];
  const currentQuestion = currentRound?.questions?.[currentQuestionIdx];

  const loadQuestion = async () => {
    if (!session || !currentRound || !currentQuestion) return;
    setError(null);
    try {
      await api(`/api/sessions/${session.id}/load-question`, {
        method: 'POST',
        body: JSON.stringify({
          roundId: currentRound.id,
          questionId: currentQuestion.id,
          questionNumber: currentQuestionIdx + 1,
          roundNumber: currentRound.roundNumber,
        }),
      });
      setQuestionLoaded(true);
      setQuestionRevealed(false);
      setAnswersClosed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const revealQuestion = async () => {
    if (!session || !currentQuestion) return;
    try {
      await api(`/api/sessions/${session.id}/reveal`, {
        method: 'POST',
        body: JSON.stringify({ questionId: currentQuestion.id }),
      });
      setQuestionRevealed(true);
      // Auto-start timer if round has time limit
      if (currentRound?.timeLimitSeconds) {
        await api(`/api/sessions/${session.id}/start-timer`, {
          method: 'POST',
          body: JSON.stringify({ questionId: currentQuestion.id, durationSeconds: currentRound.timeLimitSeconds }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const playAudio = async () => {
    if (!session || !currentQuestion?.audioPath) return;
    try {
      await api(`/api/sessions/${session.id}/audio-play`, {
        method: 'POST',
        body: JSON.stringify({ audioUrl: currentQuestion.audioPath }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const closeAnswers = async () => {
    if (!session || !currentQuestion) return;
    try {
      await api(`/api/sessions/${session.id}/close-answers`, {
        method: 'POST',
        body: JSON.stringify({ questionId: currentQuestion.id }),
      });
      setAnswersClosed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const openMarking = async () => {
    if (!session || !currentQuestion) return;
    try {
      const data = await api(`/api/sessions/${session.id}/answers/${currentQuestion.id}`);
      setMarkingAnswers(data.answers || []);
      setCorrectAnswer(data.correctAnswer || '');
      setView('marking');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load answers');
    }
  };

  const markAnswer = async (answerId: number, isCorrect: boolean) => {
    if (!session) return;
    try {
      await api(`/api/sessions/${session.id}/mark`, {
        method: 'POST',
        body: JSON.stringify({ answerId, isCorrect, points: isCorrect ? 1 : 0 }),
      });
      setMarkingAnswers(prev => prev.map(a => a.id === answerId ? { ...a, isCorrect, points: isCorrect ? 1 : 0 } : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark');
    }
  };

  const pushScores = async (roundId?: number) => {
    if (!session) return;
    try {
      const data = await api(`/api/sessions/${session.id}/push-scores`, {
        method: 'POST',
        body: JSON.stringify({ roundId: roundId ?? null }),
      });
      setScores(data.scores || []);
      setView('scores');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push scores');
    }
  };

  const nextQuestion = () => {
    if (!currentRound) return;
    setQuestionLoaded(false);
    setQuestionRevealed(false);
    setAnswersClosed(false);
    if (currentQuestionIdx + 1 < (currentRound.questions?.length || 0)) {
      setCurrentQuestionIdx(idx => idx + 1);
    } else if (currentRoundIdx + 1 < rounds.length) {
      setCurrentRoundIdx(idx => idx + 1);
      setCurrentQuestionIdx(0);
    }
    setView('control');
  };

  const endQuiz = async () => {
    if (!session || !window.confirm('End the quiz?')) return;
    try {
      await api(`/api/sessions/${session.id}/end`, { method: 'POST' });
      setSuccess('Quiz ended');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (!userId || !token) {
    return (
      <div style={s.container}>
        <h2 style={s.title}>Quiz Master</h2>
        <p style={s.muted}>Access this app through the lobby. Requires quiz_master or game_admin role.</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>Quiz Master</h2>
        {session && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={s.joinCodeBadge}>{session.joinCode}</span>
            <span style={s.statusBadge(session.status)}>{session.status}</span>
          </div>
        )}
      </div>

      {error && <div style={s.error} onClick={() => setError(null)}>{error}</div>}
      {success && <div style={s.successBanner}>{success}</div>}

      {/* Navigation tabs when session active */}
      {session && (
        <div style={s.tabs}>
          {(['lobby', 'control', 'marking', 'scores'] as View[]).map(v => (
            <button key={v} style={view === v ? s.tabActive : s.tab} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Setup view */}
      {view === 'setup' && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>Create Quiz Session</h3>
          <div style={s.field}>
            <label style={s.label}>Session name</label>
            <input style={s.input} placeholder="e.g. Pub Quiz Night 1" value={newSessionName} onChange={e => setNewSessionName(e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Quiz pack</label>
            <select style={s.select} value={newPackId} onChange={e => setNewPackId(e.target.value)}>
              <option value="">— select pack —</option>
              {packs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.roundCount} rounds)</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Mode</label>
            <select style={s.select} value={newMode} onChange={e => setNewMode(e.target.value)}>
              <option value="team">Team</option>
              <option value="individual">Individual</option>
            </select>
          </div>
          {newMode === 'team' && (
            <div style={s.field}>
              <label style={s.label}>Team names (comma-separated)</label>
              <input style={s.input} value={newTeamNames} onChange={e => setNewTeamNames(e.target.value)} placeholder="Team A, Team B, Team C" />
            </div>
          )}
          <button style={s.btnPrimary} onClick={createSession} disabled={!newSessionName.trim() || !newPackId}>
            Create Session
          </button>
          {packs.length === 0 && (
            <p style={{ ...s.muted, marginTop: 12, color: '#E65100' }}>No quiz packs found. Create one in Game Admin → Quiz → Packs first.</p>
          )}
        </div>
      )}

      {/* Lobby view */}
      {view === 'lobby' && session && (
        <div>
          <div style={s.card}>
            <h3 style={s.cardTitle}>Session Lobby</h3>
            <div style={s.joinCodeDisplay}>
              <p style={s.muted}>Players join at:</p>
              <p style={{ fontSize: 32, fontWeight: 800, color: '#1565C0', letterSpacing: 4 }}>{session.joinCode}</p>
              <p style={s.muted}>Quiz Player app → Join code above</p>
            </div>
            <button style={s.btnPrimary} onClick={startQuiz} disabled={players.length === 0}>
              Start Quiz ({players.length} player{players.length !== 1 ? 's' : ''})
            </button>
          </div>

          {teams.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>Teams</h3>
              {teams.map(t => (
                <div key={t.id} style={s.teamRow}>
                  <strong>{t.name}</strong>
                  <span style={s.muted}> · Code: <strong>{t.joinCode}</strong></span>
                </div>
              ))}
            </div>
          )}

          <div style={s.card}>
            <h3 style={s.cardTitle}>Players ({players.length})</h3>
            {players.length === 0 ? (
              <p style={s.muted}>Waiting for players to join...</p>
            ) : (
              players.map(p => (
                <div key={p.id} style={s.playerRow}>
                  <span>{p.userName || p.userEmail}</span>
                  {p.teamName && <span style={s.teamBadge}>{p.teamName}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Control view */}
      {view === 'control' && session && currentRound && (
        <div>
          {/* Round/question nav */}
          <div style={s.card}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {rounds.map((rd, ri) => (
                <button
                  key={rd.id}
                  style={ri === currentRoundIdx ? s.tabActive : s.tab}
                  onClick={() => { setCurrentRoundIdx(ri); setCurrentQuestionIdx(0); setQuestionLoaded(false); setQuestionRevealed(false); setAnswersClosed(false); }}
                >
                  R{rd.roundNumber}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {currentRound.questions.map((q, qi) => (
                <button
                  key={q.id}
                  style={qi === currentQuestionIdx ? s.tabActive : s.tab}
                  onClick={() => { setCurrentQuestionIdx(qi); setQuestionLoaded(false); setQuestionRevealed(false); setAnswersClosed(false); }}
                >
                  Q{qi + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Current question */}
          {currentQuestion && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={s.roundBadge}>{currentRound.name} · Q{currentQuestionIdx + 1}/{currentRound.questions.length}</span>
                  <span style={{ ...s.roundBadge, marginLeft: 8, backgroundColor: '#FFF3E0', color: '#E65100' }}>{currentRound.type}</span>
                </div>
                {currentRound.timeLimitSeconds > 0 && (
                  <span style={s.muted}>{currentRound.timeLimitSeconds}s limit</span>
                )}
              </div>

              <p style={s.questionText}>{currentQuestion.text}</p>

              {currentQuestion.imagePath && (
                <div style={s.mediaBadge}>Image: {currentQuestion.imagePath.split('/').pop()}</div>
              )}
              {currentQuestion.audioPath && (
                <div style={{ ...s.mediaBadge, backgroundColor: '#FFF3E0', color: '#E65100' }}>
                  Audio: {currentQuestion.audioPath.split('/').pop()}
                </div>
              )}

              <p style={{ ...s.muted, marginTop: 8 }}>
                Answer: <strong style={{ color: '#2E7D32' }}>{currentQuestion.answer}</strong>
              </p>

              {/* Control buttons flow */}
              <div style={s.controlButtons}>
                <button
                  style={questionLoaded ? s.btnDone : s.btnPrimary}
                  onClick={loadQuestion}
                  disabled={questionLoaded}
                >
                  {questionLoaded ? '1. Loaded' : '1. Load Question'}
                </button>

                <button
                  style={questionRevealed ? s.btnDone : s.btnPrimary}
                  onClick={revealQuestion}
                  disabled={!questionLoaded || questionRevealed}
                >
                  {questionRevealed ? '2. Revealed' : '2. Reveal'}
                </button>

                {currentRound.type === 'music' && currentQuestion.audioPath && (
                  <button style={s.btnOutline} onClick={playAudio} disabled={!questionRevealed}>
                    Play Audio
                  </button>
                )}

                <button
                  style={answersClosed ? s.btnDone : s.btnDanger}
                  onClick={closeAnswers}
                  disabled={!questionRevealed || answersClosed}
                >
                  {answersClosed ? '3. Closed' : '3. Close Answers'}
                </button>

                <button
                  style={s.btnOutline}
                  onClick={openMarking}
                  disabled={!answersClosed}
                >
                  4. Mark Answers
                </button>

                <button style={s.btnOutline} onClick={nextQuestion}>
                  Next →
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={s.btnOutline} onClick={() => pushScores(currentRound.id)}>
              Push Round Scores
            </button>
            <button style={s.btnOutline} onClick={() => pushScores(undefined)}>
              Push Overall Scores
            </button>
            <button style={{ ...s.btnDanger, flex: 'none' }} onClick={endQuiz}>End Quiz</button>
          </div>
        </div>
      )}

      {/* Marking view */}
      {view === 'marking' && session && (
        <div>
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={s.cardTitle}>Marking</h3>
              <button style={s.btnOutline} onClick={() => setView('control')}>← Back</button>
            </div>
            <p style={s.muted}>Correct answer: <strong style={{ color: '#2E7D32' }}>{correctAnswer}</strong></p>
          </div>

          {markingAnswers.length === 0 ? (
            <div style={s.card}><p style={s.muted}>No answers submitted.</p></div>
          ) : (
            markingAnswers.map(a => (
              <div key={a.id} style={{ ...s.card, borderLeft: a.isCorrect === true ? '4px solid #4CAF50' : a.isCorrect === false ? '4px solid #F44336' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 500 }}>{a.teamName || a.playerName || a.playerEmail}</p>
                    <p style={{ fontSize: 18, margin: '4px 0', color: '#222' }}>{a.answerText || <em style={{ color: '#999' }}>no answer</em>}</p>
                    {a.isLikelyCorrect && a.isCorrect === null && (
                      <span style={{ fontSize: 11, backgroundColor: '#E8F5E9', color: '#2E7D32', padding: '2px 6px', borderRadius: 10 }}>
                        likely correct
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button
                      style={{ ...s.btnOutline, color: '#4CAF50', borderColor: '#4CAF50', padding: '6px 14px' }}
                      onClick={() => markAnswer(a.id, true)}
                    >
                      ✓
                    </button>
                    <button
                      style={{ ...s.btnDanger, padding: '6px 14px' }}
                      onClick={() => markAnswer(a.id, false)}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          <button style={s.btnPrimary} onClick={() => pushScores(currentRound?.id)}>
            Push Scores
          </button>
        </div>
      )}

      {/* Scores view */}
      {view === 'scores' && (
        <div>
          <div style={s.card}>
            <h3 style={s.cardTitle}>Leaderboard</h3>
            {scores.length === 0 ? (
              <p style={s.muted}>No scores yet.</p>
            ) : (
              scores.map((entry, idx) => (
                <div key={entry.teamId} style={s.scoreRow}>
                  <span style={s.scoreRank}>#{idx + 1}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{entry.name}</span>
                  <span style={s.scorePoints}>{entry.total} pts</span>
                </div>
              ))
            )}
          </div>
          <button style={s.btnOutline} onClick={() => setView('control')}>← Back to Control</button>
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const s: Record<string, React.CSSProperties> & {
  statusBadge: (status: string) => React.CSSProperties;
} = {
  container: { maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'inherit' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 22, fontWeight: 800, color: '#1565C0' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#333' },
  muted: { color: '#777', fontSize: 13 },
  error: { backgroundColor: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13 },
  successBanner: { backgroundColor: '#E8F5E9', color: '#2E7D32', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 },
  select: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 },
  btnPrimary: { padding: '12px 20px', borderRadius: 8, border: 'none', backgroundColor: '#1565C0', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  btnOutline: { padding: '10px 16px', borderRadius: 8, border: '1px solid #1565C0', backgroundColor: 'transparent', color: '#1565C0', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnDanger: { padding: '10px 16px', borderRadius: 8, border: 'none', backgroundColor: '#F44336', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnDone: { padding: '12px 20px', borderRadius: 8, border: 'none', backgroundColor: '#4CAF50', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'default', width: '100%' },
  tabs: { display: 'flex', gap: 4, marginBottom: 12, borderBottom: '2px solid #e0e0e0', paddingBottom: 4 },
  tab: { padding: '6px 14px', borderRadius: '6px 6px 0 0', border: 'none', backgroundColor: 'transparent', color: '#666', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  tabActive: { padding: '6px 14px', borderRadius: '6px 6px 0 0', border: 'none', backgroundColor: '#1565C0', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  joinCodeDisplay: { textAlign: 'center', padding: '20px 0' },
  joinCodeBadge: { fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#1565C0', backgroundColor: '#E3F2FD', padding: '4px 12px', borderRadius: 8 },
  statusBadge: (status: string) => ({
    fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 8,
    backgroundColor: status === 'active' ? '#E8F5E9' : status === 'lobby' ? '#FFF3E0' : '#ECEFF1',
    color: status === 'active' ? '#2E7D32' : status === 'lobby' ? '#E65100' : '#607D8B',
  }),
  roundBadge: { display: 'inline-block', backgroundColor: '#E3F2FD', color: '#1565C0', padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  questionText: { fontSize: 18, fontWeight: 600, color: '#222', margin: '12px 0', lineHeight: 1.5 },
  mediaBadge: { display: 'inline-block', backgroundColor: '#E8F5E9', color: '#2E7D32', padding: '2px 8px', borderRadius: 8, fontSize: 12, margin: '4px 4px 0 0' },
  controlButtons: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 },
  teamRow: { padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14 },
  playerRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14, borderBottom: '1px solid #f5f5f5' },
  teamBadge: { fontSize: 11, backgroundColor: '#E3F2FD', color: '#1565C0', padding: '2px 8px', borderRadius: 10 },
  scoreRow: { display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f5f5f5' },
  scoreRank: { fontSize: 14, fontWeight: 700, color: '#999', width: 36 },
  scorePoints: { fontSize: 16, fontWeight: 700, color: '#1565C0' },
};

export default App;
