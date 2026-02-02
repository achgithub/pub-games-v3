import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './App.css';

interface Competition {
  id: number;
  name: string;
  type: 'knockout' | 'race';
  status: 'draft' | 'open' | 'locked' | 'completed' | 'archived';
  description?: string;
  start_date?: string;
  end_date?: string;
}

interface Entry {
  id: number;
  competition_id: number;
  name: string;
  status: string;
  seed?: number;
  number?: number;
  position?: number;
}

interface Draw {
  id: number;
  user_id: number;
  competition_id: number;
  entry_id: number;
  entry_name: string;
  user_name: string;
  drawn_at: string;
  entry_status?: string;
  seed?: number;
  number?: number;
}

// Parse query params from URL
function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      userName: params.get('userName') || params.get('userId') || 'Player',
      gameId: params.get('gameId'),
    };
  }, []);
}

const API_BASE = window.location.origin;

function App() {
  const { userId, userName } = useQueryParams();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userDraws, setUserDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Must have userId to play
  if (!userId) {
    return (
      <div style={styles.container}>
        <h2>Sweepstakes</h2>
        <p style={{ color: '#666', marginTop: 20 }}>
          Missing user information. Please access this app through the Identity Shell.
        </p>
        <button
          onClick={() => {
            const shellUrl = `http://${window.location.hostname}:3001`;
            window.location.href = shellUrl;
          }}
          style={styles.button}
        >
          Go to Identity Shell
        </button>
      </div>
    );
  }

  // Load competitions on mount
  useEffect(() => {
    loadCompetitions();
  }, []);

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/competitions`);
      setCompetitions(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load competitions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompetitionDetails = async (competition: Competition) => {
    try {
      setSelectedComp(competition);
      const [entriesRes, drawsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/competitions/${competition.id}/entries`),
        axios.get(`${API_BASE}/api/draws?user_id=${userId}&competition_id=${competition.id}`),
      ]);
      setEntries(entriesRes.data || []);
      setUserDraws(drawsRes.data || []);
    } catch (err) {
      setError('Failed to load competition details');
      console.error(err);
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading...</div>;
  }

  if (!selectedComp) {
    return (
      <div style={styles.container}>
        <h1>Sweepstakes</h1>
        <p>Welcome, {userName}!</p>
        {error && <div style={styles.error}>{error}</div>}
        {competitions.length === 0 ? (
          <p>No competitions available</p>
        ) : (
          <div style={styles.competitionsList}>
            {competitions.map((comp) => (
              <div key={comp.id} style={styles.competitionCard}>
                <h3>{comp.name}</h3>
                <p>Type: {comp.type}</p>
                <p>Status: {comp.status}</p>
                {comp.description && <p>{comp.description}</p>}
                <button
                  onClick={() => loadCompetitionDetails(comp)}
                  style={styles.button}
                >
                  View/Enter
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const userDraw = userDraws.length > 0 ? userDraws[0] : null;

  return (
    <div style={styles.container}>
      <button onClick={() => setSelectedComp(null)} style={styles.backButton}>
        ← Back
      </button>
      <h1>{selectedComp.name}</h1>
      <p>Welcome, {userName}!</p>
      {error && <div style={styles.error}>{error}</div>}

      {userDraw ? (
        <div style={styles.card}>
          <h2>Your Selection</h2>
          <p>
            <strong>Entry:</strong> {userDraw.entry_name}
          </p>
          {userDraw.seed && <p><strong>Seed:</strong> {userDraw.seed}</p>}
          {userDraw.number && <p><strong>Number:</strong> {userDraw.number}</p>}
          <p>
            <strong>Selected:</strong>{' '}
            {new Date(userDraw.drawn_at).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <div style={styles.card}>
          <p>You haven't selected an entry yet.</p>
        </div>
      )}

      <div style={styles.card}>
        <h2>Entries</h2>
        <div style={styles.entriesList}>
          {entries.length === 0 ? (
            <p>No entries</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} style={styles.entryItem}>
                <h4>{entry.name}</h4>
                <p>Status: {entry.status}</p>
                {entry.seed && <p>Seed: {entry.seed}</p>}
                {entry.number && <p>Number: {entry.number}</p>}
                {entry.position && <p>Position: {entry.position}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  competitionsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  competitionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  entriesList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '15px',
    marginTop: '15px',
  },
  entryItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    padding: '15px',
    border: '1px solid #e0e0e0',
  },
  button: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    fontSize: 16,
    fontWeight: 500,
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: '10px',
  } as React.CSSProperties,
  backButton: {
    background: '#666',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    fontSize: 14,
    borderRadius: 6,
    cursor: 'pointer',
    marginBottom: '20px',
  } as React.CSSProperties,
  error: {
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    padding: '12px',
    borderRadius: '4px',
    marginTop: '10px',
  },
};

export default App;
