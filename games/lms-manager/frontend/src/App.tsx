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
  createdAt: string;
}

interface Player {
  id: number;
  managerEmail: string;
  name: string;
  createdAt: string;
}

interface Game {
  id: number;
  managerEmail: string;
  name: string;
  groupId: number;
  status: string;
  winnerName?: string;
  postponeAsWin: boolean;
  createdAt: string;
  groupName: string;
  participantCount: number;
  currentRound: number;
}

interface Participant {
  id: number;
  gameId: number;
  playerName: string;
  isActive: boolean;
  eliminatedInRound?: number;
  createdAt: string;
}

interface Round {
  id: number;
  gameId: number;
  roundNumber: number;
  status: string;
  createdAt: string;
}

interface Pick {
  id: number;
  gameId: number;
  roundId: number;
  playerName: string;
  teamId?: number;
  teamName?: string;
  result?: string;
  autoAssigned: boolean;
  createdAt: string;
}

interface GameDetail {
  game: Game;
  participants: Participant[];
  rounds: Round[];
}

function App() {
  const { userId, token } = useQueryParams();
  const [activeTab, setActiveTab] = useState<'setup' | 'games' | 'edit'>('setup');
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  // Setup tab state
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [groupTeams, setGroupTeams] = useState<Record<number, Team[]>>({});

  const [newGroupName, setNewGroupName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

  // Games tab state
  const [games, setGames] = useState<Game[]>([]);
  const [newGameName, setNewGameName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number>(0);
  const [selectedPlayerNames, setSelectedPlayerNames] = useState<string[]>([]);
  const [postponeAsWin, setPostponeAsWin] = useState<boolean>(true);

  // Game detail state
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pickAssignments, setPickAssignments] = useState<Record<string, number>>({});
  const [pickResults, setPickResults] = useState<Record<number, string>>({});
  const [usedTeams, setUsedTeams] = useState<Record<string, number[]>>({});
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [playersToAdd, setPlayersToAdd] = useState<string[]>([]);

  // Edit tab state
  const [editGameId, setEditGameId] = useState<number | null>(null);
  const [editGameDetail, setEditGameDetail] = useState<GameDetail | null>(null);
  const [editExpandedRound, setEditExpandedRound] = useState<number | null>(null);
  const [editPicks, setEditPicks] = useState<Record<number, Pick[]>>({});
  const [editPickAssignments, setEditPickAssignments] = useState<Record<number, Record<string, number>>>({});
  const [editPickResults, setEditPickResults] = useState<Record<number, Record<number, string>>>({});

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

  // Fetch games when Games tab is active
  useEffect(() => {
    if (!token || activeTab !== 'games') return;

    const fetchGames = async () => {
      try {
        const gamesRes = await fetch(`${API_BASE}/api/games`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const gamesData = await gamesRes.json();
        setGames(gamesData.games || []);
      } catch (err) {
        console.error('Failed to fetch games:', err);
      }
    };

    fetchGames();
  }, [token, activeTab]);

  // Fetch game details when a game is selected
  useEffect(() => {
    if (!token || !selectedGameId) return;

    const fetchGameDetail = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/games/${selectedGameId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setGameDetail(data);

        // Fetch teams for the game's group if not already loaded
        if (data.game.groupId) {
          const teamsRes = await fetch(`${API_BASE}/api/groups/${data.game.groupId}/teams`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const teamsData = await teamsRes.json();
          setGroupTeams((prev) => ({ ...prev, [data.game.groupId]: teamsData.teams || [] }));
        }

        // Fetch used teams for this game
        const usedTeamsRes = await fetch(`${API_BASE}/api/games/${selectedGameId}/used-teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const usedTeamsData = await usedTeamsRes.json();
        setUsedTeams(usedTeamsData.usedTeams || {});

        // If there are rounds, fetch picks for the latest round
        if (data.rounds && data.rounds.length > 0) {
          const latestRound = data.rounds[data.rounds.length - 1];
          const picksRes = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const picksData = await picksRes.json();
          setPicks(picksData.picks || []);

          // Initialize pick assignments and results from existing picks
          const assignments: Record<string, number> = {};
          const results: Record<number, string> = {};
          (picksData.picks || []).forEach((pick: Pick) => {
            if (pick.teamId) {
              assignments[pick.playerName] = pick.teamId;
            }
            if (pick.result) {
              results[pick.id] = pick.result;
            }
          });
          setPickAssignments(assignments);
          setPickResults(results);
        }
      } catch (err) {
        console.error('Failed to fetch game detail:', err);
      }
    };

    fetchGameDetail();
  }, [token, selectedGameId]);

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
    if (!window.confirm('Delete this group? This will also delete all its teams.')) return;

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
        body: JSON.stringify({ name: newTeamName }),
      });

      if (res.ok) {
        // Refresh teams for this group
        const teamsRes = await fetch(`${API_BASE}/api/groups/${groupId}/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const teamsData = await teamsRes.json();
        setGroupTeams({ ...groupTeams, [groupId]: teamsData.teams || [] });
        setNewTeamName('');
      }
    } catch (err) {
      console.error('Failed to create team:', err);
    }
  };

  const handleDeleteTeam = async (teamId: number, groupId: number) => {
    if (!window.confirm('Delete this team?')) return;

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
    if (!window.confirm('Delete this player?')) return;

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

  // Game handlers
  const handleTogglePlayerSelection = (playerName: string) => {
    if (selectedPlayerNames.includes(playerName)) {
      setSelectedPlayerNames(selectedPlayerNames.filter((n) => n !== playerName));
    } else {
      setSelectedPlayerNames([...selectedPlayerNames, playerName]);
    }
  };

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      alert('Please enter a game name');
      return;
    }

    if (selectedGroupId === 0) {
      alert('Please select a group');
      return;
    }

    if (selectedPlayerNames.length === 0) {
      alert('Please select at least one player');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newGameName,
          groupId: selectedGroupId,
          playerNames: selectedPlayerNames,
          postponeAsWin: postponeAsWin,
        }),
      });

      if (res.ok) {
        // Refresh games list
        const gamesRes = await fetch(`${API_BASE}/api/games`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const gamesData = await gamesRes.json();
        setGames(gamesData.games || []);

        // Reset form
        setNewGameName('');
        setSelectedGroupId(0);
        setSelectedPlayerNames([]);
        setPostponeAsWin(true);
      } else {
        const error = await res.text();
        alert(`Failed to create game: ${error}`);
      }
    } catch (err) {
      console.error('Failed to create game:', err);
      alert('Failed to create game');
    }
  };

  const handleViewGame = (gameId: number) => {
    setSelectedGameId(gameId);
  };

  const handleBackToGamesList = () => {
    setSelectedGameId(null);
    setGameDetail(null);
    setPicks([]);
    setPickAssignments({});
    setPickResults({});
  };

  // Game detail handlers
  const handleSavePicks = async () => {
    if (!gameDetail || !token) return;

    const latestRound = gameDetail.rounds[gameDetail.rounds.length - 1];
    if (!latestRound) return;

    // Build picks array from assignments
    const picksToSave = Object.entries(pickAssignments).map(([playerName, teamId]) => ({
      playerName,
      teamId,
    }));

    if (picksToSave.length === 0) {
      alert('No picks to save');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ picks: picksToSave }),
      });

      if (res.ok || res.status === 204) {
        // Refresh picks
        const picksRes = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const picksData = await picksRes.json();
        setPicks(picksData.picks || []);

        alert('Picks saved successfully');
      } else {
        const error = await res.text();
        alert(`Failed to save picks: ${error}`);
      }
    } catch (err) {
      console.error('Failed to save picks:', err);
      alert('Failed to save picks');
    }
  };

  const handleSaveResults = async () => {
    if (!gameDetail || !token) return;

    const latestRound = gameDetail.rounds[gameDetail.rounds.length - 1];
    if (!latestRound) return;

    // Build results array
    const resultsToSave = Object.entries(pickResults).map(([pickId, result]) => ({
      pickId: Number(pickId),
      result,
    }));

    if (resultsToSave.length === 0) {
      alert('No results to save');
      return;
    }

    // Check that all picks have results
    const allPicksHaveResults = picks.every((pick) => pickResults[pick.id]);
    if (!allPicksHaveResults) {
      if (!window.confirm('Not all picks have results. Continue anyway?')) {
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ results: resultsToSave }),
      });

      if (res.ok || res.status === 204) {
        alert('Results saved and round closed');
        // Refresh game detail
        const gameRes = await fetch(`${API_BASE}/api/games/${selectedGameId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const gameData = await gameRes.json();
        setGameDetail(gameData);
      } else {
        const error = await res.text();
        alert(`Failed to save results: ${error}`);
      }
    } catch (err) {
      console.error('Failed to save results:', err);
      alert('Failed to save results');
    }
  };

  const handleAdvanceRound = async () => {
    if (!gameDetail || !token) return;

    try {
      const res = await fetch(`${API_BASE}/api/games/${selectedGameId}/advance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await res.json();
        // Single notification - no double confirm

        // Refresh game detail
        const gameRes = await fetch(`${API_BASE}/api/games/${selectedGameId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const gameData = await gameRes.json();
        setGameDetail(gameData);

        // Refresh used teams (previous round is now closed)
        const usedTeamsRes = await fetch(`${API_BASE}/api/games/${selectedGameId}/used-teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const usedTeamsData = await usedTeamsRes.json();
        setUsedTeams(usedTeamsData.usedTeams || {});

        // Fetch picks for new round
        if (gameData.rounds && gameData.rounds.length > 0) {
          const latestRound = gameData.rounds[gameData.rounds.length - 1];
          const picksRes = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const picksData = await picksRes.json();
          setPicks(picksData.picks || []);
          setPickAssignments({});
          setPickResults({});
        }
      } else {
        const error = await res.text();
        alert(`Failed to advance round: ${error}`);
      }
    } catch (err) {
      console.error('Failed to advance round:', err);
      alert('Failed to advance round');
    }
  };

  const handleSelectAll = () => {
    setSelectedPlayerNames(players.map((p) => p.name));
  };

  const handleDeselectAll = () => {
    setSelectedPlayerNames([]);
  };

  const handleAddPlayersToGame = async () => {
    if (!gameDetail || !token) return;
    if (playersToAdd.length === 0) {
      alert('Please select at least one player to add');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/games/${selectedGameId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerNames: playersToAdd }),
      });

      if (res.ok || res.status === 204) {
        // Refresh game detail
        const gameRes = await fetch(`${API_BASE}/api/games/${selectedGameId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const gameData = await gameRes.json();
        setGameDetail(gameData);
        setShowAddPlayers(false);
        setPlayersToAdd([]);
      } else {
        const error = await res.text();
        alert(`Failed to add players: ${error}`);
      }
    } catch (err) {
      console.error('Failed to add players:', err);
      alert('Failed to add players');
    }
  };

  const handleDeleteGame = async () => {
    if (!gameDetail || !token || !selectedGameId) return;

    if (!window.confirm(`Are you sure you want to delete "${gameDetail.game.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/games/${selectedGameId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok || res.status === 204) {
        alert('Game deleted successfully');
        // Refresh games list
        const gamesRes = await fetch(`${API_BASE}/api/games`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const gamesData = await gamesRes.json();
        setGames(gamesData.games || []);
        // Go back to games list
        handleBackToGamesList();
      } else {
        const error = await res.text();
        alert(`Failed to delete game: ${error}`);
      }
    } catch (err) {
      console.error('Failed to delete game:', err);
      alert('Failed to delete game');
    }
  };

  // Edit tab handlers
  const handleSelectEditGame = async (gameId: number) => {
    if (!token) return;
    setEditGameId(gameId);
    setEditExpandedRound(null);
    setEditPicks({});
    setEditPickAssignments({});
    setEditPickResults({});

    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEditGameDetail(data);
    } catch (err) {
      console.error('Failed to fetch edit game detail:', err);
    }
  };

  const handleExpandEditRound = async (roundId: number) => {
    if (!token || !editGameDetail) return;

    if (editExpandedRound === roundId) {
      setEditExpandedRound(null);
      return;
    }

    setEditExpandedRound(roundId);

    try {
      const res = await fetch(`${API_BASE}/api/rounds/${roundId}/picks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEditPicks((prev) => ({ ...prev, [roundId]: data.picks || [] }));

      // Initialize assignments and results from existing picks
      const assignments: Record<string, number> = {};
      const results: Record<number, string> = {};
      (data.picks || []).forEach((pick: Pick) => {
        if (pick.teamId) {
          assignments[pick.playerName] = pick.teamId;
        }
        if (pick.result) {
          results[pick.id] = pick.result;
        }
      });
      setEditPickAssignments((prev) => ({ ...prev, [roundId]: assignments }));
      setEditPickResults((prev) => ({ ...prev, [roundId]: results }));
    } catch (err) {
      console.error('Failed to fetch edit picks:', err);
    }
  };

  const handleSaveEditPicks = async (roundId: number) => {
    if (!editGameDetail || !token) return;

    const assignments = editPickAssignments[roundId] || {};
    const picksToSave = Object.entries(assignments).map(([playerName, teamId]) => ({
      playerName,
      teamId,
    }));

    if (picksToSave.length === 0) {
      alert('No picks to save');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rounds/${roundId}/picks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ picks: picksToSave }),
      });

      if (res.ok || res.status === 204) {
        // Refresh picks for this round
        const picksRes = await fetch(`${API_BASE}/api/rounds/${roundId}/picks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const picksData = await picksRes.json();
        setEditPicks((prev) => ({ ...prev, [roundId]: picksData.picks || [] }));
        alert('Picks updated successfully');
      } else {
        const error = await res.text();
        alert(`Failed to update picks: ${error}`);
      }
    } catch (err) {
      console.error('Failed to save edit picks:', err);
      alert('Failed to update picks');
    }
  };

  const handleSaveEditResults = async (roundId: number) => {
    if (!editGameDetail || !token) return;

    const results = editPickResults[roundId] || {};
    const resultsToSave = Object.entries(results).map(([pickId, result]) => ({
      pickId: parseInt(pickId),
      result,
    }));

    if (resultsToSave.length === 0) {
      alert('No results to save');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rounds/${roundId}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ results: resultsToSave }),
      });

      if (res.ok || res.status === 204) {
        // Refresh game detail to update participants status
        const gameRes = await fetch(`${API_BASE}/api/games/${editGameId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const gameData = await gameRes.json();
        setEditGameDetail(gameData);

        // Refresh picks for this round
        const picksRes = await fetch(`${API_BASE}/api/rounds/${roundId}/picks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const picksData = await picksRes.json();
        setEditPicks((prev) => ({ ...prev, [roundId]: picksData.picks || [] }));
        alert('Results updated successfully');
      } else {
        const error = await res.text();
        alert(`Failed to update results: ${error}`);
      }
    } catch (err) {
      console.error('Failed to save edit results:', err);
      alert('Failed to update results');
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
          <button
            className={`ah-tab ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Edit
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
                          <button
                            className="ah-btn-primary"
                            onClick={() => handleCreateTeam(group.id)}
                          >
                            Add Team
                          </button>
                        </div>

                        {groupTeams[group.id]?.map((team) => (
                          <div key={team.id} className="team-item">
                            <strong>{team.name}</strong>
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

        {/* Games Tab */}
        {activeTab === 'games' && !selectedGameId && (
          <div>
            {/* Create Game Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header">
                <h3 className="ah-section-title">Create New Game</h3>
              </div>

              {groups.length === 0 && (
                <p className="ah-meta">
                  No groups available. Please create a group in the Setup tab first.
                </p>
              )}

              {players.length === 0 && (
                <p className="ah-meta">
                  No players available. Please add players in the Setup tab first.
                </p>
              )}

              {groups.length > 0 && players.length > 0 && (
                <div>
                  <div className="inline-form">
                    <input
                      type="text"
                      className="ah-input"
                      placeholder="Game name (e.g., Spring 2026 LMS)"
                      value={newGameName}
                      onChange={(e) => setNewGameName(e.target.value)}
                    />
                    <select
                      className="ah-select"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                    >
                      <option value={0}>Select Group</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.teamCount} teams)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <p className="ah-meta">
                        Select Players ({selectedPlayerNames.length} selected):
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="ah-btn-outline" onClick={handleSelectAll} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                          Select All
                        </button>
                        <button className="ah-btn-outline" onClick={handleDeselectAll} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                          Deselect All
                        </button>
                      </div>
                    </div>
                    <div className="player-selection-grid">
                      {players.map((player) => (
                        <label key={player.id} className="player-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedPlayerNames.includes(player.name)}
                            onChange={() => handleTogglePlayerSelection(player.name)}
                          />
                          <span>{player.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <label className="postpone-checkbox-label">
                      <input
                        type="checkbox"
                        checked={postponeAsWin}
                        onChange={(e) => setPostponeAsWin(e.target.checked)}
                      />
                      <span>Postponed matches count as WIN (uncheck for LOSS)</span>
                    </label>
                  </div>

                  <button
                    className="ah-btn-primary"
                    onClick={handleCreateGame}
                    style={{ marginTop: '1rem' }}
                  >
                    Create Game
                  </button>
                </div>
              )}
            </div>

            {/* Games List Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header">
                <h3 className="ah-section-title">Active Games</h3>
              </div>

              {games.length === 0 && (
                <p className="ah-meta">No games yet. Create one above to get started.</p>
              )}

              <div className="games-list">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="game-item"
                    onClick={() => handleViewGame(game.id)}
                  >
                    <div className="game-item-main">
                      <div>
                        <strong>{game.name}</strong>
                        <p className="ah-meta">
                          {game.groupName} • {game.participantCount} players • Round{' '}
                          {game.currentRound}
                        </p>
                      </div>
                      <span
                        className={`game-status ${
                          game.status === 'active' ? 'status-active' : 'status-completed'
                        }`}
                      >
                        {game.status}
                      </span>
                    </div>
                    {game.status === 'completed' && game.winnerName && (
                      <p className="ah-meta">Winner: {game.winnerName}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game Detail View */}
        {activeTab === 'games' && selectedGameId && gameDetail && (
          <div>
            {/* Header */}
            <div className="ah-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="ah-btn-outline" onClick={handleBackToGamesList}>
                  ← Back to Games
                </button>
                <button className="ah-btn-danger" onClick={handleDeleteGame}>
                  Delete Game
                </button>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <h3 className="ah-section-title">{gameDetail.game.name}</h3>
                <p className="ah-meta">
                  {gameDetail.game.groupName} •{' '}
                  <span
                    className={`game-status ${
                      gameDetail.game.status === 'active' ? 'status-active' : 'status-completed'
                    }`}
                  >
                    {gameDetail.game.status}
                  </span>
                </p>
                {gameDetail.game.status === 'completed' && gameDetail.game.winnerName && (
                  <p style={{ marginTop: '0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
                    Winner: {gameDetail.game.winnerName} 🏆
                  </p>
                )}
              </div>
            </div>

            {/* Participants */}
            <div className="ah-card">
              <div className="setup-section-header">
                <h3 className="ah-section-title">Participants</h3>
                {gameDetail.game.status === 'active' && (
                  <button
                    className="ah-btn-outline"
                    onClick={() => setShowAddPlayers(!showAddPlayers)}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    {showAddPlayers ? 'Cancel' : '+ Add Players'}
                  </button>
                )}
              </div>

              {showAddPlayers && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: '#FAFAF9', borderRadius: '8px' }}>
                  <p className="ah-meta" style={{ marginBottom: '0.5rem' }}>Select players to add:</p>
                  <div className="player-selection-grid" style={{ maxHeight: '200px' }}>
                    {players.filter(p => !gameDetail.participants.some(part => part.playerName === p.name)).map((player) => (
                      <label key={player.id} className="player-checkbox-label">
                        <input
                          type="checkbox"
                          checked={playersToAdd.includes(player.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPlayersToAdd([...playersToAdd, player.name]);
                            } else {
                              setPlayersToAdd(playersToAdd.filter(n => n !== player.name));
                            }
                          }}
                        />
                        <span>{player.name}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="ah-btn-primary"
                    onClick={handleAddPlayersToGame}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Add Selected Players
                  </button>
                </div>
              )}

              <div className="participants-grid">
                {gameDetail.participants.map((participant) => (
                  <div
                    key={participant.id}
                    className={`participant-badge ${
                      participant.isActive ? 'participant-active' : 'participant-eliminated'
                    }`}
                  >
                    <span>{participant.playerName}</span>
                    {!participant.isActive && participant.eliminatedInRound && (
                      <span className="elimination-round">R{participant.eliminatedInRound}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Round Management */}
            {gameDetail.game.status === 'active' &&
              gameDetail.rounds &&
              gameDetail.rounds.length > 0 && (
                <div>
                  {(() => {
                    const currentRound = gameDetail.rounds[gameDetail.rounds.length - 1];
                    const activePlayers = gameDetail.participants.filter((p) => p.isActive);

                    return (
                      <div className="ah-card">
                        <div className="setup-section-header">
                          <h3 className="ah-section-title">
                            Round {currentRound.roundNumber} -{' '}
                            {currentRound.status === 'open' ? 'Open' : 'Closed'}
                          </h3>
                          {currentRound.status === 'closed' && (
                            <button className="ah-btn-primary" onClick={handleAdvanceRound}>
                              Next Round →
                            </button>
                          )}
                        </div>

                        {currentRound.status === 'open' && (
                          <div>
                            <p className="ah-meta" style={{ marginBottom: '1rem' }}>
                              Assign teams to active players:
                            </p>

                            {/* Team assignment for each active player */}
                            <div className="picks-list">
                              {activePlayers.map((participant) => {
                                const existingPick = picks.find(
                                  (p) => p.playerName === participant.playerName
                                );
                                return (
                                  <div key={participant.id} className="pick-row">
                                    <strong>{participant.playerName}</strong>
                                    <select
                                      className="ah-select"
                                      value={
                                        pickAssignments[participant.playerName] ||
                                        existingPick?.teamId ||
                                        ''
                                      }
                                      onChange={(e) =>
                                        setPickAssignments({
                                          ...pickAssignments,
                                          [participant.playerName]: Number(e.target.value),
                                        })
                                      }
                                    >
                                      <option value="">Select Team</option>
                                      {groupTeams[gameDetail.game.groupId]?.map((team) => {
                                        const alreadyUsed = usedTeams[participant.playerName]?.includes(team.id);
                                        return (
                                          <option
                                            key={team.id}
                                            value={team.id}
                                            disabled={alreadyUsed}
                                            style={alreadyUsed ? { color: '#999', textDecoration: 'line-through' } : {}}
                                          >
                                            {team.name}{alreadyUsed ? ' (used)' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              className="ah-btn-primary"
                              onClick={handleSavePicks}
                              style={{ marginTop: '1rem' }}
                            >
                              Save Picks
                            </button>

                            {/* Results Entry - Team-based */}
                            {picks.length > 0 && (
                              <div style={{ marginTop: '2rem' }}>
                                <h4 className="ah-section-title">Enter Results (by Team)</h4>
                                <p className="ah-meta" style={{ marginBottom: '1rem' }}>
                                  Click result for each team. All players who picked that team will get the same result.
                                </p>

                                <div className="team-results-list">
                                  {(() => {
                                    // Group picks by team
                                    const teamGroups: Record<string, Pick[]> = {};
                                    picks.forEach(pick => {
                                      const teamKey = pick.teamName || 'No team';
                                      if (!teamGroups[teamKey]) {
                                        teamGroups[teamKey] = [];
                                      }
                                      teamGroups[teamKey].push(pick);
                                    });

                                    return Object.entries(teamGroups).map(([teamName, teamPicks]) => {
                                      // Get current result for this team (they should all be the same)
                                      const currentResult = teamPicks[0].result || pickResults[teamPicks[0].id];

                                      const setTeamResult = (result: string) => {
                                        const newResults = { ...pickResults };
                                        teamPicks.forEach(pick => {
                                          newResults[pick.id] = result;
                                        });
                                        setPickResults(newResults);
                                      };

                                      return (
                                        <div key={teamName} className="team-result-row">
                                          <div>
                                            <strong style={{ fontSize: '1.125rem' }}>{teamName}</strong>
                                            <p className="ah-meta">
                                              {teamPicks.map(p => p.playerName).join(', ')}
                                            </p>
                                          </div>
                                          <div className="result-buttons">
                                            <button
                                              className={`result-btn result-btn-win ${currentResult === 'win' ? 'active' : ''}`}
                                              onClick={() => setTeamResult('win')}
                                            >
                                              Win
                                            </button>
                                            <button
                                              className={`result-btn result-btn-loss ${currentResult === 'loss' ? 'active' : ''}`}
                                              onClick={() => setTeamResult('loss')}
                                            >
                                              Loss
                                            </button>
                                            <button
                                              className={`result-btn result-btn-draw ${currentResult === 'draw' ? 'active' : ''}`}
                                              onClick={() => setTeamResult('draw')}
                                            >
                                              Draw
                                            </button>
                                            <button
                                              className={`result-btn ${gameDetail.game.postponeAsWin ? 'result-btn-win' : 'result-btn-loss'} ${currentResult === 'postponed' ? 'active' : ''}`}
                                              onClick={() => setTeamResult('postponed')}
                                            >
                                              Postponed
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>

                                <button
                                  className="ah-btn-primary"
                                  onClick={handleSaveResults}
                                  style={{ marginTop: '1rem' }}
                                >
                                  Save Results & Close Round
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Closed round - show results */}
                        {currentRound.status === 'closed' && (
                          <div>
                            <p className="ah-meta" style={{ marginBottom: '1rem' }}>
                              Round complete. Click "Next Round" to continue or use the Edit tab to make changes.
                            </p>
                            {picks.length > 0 && (
                              <div className="picks-list">
                                {picks.map((pick) => (
                                  <div key={pick.id} className="pick-row">
                                    <div>
                                      <strong>{pick.playerName}</strong>
                                      <p className="ah-meta">{pick.teamName || 'No team'}</p>
                                    </div>
                                    <span
                                      className={`result-badge result-${pick.result || 'none'}`}
                                    >
                                      {pick.result || 'No result'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
          </div>
        )}

        {/* Edit Tab */}
        {activeTab === 'edit' && (
          <div>
            <div className="ah-card">
              <h3 className="ah-section-title">Edit Game Data</h3>
              <p className="ah-meta">Select a game to edit picks and results for any round</p>

              <div style={{ marginTop: '1rem' }}>
                <label className="ah-meta" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Select Game
                </label>
                <select
                  className="ah-select"
                  value={editGameId || ''}
                  onChange={(e) => handleSelectEditGame(parseInt(e.target.value))}
                  style={{ width: '100%', maxWidth: '400px' }}
                >
                  <option value="">-- Choose a game --</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name} ({game.groupName}) - Round {game.currentRound}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {editGameDetail && (
              <div className="ah-card" style={{ marginTop: '1rem' }}>
                <h3 className="ah-section-title">{editGameDetail.game.name}</h3>
                <p className="ah-meta">{editGameDetail.game.groupName}</p>

                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem' }}>Rounds</h4>
                  {editGameDetail.rounds.length === 0 && (
                    <p className="ah-meta">No rounds yet</p>
                  )}

                  {editGameDetail.rounds.map((round) => (
                    <div key={round.id} className="ah-card" style={{ marginBottom: '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleExpandEditRound(round.id)}
                      >
                        <div>
                          <strong>Round {round.roundNumber}</strong>
                          <span
                            className={`game-status status-${round.status === 'open' ? 'active' : 'completed'}`}
                            style={{ marginLeft: '1rem' }}
                          >
                            {round.status}
                          </span>
                        </div>
                        <span>{editExpandedRound === round.id ? '▼' : '▶'}</span>
                      </div>

                      {editExpandedRound === round.id && (
                        <div style={{ marginTop: '1.5rem' }}>
                          {/* Edit Picks Section */}
                          <div style={{ marginBottom: '2rem' }}>
                            <h5 style={{ marginBottom: '1rem' }}>Edit Picks</h5>
                            {editGameDetail.participants.map((participant) => {
                                const currentPick = (editPicks[round.id] || []).find(
                                  (p) => p.playerName === participant.playerName
                                );
                                const isEliminated = !participant.isActive;
                                const eliminatedInThisRound = participant.eliminatedInRound === round.roundNumber;

                                return (
                                  <div key={participant.playerName} className="pick-row">
                                    <div>
                                      <strong>{participant.playerName}</strong>
                                      {isEliminated && (
                                        <span
                                          className="ah-meta"
                                          style={{ marginLeft: '0.5rem', color: '#991B1B' }}
                                        >
                                          (Eliminated R{participant.eliminatedInRound})
                                        </span>
                                      )}
                                      {!currentPick?.teamId && (
                                        <p className="ah-meta" style={{ margin: 0, fontSize: '0.75rem' }}>
                                          No prediction
                                        </p>
                                      )}
                                    </div>
                                    <select
                                      className="ah-select"
                                      value={
                                        editPickAssignments[round.id]?.[participant.playerName] ||
                                        currentPick?.teamId ||
                                        ''
                                      }
                                      onChange={(e) => {
                                        const teamId = parseInt(e.target.value);
                                        setEditPickAssignments((prev) => ({
                                          ...prev,
                                          [round.id]: {
                                            ...(prev[round.id] || {}),
                                            [participant.playerName]: teamId,
                                          },
                                        }));
                                      }}
                                    >
                                      <option value="">-- Select team --</option>
                                      {groupTeams[editGameDetail.game.groupId]?.map((team) => (
                                        <option key={team.id} value={team.id}>
                                          {team.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })}
                            <button
                              className="ah-btn-primary"
                              onClick={() => handleSaveEditPicks(round.id)}
                              style={{ marginTop: '1rem' }}
                            >
                              Save Picks
                            </button>
                          </div>

                          {/* Edit Results Section */}
                          {(editPicks[round.id] || []).some((p) => p.teamId) && (
                            <div>
                              <h5 style={{ marginBottom: '1rem' }}>Edit Results</h5>
                              <div className="team-results-list">
                                {(() => {
                                  const teamGroups: Record<string, Pick[]> = {};
                                  (editPicks[round.id] || []).forEach((pick) => {
                                    const teamKey = pick.teamName || 'No team';
                                    if (!teamGroups[teamKey]) teamGroups[teamKey] = [];
                                    teamGroups[teamKey].push(pick);
                                  });

                                  return Object.entries(teamGroups).map(([teamName, teamPicks]) => {
                                    const firstPick = teamPicks[0];
                                    const currentResult =
                                      editPickResults[round.id]?.[firstPick.id] || firstPick.result || '';

                                    return (
                                      <div key={teamName} className="team-result-row">
                                        <div>
                                          <strong>{teamName}</strong>
                                          <p className="ah-meta">
                                            {teamPicks.map((p) => p.playerName).join(', ')}
                                          </p>
                                        </div>
                                        <div className="result-buttons">
                                          <button
                                            className={`result-btn result-btn-win ${
                                              currentResult === 'win' ? 'active' : ''
                                            }`}
                                            onClick={() => {
                                              teamPicks.forEach((pick) => {
                                                setEditPickResults((prev) => ({
                                                  ...prev,
                                                  [round.id]: {
                                                    ...(prev[round.id] || {}),
                                                    [pick.id]: 'win',
                                                  },
                                                }));
                                              });
                                            }}
                                          >
                                            Win
                                          </button>
                                          <button
                                            className={`result-btn result-btn-draw ${
                                              currentResult === 'draw' ? 'active' : ''
                                            }`}
                                            onClick={() => {
                                              teamPicks.forEach((pick) => {
                                                setEditPickResults((prev) => ({
                                                  ...prev,
                                                  [round.id]: {
                                                    ...(prev[round.id] || {}),
                                                    [pick.id]: 'draw',
                                                  },
                                                }));
                                              });
                                            }}
                                          >
                                            Draw
                                          </button>
                                          <button
                                            className={`result-btn result-btn-loss ${
                                              currentResult === 'loss' ? 'active' : ''
                                            }`}
                                            onClick={() => {
                                              teamPicks.forEach((pick) => {
                                                setEditPickResults((prev) => ({
                                                  ...prev,
                                                  [round.id]: {
                                                    ...(prev[round.id] || {}),
                                                    [pick.id]: 'loss',
                                                  },
                                                }));
                                              });
                                            }}
                                          >
                                            Loss
                                          </button>
                                          <button
                                            className={`result-btn ${
                                              editGameDetail.game.postponeAsWin
                                                ? 'result-btn-win'
                                                : 'result-btn-loss'
                                            } ${currentResult === 'postponed' ? 'active' : ''}`}
                                            onClick={() => {
                                              teamPicks.forEach((pick) => {
                                                setEditPickResults((prev) => ({
                                                  ...prev,
                                                  [round.id]: {
                                                    ...(prev[round.id] || {}),
                                                    [pick.id]: 'postponed',
                                                  },
                                                }));
                                              });
                                            }}
                                          >
                                            Postponed
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                              <button
                                className="ah-btn-primary"
                                onClick={() => handleSaveEditResults(round.id)}
                                style={{ marginTop: '1rem' }}
                              >
                                Save Results
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
