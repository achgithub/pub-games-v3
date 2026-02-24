import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = '/api';

interface Event {
  id: number;
  name: string;
  description: string;
  status: string;
  managerEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface Horse {
  id: number;
  eventId: number;
  name: string;
  createdAt: string;
}

interface Player {
  id: number;
  eventId: number;
  playerEmail: string;
  playerName: string;
  horseId?: number | null;
  horseName?: string | null;
  createdAt: string;
}

interface WinningPosition {
  id: number;
  eventId: number;
  position: string;
  createdAt: string;
}

interface Result {
  id: number;
  eventId: number;
  horseId: number;
  horseName: string;
  position: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportEntry {
  playerName: string;
  playerEmail: string;
  horseName: string;
  position: string;
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const [view, setView] = useState<'events' | 'setup' | 'results' | 'report'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [positions, setPositions] = useState<WinningPosition[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [report, setReport] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [newEventName, setNewEventName] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newHorseName, setNewHorseName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [resultAssignments, setResultAssignments] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      setError('Event name is required');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newEventName,
          description: newEventDescription,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create event');
        return;
      }

      setNewEventName('');
      setNewEventDescription('');
      setError('');
      fetchEvents();
    } catch (err) {
      setError('Network error');
    }
  };

  const handleSelectEvent = async (event: Event) => {
    setSelectedEvent(event);
    setView('setup');
    await fetchEventData(event.id);
  };

  const fetchEventData = async (eventId: number) => {
    setLoading(true);
    try {
      const [horsesRes, playersRes, positionsRes, resultsRes] = await Promise.all([
        fetch(`${API_BASE}/events/${eventId}/horses`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/events/${eventId}/players`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/events/${eventId}/positions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/events/${eventId}/results`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const horsesData = await horsesRes.json();
      const playersData = await playersRes.json();
      const positionsData = await positionsRes.json();
      const resultsData = await resultsRes.json();

      setHorses(horsesData || []);
      setPlayers(playersData || []);
      setPositions(positionsData || []);
      setResults(resultsData || []);

      // Build result assignments
      const assignments: Record<number, string> = {};
      (resultsData || []).forEach((r: Result) => {
        assignments[r.horseId] = r.position;
      });
      setResultAssignments(assignments);
    } catch (err) {
      console.error('Failed to fetch event data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHorse = async () => {
    if (!selectedEvent || !newHorseName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/events/${selectedEvent.id}/horses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newHorseName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add horse');
        return;
      }

      setNewHorseName('');
      setError('');
      fetchEventData(selectedEvent.id);
    } catch (err) {
      setError('Network error');
    }
  };

  const handleDeleteHorse = async (horseId: number) => {
    if (!window.confirm('Delete this horse?')) return;

    try {
      await fetch(`${API_BASE}/horses/${horseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (selectedEvent) fetchEventData(selectedEvent.id);
    } catch (err) {
      console.error('Failed to delete horse:', err);
    }
  };

  const handleCreatePlayer = async () => {
    if (!selectedEvent || !newPlayerEmail.trim() || !newPlayerName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/events/${selectedEvent.id}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playerEmail: newPlayerEmail,
          playerName: newPlayerName,
          horseId: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add player');
        return;
      }

      setNewPlayerEmail('');
      setNewPlayerName('');
      setError('');
      fetchEventData(selectedEvent.id);
    } catch (err) {
      setError('Network error');
    }
  };

  const handleAssignHorse = async (playerId: number, horseId: number | null) => {
    if (!selectedEvent) return;

    try {
      await fetch(`${API_BASE}/players/${playerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ horseId }),
      });
      fetchEventData(selectedEvent.id);
    } catch (err) {
      console.error('Failed to assign horse:', err);
    }
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!window.confirm('Delete this player?')) return;

    try {
      await fetch(`${API_BASE}/players/${playerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (selectedEvent) fetchEventData(selectedEvent.id);
    } catch (err) {
      console.error('Failed to delete player:', err);
    }
  };

  const handleCreatePosition = async () => {
    if (!selectedEvent || !newPosition.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/events/${selectedEvent.id}/positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ position: newPosition }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add position');
        return;
      }

      setNewPosition('');
      setError('');
      fetchEventData(selectedEvent.id);
    } catch (err) {
      setError('Network error');
    }
  };

  const handleDeletePosition = async (posId: number) => {
    if (!window.confirm('Delete this position?')) return;

    try {
      await fetch(`${API_BASE}/positions/${posId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (selectedEvent) fetchEventData(selectedEvent.id);
    } catch (err) {
      console.error('Failed to delete position:', err);
    }
  };

  const handleSaveResults = async () => {
    if (!selectedEvent) return;

    // Build results array
    const resultsArray = Object.entries(resultAssignments)
      .filter(([_, position]) => position)
      .map(([horseId, position]) => ({
        horseId: parseInt(horseId),
        position,
      }));

    try {
      const res = await fetch(`${API_BASE}/events/${selectedEvent.id}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ results: resultsArray }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save results');
        return;
      }

      setError('');
      alert('Results saved! Event is now completed.');
      fetchEventData(selectedEvent.id);
      fetchEvents(); // Refresh event status
      setView('report');
    } catch (err) {
      setError('Network error');
    }
  };

  const handleViewReport = async () => {
    if (!selectedEvent) return;

    try {
      const res = await fetch(`${API_BASE}/events/${selectedEvent.id}/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReport(data || []);
      setView('report');
    } catch (err) {
      console.error('Failed to fetch report:', err);
    }
  };

  const unassignedHorses = horses.filter(
    (h) => !players.some((p) => p.horseId === h.id)
  );

  return (
    <>
      {/* App Header Bar */}
      <div className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">🏇 Sweepstakes Knockout</h1>
        </div>
        <div className="ah-app-header-right">
          <button
            className="ah-lobby-btn"
            onClick={() => {
              window.location.href = `http://${window.location.hostname}:3001`;
            }}
          >
            ← Lobby
          </button>
        </div>
      </div>

      <div className="ah-container ah-container--wide">
        {error && <div className="ah-banner ah-banner--error">{error}</div>}

        {!selectedEvent && (
          <>
            <h2>Events</h2>

            <div className="ah-card" style={{ marginBottom: 20 }}>
              <h3 className="ah-section-title">Create New Event</h3>
              <input
                type="text"
                className="ah-input"
                placeholder="Event name (e.g., Grand National 2026)"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
              />
              <textarea
                className="ah-input"
                placeholder="Description (optional)"
                value={newEventDescription}
                onChange={(e) => setNewEventDescription(e.target.value)}
                style={{ marginTop: 8 }}
                rows={3}
              />
              <button className="ah-btn-primary" onClick={handleCreateEvent} style={{ marginTop: 12 }}>
                Create Event
              </button>
            </div>

            {events.length === 0 && (
              <div className="ah-banner ah-banner--info">No events yet. Create one above.</div>
            )}

            {events.map((event) => (
              <div key={event.id} className="ah-card" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => handleSelectEvent(event)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{event.name}</h3>
                    {event.description && <p style={{ margin: '4px 0 0', color: '#78716C' }}>{event.description}</p>}
                  </div>
                  <span className={`ah-status ah-status--${event.status === 'completed' ? 'active' : 'waiting'}`}>
                    {event.status}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {selectedEvent && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="ah-btn-back" onClick={() => { setSelectedEvent(null); setView('events'); }}>
                ← Back to Events
              </button>
              <h2 style={{ margin: 0 }}>{selectedEvent.name}</h2>
              <span className={`ah-status ah-status--${selectedEvent.status === 'completed' ? 'active' : 'waiting'}`}>
                {selectedEvent.status}
              </span>
            </div>

            <div className="ah-tabs">
              <button className={`ah-tab ${view === 'setup' ? 'active' : ''}`} onClick={() => setView('setup')}>
                Setup
              </button>
              <button className={`ah-tab ${view === 'results' ? 'active' : ''}`} onClick={() => setView('results')}>
                Results
              </button>
              <button className={`ah-tab ${view === 'report' ? 'active' : ''}`} onClick={() => { setView('report'); handleViewReport(); }}>
                Report
              </button>
            </div>

            {view === 'setup' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
                {/* Horses */}
                <div className="ah-card">
                  <h3 className="ah-section-title">Horses</h3>
                  <input
                    type="text"
                    className="ah-input"
                    placeholder="Horse name"
                    value={newHorseName}
                    onChange={(e) => setNewHorseName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateHorse()}
                  />
                  <button className="ah-btn-primary" onClick={handleCreateHorse} style={{ marginTop: 8 }}>
                    Add Horse
                  </button>

                  <div className="horse-list">
                    {horses.map((horse) => (
                      <div key={horse.id} className="horse-item">
                        <span>{horse.name}</span>
                        <button className="ah-btn-danger" onClick={() => handleDeleteHorse(horse.id)}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Players */}
                <div className="ah-card">
                  <h3 className="ah-section-title">Players</h3>
                  <input
                    type="email"
                    className="ah-input"
                    placeholder="Player email"
                    value={newPlayerEmail}
                    onChange={(e) => setNewPlayerEmail(e.target.value)}
                  />
                  <input
                    type="text"
                    className="ah-input"
                    placeholder="Player name"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                  <button className="ah-btn-primary" onClick={handleCreatePlayer} style={{ marginTop: 8 }}>
                    Add Player
                  </button>

                  <div className="player-list">
                    {players.map((player) => (
                      <div key={player.id} className="player-item">
                        <div>
                          <div><strong>{player.playerName}</strong></div>
                          <div style={{ fontSize: '14px', color: '#78716C' }}>{player.playerEmail}</div>
                          <select
                            className="ah-select"
                            value={player.horseId || ''}
                            onChange={(e) => handleAssignHorse(player.id, e.target.value ? parseInt(e.target.value) : null)}
                            style={{ marginTop: 8, width: '100%' }}
                          >
                            <option value="">Not assigned</option>
                            {player.horseId && player.horseName && (
                              <option value={player.horseId}>{player.horseName}</option>
                            )}
                            {unassignedHorses.map((h) => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                        </div>
                        <button className="ah-btn-danger" onClick={() => handleDeletePlayer(player.id)}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Winning Positions */}
                <div className="ah-card" style={{ gridColumn: '1 / -1' }}>
                  <h3 className="ah-section-title">Winning Positions</h3>
                  <p className="ah-meta">Add positions that pay out (e.g., 1, 2, 3, last)</p>
                  <input
                    type="text"
                    className="ah-input"
                    placeholder="Position (e.g., 1, 2, 3, last)"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePosition()}
                  />
                  <button className="ah-btn-primary" onClick={handleCreatePosition} style={{ marginTop: 8 }}>
                    Add Position
                  </button>

                  <div className="position-list">
                    {positions.map((pos) => (
                      <div key={pos.id} className="position-item">
                        <span><strong>{pos.position}</strong></span>
                        <button className="ah-btn-danger" onClick={() => handleDeletePosition(pos.id)}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'results' && (
              <div style={{ marginTop: 20 }}>
                <div className="ah-card">
                  <h3 className="ah-section-title">Assign Positions to Horses</h3>
                  <p className="ah-meta">
                    Assign each horse to a finishing position. You must assign all winning positions before saving.
                  </p>

                  <div className="result-grid">
                    {horses.map((horse) => (
                      <div key={horse.id} className={`result-card ${resultAssignments[horse.id] ? 'assigned' : ''}`}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>{horse.name}</div>
                        <select
                          className="ah-select"
                          value={resultAssignments[horse.id] || ''}
                          onChange={(e) => setResultAssignments({ ...resultAssignments, [horse.id]: e.target.value })}
                          style={{ width: '100%' }}
                        >
                          <option value="">Select position</option>
                          {positions.map((pos) => (
                            <option key={pos.id} value={pos.position}>{pos.position}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <button className="ah-btn-primary" onClick={handleSaveResults} style={{ marginTop: 20 }}>
                    Save Results
                  </button>
                </div>
              </div>
            )}

            {view === 'report' && (
              <div style={{ marginTop: 20 }}>
                <div className="ah-card">
                  <h3 className="ah-section-title">Winners</h3>

                  {report.length === 0 && selectedEvent.status !== 'completed' && (
                    <div className="ah-banner ah-banner--info">Results not yet saved.</div>
                  )}

                  {report.length === 0 && selectedEvent.status === 'completed' && (
                    <div className="ah-banner ah-banner--info">No winners (no horses finished in winning positions).</div>
                  )}

                  {report.length > 0 && (
                    <table className="ah-table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Email</th>
                          <th>Horse</th>
                          <th>Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.map((entry, idx) => (
                          <tr key={idx}>
                            <td><strong>{entry.playerName}</strong></td>
                            <td>{entry.playerEmail}</td>
                            <td>{entry.horseName}</td>
                            <td>
                              <span className="winner-badge">{entry.position}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default App;
