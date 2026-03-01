import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = '/api';

// Parse query params
function useQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token') || '',
  };
}

// Types
interface Player {
  id: number;
  managerEmail: string;
  name: string;
  createdAt: string;
}

interface Competitor {
  id: number;
  managerEmail: string;
  name: string;
  createdAt: string;
}

interface Event {
  id: number;
  name: string;
  description: string;
  status: string;
  managerEmail: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
}

interface Participant {
  id: number;
  eventId: number;
  playerId: number;
  playerName: string;
  competitorId?: number | null;
  competitorName?: string | null;
}

interface Position {
  id: number;
  eventId: number;
  position: string;
}

interface ReportEntry {
  playerName: string;
  competitorName: string;
  position: string;
}

function App() {
  const { token } = useQueryParams();
  const [activeTab, setActiveTab] = useState<'setup' | 'games' | 'reports'>('games');

  // Report display mode (for screens - no auth)
  const [reportView, setReportView] = useState<string>('');
  const [displayEventId, setDisplayEventId] = useState<number>(0);
  const [displayEventName, setDisplayEventName] = useState<string>('');
  const [displayReportData, setDisplayReportData] = useState<ReportEntry[]>([]);

  // Setup tab state
  const [players, setPlayers] = useState<Player[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newCompetitorName, setNewCompetitorName] = useState('');

  // Games tab state
  const [events, setEvents] = useState<Event[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [newPosition, setNewPosition] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [showSelectedPlayersOnly, setShowSelectedPlayersOnly] = useState(false);
  const [resultAssignments, setResultAssignments] = useState<Record<number, string>>({});

  // Reports tab state
  const [reportEventId, setReportEventId] = useState<number>(0);
  const [reportData, setReportData] = useState<ReportEntry[]>([]);

  // Collapse state
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  const toggleCard = (cardName: string) => {
    setCollapsedCards({
      ...collapsedCards,
      [cardName]: !collapsedCards[cardName],
    });
  };

  // Check for report display mode from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const eventId = params.get('eventId');

    if (view === 'report' && eventId) {
      setReportView('report');
      setDisplayEventId(parseInt(eventId));
    }
  }, []);

  // Fetch display report data
  useEffect(() => {
    if (displayEventId === 0) return;

    const fetchDisplayReport = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/report/${displayEventId}`);
        const data = await res.json();
        setDisplayReportData(data || []);

        // Fetch event name
        const eventRes = await fetch(`${API_BASE}/api/events/${displayEventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setDisplayEventName(eventData.event?.name || 'Event Results');
        }
      } catch (err) {
        console.error('Failed to fetch display report:', err);
      }
    };

    fetchDisplayReport();
  }, [displayEventId, token]);

  // Fetch setup data
  useEffect(() => {
    if (!token || activeTab !== 'setup') return;

    const fetchSetupData = async () => {
      try {
        const [playersRes, competitorsRes] = await Promise.all([
          fetch(`${API_BASE}/players`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/competitors`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const playersData = await playersRes.json();
        const competitorsData = await competitorsRes.json();
        setPlayers(playersData.players || []);
        setCompetitors(competitorsData.competitors || []);
      } catch (err) {
        console.error('Failed to fetch setup data:', err);
      }
    };

    fetchSetupData();
  }, [token, activeTab]);

  // Fetch events
  useEffect(() => {
    if (!token || (activeTab !== 'games' && activeTab !== 'reports')) return;

    const fetchEvents = async () => {
      try {
        const res = await fetch(`${API_BASE}/events`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setEvents(data.events || []);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      }
    };

    fetchEvents();
  }, [token, activeTab]);

  // Fetch event details when selected
  useEffect(() => {
    if (!token || !selectedEventId) return;

    const fetchEventDetail = async () => {
      try {
        const res = await fetch(`${API_BASE}/events/${selectedEventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setParticipants(data.participants || []);
        setPositions(data.positions || []);

        // Fetch results
        const resultsRes = await fetch(`${API_BASE}/events/${selectedEventId}/results`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const resultsData = await resultsRes.json();
        const assignments: Record<number, string> = {};
        (resultsData || []).forEach((r: any) => {
          assignments[r.competitorId] = r.position;
        });
        setResultAssignments(assignments);
      } catch (err) {
        console.error('Failed to fetch event details:', err);
      }
    };

    fetchEventDetail();
  }, [token, selectedEventId]);

  // Fetch report
  useEffect(() => {
    if (!token || reportEventId === 0) return;

    const fetchReport = async () => {
      try {
        const res = await fetch(`${API_BASE}/events/${reportEventId}/report`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setReportData(data || []);
      } catch (err) {
        console.error('Failed to fetch report:', err);
      }
    };

    fetchReport();
  }, [token, reportEventId]);

  // Report display view (public access for screens)
  if (reportView === 'report' && displayEventId > 0) {
    const refreshDisplayReport = () => {
      fetch(`${API_BASE}/api/report/${displayEventId}`)
        .then(res => res.json())
        .then(data => setDisplayReportData(data || []))
        .catch(err => console.error('Failed to refresh display report:', err));
    };

    return (
      <>
        <div className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">🏇 {displayEventName}</h1>
          </div>
          <div className="ah-app-header-right">
            <button className="ah-btn-outline" onClick={refreshDisplayReport}>
              🔄 Refresh
            </button>
          </div>
        </div>

        <div className="ah-container ah-container--wide">
          <div className="ah-card">
            {displayReportData.length === 0 ? (
              <div className="ah-banner ah-banner--info">
                No results yet. Event may not be completed.
              </div>
            ) : (
              <table className="ah-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Player</th>
                    <th>Competitor</th>
                  </tr>
                </thead>
                <tbody>
                  {displayReportData.map((entry, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="winner-badge">{entry.position}</span>
                      </td>
                      <td>
                        <strong>{entry.playerName}</strong>
                      </td>
                      <td>{entry.competitorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </>
    );
  }

  // Setup tab handlers
  const handleCreatePlayer = async () => {
    if (!newPlayerName.trim()) return;

    try {
      await fetch(`${API_BASE}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newPlayerName }),
      });
      setNewPlayerName('');
      // Refetch players
      const res = await fetch(`${API_BASE}/players`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPlayers(data.players || []);
    } catch (err) {
      console.error('Failed to create player:', err);
    }
  };

  const handleDeletePlayer = async (id: number) => {
    if (!window.confirm('Delete this player?')) return;

    try {
      await fetch(`${API_BASE}/players/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlayers(players.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete player:', err);
    }
  };

  const handleCreateCompetitor = async () => {
    if (!newCompetitorName.trim()) return;

    try {
      await fetch(`${API_BASE}/competitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCompetitorName }),
      });
      setNewCompetitorName('');
      // Refetch competitors
      const res = await fetch(`${API_BASE}/competitors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCompetitors(data.competitors || []);
    } catch (err) {
      console.error('Failed to create competitor:', err);
    }
  };

  const handleDeleteCompetitor = async (id: number) => {
    if (!window.confirm('Delete this competitor?')) return;

    try {
      await fetch(`${API_BASE}/competitors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setCompetitors(competitors.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Failed to delete competitor:', err);
    }
  };

  // Games tab handlers
  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;

    try {
      await fetch(`${API_BASE}/events`, {
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
      setNewEventName('');
      setNewEventDescription('');
      // Refetch events
      const res = await fetch(`${API_BASE}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!window.confirm('Delete this event?')) return;

    try {
      await fetch(`${API_BASE}/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvents(events.filter((e) => e.id !== id));
      if (selectedEventId === id) {
        setSelectedEventId(null);
      }
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const handleSelectAllPlayers = () => {
    setSelectedPlayers(players.map((p) => p.id));
  };

  const handleDeselectAllPlayers = () => {
    setSelectedPlayers([]);
  };

  const handleTogglePlayerSelection = (playerId: number) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const handleAddParticipants = async () => {
    if (!selectedEventId || selectedPlayers.length === 0) return;

    try {
      await fetch(`${API_BASE}/events/${selectedEventId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerIds: selectedPlayers }),
      });
      setSelectedPlayers([]);
      // Refetch event details
      const res = await fetch(`${API_BASE}/events/${selectedEventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch (err) {
      console.error('Failed to add participants:', err);
    }
  };

  const handleAssignCompetitor = async (participantId: number, competitorId: number | null) => {
    try {
      await fetch(`${API_BASE}/participants/${participantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ competitorId }),
      });
      // Refetch event details
      if (selectedEventId) {
        const res = await fetch(`${API_BASE}/events/${selectedEventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error('Failed to assign competitor:', err);
    }
  };

  const handleRemoveParticipant = async (participantId: number) => {
    if (!window.confirm('Remove this participant?')) return;

    try {
      await fetch(`${API_BASE}/participants/${participantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setParticipants(participants.filter((p) => p.id !== participantId));
    } catch (err) {
      console.error('Failed to remove participant:', err);
    }
  };

  const handleCreatePosition = async () => {
    if (!selectedEventId || !newPosition.trim()) return;

    try {
      await fetch(`${API_BASE}/events/${selectedEventId}/positions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ position: newPosition }),
      });
      setNewPosition('');
      // Refetch event details
      const res = await fetch(`${API_BASE}/events/${selectedEventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPositions(data.positions || []);
    } catch (err) {
      console.error('Failed to create position:', err);
    }
  };

  const handleDeletePosition = async (positionId: number) => {
    if (!window.confirm('Delete this position?')) return;

    try {
      await fetch(`${API_BASE}/positions/${positionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setPositions(positions.filter((p) => p.id !== positionId));
    } catch (err) {
      console.error('Failed to delete position:', err);
    }
  };

  const handleSaveResults = async () => {
    if (!selectedEventId) return;

    const results = Object.entries(resultAssignments)
      .filter(([_, position]) => position)
      .map(([competitorId, position]) => ({
        competitorId: parseInt(competitorId),
        position,
      }));

    try {
      await fetch(`${API_BASE}/events/${selectedEventId}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ results }),
      });
      alert('Results saved! Event completed.');
      // Refetch events to update status
      const res = await fetch(`${API_BASE}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to save results:', err);
    }
  };

  // Get unassigned competitors for a participant dropdown
  const getAvailableCompetitors = (currentCompetitorId?: number | null) => {
    const assignedCompetitorIds = participants
      .filter((p) => p.competitorId && p.competitorId !== currentCompetitorId)
      .map((p) => p.competitorId);
    return competitors.filter((h) => !assignedCompetitorIds.includes(h.id));
  };

  // Get players not yet in event
  const getAvailablePlayers = () => {
    const participantPlayerIds = participants.map((p) => p.playerId);
    return players.filter((p) => !participantPlayerIds.includes(p.id));
  };

  // Get available positions for results dropdown
  const getAvailablePositions = (currentCompetitorId: number) => {
    const assignedPositions = Object.entries(resultAssignments)
      .filter(([competitorId, _]) => parseInt(competitorId) !== currentCompetitorId)
      .map(([_, position]) => position);
    return positions.filter((pos) => !assignedPositions.includes(pos.position));
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <>
      {/* App Header */}
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

      <div className="ah-container">
        {/* Tabs */}
        <div className="ah-tabs">
          <button
            className={`ah-tab ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            Setup
          </button>
          <button
            className={`ah-tab ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            Games
          </button>
          <button
            className={`ah-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
        </div>

        {/* SETUP TAB */}
        {activeTab === 'setup' && (
          <div>
            {/* Player Pool */}
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => toggleCard('players')}>
                <h3 className="ah-section-title">Player Pool ({players.length})</h3>
                <span className={`ah-section-toggle ${collapsedCards['players'] ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedCards['players'] && (
                <>
                  <div className="ah-inline-form">
                    <input
                      type="text"
                      className="ah-input"
                      placeholder="Player name"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreatePlayer()}
                    />
                    <button className="ah-btn-primary" onClick={handleCreatePlayer}>
                      Add Player
                    </button>
                  </div>

                  <div className="ah-list">
                    {players.length === 0 && (
                      <p className="ah-meta">No players yet. Add one to get started.</p>
                    )}
                    {players.map((player) => (
                      <div key={player.id} className="ah-list-item">
                        <strong>{player.name}</strong>
                        <button
                          className="ah-btn-danger-sm"
                          onClick={() => handleDeletePlayer(player.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Competitor Pool */}
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => toggleCard('competitors')}>
                <h3 className="ah-section-title">Competitor Pool ({competitors.length})</h3>
                <span className={`ah-section-toggle ${collapsedCards['competitors'] ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedCards['competitors'] && (
                <>
                  <div className="ah-inline-form">
                    <input
                      type="text"
                      className="ah-input"
                      placeholder="Competitor name"
                      value={newCompetitorName}
                      onChange={(e) => setNewCompetitorName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateCompetitor()}
                    />
                    <button className="ah-btn-primary" onClick={handleCreateCompetitor}>
                      Add Competitor
                    </button>
                  </div>

                  <div className="ah-list">
                    {competitors.length === 0 && (
                      <p className="ah-meta">No competitors yet. Add one to get started.</p>
                    )}
                    {competitors.map((competitor) => (
                      <div key={competitor.id} className="ah-list-item">
                        <strong>{competitor.name}</strong>
                        <button
                          className="ah-btn-danger-sm"
                          onClick={() => handleDeleteCompetitor(competitor.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* GAMES TAB */}
        {activeTab === 'games' && (
          <div>
            {!selectedEventId && (
              <>
                {/* Create Event Card */}
                <div className="ah-card ah-section">
                  <div className="ah-section-header" onClick={() => toggleCard('createEvent')}>
                    <h3 className="ah-section-title">CREATE NEW EVENT</h3>
                    <span className={`ah-section-toggle ${collapsedCards['createEvent'] ? 'collapsed' : ''}`}>▼</span>
                  </div>

                  {!collapsedCards['createEvent'] && (
                    <div className="event-form">
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
                        rows={3}
                      />
                      <button
                        className="ah-btn-primary"
                        onClick={handleCreateEvent}
                      >
                        Create Event
                      </button>
                    </div>
                  )}
                </div>

                {/* Active Events */}
                <div className="ah-card ah-section">
                  <div className="ah-section-header" onClick={() => toggleCard('activeEvents')}>
                    <h3 className="ah-section-title">ACTIVE EVENTS ({events.filter(e => e.status !== 'completed').length})</h3>
                    <span className={`ah-section-toggle ${collapsedCards['activeEvents'] ? 'collapsed' : ''}`}>▼</span>
                  </div>

                  {!collapsedCards['activeEvents'] && (
                    <>
                      {events.filter(e => e.status !== 'completed').length === 0 && (
                        <p className="ah-meta">No active events. Create one above.</p>
                      )}
                      <div className="ah-list">
                        {events.filter(e => e.status !== 'completed').map((event) => (
                          <div key={event.id} className="ah-card event-item" onClick={() => setSelectedEventId(event.id)}>
                            <div className="ah-flex-between">
                              <div>
                                <h4 className="event-name">{event.name}</h4>
                                {event.description && <p className="ah-meta">{event.description}</p>}
                                <p className="ah-meta">{event.participantCount} participants</p>
                              </div>
                              <span className="ah-status ah-status--waiting">{event.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Completed Events */}
                {events.filter(e => e.status === 'completed').length > 0 && (
                  <div className="ah-card ah-section">
                    <div className="ah-section-header" onClick={() => toggleCard('completedEvents')}>
                      <h3 className="ah-section-title">COMPLETED EVENTS ({events.filter(e => e.status === 'completed').length})</h3>
                      <span className={`ah-section-toggle ${collapsedCards['completedEvents'] ? 'collapsed' : ''}`}>▼</span>
                    </div>

                    {!collapsedCards['completedEvents'] && (
                      <div className="ah-list">
                        {events.filter(e => e.status === 'completed').map((event) => (
                          <div key={event.id} className="ah-card event-item" onClick={() => setSelectedEventId(event.id)}>
                            <div className="ah-flex-between">
                              <div>
                                <h4 className="event-name">{event.name}</h4>
                                {event.description && <p className="ah-meta">{event.description}</p>}
                              </div>
                              <span className="ah-status ah-status--active">{event.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Event Detail View */}
            {selectedEventId && selectedEvent && (
              <>
                <div className="ah-detail-header">
                  <button className="ah-btn-back" onClick={() => setSelectedEventId(null)}>
                    ← Back to Events
                  </button>
                  <h2 className="event-detail-title">{selectedEvent.name}</h2>
                  <span className={`ah-status ah-status--${selectedEvent.status === 'completed' ? 'active' : 'waiting'}`}>
                    {selectedEvent.status}
                  </span>
                  <button
                    className="ah-btn-danger"
                    onClick={() => handleDeleteEvent(selectedEventId)}
                  >
                    Delete Event
                  </button>
                </div>

                <div className="ah-card">
                  <p className="ah-meta">
                    <strong>Event ID:</strong> {selectedEventId}
                  </p>
                  <p className="ah-meta" style={{ marginTop: '0.5rem' }}>
                    <strong>Display URL:</strong>
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                    <input
                      type="text"
                      className="ah-input"
                      value={`http://${window.location.hostname}:4032/?view=report&eventId=${selectedEventId}`}
                      readOnly
                      style={{ flex: 1 }}
                    />
                    <button
                      className="ah-btn-outline"
                      onClick={() => {
                        const url = `http://${window.location.hostname}:4032/?view=report&eventId=${selectedEventId}`;
                        navigator.clipboard.writeText(url);
                        alert('Display URL copied to clipboard!');
                      }}
                    >
                      Copy URL
                    </button>
                  </div>
                </div>

                {/* Participants */}
                <div className="ah-card ah-section">
                  <div className="ah-section-header" onClick={() => toggleCard('participants')}>
                    <h3 className="ah-section-title">Participants ({participants.length})</h3>
                    <span className={`ah-section-toggle ${collapsedCards['participants'] ? 'collapsed' : ''}`}>▼</span>
                  </div>

                  {!collapsedCards['participants'] && (
                    <>
                      <div className="add-players-section">
                        <div style={{ marginBottom: '0.75rem' }}>
                          <p className="ah-meta">
                            Select Players ({selectedPlayers.length} selected):
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button className="ah-btn-outline" onClick={handleSelectAllPlayers} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                              Select All
                            </button>
                            <button className="ah-btn-outline" onClick={handleDeselectAllPlayers} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                              Deselect All
                            </button>
                            <button
                              className="ah-btn-primary"
                              onClick={handleAddParticipants}
                              disabled={selectedPlayers.length === 0}
                              style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', marginLeft: 'auto' }}
                            >
                              Add Selected Players
                            </button>
                          </div>
                        </div>

                        {/* Player filters */}
                        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#FAFAF9', borderRadius: '8px', border: '1px solid #E7E5E4' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              placeholder="Search players by name..."
                              value={playerSearch}
                              onChange={(e) => setPlayerSearch(e.target.value)}
                              className="ah-input"
                              style={{ flex: '1 1 200px', minWidth: 0 }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                              <input
                                type="checkbox"
                                checked={showSelectedPlayersOnly}
                                onChange={(e) => setShowSelectedPlayersOnly(e.target.checked)}
                              />
                              <span>Selected only</span>
                            </label>
                          </div>
                        </div>

                        <div className="player-selection-grid">
                          {getAvailablePlayers().filter((player) => {
                            // Text search filter
                            const matchesSearch = !playerSearch ||
                              player.name.toLowerCase().includes(playerSearch.toLowerCase());

                            // Selected filter
                            const matchesSelected = !showSelectedPlayersOnly ||
                              selectedPlayers.includes(player.id);

                            return matchesSearch && matchesSelected;
                          }).map((player) => (
                            <label key={player.id} className="player-checkbox-label">
                              <input
                                type="checkbox"
                                checked={selectedPlayers.includes(player.id)}
                                onChange={() => handleTogglePlayerSelection(player.id)}
                              />
                              <span>{player.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="ah-list">
                        {participants.length === 0 && (
                          <p className="ah-meta">No participants yet. Add players above.</p>
                        )}
                        {participants.map((participant) => (
                          <div key={participant.id} className="ah-list-item">
                            <div className="participant-info">
                              <strong>{participant.playerName}</strong>
                              <select
                                className="ah-select"
                                value={participant.competitorId || ''}
                                onChange={(e) =>
                                  handleAssignCompetitor(
                                    participant.id,
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                              >
                                <option value="">Not assigned</option>
                                {participant.competitorId && participant.competitorName && (
                                  <option value={participant.competitorId}>{participant.competitorName}</option>
                                )}
                                {getAvailableCompetitors(participant.competitorId).map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              className="ah-btn-danger-sm"
                              onClick={() => handleRemoveParticipant(participant.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Winning Positions */}
                <div className="ah-card ah-section">
                  <div className="ah-section-header" onClick={() => toggleCard('positions')}>
                    <h3 className="ah-section-title">Winning Positions ({positions.length})</h3>
                    <span className={`ah-section-toggle ${collapsedCards['positions'] ? 'collapsed' : ''}`}>▼</span>
                  </div>

                  {!collapsedCards['positions'] && (
                    <>
                      <p className="ah-meta">
                        Add positions that pay out (e.g., 1, 2, 3, last)
                      </p>
                      <div className="ah-inline-form">
                        <input
                          type="text"
                          className="ah-input"
                          placeholder="Position (e.g., 1, 2, 3, last)"
                          value={newPosition}
                          onChange={(e) => setNewPosition(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleCreatePosition()}
                        />
                        <button className="ah-btn-primary" onClick={handleCreatePosition}>
                          Add Position
                        </button>
                      </div>

                      <div className="ah-list">
                        {positions.map((pos) => (
                          <div key={pos.id} className="ah-list-item">
                            <span>
                              <strong>{pos.position}</strong>
                            </span>
                            <button
                              className="ah-btn-danger"
                              onClick={() => handleDeletePosition(pos.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Results */}
                <div className="ah-card ah-section">
                  <div className="ah-section-header" onClick={() => toggleCard('results')}>
                    <h3 className="ah-section-title">Results</h3>
                    <span className={`ah-section-toggle ${collapsedCards['results'] ? 'collapsed' : ''}`}>▼</span>
                  </div>

                  {!collapsedCards['results'] && (
                    <>
                      <p className="ah-meta">
                        Assign finishing positions to competitors. All winning positions must be assigned.
                      </p>

                      <div className="ah-grid-auto">
                        {participants
                          .filter((p) => p.competitorId)
                          .map((participant) => {
                            const availablePos = getAvailablePositions(participant.competitorId!);
                            return (
                              <div
                                key={participant.id}
                                className={`ah-card result-card ${
                                  resultAssignments[participant.competitorId!] ? 'assigned' : ''
                                }`}
                              >
                                <div className="result-card-competitor">
                                  {participant.competitorName}
                                </div>
                                <div className="ah-meta">
                                  {participant.playerName}
                                </div>
                                <select
                                  className="ah-select"
                                  value={resultAssignments[participant.competitorId!] || ''}
                                  onChange={(e) =>
                                    setResultAssignments({
                                      ...resultAssignments,
                                      [participant.competitorId!]: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Select position</option>
                                  {availablePos.map((pos) => (
                                    <option key={pos.id} value={pos.position}>
                                      {pos.position}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                      </div>

                      <button
                        className="ah-btn-primary save-results-btn"
                        onClick={handleSaveResults}
                      >
                        Save Results & Complete Event
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="ah-card">
            <h3 className="ah-section-title">Event Report</h3>

            <select
              className="ah-select report-select"
              value={reportEventId}
              onChange={(e) => setReportEventId(parseInt(e.target.value))}
            >
              <option value={0}>Select an event</option>
              {events
                .filter((e) => e.status === 'completed')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} (ID: {e.id})
                  </option>
                ))}
            </select>

            {reportEventId > 0 && (
              <>
                {reportData.length === 0 && (
                  <div className="ah-banner ah-banner--info">
                    No winners (no competitors finished in winning positions).
                  </div>
                )}

                {reportData.length > 0 && (
                  <table className="ah-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Competitor</th>
                        <th>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((entry, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{entry.playerName}</strong>
                          </td>
                          <td>{entry.competitorName}</td>
                          <td>
                            <span className="winner-badge">{entry.position}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
