import React, { useState, useRef, useMemo } from 'react';

// --- Types ---

type StepStatus = 'pending' | 'running' | 'pass' | 'fail';
type RunnerState = 'idle' | 'running' | 'done';

interface Step {
  id: string;
  label: string;
  detail: string;
  status: StepStatus;
}

interface TestContent {
  text: { id: number; text: string } | null;
  picture: { id: number; imagePath: string } | null;
  music: { id: number; audioPath: string } | null;
}

const INITIAL_STEPS: Step[] = [
  { id: 'ping',  label: 'HTTP Connectivity',  detail: '', status: 'pending' },
  { id: 'sse',   label: 'SSE Connectivity',   detail: '', status: 'pending' },
  { id: 'text',  label: 'Text Rendering',     detail: '', status: 'pending' },
  { id: 'image', label: 'Image Loading',      detail: '', status: 'pending' },
  { id: 'audio', label: 'Audio Playback',     detail: '', status: 'pending' },
];

// --- Main App ---

function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get('token') || '';
  const userId = params.get('userId') || '';

  const [runnerState, setRunnerState] = useState<RunnerState>('idle');
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [audioNeedsGesture, setAudioNeedsGesture] = useState(false);
  const audioTapResolve = useRef<(() => void) | null>(null);
  const loadedContent = useRef<TestContent | null>(null);

  const setStep = (id: string, patch: Partial<Step>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const runTests = async () => {
    setAudioNeedsGesture(false);
    setRunnerState('running');
    setSteps(INITIAL_STEPS);
    loadedContent.current = null;

    // ── Step 1: HTTP ping ──────────────────────────────────────────────
    setStep('ping', { status: 'running' });
    try {
      const t0 = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/ping', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ms = Date.now() - t0;
      setStep('ping', { status: 'pass', detail: `${ms}ms` });
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError' ? 'Timeout (5s)' : String(err);
      setStep('ping', { status: 'fail', detail: msg });
      finishEarly();
      return;
    }

    // ── Step 2: SSE connectivity ───────────────────────────────────────
    setStep('sse', { status: 'running' });
    try {
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource('/api/test-sse');
        let count = 0;
        es.addEventListener('ping', () => {
          count++;
          setStep('sse', { status: 'running', detail: `${count}/3 messages` });
        });
        es.addEventListener('done', () => {
          es.close();
          setStep('sse', { status: 'pass', detail: `${count}/3 messages received` });
          resolve();
        });
        es.onerror = () => {
          es.close();
          reject(new Error('SSE connection failed'));
        };
        setTimeout(() => { es.close(); reject(new Error('SSE timeout')); }, 10000);
      });
    } catch (err) {
      setStep('sse', { status: 'fail', detail: String(err) });
      finishEarly();
      return;
    }

    // ── Step 3: Load test content ──────────────────────────────────────
    setStep('text', { status: 'running' });
    let content: TestContent | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/test-content', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      content = await res.json();
      loadedContent.current = content;
      if (!content?.text) throw new Error('No test text question seeded');
      setStep('text', { status: 'pass', detail: content.text.text });
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError' ? 'Timeout (5s)' : String(err);
      setStep('text', { status: 'fail', detail: msg });
    }

    // ── Step 4: Image loading ──────────────────────────────────────────
    setStep('image', { status: 'running' });
    const imagePath = content?.picture?.imagePath;
    if (!imagePath) {
      setStep('image', { status: 'fail', detail: 'No test image seeded' });
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          const timeoutId = setTimeout(() => {
            img.src = '';
            reject(new Error('Timeout (8s)'));
          }, 8000);
          img.onload = () => {
            clearTimeout(timeoutId);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Image failed to load'));
          };
          img.src = imagePath;
        });
        setStep('image', { status: 'pass', detail: imagePath });
      } catch (err) {
        setStep('image', { status: 'fail', detail: String(err) });
      }
    }

    // ── Step 5: Audio playback ─────────────────────────────────────────
    setStep('audio', { status: 'running' });
    const audioPath = content?.music?.audioPath;
    if (!audioPath) {
      setStep('audio', { status: 'fail', detail: 'No test audio seeded' });
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(audioPath);
          const timeoutId = setTimeout(() => {
            audio.pause();
            audio.src = '';
            reject(new Error('Timeout (5s)'));
          }, 5000);
          audio.onended = () => {
            clearTimeout(timeoutId);
            resolve();
          };
          audio.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Audio failed to load'));
          };
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                // Playing — wait for onended
              })
              .catch(() => {
                clearTimeout(timeoutId);
                // Autoplay blocked — ask user to tap
                setAudioNeedsGesture(true);
                audioTapResolve.current = () => {
                  setAudioNeedsGesture(false);
                  const retryTimeout = setTimeout(() => {
                    audio.pause();
                    audio.src = '';
                    reject(new Error('Timeout (5s)'));
                  }, 5000);
                  audio.play()
                    .then(() => { /* wait for onended */ })
                    .catch(() => {
                      clearTimeout(retryTimeout);
                      reject(new Error('Audio blocked by browser'));
                    });
                };
              });
          }
        });
        setStep('audio', { status: 'pass', detail: 'Played successfully' });
      } catch (err) {
        setStep('audio', { status: 'fail', detail: String(err) });
      }
    }

    setRunnerState('done');
  };

  const finishEarly = () => {
    setSteps(prev => prev.map(s =>
      s.status === 'pending' ? { ...s, status: 'fail', detail: 'Skipped' } : s
    ));
    setRunnerState('done');
  };

  const allPass = steps.every(s => s.status === 'pass');
  const anyFail = steps.some(s => s.status === 'fail');
  const passCount = steps.filter(s => s.status === 'pass').length;
  const failCount = steps.filter(s => s.status === 'fail').length;

  if (!userId || !token) {
    return (
      <>
        {/* App Header Bar */}
        <div className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">Mobile Test</h1>
          </div>
          <div className="ah-app-header-right">
            <button
              className="ah-lobby-btn"
              onClick={() => {
                const shellUrl = `http://${window.location.hostname}:3001`;
                window.location.href = shellUrl;
              }}
            >
              ← Lobby
            </button>
          </div>
        </div>

        <div style={s.page}>
          <div style={s.card}>
            <p style={s.notice}>Access this app through the lobby to run tests.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* App Header Bar */}
      <div className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">Mobile Test</h1>
        </div>
        <div className="ah-app-header-right">
          <button
            className="ah-lobby-btn"
            onClick={() => {
              const shellUrl = `http://${window.location.hostname}:3001`;
              window.location.href = shellUrl;
            }}
          >
            ← Lobby
          </button>
        </div>
      </div>

      <div style={s.page}>
        {/* Description card */}
        <div style={s.card}>
          <p style={s.notice}>
            Tests HTTP, SSE, text, image and audio delivery on this device and browser.
          </p>
        </div>

      {/* Steps card */}
      <div style={s.card}>
        <div style={s.sectionLabel}>Test Steps</div>
        {steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} />
        ))}
      </div>

      {/* Audio gesture prompt */}
      {audioNeedsGesture && (
        <div style={s.card}>
          <div style={s.gestureRow}>
            <span style={s.gestureIcon}>🔇</span>
            <div>
              <div style={s.gestureTitle}>Audio blocked by browser</div>
              <div style={s.gestureSub}>Tap below to allow audio playback</div>
            </div>
            <button
              style={s.tapBtn}
              onClick={() => audioTapResolve.current?.()}
            >
              Tap to Play
            </button>
          </div>
        </div>
      )}

      {/* Image preview (shown after pass) */}
      {runnerState !== 'idle' && steps.find(s => s.id === 'image')?.status === 'pass' &&
        loadedContent.current?.picture?.imagePath && (
        <div style={s.card}>
          <div style={s.sectionLabel}>Image Preview</div>
          <img
            src={loadedContent.current.picture.imagePath}
            alt="Test"
            style={s.previewImage}
          />
        </div>
      )}

      {/* Summary banner */}
      {runnerState === 'done' && (
        <div style={{
          ...s.summaryBanner,
          backgroundColor: allPass ? '#E8F5E9' : '#FFF3E0',
          borderColor: allPass ? '#4CAF50' : '#FF9800',
        }}>
          <div style={{ ...s.summaryIcon, color: allPass ? '#2E7D32' : '#E65100' }}>
            {allPass ? '✓' : '!'}
          </div>
          <div>
            <div style={{ ...s.summaryTitle, color: allPass ? '#2E7D32' : '#E65100' }}>
              {allPass ? 'All tests passed' : anyFail ? `${failCount} test${failCount > 1 ? 's' : ''} failed` : 'Tests complete'}
            </div>
            <div style={s.summaryDetail}>
              {passCount} passed · {failCount} failed
            </div>
          </div>
        </div>
      )}

      {/* Action button */}
      {runnerState === 'idle' && (
        <button style={s.runBtn} onClick={runTests}>
          Run Tests
        </button>
      )}
      {runnerState === 'running' && (
        <button style={{ ...s.runBtn, ...s.runBtnDisabled }} disabled>
          Running...
        </button>
      )}
      {runnerState === 'done' && (
        <button style={s.runBtn} onClick={runTests}>
          Run Again
        </button>
      )}
      </div>
    </>
  );
}

// --- StepRow ---

function StepRow({ step, index }: { step: Step; index: number }) {
  const statusColor =
    step.status === 'pass' ? '#4CAF50' :
    step.status === 'fail' ? '#F44336' :
    step.status === 'running' ? '#1565C0' : '#BDBDBD';

  const statusIcon =
    step.status === 'pass' ? '✓' :
    step.status === 'fail' ? '✗' :
    step.status === 'running' ? '◌' : '○';

  return (
    <div style={{
      ...s.stepRow,
      borderTop: index === 0 ? 'none' : '1px solid #F5F5F5',
    }}>
      <div style={{ ...s.stepIndex, color: statusColor }}>
        {step.status === 'running'
          ? <SpinnerIcon color={statusColor} />
          : <span style={{ fontSize: 18, fontWeight: 700 }}>{statusIcon}</span>
        }
      </div>
      <div style={s.stepBody}>
        <div style={s.stepLabel}>{step.label}</div>
        {step.detail && (
          <div style={{
            ...s.stepDetail,
            color: step.status === 'fail' ? '#F44336' : '#888',
          }}>
            {step.detail}
          </div>
        )}
      </div>
      <div style={{ ...s.stepStatus, color: statusColor }}>
        {step.status === 'pass' ? 'PASS' :
         step.status === 'fail' ? 'FAIL' :
         step.status === 'running' ? '...' : '—'}
      </div>
    </div>
  );
}

// --- Simple CSS spinner via SVG ---

function SpinnerIcon({ color }: { color: string }) {
  return (
    <svg
      width="18" height="18"
      viewBox="0 0 18 18"
      style={{ animation: 'spin 1s linear infinite', display: 'block' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="9" cy="9" r="7" fill="none" stroke="#E0E0E0" strokeWidth="2" />
      <path d="M9 2 A7 7 0 0 1 16 9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '16px 16px 32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  notice: {
    fontSize: 13,
    color: '#666',
    lineHeight: 1.5,
    margin: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#AAA',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  stepIndex: {
    width: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#222',
  },
  stepDetail: {
    fontSize: 12,
    marginTop: 2,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stepStatus: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  gestureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  gestureIcon: {
    fontSize: 28,
    flexShrink: 0,
  },
  gestureTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#222',
  },
  gestureSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  tapBtn: {
    marginLeft: 'auto',
    padding: '10px 16px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#1565C0',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  previewImage: {
    display: 'block',
    width: '100%',
    borderRadius: 8,
  },
  summaryBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    border: '1.5px solid',
  },
  summaryIcon: {
    fontSize: 28,
    fontWeight: 700,
    flexShrink: 0,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: 700,
  },
  summaryDetail: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  runBtn: {
    display: 'block',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#1565C0',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.3,
  },
  runBtnDisabled: {
    backgroundColor: '#90A4AE',
    cursor: 'not-allowed',
  },
};

export default App;
