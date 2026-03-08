import React, { useState, useEffect } from 'react';

// API configuration
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

interface Group {
  id: number;
  managerEmail: string;
  name: string;
  competitorCount: number;
  createdAt: string;
}

interface Competitor {
  id: number;
  groupId: number;
  name: string;
  createdAt: string;
}

interface Event {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  status: string;
  managerEmail: string;
  winningPositions: string; // comma-separated: "1,2,3,last"
  spinnerEnabled: boolean; // use spinner for random assignment
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [groupCompetitors, setGroupCompetitors] = useState<Record<number, Competitor[]>>({});
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newCompetitorName, setNewCompetitorName] = useState('');

  // Games tab state
  const [events, setEvents] = useState<Event[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number>(0);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]); // Now using player names like LMS
  const [playerSearch, setPlayerSearch] = useState('');
  const [showSelectedPlayersOnly, setShowSelectedPlayersOnly] = useState(false);
  const [winningPositions, setWinningPositions] = useState<string>('1,2,3,last');
  const [spinnerEnabled, setSpinnerEnabled] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [resultAssignments, setResultAssignments] = useState<Record<number, string>>({});

  // Spinner state
  const [spinnerModalOpen, setSpinnerModalOpen] = useState<boolean>(false);
  const [spinnerParticipantId, setSpinnerParticipantId] = useState<number | null>(null);
  const [spinnerResult, setSpinnerResult] = useState<Competitor | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinnerDisplayIndex, setSpinnerDisplayIndex] = useState<number>(0);

  // Reveal state (for hiding selections from users)
  const [revealedParticipants, setRevealedParticipants] = useState<Set<number>>(new Set());

  // Reports tab state
  const [reportEventId, setReportEventId] = useState<number>(0);
  const [reportData, setReportData] = useState<ReportEntry[]>([]);

  // Collapse state
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [importResult, setImportResult] = useState<string>('');
  const [loadingGroups, setLoadingGroups] = useState(false);

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
        const res = await fetch(`${API_BASE}/report/${displayEventId}`);
        const data = await res.json();
        setDisplayReportData(data.results || []);
        setDisplayEventName(data.event?.name || `Event #${displayEventId} Results`);
      } catch (err) {
        console.error('Failed to fetch display report:', err);
      }
    };

    fetchDisplayReport();
  }, [displayEventId]);

  // Fetch setup data
  useEffect(() => {
    if (!token || (activeTab !== 'setup' && activeTab !== 'games')) return;

    const fetchSetupData = async () => {
      try {
        const [playersRes, groupsRes] = await Promise.all([
          fetch(`${API_BASE}/players`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/groups`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const playersData = await playersRes.json();
        const groupsData = await groupsRes.json();
        setPlayers(playersData.players || []);
        setGroups(groupsData.groups || []);
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

        // Fetch group competitors for this event
        const selectedEv = events.find(e => e.id === selectedEventId);
        if (selectedEv && selectedEv.groupId) {
          const compRes = await fetch(`${API_BASE}/groups/${selectedEv.groupId}/competitors`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const compData = await compRes.json();
          setGroupCompetitors({
            ...groupCompetitors,
            [selectedEv.groupId]: compData.competitors || [],
          });
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return (
      <>
        <div className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">🏇 {displayEventName}</h1>
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
                        <span className="ah-badge ah-badge--success">{entry.position}</span>
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
  // Setup handlers
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      await fetch(`${API_BASE}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newGroupName }),
      });
      setNewGroupName('');
      // Refetch groups
      const res = await fetch(`${API_BASE}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!window.confirm('Delete this group and all its competitors?')) return;

    try {
      await fetch(`${API_BASE}/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroups(groups.filter((g) => g.id !== id));
      if (expandedGroup === id) {
        setExpandedGroup(null);
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const handleShowImportModal = async () => {
    setShowImportModal(true);
    setLoadingGroups(true);
    setSelectedGroupIds([]);
    setImportResult('');

    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId') || '';

    try {
      const res = await fetch(`http://${window.location.hostname}:5070/api/export/groups?manager_email=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableGroups(data.groups || []);
      } else {
        setImportResult('Failed to fetch groups from Game Admin');
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setImportResult('Failed to fetch groups from Game Admin');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleToggleGroupSelection = (groupId: number, checked: boolean) => {
    if (checked) {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    } else {
      setSelectedGroupIds(selectedGroupIds.filter(id => id !== groupId));
    }
  };

  const handleImportGroups = async () => {
    if (selectedGroupIds.length === 0) return;

    try {
      const res = await fetch(`${API_BASE}/groups/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ groupIds: selectedGroupIds }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowImportModal(false);

        // Refresh groups list
        const groupsRes = await fetch(`${API_BASE}/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);

        // Show success message
        const message = `Imported ${data.groups_created} groups with ${data.members_added} competitors from Game Admin`;
        setImportResult(message);

        // Auto-dismiss after 10 seconds
        setTimeout(() => setImportResult(''), 10000);
      } else {
        setImportResult('Failed to import groups');
      }
    } catch (err) {
      console.error('Failed to import groups:', err);
      setImportResult('Failed to import groups');
    }
  };

  const handleToggleGroup = async (groupId: number) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
      return;
    }

    setExpandedGroup(groupId);

    // Fetch competitors for this group
    if (!groupCompetitors[groupId]) {
      try {
        const res = await fetch(`${API_BASE}/groups/${groupId}/competitors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setGroupCompetitors({
          ...groupCompetitors,
          [groupId]: data.competitors || [],
        });
      } catch (err) {
        console.error('Failed to fetch competitors:', err);
      }
    }
  };

  const handleCreateCompetitor = async (groupId: number) => {
    if (!newCompetitorName.trim()) return;

    try {
      await fetch(`${API_BASE}/groups/${groupId}/competitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCompetitorName }),
      });
      setNewCompetitorName('');
      // Refetch competitors for this group
      const res = await fetch(`${API_BASE}/groups/${groupId}/competitors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGroupCompetitors({
        ...groupCompetitors,
        [groupId]: data.competitors || [],
      });
      // Update group competitor count
      const groupRes = await fetch(`${API_BASE}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const groupData = await groupRes.json();
      setGroups(groupData.groups || []);
    } catch (err) {
      console.error('Failed to create competitor:', err);
    }
  };

  const handleDeleteCompetitor = async (id: number, groupId: number) => {
    if (!window.confirm('Delete this competitor?')) return;

    try {
      await fetch(`${API_BASE}/competitors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroupCompetitors({
        ...groupCompetitors,
        [groupId]: groupCompetitors[groupId].filter((c) => c.id !== id),
      });
      // Update group competitor count
      const groupRes = await fetch(`${API_BASE}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const groupData = await groupRes.json();
      setGroups(groupData.groups || []);
    } catch (err) {
      console.error('Failed to delete competitor:', err);
    }
  };

  // Games tab handlers
  const handleCreateEvent = async () => {
    if (!newEventName.trim() || selectedGroupId === 0 || selectedPlayers.length === 0) {
      alert('Please provide event name, select a group, and select at least one player');
      return;
    }

    try {
      await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newEventName,
          groupId: selectedGroupId,
          playerNames: selectedPlayers,
          winningPositions: winningPositions,
          spinnerEnabled: spinnerEnabled,
        }),
      });
      setNewEventName('');
      setSelectedGroupId(0);
      setSelectedPlayers([]);
      setWinningPositions('1,2,3,last');
      setSpinnerEnabled(false);
      // Refetch events
      const res = await fetch(`${API_BASE}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to create event:', err);
      alert('Failed to create event');
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
    setSelectedPlayers(players.map((p) => p.name));
  };

  const handleDeselectAllPlayers = () => {
    setSelectedPlayers([]);
  };

  const handleTogglePlayerSelection = (playerName: string) => {
    if (selectedPlayers.includes(playerName)) {
      setSelectedPlayers(selectedPlayers.filter((name) => name !== playerName));
    } else {
      setSelectedPlayers([...selectedPlayers, playerName]);
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

  const handleSpin = (participantId: number, currentCompetitorId: number | null) => {
    // Get available competitors for this participant
    const available = getAvailableCompetitors(currentCompetitorId);

    if (available.length === 0) {
      alert('No competitors available to assign');
      return;
    }

    // If only 1 competitor, skip animation and assign directly
    if (available.length === 1) {
      const selectedCompetitor = available[0];
      setSpinnerResult(selectedCompetitor);
      setSpinnerParticipantId(participantId);
      setSpinnerModalOpen(true);
      // Auto-assign after showing result
      setTimeout(() => {
        handleAssignCompetitor(participantId, selectedCompetitor.id);
        setSpinnerModalOpen(false);
        setSpinnerResult(null);
        setSpinnerParticipantId(null);
      }, 2000);
      return;
    }

    // Multiple competitors - start spinner animation
    setSpinnerParticipantId(participantId);
    setSpinnerDisplayIndex(0);
    setIsSpinning(true);
    setSpinnerModalOpen(true);

    // Randomly select a competitor
    const randomIndex = Math.floor(Math.random() * available.length);
    const selectedCompetitor = available[randomIndex];

    // Rotate through competitors during animation (60 iterations over 6 seconds = 100ms each)
    let iteration = 0;
    const rotationInterval = setInterval(() => {
      setSpinnerDisplayIndex((prev) => (prev + 1) % available.length);
      iteration++;
      if (iteration >= 60) {
        clearInterval(rotationInterval);
      }
    }, 100);

    // After 6 seconds, show result
    setTimeout(() => {
      setIsSpinning(false);
      setSpinnerResult(selectedCompetitor);

      // Auto-assign after showing result for 2 seconds
      setTimeout(() => {
        handleAssignCompetitor(participantId, selectedCompetitor.id);
        setSpinnerModalOpen(false);
        setSpinnerResult(null);
        setSpinnerParticipantId(null);
      }, 2000);
    }, 6000);
  };

  // Positions are now configured at event creation time, not dynamically added

  const handleResultChange = async (competitorId: number, position: string) => {
    // Update local state immediately for UI responsiveness
    setResultAssignments({
      ...resultAssignments,
      [competitorId]: position,
    });

    // Save to backend immediately
    if (!selectedEventId) return;

    const currentResults = Object.entries(resultAssignments)
      .filter(([cId, pos]) => pos && parseInt(cId) !== competitorId)
      .map(([cId, pos]) => ({ competitorId: parseInt(cId), position: pos }));

    // Add the new/updated result
    if (position) {
      currentResults.push({ competitorId, position });
    }

    try {
      await fetch(`${API_BASE}/events/${selectedEventId}/results`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ results: currentResults }),
      });
    } catch (err) {
      console.error('Failed to save result:', err);
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
      alert('Event marked as completed!');
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

  // Get unassigned competitors for a participant dropdown (from event's group)
  const getAvailableCompetitors = (currentCompetitorId?: number | null) => {
    if (!selectedEvent) return [];

    const groupComps = groupCompetitors[selectedEvent.groupId] || [];
    const assignedCompetitorIds = participants
      .filter((p) => p.competitorId && p.competitorId !== currentCompetitorId)
      .map((p) => p.competitorId);
    return groupComps.filter((c) => !assignedCompetitorIds.includes(c.id));
  };

  // Get available positions for results dropdown (from event's winningPositions)
  const getAvailablePositions = (currentCompetitorId: number) => {
    if (!selectedEvent) return [];

    const positions = selectedEvent.winningPositions.split(',').map(p => p.trim());
    const assignedPositions = Object.entries(resultAssignments)
      .filter(([competitorId, _]) => parseInt(competitorId) !== currentCompetitorId)
      .map(([_, position]) => position);
    return positions.filter((pos) => !assignedPositions.includes(pos));
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
            Game Reports
          </button>
        </div>

        {/* SETUP TAB */}
        {activeTab === 'setup' && (
          <div>
            {/* Player Pool Section */}
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

                  <div className="ah-list mt-4">
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

            {/* Groups & Competitors Section */}
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => toggleCard('groups')}>
                <h3 className="ah-section-title">Groups & Competitors ({groups.length})</h3>
                <span className={`ah-section-toggle ${collapsedCards['groups'] ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedCards['groups'] && (
                <>
                  <div className="ah-inline-form">
                    <input
                      type="text"
                      className="ah-input"
                      placeholder="New group name (e.g., Grand National 2026)"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
                    />
                    <button className="ah-btn-primary" onClick={handleCreateGroup}>
                      Create Group
                    </button>
                    <button className="ah-btn-outline" onClick={handleShowImportModal}>
                      Import from Game Admin
                    </button>
                  </div>

                  {importResult && (
                    <div className="ah-banner ah-banner--success mt-4">
                      {importResult}
                    </div>
                  )}

                  <div className="ah-list mt-4">
                    {groups.length === 0 && (
                      <p className="ah-meta">No groups yet. Create one to get started.</p>
                    )}

                    {groups.map((group) => (
                      <div key={group.id} className="ah-card">
                        <div
                          className="ah-flex-between cursor-pointer"
                          onClick={() => handleToggleGroup(group.id)}
                        >
                          <div>
                            <strong>{group.name}</strong>
                            <p className="ah-meta">{group.competitorCount} competitors</p>
                          </div>
                          <button
                            className="ah-btn-danger-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(group.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        {expandedGroup === group.id && (
                          <div className="ah-list mt-4 pt-4 border-t">
                            <div className="ah-inline-form">
                              <input
                                type="text"
                                className="ah-input"
                                placeholder="Competitor name (e.g., Seabiscuit)"
                                value={newCompetitorName}
                                onChange={(e) => setNewCompetitorName(e.target.value)}
                                onKeyPress={(e) =>
                                  e.key === 'Enter' && handleCreateCompetitor(group.id)
                                }
                              />
                              <button
                                className="ah-btn-primary"
                                onClick={() => handleCreateCompetitor(group.id)}
                              >
                                Add Competitor
                              </button>
                            </div>

                            {groupCompetitors[group.id]?.map((competitor) => (
                              <div key={competitor.id} className="ah-flex-between p-2 rounded">
                                <strong>{competitor.name}</strong>
                                <button
                                  className="ah-btn-danger-sm"
                                  onClick={() => handleDeleteCompetitor(competitor.id, group.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}

                            {groupCompetitors[group.id]?.length === 0 && (
                              <p className="ah-meta">No competitors yet. Add one above.</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Import Modal */}
            {showImportModal && (
              <div className="ah-modal-overlay" onClick={() => setShowImportModal(false)}>
                <div className="ah-modal" onClick={e => e.stopPropagation()}>
                  <div className="ah-modal-header">
                    <h2>Import Groups from Game Admin</h2>
                    <button onClick={() => setShowImportModal(false)}>×</button>
                  </div>
                  <div className="ah-modal-body">
                    {loadingGroups && <p>Loading groups...</p>}
                    {!loadingGroups && availableGroups.length === 0 && (
                      <p className="ah-meta">No groups found in Game Admin</p>
                    )}
                    {!loadingGroups && availableGroups.length > 0 && (
                      <div className="ah-list">
                        {availableGroups.map(g => (
                          <label key={g.id} className="ah-list-item cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.includes(g.id)}
                              onChange={e => handleToggleGroupSelection(g.id, e.target.checked)}
                            />
                            <span>{g.name} ({g.teams.length} competitors)</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ah-modal-footer">
                    <button className="ah-btn-outline" onClick={() => setShowImportModal(false)}>
                      Cancel
                    </button>
                    <button
                      className="ah-btn-primary"
                      onClick={handleImportGroups}
                      disabled={selectedGroupIds.length === 0}
                    >
                      Import Selected ({selectedGroupIds.length})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GAMES TAB */}
        {activeTab === 'games' && !selectedEventId && (
          <div>
            {/* Games List Section (moved to top like LMS) */}
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => toggleCard('games')}>
                <h3 className="ah-section-title">Games ({events.length})</h3>
                <span className={`ah-section-toggle ${collapsedCards['games'] ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedCards['games'] && (
                <>
                  {events.length === 0 && (
                    <p className="ah-meta">No games yet. Create one below.</p>
                  )}
                  <div className="ah-list gap-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="ah-card cursor-pointer p-5"
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        <div className="ah-flex-between items-start">
                          <div>
                            <strong>{event.name}</strong>
                            <p className="ah-meta">
                              {event.groupName} • {event.participantCount} players
                            </p>
                          </div>
                          <span
                            className={`ah-status ${
                              event.status === 'active' ? 'ah-status--active' : event.status === 'completed' ? 'ah-status--complete' : 'ah-status--waiting'
                            }`}
                          >
                            {event.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Create Game Section (moved below like LMS) */}
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => toggleCard('createGame')}>
                <h3 className="ah-section-title">Create New Game</h3>
                <span className={`ah-section-toggle ${collapsedCards['createGame'] ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedCards['createGame'] && (
                <>
                  <div className="mt-4">
                    <label className="block mb-2">
                      <strong>Game Name:</strong>
                    </label>
                    <input
                      type="text"
                      className="ah-input w-full"
                      placeholder="e.g., Grand National 2026"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block mb-2">
                      <strong>Select Group:</strong>
                    </label>
                    <select
                      className="ah-select w-full"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(parseInt(e.target.value))}
                    >
                      <option value={0}>Select Group</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.competitorCount} competitors)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4">
                    <div className="ah-flex-between mb-2">
                      <p className="ah-meta">
                        Select Players ({selectedPlayers.length} selected):
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button className="ah-btn-outline ah-btn-sm" onClick={handleSelectAllPlayers}>
                          Select All
                        </button>
                        <button className="ah-btn-outline ah-btn-sm" onClick={handleDeselectAllPlayers}>
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Player filters */}
                    <div className="ah-filter-box mb-3">
                      <div className="flex gap-3 items-center flex-wrap">
                        <input
                          type="text"
                          placeholder="Search players by name..."
                          value={playerSearch}
                          onChange={(e) => setPlayerSearch(e.target.value)}
                          className="ah-input flex-1"
                        />
                        <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={showSelectedPlayersOnly}
                            onChange={(e) => setShowSelectedPlayersOnly(e.target.checked)}
                          />
                          <span>Selected only</span>
                        </label>
                      </div>
                    </div>

                    <div className="ah-player-grid">
                      {players.filter((player) => {
                        // Text search filter
                        const matchesSearch = !playerSearch ||
                          player.name.toLowerCase().includes(playerSearch.toLowerCase());

                        // Selected filter
                        const matchesSelected = !showSelectedPlayersOnly ||
                          selectedPlayers.includes(player.name);

                        return matchesSearch && matchesSelected;
                      }).map((player) => (
                        <label key={player.id} className="ah-player-grid-item">
                          <input
                            type="checkbox"
                            checked={selectedPlayers.includes(player.name)}
                            onChange={() => handleTogglePlayerSelection(player.name)}
                          />
                          <span>{player.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block mb-2">
                      <strong>Winning Positions (comma-separated):</strong>
                    </label>
                    <input
                      type="text"
                      className="ah-input w-full"
                      placeholder="e.g., 1,2,3,last"
                      value={winningPositions}
                      onChange={(e) => setWinningPositions(e.target.value)}
                    />
                    <p className="ah-meta mt-1">These positions will determine the winners</p>
                  </div>

                  <div className="mt-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={spinnerEnabled}
                        onChange={(e) => setSpinnerEnabled(e.target.checked)}
                      />
                      <span><strong>Enable Spinner</strong> - Use randomized spinner for competitor assignment (mobile-friendly)</span>
                    </label>
                  </div>

                  <button
                    className="ah-btn-primary mt-4"
                    onClick={handleCreateEvent}
                  >
                    Create Game
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Event Detail View */}
        {activeTab === 'games' && selectedEventId && selectedEvent && (
          <>
            <div className="ah-detail-header">
              <button className="ah-btn-back" onClick={() => setSelectedEventId(null)}>
                ← Back to Games
              </button>
              <h2 className="m-0">{selectedEvent.name}</h2>
              <span className={`ah-status ah-status--${selectedEvent.status === 'completed' ? 'active' : 'waiting'}`}>
                {selectedEvent.status}
              </span>
              <button
                className="ah-btn-danger"
                onClick={() => handleDeleteEvent(selectedEventId)}
              >
                Delete Game
              </button>
            </div>

            <div className="ah-card">
              <p className="ah-meta">
                <strong>Group:</strong> {selectedEvent.groupName}
              </p>
              <p className="ah-meta mt-2">
                <strong>Winning Positions:</strong> {selectedEvent.winningPositions}
              </p>
              <p className="ah-meta mt-2">
                <strong>Display URL:</strong>
              </p>
              <div className="ah-flex-center gap-2 mt-1">
                <input
                  type="text"
                  className="ah-input flex-1"
                  value={`http://${window.location.hostname}:4032/?view=report&eventId=${selectedEventId}`}
                  readOnly
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

            {/* Participants & Competitor Assignments */}
            <div className="ah-card ah-section">
              <div className="ah-section-header" onClick={() => toggleCard('participants')}>
                <h3 className="ah-section-title">Participants & Competitor Assignments ({participants.length})</h3>
                <span className={`ah-section-toggle ${collapsedCards['participants'] ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedCards['participants'] && (
                <>
                  <div className="ah-list">
                    {participants.length === 0 && (
                      <p className="ah-meta">No participants in this game.</p>
                    )}
                    {participants.map((participant) => {
                      const isRevealed = revealedParticipants.has(participant.id);
                      const hasAssignment = !!participant.competitorId;
                      const maskedName = '*************************'; // Always 25 chars

                      return (
                        <div key={participant.id} className="ah-flex-between p-3 border rounded-md gap-3">
                          <strong>{participant.playerName}</strong>

                          <div className="flex gap-2 items-center">
                            {selectedEvent?.spinnerEnabled && (
                              <button
                                className="ah-btn-primary ah-btn-sm"
                                onClick={() => handleSpin(participant.id, participant.competitorId ?? null)}
                                disabled={getAvailableCompetitors(participant.competitorId ?? null).length === 0}
                              >
                                🎲
                              </button>
                            )}

                            <select
                              className="ah-select-fixed"
                              value={participant.competitorId || ''}
                              onChange={(e) =>
                                handleAssignCompetitor(
                                  participant.id,
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                            >
                              <option value="">
                                {!isRevealed && hasAssignment ? maskedName : 'Not assigned'}
                              </option>
                              {participant.competitorId && participant.competitorName && (
                                <option value={participant.competitorId}>
                                  {!isRevealed ? maskedName : participant.competitorName}
                                </option>
                              )}
                              {!isRevealed && hasAssignment ? null : getAvailableCompetitors(participant.competitorId).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>

                            <button
                              className="ah-btn-outline ah-btn-sm"
                              onClick={() => handleAssignCompetitor(participant.id, null)}
                              disabled={!hasAssignment}
                              title="Clear assignment"
                            >
                              ✕
                            </button>

                            <button
                              className="ah-btn-outline ah-btn-sm"
                              onMouseDown={() => {
                                const newSet = new Set(revealedParticipants);
                                newSet.add(participant.id);
                                setRevealedParticipants(newSet);
                              }}
                              onMouseUp={() => {
                                const newSet = new Set(revealedParticipants);
                                newSet.delete(participant.id);
                                setRevealedParticipants(newSet);
                              }}
                              onMouseLeave={() => {
                                const newSet = new Set(revealedParticipants);
                                newSet.delete(participant.id);
                                setRevealedParticipants(newSet);
                              }}
                              onTouchStart={() => {
                                const newSet = new Set(revealedParticipants);
                                newSet.add(participant.id);
                                setRevealedParticipants(newSet);
                              }}
                              onTouchEnd={() => {
                                const newSet = new Set(revealedParticipants);
                                newSet.delete(participant.id);
                                setRevealedParticipants(newSet);
                              }}
                              onTouchCancel={() => {
                                const newSet = new Set(revealedParticipants);
                                newSet.delete(participant.id);
                                setRevealedParticipants(newSet);
                              }}
                            >
                              👁️
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                        Assign finishing positions to competitors. Results are saved automatically.
                      </p>

                      <div className="ah-grid-auto">
                        {participants
                          .filter((p) => p.competitorId)
                          .map((participant) => {
                            const availablePos = getAvailablePositions(participant.competitorId!);
                            return (
                              <div
                                key={participant.id}
                                className="ah-card ah-flex-col gap-2"
                              >
                                <div className="font-semibold">
                                  {participant.competitorName}
                                </div>
                                <div className="ah-meta">
                                  {participant.playerName}
                                </div>
                                <select
                                  className="ah-select"
                                  value={resultAssignments[participant.competitorId!] || ''}
                                  onChange={(e) =>
                                    handleResultChange(participant.competitorId!, e.target.value)
                                  }
                                >
                                  <option value="">Select position</option>
                                  {availablePos.map((pos) => (
                                    <option key={pos} value={pos}>
                                      {pos}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                      </div>

                      <button
                        className="ah-btn-primary mt-5"
                        onClick={handleSaveResults}
                      >
                        Complete Event
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="ah-card">
            <h3 className="ah-section-title">Event Report</h3>

            <select
              className="ah-select w-full mb-5"
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
                            <span className="ah-badge ah-badge--success">{entry.position}</span>
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

      {/* Spinner Modal */}
      {spinnerModalOpen && (
        <div className="ah-modal-overlay" onClick={() => !isSpinning && setSpinnerModalOpen(false)}>
          <div className="ah-modal ah-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ah-modal-header">
              <h3 className="ah-modal-title">
                {isSpinning ? '🎲 Spinning...' : '🎉 Result!'}
              </h3>
              {!isSpinning && (
                <button className="ah-modal-close" onClick={() => setSpinnerModalOpen(false)}>
                  ✕
                </button>
              )}
            </div>
            <div className="ah-modal-body">
              {isSpinning ? (
                <div className="text-center py-10">
                  <div className="text-6xl mb-5">🎲</div>
                  {spinnerParticipantId && (() => {
                    const available = getAvailableCompetitors(
                      participants.find(p => p.id === spinnerParticipantId)?.competitorId || null
                    );
                    const currentCompetitor = available[spinnerDisplayIndex % available.length];
                    return (
                      <h2 className="text-3xl font-bold mb-5 ah-spinner-text">
                        {currentCompetitor?.name || ''}
                      </h2>
                    );
                  })()}
                  <p className="ah-meta">Randomizing competitor selection...</p>
                  <p className="ah-meta mt-2">
                    For: {participants.find(p => p.id === spinnerParticipantId)?.playerName}
                  </p>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="text-6xl mb-5">🏆</div>
                  <h2 className="text-3xl font-bold mb-5">{spinnerResult?.name}</h2>
                  <p className="ah-meta">
                    Assigned to {participants.find(p => p.id === spinnerParticipantId)?.playerName}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
