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

interface Horse {
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
  horseId?: number | null;
  horseName?: string | null;
}

interface Position {
  id: number;
  eventId: number;
  position: string;
}

interface ReportEntry {
  playerName: string;
  horseName: string;
  position: string;
}

function App() {
  const { token } = useQueryParams();
  const [activeTab, setActiveTab] = useState<'setup' | 'games' | 'reports'>('games');

  // Setup tab state
  const [players, setPlayers] = useState<Player[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newHorseName, setNewHorseName] = useState('');

  // Games tab state
  const [events, setEvents] = useState<Event[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [newPosition, setNewPosition] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
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

  // Fetch setup data
  useEffect(() => {
    if (!token || activeTab !== 'setup') return;

    const fetchSetupData = async () => {
      try {
        const [playersRes, horsesRes] = await Promise.all([
          fetch(`${API_BASE}/players`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/horses`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const playersData = await playersRes.json();
        const horsesData = await horsesRes.json();
        setPlayers(playersData.players || []);
        setHorses(horsesData.horses || []);
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
          assignments[r.horseId] = r.position;
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

  const handleCreateHorse = async () => {
    if (!newHorseName.trim()) return;

    try {
      await fetch(`${API_BASE}/horses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newHorseName }),
      });
      setNewHorseName('');
      // Refetch horses
      const res = await fetch(`${API_BASE}/horses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHorses(data.horses || []);
    } catch (err) {
      console.error('Failed to create horse:', err);
    }
  };

  const handleDeleteHorse = async (id: number) => {
    if (!window.confirm('Delete this horse?')) return;

    try {
      await fetch(`${API_BASE}/horses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setHorses(horses.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Failed to delete horse:', err);
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

  const handleAssignHorse = async (participantId: number, horseId: number | null) => {
    try {
      await fetch(`${API_BASE}/participants/${participantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ horseId }),
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
      console.error('Failed to assign horse:', err);
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
      .map(([horseId, position]) => ({
        horseId: parseInt(horseId),
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

  // Get unassigned horses for a participant dropdown
  const getAvailableHorses = (currentHorseId?: number | null) => {
    const assignedHorseIds = participants
      .filter((p) => p.horseId && p.horseId !== currentHorseId)
      .map((p) => p.horseId);
    return horses.filter((h) => !assignedHorseIds.includes(h.id));
  };

  // Get players not yet in event
  const getAvailablePlayers = () => {
    const participantPlayerIds = participants.map((p) => p.playerId);
    return players.filter((p) => !participantPlayerIds.includes(p.id));
  };

  // Get available positions for results dropdown
  const getAvailablePositions = (currentHorseId: number) => {
    const assignedPositions = Object.entries(resultAssignments)
      .filter(([horseId, _]) => parseInt(horseId) !== currentHorseId)
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

            {/* Horse Pool */}
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => toggleCard('horses')}>
                <h3 className="ah-section-title">Horse Pool ({horses.length})</h3>
                <span className={`ah-section-toggle ${collapsedCards['horses'] ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedCards['horses'] && (
                <>
                  <div className="ah-inline-form">
                    <input
                      type="text"
                      className="ah-input"
                      placeholder="Horse name"
                      value={newHorseName}
                      onChange={(e) => setNewHorseName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateHorse()}
                    />
                    <button className="ah-btn-primary" onClick={handleCreateHorse}>
                      Add Horse
                    </button>
                  </div>

                  <div className="ah-list">
                    {horses.length === 0 && (
                      <p className="ah-meta">No horses yet. Add one to get started.</p>
                    )}
                    {horses.map((horse) => (
                      <div key={horse.id} className="ah-list-item">
                        <strong>{horse.name}</strong>
                        <button
                          className="ah-btn-danger-sm"
                          onClick={() => handleDeleteHorse(horse.id)}
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

                {/* Participants */}
                <div className="ah-card ah-section">
                  <div className="ah-section-header" onClick={() => toggleCard('participants')}>
                    <h3 className="ah-section-title">Participants ({participants.length})</h3>
                    <span className={`ah-section-toggle ${collapsedCards['participants'] ? 'collapsed' : ''}`}>▼</span>
                  </div>

                  {!collapsedCards['participants'] && (
                    <>
                      <div className="add-players-section">
                        <label className="ah-meta">Add Players:</label>
                        <select
                          multiple
                          className="ah-select player-select"
                          value={selectedPlayers.map(String)}
                          onChange={(e) => {
                            const values = Array.from(e.target.selectedOptions).map((opt) => parseInt(opt.value));
                            setSelectedPlayers(values);
                          }}
                        >
                          {getAvailablePlayers().map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="ah-btn-primary"
                          onClick={handleAddParticipants}
                          disabled={selectedPlayers.length === 0}
                        >
                          Add Selected Players
                        </button>
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
                                value={participant.horseId || ''}
                                onChange={(e) =>
                                  handleAssignHorse(
                                    participant.id,
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                              >
                                <option value="">Not assigned</option>
                                {participant.horseId && participant.horseName && (
                                  <option value={participant.horseId}>{participant.horseName}</option>
                                )}
                                {getAvailableHorses(participant.horseId).map((h) => (
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
                        Assign finishing positions to horses. All winning positions must be assigned.
                      </p>

                      <div className="ah-grid-auto">
                        {participants
                          .filter((p) => p.horseId)
                          .map((participant) => {
                            const availablePos = getAvailablePositions(participant.horseId!);
                            return (
                              <div
                                key={participant.id}
                                className={`ah-card result-card ${
                                  resultAssignments[participant.horseId!] ? 'assigned' : ''
                                }`}
                              >
                                <div className="result-card-horse">
                                  {participant.horseName}
                                </div>
                                <div className="ah-meta">
                                  {participant.playerName}
                                </div>
                                <select
                                  className="ah-select"
                                  value={resultAssignments[participant.horseId!] || ''}
                                  onChange={(e) =>
                                    setResultAssignments({
                                      ...resultAssignments,
                                      [participant.horseId!]: e.target.value,
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
                    {e.name}
                  </option>
                ))}
            </select>

            {reportEventId > 0 && (
              <>
                {reportData.length === 0 && (
                  <div className="ah-banner ah-banner--info">
                    No winners (no horses finished in winning positions).
                  </div>
                )}

                {reportData.length > 0 && (
                  <table className="ah-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Horse</th>
                        <th>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((entry, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{entry.playerName}</strong>
                          </td>
                          <td>{entry.horseName}</td>
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
