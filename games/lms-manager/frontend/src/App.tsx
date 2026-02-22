import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

const API_BASE = window.location.origin;

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

interface Group {
  id: number;
  managerEmail: string;
  name: string;
  teamCount: number;
  createdAt: string;
}

interface Team {
  id: number;
  groupId: number;
  name: string;
  rank: number;
  createdAt: string;
}

interface Player {
  id: number;
  managerEmail: string;
  name: string;
  createdAt: string;
}

function App() {
  const { userId, userName, token } = useQueryParams();
  const [activeTab, setActiveTab] = useState<'setup' | 'games'>('setup');

  // Setup tab state
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [groupTeams, setGroupTeams] = useState<Record<number, Team[]>>({});

  const [newGroupName, setNewGroupName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamRank, setNewTeamRank] = useState(999);

  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        // Fetch groups
        const groupsRes = await fetch(`${API_BASE}/api/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);

        // Fetch players
        const playersRes = await fetch(`${API_BASE}/api/players`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const playersData = await playersRes.json();
        setPlayers(playersData.players || []);

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Auth check
  if (!userId || !token) {
    return (
      <>
        <header className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">🎯 LMS Manager</h1>
          </div>
        </header>
        <div className="ah-container ah-container--narrow">
          <div className="ah-card">
            <p className="ah-meta">
              Missing authentication. Please access this app through the Activity Hub.
            </p>
            <button
              className="ah-btn-primary"
              onClick={() => {
                window.location.href = `http://${window.location.hostname}:3001`;
              }}
            >
              Go to Lobby
            </button>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <header className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">🎯 LMS Manager</h1>
          </div>
        </header>
        <div className="ah-container ah-container--narrow">
          <div className="ah-card">
            <p className="ah-meta">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  // Group CRUD handlers
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newGroupName }),
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh groups list
        const groupsRes = await fetch(`${API_BASE}/api/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);
        setNewGroupName('');
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Delete this group? This will also delete all its teams.')) return;

    try {
      const res = await fetch(`${API_BASE}/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok || res.status === 204) {
        setGroups(groups.filter((g) => g.id !== groupId));
        delete groupTeams[groupId];
        if (expandedGroup === groupId) {
          setExpandedGroup(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const handleToggleGroup = async (groupId: number) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
      return;
    }

    setExpandedGroup(groupId);

    // Fetch teams if not already loaded
    if (!groupTeams[groupId]) {
      try {
        const res = await fetch(`${API_BASE}/api/groups/${groupId}/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setGroupTeams({ ...groupTeams, [groupId]: data.teams || [] });
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      }
    }
  };

  // Team CRUD handlers
  const handleCreateTeam = async (groupId: number) => {
    if (!newTeamName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/groups/${groupId}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newTeamName, rank: newTeamRank }),
      });

      if (res.ok) {
        // Refresh teams for this group
        const teamsRes = await fetch(`${API_BASE}/api/groups/${groupId}/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const teamsData = await teamsRes.json();
        setGroupTeams({ ...groupTeams, [groupId]: teamsData.teams || [] });
        setNewTeamName('');
        setNewTeamRank(999);
      }
    } catch (err) {
      console.error('Failed to create team:', err);
    }
  };

  const handleDeleteTeam = async (teamId: number, groupId: number) => {
    if (!confirm('Delete this team?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok || res.status === 204) {
        // Refresh teams for this group
        const teamsRes = await fetch(`${API_BASE}/api/groups/${groupId}/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const teamsData = await teamsRes.json();
        setGroupTeams({ ...groupTeams, [groupId]: teamsData.teams || [] });
      }
    } catch (err) {
      console.error('Failed to delete team:', err);
    }
  };

  // Player CRUD handlers
  const handleCreatePlayer = async () => {
    if (!newPlayerName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newPlayerName }),
      });

      if (res.ok) {
        // Refresh players list
        const playersRes = await fetch(`${API_BASE}/api/players`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const playersData = await playersRes.json();
        setPlayers(playersData.players || []);
        setNewPlayerName('');
      }
    } catch (err) {
      console.error('Failed to create player:', err);
    }
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!confirm('Delete this player?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/players/${playerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok || res.status === 204) {
        setPlayers(players.filter((p) => p.id !== playerId));
      }
    } catch (err) {
      console.error('Failed to delete player:', err);
    }
  };

  return (
    <>
      <header className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">🎯 LMS Manager</h1>
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
      </header>

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
        </div>

        {/* Setup Tab */}
        {activeTab === 'setup' && (
          <div>
            {/* Groups & Teams Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header">
                <h3 className="ah-section-title">Groups & Teams</h3>
              </div>

              <div className="inline-form">
                <input
                  type="text"
                  className="ah-input"
                  placeholder="New group name (e.g., Premier League 25/26)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
                />
                <button className="ah-btn-primary" onClick={handleCreateGroup}>
                  Create Group
                </button>
              </div>

              <div className="group-list" style={{ marginTop: '1rem' }}>
                {groups.length === 0 && (
                  <p className="ah-meta">No groups yet. Create one to get started.</p>
                )}

                {groups.map((group) => (
                  <div key={group.id} className="group-item">
                    <div
                      className="group-item-header"
                      onClick={() => handleToggleGroup(group.id)}
                    >
                      <div>
                        <strong>{group.name}</strong>
                        <p className="ah-meta">{group.teamCount} teams</p>
                      </div>
                      <button
                        className="btn-danger-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    {expandedGroup === group.id && (
                      <div className="teams-list">
                        <div className="inline-form">
                          <input
                            type="text"
                            className="ah-input"
                            placeholder="Team name"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            onKeyPress={(e) =>
                              e.key === 'Enter' && handleCreateTeam(group.id)
                            }
                          />
                          <input
                            type="number"
                            className="ah-input"
                            placeholder="Rank"
                            value={newTeamRank}
                            onChange={(e) => setNewTeamRank(parseInt(e.target.value) || 999)}
                            style={{ width: '100px' }}
                          />
                          <button
                            className="ah-btn-primary"
                            onClick={() => handleCreateTeam(group.id)}
                          >
                            Add Team
                          </button>
                        </div>

                        {groupTeams[group.id]?.map((team) => (
                          <div key={team.id} className="team-item">
                            <div>
                              <strong>{team.name}</strong>
                              <span className="ah-meta" style={{ marginLeft: '1rem' }}>
                                Rank: {team.rank}
                              </span>
                            </div>
                            <button
                              className="btn-danger-small"
                              onClick={() => handleDeleteTeam(team.id, group.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}

                        {groupTeams[group.id]?.length === 0 && (
                          <p className="ah-meta">No teams yet. Add one above.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Player Pool Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header">
                <h3 className="ah-section-title">Player Pool</h3>
              </div>

              <div className="inline-form">
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

              <div className="player-list" style={{ marginTop: '1rem' }}>
                {players.length === 0 && (
                  <p className="ah-meta">No players yet. Add one to get started.</p>
                )}

                {players.map((player) => (
                  <div key={player.id} className="player-item">
                    <strong>{player.name}</strong>
                    <button
                      className="btn-danger-small"
                      onClick={() => handleDeletePlayer(player.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Games Tab - Placeholder */}
        {activeTab === 'games' && (
          <div className="ah-card">
            <h3 className="ah-section-title">Games</h3>
            <p className="ah-meta">Game management coming soon...</p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
