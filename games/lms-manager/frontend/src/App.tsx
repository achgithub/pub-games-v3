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
  winnerMode: string; // 'single', 'multiple'
  rolloverMode: string; // 'round', 'game'
  maxWinners: number;
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
  const [activeTab, setActiveTab] = useState<'setup' | 'games' | 'reports'>('setup');
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  // Report state
  const [reportView, setReportView] = useState<string>(''); // 'report' from URL
  const [reportGameId, setReportGameId] = useState<number>(0);
  const [reportRound, setReportRound] = useState<string>('all'); // 'all' or round number
  const [reportData, setReportData] = useState<any>(null);

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
  const [winnerMode, setWinnerMode] = useState<string>('single');
  const [rolloverMode, setRolloverMode] = useState<string>('round');
  const [maxWinners, setMaxWinners] = useState<number>(4);

  // Game detail state
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pickAssignments, setPickAssignments] = useState<Record<string, number>>({});
  const [pickResults, setPickResults] = useState<Record<number, string>>({});
  const [usedTeams, setUsedTeams] = useState<Record<string, number[]>>({});
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [playersToAdd, setPlayersToAdd] = useState<string[]>([]);
  const [picksFinalized, setPicksFinalized] = useState(false);

  // Player filter state (for round picks)
  const [playerSearchText, setPlayerSearchText] = useState<string>('');
  const [showUnassignedPlayersOnly, setShowUnassignedPlayersOnly] = useState<boolean>(false);

  // Player filter state (for game creation)
  const [gameCreationPlayerSearch, setGameCreationPlayerSearch] = useState<string>('');
  const [showSelectedPlayersOnly, setShowSelectedPlayersOnly] = useState<boolean>(false);

  // Card collapse state
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);

  const toggleCard = (cardName: string) => {
    setCollapsedCards({
      ...collapsedCards,
      [cardName]: !collapsedCards[cardName],
    });
  };

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

  // Check for report view mode from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const gameId = params.get('gameId');

    if (view === 'report' && gameId) {
      setReportView('report');
      setReportGameId(parseInt(gameId));
      setActiveTab('reports');
    }
  }, []);

  // Fetch report data when game is selected
  useEffect(() => {
    if (reportGameId === 0) {
      setReportData(null);
      return;
    }

    const fetchReport = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/report/${reportGameId}`);
        const data = await res.json();
        setReportData(data);
      } catch (err) {
        console.error('Failed to fetch report:', err);
      }
    };

    fetchReport();
  }, [reportGameId]);

  // Fetch games when Games or Reports tab is active
  useEffect(() => {
    if (!token || (activeTab !== 'games' && activeTab !== 'reports')) return;

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

        // Refresh groups list to update team count
        const groupsRes = await fetch(`${API_BASE}/api/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);
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

        // Refresh groups list to update team count
        const groupsRes = await fetch(`${API_BASE}/api/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);
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
          winnerMode: winnerMode,
          rolloverMode: rolloverMode,
          maxWinners: maxWinners,
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
        setWinnerMode('single');
        setRolloverMode('round');
        setMaxWinners(4);
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
    setPicksFinalized(false);
  };

  const handleBackToGamesList = () => {
    setSelectedGameId(null);
    setGameDetail(null);
    setPicks([]);
    setPickAssignments({});
    setPickResults({});
    setPicksFinalized(false);
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

  const handleFinalizePicks = async () => {
    if (!gameDetail || !token) return;

    const latestRound = gameDetail.rounds[gameDetail.rounds.length - 1];
    if (!latestRound) return;

    // First, save any pending picks from pickAssignments
    const picksToSave = Object.entries(pickAssignments).map(([playerName, teamId]) => ({
      playerName,
      teamId,
    }));

    if (picksToSave.length > 0) {
      try {
        await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ picks: picksToSave }),
        });
      } catch (err) {
        console.error('Failed to save pending picks:', err);
        alert('Failed to save pending picks');
        return;
      }
    }

    // Refresh picks to get current state
    try {
      const picksRes = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const picksData = await picksRes.json();
      const currentPicks = picksData.picks || [];

      // Count active players and existing picks
      const activeParticipants = gameDetail.participants.filter((p) => p.isActive);
      const playersWithPicks = currentPicks.filter((p: Pick) => p.teamId).length;
      const missingCount = activeParticipants.length - playersWithPicks;

      if (missingCount > 0) {
        const confirmed = window.confirm(
          `${missingCount} player${missingCount > 1 ? 's have' : ' has'} no pick assigned. Auto-assign next available team alphabetically?`
        );
        if (!confirmed) return;
      }
    } catch (err) {
      console.error('Failed to check picks:', err);
      alert('Failed to check picks');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/finalize-picks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();

        // Refresh picks
        const picksRes = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const picksData = await picksRes.json();
        setPicks(picksData.picks || []);
        setPicksFinalized(true);

        if (data.missingCount > 0) {
          alert(`Picks finalized! Auto-assigned ${data.missingCount} player${data.missingCount > 1 ? 's' : ''}.`);
        } else {
          alert('All picks confirmed! Ready for results entry.');
        }
      } else {
        const error = await res.text();
        alert(`Failed to finalize picks: ${error}`);
      }
    } catch (err) {
      console.error('Failed to finalize picks:', err);
      alert('Failed to finalize picks');
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
        alert('Results saved');
        // Refresh picks to show updated results
        const picksRes = await fetch(`${API_BASE}/api/rounds/${latestRound.id}/picks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const picksData = await picksRes.json();
        setPicks(picksData.picks || []);
      } else {
        const error = await res.text();
        alert(`Failed to save results: ${error}`);
      }
    } catch (err) {
      console.error('Failed to save results:', err);
      alert('Failed to save results');
    }
  };

  const handleCloseRound = async () => {
    if (!gameDetail || !token) return;

    const latestRound = gameDetail.rounds[gameDetail.rounds.length - 1];
    if (!latestRound) return;

    // Check that all picks have results
    const allPicksHaveResults = picks.every((pick) => pickResults[pick.id] || pick.result);
    if (!allPicksHaveResults) {
      if (!window.confirm('Not all picks have results. Close round anyway?')) {
        return;
      }
    }

    // Save any pending results first
    const resultsToSave = Object.entries(pickResults).map(([pickId, result]) => ({
      pickId: Number(pickId),
      result,
    }));

    if (resultsToSave.length > 0) {
      try {
        await fetch(`${API_BASE}/api/rounds/${latestRound.id}/results`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ results: resultsToSave }),
        });
      } catch (err) {
        console.error('Failed to save results before closing:', err);
        alert('Failed to save results');
        return;
      }
    }

    // Close the round
    alert('Round closed');
    // Refresh game detail
    const gameRes = await fetch(`${API_BASE}/api/games/${selectedGameId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const gameData = await gameRes.json();
    setGameDetail(gameData);
    setPickResults({});
    setPicksFinalized(false);
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
          setPicksFinalized(false); // Reset for new round
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
            className={`ah-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
        </div>

        {/* Setup Tab */}
        {activeTab === 'setup' && (
          <div>
            {/* Groups & Teams Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleCard('groups')}>
                <h3 className="ah-section-title">
                  {collapsedCards['groups'] ? '▶' : '▼'} Groups & Teams ({groups.length})
                </h3>
              </div>

              {!collapsedCards['groups'] && (
              <>
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
              </>
              )}
            </div>

            {/* Player Pool Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleCard('players')}>
                <h3 className="ah-section-title">
                  {collapsedCards['players'] ? '▶' : '▼'} Player Pool ({players.length})
                </h3>
              </div>

              {!collapsedCards['players'] && (
              <>
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
              </>
              )}
            </div>
          </div>
        )}

        {/* Games Tab */}
        {activeTab === 'games' && !selectedGameId && (
          <div>
            {/* Create Game Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleCard('createGame')}>
                <h3 className="ah-section-title">
                  {collapsedCards['createGame'] ? '▶' : '▼'} Create New Game
                </h3>
              </div>

              {!collapsedCards['createGame'] && (
              <>
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
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="ah-btn-outline" onClick={handleSelectAll} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                          Select All
                        </button>
                        <button className="ah-btn-outline" onClick={handleDeselectAll} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Player filters */}
                    <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#FAFAF9', borderRadius: '8px', border: '1px solid #E7E5E4' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Search players by name..."
                          value={gameCreationPlayerSearch}
                          onChange={(e) => setGameCreationPlayerSearch(e.target.value)}
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
                      {players.filter((player) => {
                        // Text search filter
                        const matchesSearch = !gameCreationPlayerSearch ||
                          player.name.toLowerCase().includes(gameCreationPlayerSearch.toLowerCase());

                        // Selected filter
                        const matchesSelected = !showSelectedPlayersOnly ||
                          selectedPlayerNames.includes(player.name);

                        return matchesSearch && matchesSelected;
                      }).map((player) => (
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

                  <div style={{ marginTop: '1rem' }}>
                    <strong>Winner Mode:</strong>
                    <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                        <input
                          type="radio"
                          name="winnerMode"
                          value="single"
                          checked={winnerMode === 'single'}
                          onChange={(e) => setWinnerMode(e.target.value)}
                        />
                        <span style={{ marginLeft: '0.5rem' }}>1 winner only (default)</span>
                      </label>
                      <label style={{ display: 'block' }}>
                        <input
                          type="radio"
                          name="winnerMode"
                          value="multiple"
                          checked={winnerMode === 'multiple'}
                          onChange={(e) => setWinnerMode(e.target.value)}
                        />
                        <span style={{ marginLeft: '0.5rem' }}>Multiple winners allowed</span>
                      </label>
                    </div>
                  </div>

                  {winnerMode === 'multiple' && (
                    <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                      <label>
                        <strong>Max Winners:</strong>{' '}
                        <input
                          type="number"
                          min="2"
                          max="100"
                          value={maxWinners}
                          onChange={(e) => setMaxWinners(parseInt(e.target.value) || 4)}
                          style={{ width: '80px', marginLeft: '0.5rem' }}
                          className="ah-input"
                        />
                      </label>
                    </div>
                  )}

                  <div style={{ marginTop: '1rem' }}>
                    <strong>Rollover Mode:</strong>
                    <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                        <input
                          type="radio"
                          name="rolloverMode"
                          value="round"
                          checked={rolloverMode === 'round'}
                          onChange={(e) => setRolloverMode(e.target.value)}
                        />
                        <span style={{ marginLeft: '0.5rem' }}>Rollover round (default)</span>
                      </label>
                      <label style={{ display: 'block' }}>
                        <input
                          type="radio"
                          name="rolloverMode"
                          value="game"
                          checked={rolloverMode === 'game'}
                          onChange={(e) => setRolloverMode(e.target.value)}
                        />
                        <span style={{ marginLeft: '0.5rem' }}>Rollover game</span>
                      </label>
                    </div>
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
              </>
              )}
            </div>

            {/* Games List Section */}
            <div className="ah-card setup-section">
              <div className="setup-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleCard('activeGames')}>
                <h3 className="ah-section-title">
                  {collapsedCards['activeGames'] ? '▶' : '▼'} Active Games ({games.length})
                </h3>
              </div>

              {!collapsedCards['activeGames'] && (
              <>
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
              </>
              )}
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
                <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#78716C' }}>
                  <strong>Configuration:</strong>{' '}
                  {gameDetail.game.postponeAsWin ? 'Postpone=Win' : 'Postpone=Loss'} •{' '}
                  {gameDetail.game.winnerMode === 'single' ? '1 Winner' : `Multiple Winners (max ${gameDetail.game.maxWinners})`} •{' '}
                  {gameDetail.game.rolloverMode === 'round' ? 'Rollover Round' : 'Rollover Game'}
                </div>
                {gameDetail.game.status === 'completed' && gameDetail.game.winnerName && (
                  <p style={{ marginTop: '0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
                    Winner: {gameDetail.game.winnerName} 🏆
                  </p>
                )}
              </div>
            </div>

            {/* Participants */}
            <div className="ah-card">
              <div className="setup-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleCard('participants')}>
                <h3 className="ah-section-title">
                  {collapsedCards['participants'] ? '▶' : '▼'} Participants ({gameDetail.participants.length})
                </h3>
                {gameDetail.game.status === 'active' && !collapsedCards['participants'] && (
                  <button
                    className="ah-btn-outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddPlayers(!showAddPlayers);
                    }}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    {showAddPlayers ? 'Cancel' : '+ Add Players'}
                  </button>
                )}
              </div>

              {!collapsedCards['participants'] && (
              <>

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
              </>
              )}
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
                        <div className="setup-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleCard('round')}>
                          <h3 className="ah-section-title">
                            {collapsedCards['round'] ? '▶' : '▼'} Round {currentRound.roundNumber} -{' '}
                            {currentRound.status === 'open' ? 'Open' : 'Closed'}
                          </h3>
                          {currentRound.status === 'closed' && !collapsedCards['round'] && (
                            <button className="ah-btn-primary" onClick={(e) => { e.stopPropagation(); handleAdvanceRound(); }}>
                              Next Round →
                            </button>
                          )}
                        </div>

                        {!collapsedCards['round'] && (
                        <>
                        {currentRound.status === 'open' && (
                          <div>
                            <p className="ah-meta" style={{ marginBottom: '1rem' }}>
                              Assign teams to active players:
                            </p>

                            {/* Player filters */}
                            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#FAFAF9', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 300px' }}>
                                  <input
                                    type="text"
                                    placeholder="Search players (e.g., 'Dave P' to find Dave P...)"
                                    value={playerSearchText}
                                    onChange={(e) => setPlayerSearchText(e.target.value)}
                                    className="ah-input"
                                    style={{ width: '100%' }}
                                  />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                                  <input
                                    type="checkbox"
                                    checked={showUnassignedPlayersOnly}
                                    onChange={(e) => setShowUnassignedPlayersOnly(e.target.checked)}
                                  />
                                  <span>Show unassigned only</span>
                                </label>
                              </div>
                            </div>

                            {/* Team assignment for each active player */}
                            <div className="picks-list">
                              {activePlayers.filter((participant) => {
                                const existingPick = picks.find(
                                  (p) => p.playerName === participant.playerName
                                );
                                const hasAssignment = pickAssignments[participant.playerName] || existingPick?.teamId;

                                // Player name search filter (case insensitive)
                                const matchesSearch = !playerSearchText ||
                                  participant.playerName.toLowerCase().includes(playerSearchText.toLowerCase());

                                // Unassigned players only filter
                                const matchesUnassigned = !showUnassignedPlayersOnly || !hasAssignment;

                                return matchesSearch && matchesUnassigned;
                              }).map((participant) => {
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

                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="ah-btn-outline"
                                onClick={handleSavePicks}
                              >
                                Save Picks
                              </button>
                              {!picksFinalized && (
                                <button
                                  className="ah-btn-primary"
                                  onClick={handleFinalizePicks}
                                >
                                  Finalize Picks
                                </button>
                              )}
                            </div>

                            {/* Results Entry - Team-based (only after finalize) */}
                            {picksFinalized && picks.length > 0 && (
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

                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button
                                    className="ah-btn-outline"
                                    onClick={handleSaveResults}
                                  >
                                    Save Results
                                  </button>
                                  <button
                                    className="ah-btn-primary"
                                    onClick={handleCloseRound}
                                  >
                                    Close Round
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Closed round - show results */}
                        {currentRound.status === 'closed' && (
                          <div>
                            <p className="ah-meta" style={{ marginBottom: '1rem' }}>
                              Round complete. Click "Next Round" to continue.
                            </p>
                            {picks.filter(p => p.result).length > 0 && (
                              <div className="picks-list">
                                {picks.filter(p => p.result).map((pick) => (
                                  <div key={pick.id} className="pick-row">
                                    <div>
                                      <strong>{pick.playerName}</strong>
                                      <p className="ah-meta">{pick.teamName || 'No team'}</p>
                                    </div>
                                    <span
                                      className={`result-badge result-${pick.result}`}
                                    >
                                      {pick.result}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div>
            <div className="ah-card">
              <h3 className="ah-section-title">Game Reports</h3>

              {/* Game Selection */}
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  <strong>Select Game:</strong>
                </label>
                <select
                  className="ah-select"
                  value={reportGameId}
                  onChange={(e) => setReportGameId(parseInt(e.target.value))}
                  style={{ width: '100%', maxWidth: '400px' }}
                >
                  <option value={0}>-- Select a game --</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name} ({game.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Round Selection */}
              {reportGameId > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                    <strong>Select Round:</strong>
                  </label>
                  <select
                    className="ah-select"
                    value={reportRound}
                    onChange={(e) => setReportRound(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}
                  >
                    <option value="all">All Rounds</option>
                    {(() => {
                      const selectedGame = games.find(g => g.id === reportGameId);
                      if (!selectedGame) return null;
                      return Array.from({ length: selectedGame.currentRound }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Round {i + 1}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              )}
            </div>

            {/* Report Display */}
            {reportGameId > 0 && reportData && (
              <div style={{ marginTop: '1rem' }}>
                {/* Game Header */}
                <div className="ah-card">
                  <h2 style={{ marginBottom: '0.5rem' }}>{reportData.game.name}</h2>
                  <p className="ah-meta">
                    Status: {reportData.game.status}
                    {reportData.game.winnerName && ` | Winner: ${reportData.game.winnerName}`}
                  </p>
                </div>

                {/* Rounds Display */}
                {reportData.rounds && reportData.rounds.length > 0 && (
                  <>
                    {reportData.rounds
                      .filter((round: any) => reportRound === 'all' || round.roundNumber === parseInt(reportRound))
                      .map((round: any) => (
                        <div key={round.roundNumber} className="ah-card" style={{ marginTop: '1rem' }}>
                          <h3 className="ah-section-title">
                            Round {round.roundNumber} - {round.status === 'open' ? 'OPEN' : 'CLOSED'}
                          </h3>

                          {round.status === 'open' && (
                            <div style={{ marginTop: '1rem' }}>
                              <p><strong>Active Players:</strong> {round.activePlayers}</p>
                              {round.teamPicks && Object.keys(round.teamPicks).length > 0 && (
                                <div style={{ marginTop: '1rem' }}>
                                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Team Picks:</p>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                                    {Object.entries(round.teamPicks)
                                      .sort(([, a]: any, [, b]: any) => b - a)
                                      .map(([team, count]: any) => (
                                        <div key={team} style={{ padding: '0.5rem', background: '#FAFAF9', borderRadius: '4px' }}>
                                          {team} ({count})
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {round.status === 'closed' && (
                            <div style={{ marginTop: '1rem' }}>
                              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                                <p><strong>Eliminated:</strong> {round.eliminatedCount} players</p>
                                <p><strong>Through to Round {round.roundNumber + 1}:</strong> {round.throughCount} players</p>
                              </div>
                              {round.teamResults && Object.keys(round.teamResults).length > 0 && (
                                <div>
                                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Team Results:</p>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                                    {Object.entries(round.teamResults)
                                      .sort(([a]: any, [b]: any) => a.localeCompare(b))
                                      .map(([team, result]: any) => (
                                        <div
                                          key={team}
                                          style={{
                                            padding: '0.5rem',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                            background: result === 'win' ? '#D1FAE5' :
                                                       result === 'loss' ? '#FEE2E2' :
                                                       result === 'draw' ? '#FED7AA' : '#DBEAFE',
                                            color: result === 'win' ? '#065F46' :
                                                   result === 'loss' ? '#991B1B' :
                                                   result === 'draw' ? '#9A3412' : '#1E3A8A'
                                          }}
                                        >
                                          {team} - {result.toUpperCase()}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
