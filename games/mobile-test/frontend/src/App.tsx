import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- Types ---

interface TestQuestion {
  id: number;
  text: string;
  answer: string;
  type: string;
  imagePath: string;
  audioPath: string;
}

type PanelStatus = 'loading' | 'pass' | 'fail' | 'idle';

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
      };
      const res = await fetch(path, { ...options, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [token]
  );
}

// --- Main App ---

function App() {
  const { userId, token } = useUrlParams();
  const api = useApi(token);

  const [content, setContent] = useState<{
    text: TestQuestion | null;
    picture: TestQuestion | null;
    music: TestQuestion | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Panel statuses
  const [textStatus, setTextStatus] = useState<PanelStatus>('idle');
  const [imageStatus, setImageStatus] = useState<PanelStatus>('loading');
  const [audioStatus, setAudioStatus] = useState<PanelStatus>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api('/api/test-content')
      .then(data => {
        setContent(data);
        setTextStatus(data.text ? 'pass' : 'fail');
        setImageStatus(data.picture?.imagePath ? 'loading' : 'fail');
        setAudioStatus(data.music?.audioPath ? 'idle' : 'fail');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [api, token]);

  const playAudio = () => {
    if (!content?.music?.audioPath || !audioRef.current) return;
    setAudioStatus('loading');
    audioRef.current.src = content.music.audioPath;
    audioRef.current.play()
      .then(() => setAudioStatus('pass'))
      .catch(() => setAudioStatus('fail'));
  };

  if (!userId || !token) {
    return (
      <div style={s.container}>
        <h2 style={s.title}>Mobile Test</h2>
        <p style={s.muted}>Access this app through the lobby.</p>
      </div>
    );
  }

  if (loading) return <div style={s.container}><p style={s.muted}>Loading...</p></div>;

  if (error) return (
    <div style={s.container}>
      <h2 style={s.title}>Mobile Test</h2>
      <div style={s.errorBanner}>{error}</div>
    </div>
  );

  return (
    <div style={s.container}>
      <h2 style={s.title}>Mobile Media Test</h2>
      <p style={s.muted}>Verify media works correctly on this device/browser.</p>

      {/* Text panel */}
      <Panel
        title="Text"
        status={textStatus}
        description="Checks that text questions render correctly."
      >
        {content?.text ? (
          <p style={s.questionText}>{content.text.text}</p>
        ) : (
          <p style={s.noContent}>No test text question found. Mark a question as "test content" in Game Admin.</p>
        )}
      </Panel>

      {/* Image panel */}
      <Panel
        title="Image"
        status={imageStatus}
        description="Checks that images load and display on this device."
      >
        {content?.picture?.imagePath ? (
          <img
            src={content.picture.imagePath}
            alt="Test"
            style={s.testImage}
            onLoad={() => setImageStatus('pass')}
            onError={() => setImageStatus('fail')}
          />
        ) : (
          <p style={s.noContent}>No test picture question found. Add a question with an image and mark as "test content".</p>
        )}
      </Panel>

      {/* Audio panel */}
      <Panel
        title="Audio"
        status={audioStatus}
        description="Checks that audio plays on this device. Tap the button to test."
      >
        <audio ref={audioRef} style={{ display: 'none' }} onEnded={() => setAudioStatus('pass')} />
        {content?.music?.audioPath ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <button style={s.playBtn} onClick={playAudio} disabled={audioStatus === 'loading'}>
              {audioStatus === 'loading' ? '⏳ Loading...' : audioStatus === 'pass' ? '🔊 Playing' : '▶ Play Audio'}
            </button>
          </div>
        ) : (
          <p style={s.noContent}>No test music question found. Add a question with audio and mark as "test content".</p>
        )}
      </Panel>

      <div style={s.summary}>
        <SummaryItem label="Text" status={textStatus} />
        <SummaryItem label="Image" status={imageStatus} />
        <SummaryItem label="Audio" status={audioStatus} />
      </div>
    </div>
  );
}

// --- Panel component ---

function Panel({ title, status, description, children }: {
  title: string;
  status: PanelStatus;
  description: string;
  children: React.ReactNode;
}) {
  const statusIcon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : status === 'loading' ? '⏳' : '—';
  const statusColor = status === 'pass' ? '#4CAF50' : status === 'fail' ? '#F44336' : '#FF9800';

  return (
    <div style={{ ...s.panel, borderLeft: `4px solid ${statusColor}` }}>
      <div style={s.panelHeader}>
        <h3 style={s.panelTitle}>{title}</h3>
        <span style={{ fontSize: 20, color: statusColor, fontWeight: 700 }}>{statusIcon}</span>
      </div>
      <p style={s.panelDesc}>{description}</p>
      <div style={s.panelContent}>{children}</div>
    </div>
  );
}

// --- Summary item ---

function SummaryItem({ label, status }: { label: string; status: PanelStatus }) {
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '—';
  const color = status === 'pass' ? '#4CAF50' : status === 'fail' ? '#F44336' : '#999';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <span style={{ color, fontWeight: 700, fontSize: 18 }}>{icon}</span>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>
        {status === 'pass' ? 'OK' : status === 'fail' ? 'FAIL' : status === 'loading' ? 'Loading' : 'Not tested'}
      </span>
    </div>
  );
}

// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'inherit' },
  title: { fontSize: 20, fontWeight: 700, color: '#1565C0', marginBottom: 4 },
  muted: { color: '#777', fontSize: 13, marginBottom: 16 },
  errorBanner: { backgroundColor: '#FFEBEE', color: '#C62828', padding: 12, borderRadius: 8, fontSize: 13 },
  panel: { backgroundColor: 'white', borderRadius: 10, padding: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.07)', marginBottom: 12 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  panelTitle: { fontSize: 15, fontWeight: 700, color: '#333' },
  panelDesc: { fontSize: 12, color: '#888', marginBottom: 10 },
  panelContent: {},
  questionText: { fontSize: 16, color: '#222', lineHeight: 1.5 },
  testImage: { maxWidth: '100%', maxHeight: 200, borderRadius: 8, display: 'block', margin: '0 auto' },
  noContent: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  playBtn: { padding: '12px 24px', borderRadius: 8, border: 'none', backgroundColor: '#1565C0', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  summary: { backgroundColor: 'white', borderRadius: 10, padding: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 8 },
};

export default App;
