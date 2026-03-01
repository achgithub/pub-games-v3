import React, { useState, useEffect } from 'react';

const API_BASE = window.location.origin;

interface Activity {
  userEmail: string;
  userName: string;
  action: string;
  counterValue: number;
  createdAt: string;
}

interface Props {
  token: string;
}

function InteractiveDemo({ token }: Props) {
  const [counter, setCounter] = useState<number>(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [incrementing, setIncrementing] = useState(false);

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
      setCounter(data.counter);
    } catch (err) {
      console.error('Failed to increment:', err);
    }
    setIncrementing(false);
  };

  if (loading) {
    return (
      <div className="ah-card">
        <p className="ah-meta">Loading demo...</p>
      </div>
    );
  }

  return (
    <>
      <div className="ah-card">
        <h2>Interactive Demo</h2>
        <p className="ah-meta">
          This tab demonstrates the full Activity Hub stack: PostgreSQL, Redis,
          SSE, and real-time updates. All other tabs showcase CSS components.
        </p>
      </div>

      {/* Counter Card */}
      <div className="ah-card">
        <h3 className="ah-section-title">Global Counter (Redis)</h3>
        <div className="counter-display">
          <div className="counter-value">{counter}</div>
          <p className="ah-meta">
            Counter value stored in Redis, updates broadcast via SSE
          </p>
        </div>
        <button
          className="ah-btn-primary full-width"
          onClick={handleIncrement}
          disabled={incrementing}
        >
          {incrementing ? 'Incrementing...' : '+ Increment Counter'}
        </button>
      </div>

      {/* Activity Log Card */}
      <div className="ah-card">
        <h3 className="ah-section-title">Recent Activity (PostgreSQL)</h3>
        {activities.length === 0 ? (
          <p className="ah-meta">No activity yet. Be the first to increment!</p>
        ) : (
          <div className="activity-list">
            {activities.map((activity, idx) => (
              <div key={idx} className="activity-item">
                <div className="activity-user">
                  {activity.userName} → {activity.counterValue}
                </div>
                <div className="activity-time">
                  {new Date(activity.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tech Stack Info */}
      <div className="ah-card">
        <h3 className="ah-section-title">Tech Stack</h3>
        <ul className="tech-stack-list">
          <li>
            <strong>Frontend:</strong> React + TypeScript
          </li>
          <li>
            <strong>CSS:</strong> Shared Activity Hub CSS (loaded dynamically)
          </li>
          <li>
            <strong>Backend:</strong> Go with activity-hub-common library
          </li>
          <li>
            <strong>Auth:</strong> JWT tokens from identity-shell
          </li>
          <li>
            <strong>Real-time:</strong> Server-Sent Events (SSE)
          </li>
          <li>
            <strong>Ephemeral state:</strong> Redis (counter)
          </li>
          <li>
            <strong>Persistent data:</strong> PostgreSQL (activity log)
          </li>
          <li>
            <strong>Pub/Sub:</strong> Redis channels for SSE broadcast
          </li>
        </ul>
      </div>
    </>
  );
}

export default InteractiveDemo;
