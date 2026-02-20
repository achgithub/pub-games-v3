import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

const API_BASE = window.location.origin;

interface Activity {
  userEmail: string;
  userName: string;
  action: string;
  counterValue: number;
  createdAt: string;
}

// Parse query params from URL
function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      userName: params.get('userName') || 'Unknown',
      token: params.get('token'),
    };
  }, []);
}

function App() {
  const { userId, userName, token } = useQueryParams();

  const [counter, setCounter] = useState<number>(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [incrementing, setIncrementing] = useState(false);

  // Must have userId and token
  if (!userId || !token) {
    return (
      <div className="ah-container ah-container--narrow" style={{ paddingTop: 40 }}>
        <div className="ah-card">
          <h2 style={{ marginBottom: 12 }}>🧪 Smoke Test</h2>
          <p className="ah-meta">
            Missing authentication. Please access this app through the Activity Hub.
          </p>
          <button
            className="ah-btn-primary"
            onClick={() => {
              window.location.href = `http://${window.location.hostname}:3001`;
            }}
            style={{ marginTop: 20 }}
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Fetch initial counter and activity
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch counter
        const counterRes = await fetch(`${API_BASE}/api/counter`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const counterData = await counterRes.json();
        setCounter(counterData.counter);

        // Fetch activity log
        const activityRes = await fetch(`${API_BASE}/api/activity`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const activityData = await activityRes.json();
        setActivities(activityData.activities || []);

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Setup SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(
      `${API_BASE}/api/events?token=${encodeURIComponent(token)}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'counter_update') {
          setCounter(data.counter);

          // Add to activity log (optimistic update)
          const newActivity: Activity = {
            userEmail: '',
            userName: data.user,
            action: 'increment',
            counterValue: data.counter,
            createdAt: new Date().toISOString(),
          };
          setActivities((prev) => [newActivity, ...prev].slice(0, 20));
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  // Increment counter
  const handleIncrement = async () => {
    setIncrementing(true);
    try {
      const res = await fetch(`${API_BASE}/api/counter/increment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Counter will update via SSE, but we can also update directly
      setCounter(data.counter);
    } catch (err) {
      console.error('Failed to increment:', err);
    }
    setIncrementing(false);
  };

  if (loading) {
    return (
      <div className="ah-container ah-container--narrow" style={{ paddingTop: 40 }}>
        <div className="ah-card">
          <p className="ah-meta">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ah-container ah-container--narrow" style={{ paddingTop: 20 }}>
      {/* Header */}
      <div className="ah-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>🧪 Smoke Test</h2>
          <button
            className="ah-lobby-btn"
            onClick={() => {
              window.location.href = `http://${window.location.hostname}:3001`;
            }}
          >
            ← Lobby
          </button>
        </div>
        <p className="ah-meta" style={{ margin: 0 }}>
          Welcome, {userName}! This app demonstrates the full Activity Hub stack.
        </p>
      </div>

      {/* Counter Card */}
      <div className="ah-card">
        <h3 className="ah-section-title">Global Counter (Redis)</h3>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: '#2196F3' }}>
            {counter}
          </div>
          <p className="ah-meta" style={{ marginTop: 8 }}>
            Counter value stored in Redis, updates broadcast via SSE
          </p>
        </div>
        <button
          className="ah-btn-primary"
          onClick={handleIncrement}
          disabled={incrementing}
          style={{ width: '100%' }}
        >
          {incrementing ? 'Incrementing...' : '+ Increment Counter'}
        </button>
      </div>

      {/* Activity Log Card */}
      <div className="ah-card" style={{ marginTop: 20 }}>
        <h3 className="ah-section-title">Recent Activity (PostgreSQL)</h3>
        {activities.length === 0 ? (
          <p className="ah-meta">No activity yet. Be the first to increment!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activities.map((activity, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  background: '#F5F5F4',
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                <div style={{ fontWeight: 500 }}>
                  {activity.userName} → {activity.counterValue}
                </div>
                <div className="ah-meta" style={{ fontSize: 12 }}>
                  {new Date(activity.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tech Stack Info */}
      <div className="ah-card" style={{ marginTop: 20 }}>
        <h3 className="ah-section-title">Tech Stack</h3>
        <ul style={{ marginLeft: 20, lineHeight: 1.8 }}>
          <li><strong>Frontend:</strong> React + TypeScript</li>
          <li><strong>CSS:</strong> Shared Activity Hub CSS (loaded dynamically)</li>
          <li><strong>Backend:</strong> Go with activity-hub-common library</li>
          <li><strong>Auth:</strong> JWT tokens from identity-shell</li>
          <li><strong>Real-time:</strong> Server-Sent Events (SSE)</li>
          <li><strong>Ephemeral state:</strong> Redis (counter)</li>
          <li><strong>Persistent data:</strong> PostgreSQL (activity log)</li>
          <li><strong>Pub/Sub:</strong> Redis channels for SSE broadcast</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
