import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Types ---

interface SessionMeta {
  sessionId: number;
  name: string;
  packName: string;
  mode: string;
  status: string;
}

interface CachedQuestion {
  roundId: number;
  questionId: number;
  questionNumber: number;
  roundNumber: number;
  questionText: string;
  imageUrl: string;
  audioUrl: string;
  timeLimit: number | null;
}

interface ScoreEntry {
  teamId: number;
  name: string;
  total: number;
  roundPoints: number;
}

type DisplayState =
  | 'idle'
  | 'waiting'
  | 'question-loading'
  | 'question-reveal'
  | 'music-round'
  | 'answers-closed'
  | 'scores'
  | 'ended';

// --- Main App ---

function App() {
  const sessionCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || '';
  }, []);

  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [displayState, setDisplayState] = useState<DisplayState>('idle');
  const [cachedQuestion, setCachedQuestion] = useState<CachedQuestion | null>(null);
  const [revealedQuestion, setRevealedQuestion] = useState<CachedQuestion | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionCode) return;
    // Load session metadata
    fetch(`/api/display/session/${sessionCode}`)
      .then(r => r.json())
      .then(d => { setMeta(d); setDisplayState('waiting'); })
      .catch(() => {});
  }, [sessionCode]);

  const connectSSE = (code: string) => {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(`/api/display/stream/${code}`);
    sseRef.current = es;

    es.addEventListener('connected', () => {
      setDisplayState('waiting');
    });

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        handleSSEEvent(event);
      } catch {}
    };

    es.onerror = () => {
      setTimeout(() => connectSSE(code), 3000);
    };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSSEEvent = (event: { type: string; payload: unknown }) => {
    switch (event.type) {
      case 'quiz_started': {
        setDisplayState('waiting');
        break;
      }
      case 'question_precache': {
        const p = event.payload as CachedQuestion;
        setCachedQuestion(p);
        setRevealedQuestion(null);
        setDisplayState('question-loading');
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(null);
        break;
      }
      case 'question_reveal': {
        setRevealedQuestion(cachedQuestion);
        if (cachedQuestion?.audioUrl) {
          setDisplayState('music-round');
        } else {
          setDisplayState('question-reveal');
        }
        break;
      }
      case 'audio_play': {
        const p = event.payload as { audioUrl: string };
        setAudioSrc(p.audioUrl);
        setDisplayState('music-round');
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
        setDisplayState('answers-closed');
        break;
      }
      case 'scores_revealed': {
        const p = event.payload as { scores: ScoreEntry[] };
        setScores(p.scores);
        setDisplayState('scores');
        break;
      }
      case 'quiz_ended': {
        setDisplayState('ended');
        if (sseRef.current) sseRef.current.close();
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (sessionCode) connectSSE(sessionCode);
    return () => {
      sseRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-play audio when audioSrc changes
  useEffect(() => {
    if (audioRef.current && audioSrc) {
      audioRef.current.src = audioSrc;
      audioRef.current.play().catch(() => {});
    }
  }, [audioSrc]);

  if (!sessionCode) {
    return (
      <div style={s.fullscreen}>
        <div style={s.center}>
          <h1 style={s.title}>Quiz Display</h1>
          <p style={s.subtitle}>Add ?session=CODE to the URL to connect to a quiz</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.fullscreen}>
      {/* Hidden audio element */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Idle / not yet connected */}
      {displayState === 'idle' && (
        <div style={s.center}>
          <div style={s.spinner} />
          <p style={s.subtitle}>Connecting to session {sessionCode}...</p>
        </div>
      )}

      {/* Waiting for quiz to start */}
      {displayState === 'waiting' && meta && (
        <div style={s.center}>
          <p style={s.packName}>{meta.packName}</p>
          <h1 style={s.quizTitle}>{meta.name}</h1>
          <div style={s.joinCodeBox}>
            <p style={s.joinCodeLabel}>Join the quiz</p>
            <p style={s.joinCode}>{sessionCode}</p>
          </div>
          <p style={s.subtitle}>Waiting for the Quiz Master to start...</p>
        </div>
      )}

      {/* Question loading (pre-cache) */}
      {displayState === 'question-loading' && cachedQuestion && (
        <div style={s.center}>
          <p style={s.roundLabel}>Round {cachedQuestion.roundNumber}</p>
          <div style={s.questionNumberBox}>
            <p style={s.questionNumberLabel}>Question</p>
            <p style={s.questionNumber}>{cachedQuestion.questionNumber}</p>
          </div>
          <p style={s.getReady}>Get Ready...</p>
        </div>
      )}

      {/* Question revealed */}
      {displayState === 'question-reveal' && revealedQuestion && (
        <div style={{ ...s.fullscreen, display: 'flex', flexDirection: 'column', padding: '5vh 8vw' }}>
          <div style={s.questionHeader}>
            <span style={s.roundBadge}>Round {revealedQuestion.roundNumber}</span>
            <span style={s.qBadge}>Q{revealedQuestion.questionNumber}</span>
            {timeLeft !== null && timeLeft > 0 && (
              <span style={{ ...s.timerBadge, color: timeLeft <= 10 ? '#ff6b6b' : '#ffd700' }}>
                {timeLeft}s
              </span>
            )}
          </div>

          <div style={s.questionBody}>
            {revealedQuestion.imageUrl && (
              <img
                src={revealedQuestion.imageUrl}
                alt="Question"
                style={s.questionImage}
              />
            )}
            <p style={s.questionText}>{revealedQuestion.questionText}</p>
          </div>

          {timeLeft === 0 && (
            <div style={s.timeUpBanner}>Time's up!</div>
          )}
        </div>
      )}

      {/* Music round */}
      {displayState === 'music-round' && (
        <div style={s.center}>
          {revealedQuestion && (
            <>
              <p style={s.roundLabel}>Round {revealedQuestion.roundNumber} · Q{revealedQuestion.questionNumber}</p>
              <p style={s.musicRoundLabel}>Music Round</p>
            </>
          )}
          <div style={s.musicWave}>
            {[...Array(7)].map((_, i) => (
              <div key={i} style={{ ...s.wavebar, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <p style={s.subtitle}>Listen carefully...</p>
          {timeLeft !== null && timeLeft > 0 && (
            <p style={{ ...s.timerBadge, fontSize: 40, marginTop: 20 }}>{timeLeft}s</p>
          )}
        </div>
      )}

      {/* Answers closed */}
      {displayState === 'answers-closed' && (
        <div style={s.center}>
          <p style={s.pencilsDown}>Pencils Down!</p>
          <p style={s.subtitle}>Submit your final answers</p>
        </div>
      )}

      {/* Scores */}
      {displayState === 'scores' && (
        <div style={{ ...s.fullscreen, display: 'flex', flexDirection: 'column', padding: '5vh 8vw' }}>
          <h2 style={s.scoresTitle}>Leaderboard</h2>
          <div style={s.scoresList}>
            {scores.map((entry, idx) => (
              <div key={entry.teamId} style={{ ...s.scoreRow, opacity: 1 - idx * 0.05 }}>
                <span style={s.scoreRank}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </span>
                <span style={s.scoreName}>{entry.name}</span>
                <span style={s.scorePoints}>{entry.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz ended */}
      {displayState === 'ended' && (
        <div style={s.center}>
          <p style={{ fontSize: '6vw' }}>🏆</p>
          <h1 style={s.endTitle}>Quiz Complete!</h1>
          {scores.length > 0 && (
            <>
              <p style={s.winnerLabel}>Winner</p>
              <p style={s.winnerName}>{scores[0]?.name}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  fullscreen: { width: '100vw', height: '100vh', backgroundColor: '#0a0a2e', color: 'white', position: 'relative' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 8vw' },
  title: { fontSize: '4vw', fontWeight: 800, color: '#ffd700', marginBottom: '2vh' },
  subtitle: { fontSize: '1.8vw', color: '#aaa', marginTop: '2vh' },
  packName: { fontSize: '1.5vw', color: '#888', textTransform: 'uppercase', letterSpacing: 4, marginBottom: '1vh' },
  quizTitle: { fontSize: '5vw', fontWeight: 900, color: 'white', marginBottom: '4vh' },
  joinCodeBox: { backgroundColor: 'rgba(255,215,0,0.1)', border: '2px solid #ffd700', borderRadius: 16, padding: '3vh 6vw', marginBottom: '3vh' },
  joinCodeLabel: { fontSize: '1.5vw', color: '#ffd700', marginBottom: '1vh' },
  joinCode: { fontSize: '5vw', fontWeight: 900, color: '#ffd700', letterSpacing: 8 },
  roundLabel: { fontSize: '2vw', color: '#888', textTransform: 'uppercase', letterSpacing: 3, marginBottom: '2vh' },
  questionNumberBox: { marginBottom: '2vh' },
  questionNumberLabel: { fontSize: '2vw', color: '#aaa' },
  questionNumber: { fontSize: '12vw', fontWeight: 900, color: '#ffd700', lineHeight: 1 },
  getReady: { fontSize: '2.5vw', color: '#aaa', animation: 'pulse 1s infinite' },
  questionHeader: { display: 'flex', alignItems: 'center', gap: '1.5vw', marginBottom: '3vh' },
  roundBadge: { fontSize: '1.5vw', backgroundColor: 'rgba(255,215,0,0.2)', color: '#ffd700', padding: '0.5vh 1.5vw', borderRadius: 8 },
  qBadge: { fontSize: '1.5vw', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.5vh 1.5vw', borderRadius: 8 },
  timerBadge: { fontSize: '2.5vw', fontWeight: 900, color: '#ffd700', marginLeft: 'auto' },
  questionBody: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' },
  questionImage: { maxWidth: '60vw', maxHeight: '40vh', objectFit: 'contain', borderRadius: 12, marginBottom: '3vh' },
  questionText: { fontSize: '3.5vw', fontWeight: 700, color: 'white', lineHeight: 1.4, textAlign: 'center', maxWidth: '80vw' },
  timeUpBanner: { fontSize: '3vw', fontWeight: 900, color: '#ff6b6b', textAlign: 'center', padding: '2vh', backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 12 },
  musicRoundLabel: { fontSize: '4vw', fontWeight: 800, color: '#ffd700', marginBottom: '4vh' },
  musicWave: { display: 'flex', alignItems: 'flex-end', gap: '0.8vw', height: '15vh', marginBottom: '4vh' },
  wavebar: { width: '1.2vw', height: '100%', backgroundColor: '#ffd700', borderRadius: 4, animation: 'wave 0.8s ease-in-out infinite alternate' },
  pencilsDown: { fontSize: '7vw', fontWeight: 900, color: '#ff6b6b', marginBottom: '2vh' },
  scoresTitle: { fontSize: '3vw', fontWeight: 800, color: '#ffd700', marginBottom: '4vh', textAlign: 'center' },
  scoresList: { width: '100%', maxWidth: '80vw', margin: '0 auto' },
  scoreRow: { display: 'flex', alignItems: 'center', padding: '1.5vh 2vw', marginBottom: '1vh', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  scoreRank: { fontSize: '2.5vw', width: '6vw', textAlign: 'center' },
  scoreName: { flex: 1, fontSize: '2.5vw', fontWeight: 600, marginLeft: '2vw' },
  scorePoints: { fontSize: '3vw', fontWeight: 900, color: '#ffd700' },
  endTitle: { fontSize: '6vw', fontWeight: 900, color: '#ffd700', marginBottom: '3vh' },
  winnerLabel: { fontSize: '2vw', color: '#888', marginBottom: '1vh' },
  winnerName: { fontSize: '5vw', fontWeight: 800, color: 'white' },
  spinner: { width: '5vw', height: '5vw', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #ffd700', borderRadius: '50%', animation: 'spin 1s linear infinite' },
};

// Inject keyframe animations
const styleSheet = document.styleSheets[0];
if (styleSheet) {
  try {
    styleSheet.insertRule('@keyframes wave { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }', styleSheet.cssRules.length);
    styleSheet.insertRule('@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }', styleSheet.cssRules.length);
    styleSheet.insertRule('@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }', styleSheet.cssRules.length);
  } catch {}
}

export default App;
