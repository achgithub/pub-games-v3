import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --- Types ---

interface Team {
  id: number;
  name: string;
  joinCode: string;
}

interface SessionInfo {
  sessionId: number;
  sessionName: string;
  mode: string;
  status: string;
  playerId: number;
  teams: Team[];
}

interface CachedQuestion {
  roundId: number;
  questionId: number;
  questionNumber: number;
  roundNumber: number;
  questionText: string;
  imageUrl: string;
  timeLimit: number | null;
}

interface ScoreEntry {
  teamId: number;
  name: string;
  total: number;
  roundPoints: number;
}

type ViewState =
  | 'join'
  | 'team-join'
  | 'lobby'
  | 'waiting'
  | 'question-ready'
  | 'question'
  | 'answer-submitted'
  | 'scores'
  | 'ended';

// --- Hooks ---

function useUrlParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId') || '',
      userName: params.get('userName') || '',
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
  const { userId, userName, token } = useUrlParams();
  const api = useApi(token);

  const [view, setView] = useState<ViewState>('join');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [teamJoinCode, setTeamJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [cachedQuestion, setCachedQuestion] = useState<CachedQuestion | null>(null);
  const [revealedQuestionId, setRevealedQuestionId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sseRef = useRef<EventSource | null>(null);

  const connectSSE = useCallback((sid: number) => {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(`/api/sessions/${sid}/stream?token=${encodeURIComponent(token)}`);
    sseRef.current = es;

    es.addEventListener('connected', () => {
      // connected
    });

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        handleSSEEvent(event);
      } catch {}
    };

    es.onerror = () => {
      setTimeout(() => connectSSE(sid), 3000);
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSSEEvent = (event: { type: string; payload: unknown }) => {
    switch (event.type) {
      case 'question_precache': {
        const p = event.payload as CachedQuestion;
        setCachedQuestion(p);
        setRevealedQuestionId(null);
        setAnswerText('');
        setAnswerSubmitted(false);
        setView('question-ready');
        break;
      }
      case 'question_reveal': {
        const p = event.payload as { questionId: number };
        setRevealedQuestionId(p.questionId);
        setView('question');
        break;
      }
      case 'timer_start': {
        const p = event.payload as { questionId: number; durationSeconds: number };
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(p.durationSeconds);
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(timerRef.current!);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        break;
      }
      case 'answers_closed': {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(null);
        if (!answerSubmitted) setView('waiting');
        break;
      }
      case 'scores_revealed': {
        const p = event.payload as { scores: ScoreEntry[] };
        setScores(p.scores);
        setView('scores');
        break;
      }
      case 'quiz_ended': {
        setView('ended');
        if (sseRef.current) sseRef.current.close();
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const joinSession = async () => {
    if (!joinCode.trim()) return;
    setError(null);
    try {
      const data = await api('/api/sessions/join', {
        method: 'POST',
        body: JSON.stringify({ joinCode: joinCode.trim().toUpperCase() }),
      });
      setSession(data);
      connectSSE(data.sessionId);
      if (data.mode === 'team' && data.teams.length > 0) {
        setView('team-join');
      } else {
        setView('lobby');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    }
  };

  const joinTeam = async (teamCode: string) => {
    if (!session) return;
    setError(null);
    try {
      await api('/api/sessions/join-team', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.sessionId, teamCode }),
      });
      setView('lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    }
  };

  const submitAnswer = async () => {
    if (!session || !cachedQuestion || !answerText.trim()) return;
    setError(null);
    try {
      await api(`/api/sessions/${session.sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          roundId: cachedQuestion.roundId,
          questionId: cachedQuestion.questionId,
          answerText: answerText.trim(),
        }),
      });
      setAnswerSubmitted(true);
      setView('answer-submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  if (!userId || !token) {
    return (
      <div style={s.container}>
        <h2 style={s.title}>Quiz Player</h2>
        <p style={s.muted}>Access this app through the lobby.</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>Quiz Player</h2>
        {session && <span style={s.sessionName}>{session.sessionName}</span>}
      </div>

      {error && (
        <div style={s.error} onClick={() => setError(null)}>{error}</div>
      )}

      {/* Join view */}
      {view === 'join' && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>Join a Quiz</h3>
          <p style={s.muted}>Hi {userName || userId}! Enter the code from your Quiz Master.</p>
          <input
            style={s.input}
            placeholder="Join code (e.g. ABC123)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinSession()}
            autoFocus
          />
          <button style={s.btnPrimary} onClick={joinSession} disabled={!joinCode.trim()}>
            Join Quiz
          </button>
        </div>
      )}

      {/* Team join view */}
      {view === 'team-join' && session && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>Join a Team</h3>
          <p style={s.muted}>Enter your team's code, or ask your Quiz Master for it.</p>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Available Teams:</h4>
            {session.teams.map(team => (
              <div key={team.id} style={s.teamCard} onClick={() => joinTeam(team.joinCode)}>
                <strong>{team.name}</strong>
                <span style={s.muted}> · Code: {team.joinCode}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Team code"
              value={teamJoinCode}
              onChange={e => setTeamJoinCode(e.target.value.toUpperCase())}
            />
            <button style={s.btnPrimary} onClick={() => joinTeam(teamJoinCode)} disabled={!teamJoinCode.trim()}>
              Join
            </button>
          </div>
          <button style={{ ...s.btnOutline, marginTop: 8 }} onClick={() => setView('lobby')}>
            Skip (no team)
          </button>
        </div>
      )}

      {/* Lobby */}
      {view === 'lobby' && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>Waiting for Quiz to Start</h3>
          <div style={s.waitingAnim}>
            <span style={{ fontSize: 48 }}>🎯</span>
            <p style={{ ...s.muted, marginTop: 12 }}>The Quiz Master will start the quiz shortly...</p>
          </div>
          {session?.mode === 'team' && (
            <button style={{ ...s.btnOutline, marginTop: 12 }} onClick={() => setView('team-join')}>
              Change Team
            </button>
          )}
        </div>
      )}

      {/* Question loading (pre-cached, not yet revealed) */}
      {view === 'question-ready' && cachedQuestion && (
        <div style={s.card}>
          <div style={s.roundBadge}>Round {cachedQuestion.roundNumber}</div>
          <div style={s.waitingAnim}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#1565C0' }}>
              Question {cachedQuestion.questionNumber}
            </p>
            <p style={{ ...s.muted, marginTop: 8 }}>Get ready...</p>
          </div>
        </div>
      )}

      {/* Question revealed */}
      {view === 'question' && cachedQuestion && revealedQuestionId === cachedQuestion.questionId && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={s.roundBadge}>Round {cachedQuestion.roundNumber} · Q{cachedQuestion.questionNumber}</div>
            {timeLeft !== null && timeLeft > 0 && (
              <div style={{ ...s.timer, color: timeLeft <= 10 ? '#F44336' : '#333' }}>
                {timeLeft}s
              </div>
            )}
          </div>

          {cachedQuestion.imageUrl && (
            <img src={cachedQuestion.imageUrl} alt="Question" style={s.questionImage} />
          )}

          <p style={s.questionText}>{cachedQuestion.questionText}</p>

          <textarea
            style={s.answerInput}
            placeholder="Your answer..."
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            rows={3}
          />
          <button
            style={s.btnPrimary}
            onClick={submitAnswer}
            disabled={!answerText.trim()}
          >
            Submit Answer
          </button>
        </div>
      )}

      {/* Answer submitted */}
      {view === 'answer-submitted' && (
        <div style={s.card}>
          <div style={s.waitingAnim}>
            <span style={{ fontSize: 48 }}>✅</span>
            <p style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>Answer submitted!</p>
            <p style={s.muted}>Waiting for other players...</p>
            {answerText && <p style={{ marginTop: 12, color: '#555', fontStyle: 'italic' }}>"{answerText}"</p>}
          </div>
        </div>
      )}

      {/* Waiting between questions */}
      {view === 'waiting' && (
        <div style={s.card}>
          <div style={s.waitingAnim}>
            <span style={{ fontSize: 48 }}>⏳</span>
            <p style={{ ...s.muted, marginTop: 12 }}>Waiting for next question...</p>
          </div>
        </div>
      )}

      {/* Scores */}
      {view === 'scores' && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>Scores</h3>
          {scores.length === 0 ? (
            <p style={s.muted}>No scores yet.</p>
          ) : (
            <div>
              {scores.map((entry, idx) => (
                <div key={entry.teamId} style={{ ...s.scoreRow, borderLeft: idx === 0 ? '4px solid gold' : undefined }}>
                  <span style={s.scoreRank}>#{idx + 1}</span>
                  <span style={s.scoreName}>{entry.name}</span>
                  <span style={s.scorePoints}>{entry.total} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ended */}
      {view === 'ended' && (
        <div style={s.card}>
          <div style={s.waitingAnim}>
            <span style={{ fontSize: 48 }}>🏆</span>
            <h3 style={{ ...s.cardTitle, marginTop: 12 }}>Quiz Complete!</h3>
            {scores.length > 0 && (
              <p style={{ fontWeight: 600, marginTop: 8, color: '#1565C0' }}>
                Winner: {scores[0]?.name}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'inherit' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, color: '#1565C0' },
  sessionName: { fontSize: 13, color: '#666', fontStyle: 'italic' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#333' },
  muted: { color: '#666', fontSize: 13 },
  error: { backgroundColor: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 8, marginBottom: 12, cursor: 'pointer', fontSize: 13 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 16, marginBottom: 12, display: 'block' },
  btnPrimary: { width: '100%', padding: '14px', borderRadius: 8, border: 'none', backgroundColor: '#1565C0', color: 'white', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  btnOutline: { width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #1565C0', backgroundColor: 'transparent', color: '#1565C0', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  teamCard: { padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', marginBottom: 8, cursor: 'pointer', backgroundColor: '#fafafa' },
  waitingAnim: { textAlign: 'center', padding: '20px 0' },
  roundBadge: { display: 'inline-block', backgroundColor: '#E3F2FD', color: '#1565C0', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
  questionText: { fontSize: 20, fontWeight: 600, color: '#222', margin: '16px 0', lineHeight: 1.4 },
  questionImage: { width: '100%', borderRadius: 8, marginBottom: 12, maxHeight: 250, objectFit: 'contain' },
  answerInput: { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 16, marginBottom: 12, resize: 'vertical', fontFamily: 'inherit' },
  timer: { fontSize: 24, fontWeight: 700, minWidth: 50, textAlign: 'center' },
  scoreRow: { display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 8, backgroundColor: '#f9f9f9', marginBottom: 6 },
  scoreRank: { fontSize: 14, fontWeight: 700, color: '#999', width: 32 },
  scoreName: { flex: 1, fontSize: 15, fontWeight: 500 },
  scorePoints: { fontSize: 16, fontWeight: 700, color: '#1565C0' },
};

export default App;
