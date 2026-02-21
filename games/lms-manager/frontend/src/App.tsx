import React, { useState, useEffect } from 'react';
import './App.css';

// Types matching backend models
interface Team {
  id: number;
  teamName: string;
}

interface Player {
  id: number;
  playerNickname: string;
}

interface Game {
  id: number;
  gameName: string;
  status: string;
  winnerNames: string[];
  createdAt: string;
}

interface Round {
  id: number;
  roundNumber: number;
  status: string;
}

interface Pick {
  id: number;
  playerNickname: string;
  teamName: string;
  result: string | null;
}

interface TeamSummary {
  teamName: string;
  count: number;
  managerPicked: boolean;
}

interface RoundReport {
  roundNumber: number;
  status: string;
  activePlayers: number;
  teamSummary: TeamSummary[];
  eliminatedList: string[];
}

interface GameReport {
  gameId: number;
  gameName: string;
  status: string;
  winnerNames: string[];
  rounds: RoundReport[];
}

function App() {
  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  const reportGameId = params.get('gameId');
  const isReportMode = reportGameId !== null;

  // State
  const [activeTab, setActiveTab] = useState<'teams' | 'players' | 'games' | 'management'>('teams');

  // Teams tab
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');

  // Players tab
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerNickname, setNewPlayerNickname] = useState('');

  // Games tab
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [newGameName, setNewGameName] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [showCreateGame, setShowCreateGame] = useState(false);

  // Management tab
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);

  // Report mode
  const [gameReport, setGameReport] = useState<GameReport | null>(null);

  // Fetch data based on active tab
  useEffect(() => {
    if (isReportMode) {
      fetchGameReport(parseInt(reportGameId!));
    } else {
      if (activeTab === 'teams') fetchTeams();
      else if (activeTab === 'players') fetchPlayers();
      else if (activeTab === 'games') fetchGames();
    }
  }, [activeTab, isReportMode, reportGameId]);

  // Fetch rounds when game selected
  useEffect(() => {
    if (selectedGameId && activeTab === 'management') {
      fetchRounds(selectedGameId);
    }
  }, [selectedGameId, activeTab]);

  // Fetch picks when round selected
  useEffect(() => {
    if (selectedRoundId) {
      fetchPicks(selectedRoundId);
      fetchAvailableTeams(selectedRoundId);
      fetchAvailablePlayers(selectedRoundId);
    }
  }, [selectedRoundId]);

  // API calls
  const fetchTeams = async () => {
    const response = await fetch('/api/teams');
    if (response.ok) {
      setTeams(await response.json());
    }
  };

  const fetchPlayers = async () => {
    const response = await fetch('/api/players');
    if (response.ok) {
      setPlayers(await response.json());
    }
  };

  const fetchGames = async () => {
    const response = await fetch('/api/games');
    if (response.ok) {
      setGames(await response.json());
    }
  };

  const fetchRounds = async (gameId: number) => {
    const response = await fetch(`/api/games/${gameId}/rounds`);
    if (response.ok) {
      setRounds(await response.json());
    }
  };

  const fetchPicks = async (roundId: number) => {
    const response = await fetch(`/api/rounds/${roundId}/picks`);
    if (response.ok) {
      setPicks(await response.json());
    }
  };

  const fetchAvailableTeams = async (roundId: number) => {
    const response = await fetch(`/api/rounds/${roundId}/available-teams`);
    if (response.ok) {
      setAvailableTeams(await response.json());
    }
  };

  const fetchAvailablePlayers = async (roundId: number) => {
    const response = await fetch(`/api/rounds/${roundId}/available-players`);
    if (response.ok) {
      setAvailablePlayers(await response.json());
    }
  };

  const fetchGameReport = async (gameId: number) => {
    const response = await fetch(`/api/games/${gameId}/report`);
    if (response.ok) {
      setGameReport(await response.json());
    }
  };

  // Actions
  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    const response = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamName: newTeamName }),
    });
    if (response.ok) {
      setNewTeamName('');
      fetchTeams();
    }
  };

  const deleteTeam = async (id: number) => {
    if (!window.confirm('Delete this team?')) return;
    const response = await fetch(`/api/teams/${id}`, { method: 'DELETE' });
    if (response.ok) fetchTeams();
  };

  const createPlayer = async () => {
    if (!newPlayerNickname.trim()) return;
    const response = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerNickname: newPlayerNickname }),
    });
    if (response.ok) {
      setNewPlayerNickname('');
      fetchPlayers();
    }
  };

  const deletePlayer = async (id: number) => {
    if (!window.confirm('Delete this player?')) return;
    const response = await fetch(`/api/players/${id}`, { method: 'DELETE' });
    if (response.ok) fetchPlayers();
  };

  const createGame = async () => {
    if (!newGameName.trim() || selectedTeams.length === 0 || selectedPlayers.length === 0) {
      alert('Please provide game name, teams, and players');
      return;
    }
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameName: newGameName,
        teams: selectedTeams,
        players: selectedPlayers,
      }),
    });
    if (response.ok) {
      setNewGameName('');
      setSelectedTeams([]);
      setSelectedPlayers([]);
      setShowCreateGame(false);
      fetchGames();
    }
  };

  const deleteGame = async (id: number) => {
    if (!window.confirm('Delete this game? This will remove all rounds and picks.')) return;
    const response = await fetch(`/api/games/${id}`, { method: 'DELETE' });
    if (response.ok) {
      if (selectedGameId === id) setSelectedGameId(null);
      fetchGames();
    }
  };

  const createRound = async () => {
    if (!selectedGameId) return;
    const response = await fetch(`/api/games/${selectedGameId}/rounds`, {
      method: 'POST',
    });
    if (response.ok) {
      fetchRounds(selectedGameId);
    }
  };

  const createPick = async (playerNickname: string, teamName: string) => {
    if (!selectedRoundId) return;
    const response = await fetch(`/api/rounds/${selectedRoundId}/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerNickname, teamName }),
    });
    if (response.ok) {
      fetchPicks(selectedRoundId);
      fetchAvailableTeams(selectedRoundId);
      fetchAvailablePlayers(selectedRoundId);
    }
  };

  const setPickResult = async (pickId: number, result: 'win' | 'lose') => {
    const response = await fetch(`/api/picks/${pickId}/result`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    });
    if (response.ok) {
      fetchPicks(selectedRoundId!);
    }
  };

  const closeRound = async (roundId: number) => {
    const response = await fetch(`/api/rounds/${roundId}/close`, { method: 'POST' });
    if (response.ok) {
      fetchRounds(selectedGameId!);
    }
  };

  const processRound = async (roundId: number) => {
    const response = await fetch(`/api/rounds/${roundId}/process`, { method: 'POST' });
    if (response.ok) {
      alert('Round processed - eliminated players updated');
      fetchRounds(selectedGameId!);
    }
  };

  const declareWinner = async (gameId: number) => {
    if (!window.confirm('Declare all active players as winners and complete the game?')) return;
    const response = await fetch(`/api/games/${gameId}/declare-winner`, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      alert(`Winners: ${data.winners.join(', ')}`);
      fetchGames();
      setSelectedGameId(null);
    }
  };

  // Report mode view
  if (isReportMode && gameReport) {
    return (
      <div className="ah-container ah-container--narrow">
        <div className="ah-card">
          <div className="report-header">
            <div className="report-title">{gameReport.gameName}</div>
            <div className="report-meta">
              Status: <strong>{gameReport.status}</strong>
            </div>
          </div>

          {gameReport.winnerNames.length > 0 && (
            <div className="winners-section">
              <div className="winners-title">🏆 Winners</div>
              <div className="winner-list">
                {gameReport.winnerNames.map(name => (
                  <div key={name} className="winner-name">{name}</div>
                ))}
              </div>
            </div>
          )}

          {gameReport.rounds.map(round => (
            <div key={round.roundNumber} className="round-report">
              <div className="round-report-header">
                <div className="round-report-title">Round {round.roundNumber}</div>
                <div className="active-count">{round.activePlayers} active</div>
              </div>

              {round.teamSummary.length > 0 && (
                <div className="team-summary">
                  {round.teamSummary.map(ts => (
                    <div
                      key={ts.teamName}
                      className={`team-summary-item ${ts.managerPicked ? 'manager-picked' : ''}`}
                    >
                      <div className={`team-name ${ts.managerPicked ? 'manager-picked' : ''}`}>
                        {ts.teamName}
                      </div>
                      <div className="team-count">{ts.count}</div>
                    </div>
                  ))}
                </div>
              )}

              {round.eliminatedList.length > 0 && (
                <div className="eliminated-section">
                  <div className="eliminated-title">Eliminated</div>
                  <div className="eliminated-list">
                    {round.eliminatedList.map(player => (
                      <div key={player} className="eliminated-player">{player}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Main manager interface
  return (
    <div className="ah-container ah-container--narrow">
      <div className="ah-card">
        <h1>🎯 LMS Manager</h1>
        <p className="ah-meta">Manage Last Man Standing games</p>

        <div className="ah-tabs">
          <button
            className={`ah-tab ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            Teams
          </button>
          <button
            className={`ah-tab ${activeTab === 'players' ? 'active' : ''}`}
            onClick={() => setActiveTab('players')}
          >
            Players
          </button>
          <button
            className={`ah-tab ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            Games
          </button>
          <button
            className={`ah-tab ${activeTab === 'management' ? 'active' : ''}`}
            onClick={() => setActiveTab('management')}
            disabled={!selectedGameId}
          >
            Management
          </button>
        </div>

        {/* TEAMS TAB */}
        {activeTab === 'teams' && (
          <div>
            <h2>Master Team Data</h2>
            <div className="form-row">
              <input
                type="text"
                className="ah-input"
                placeholder="Team name"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && createTeam()}
              />
              <button className="ah-btn-primary" onClick={createTeam}>Add Team</button>
            </div>

            {teams.length === 0 ? (
              <div className="list-empty">No teams yet. Add your first team above.</div>
            ) : (
              teams.map(team => (
                <div key={team.id} className="list-item">
                  <div className="list-item-name">{team.teamName}</div>
                  <button className="ah-btn-danger" onClick={() => deleteTeam(team.id)}>Delete</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* PLAYERS TAB */}
        {activeTab === 'players' && (
          <div>
            <h2>Master Player Data</h2>
            <div className="form-row">
              <input
                type="text"
                className="ah-input"
                placeholder="Player nickname"
                value={newPlayerNickname}
                onChange={e => setNewPlayerNickname(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && createPlayer()}
              />
              <button className="ah-btn-primary" onClick={createPlayer}>Add Player</button>
            </div>

            {players.length === 0 ? (
              <div className="list-empty">No players yet. Add your first player above.</div>
            ) : (
              players.map(player => (
                <div key={player.id} className="list-item">
                  <div className="list-item-name">{player.playerNickname}</div>
                  <button className="ah-btn-danger" onClick={() => deletePlayer(player.id)}>Delete</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* GAMES TAB */}
        {activeTab === 'games' && (
          <div>
            <h2>Games</h2>
            <button className="ah-btn-primary" onClick={() => setShowCreateGame(!showCreateGame)}>
              {showCreateGame ? 'Cancel' : 'Create New Game'}
            </button>

            {showCreateGame && (
              <div className="ah-card" style={{ marginTop: '16px' }}>
                <h3>New Game</h3>
                <input
                  type="text"
                  className="ah-input"
                  placeholder="Game name"
                  value={newGameName}
                  onChange={e => setNewGameName(e.target.value)}
                  style={{ marginBottom: '12px' }}
                />

                <h4>Select Teams</h4>
                {teams.map(team => (
                  <label key={team.id} style={{ display: 'block', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.teamName)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedTeams([...selectedTeams, team.teamName]);
                        } else {
                          setSelectedTeams(selectedTeams.filter(t => t !== team.teamName));
                        }
                      }}
                    />
                    {' '}{team.teamName}
                  </label>
                ))}

                <h4 style={{ marginTop: '16px' }}>Select Players</h4>
                {players.map(player => (
                  <label key={player.id} style={{ display: 'block', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(player.playerNickname)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedPlayers([...selectedPlayers, player.playerNickname]);
                        } else {
                          setSelectedPlayers(selectedPlayers.filter(p => p !== player.playerNickname));
                        }
                      }}
                    />
                    {' '}{player.playerNickname}
                  </label>
                ))}

                <button className="ah-btn-primary" onClick={createGame} style={{ marginTop: '16px' }}>
                  Create Game
                </button>
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              {games.length === 0 ? (
                <div className="list-empty">No games yet.</div>
              ) : (
                games.map(game => (
                  <div
                    key={game.id}
                    className={`game-card ${selectedGameId === game.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedGameId(game.id);
                      setActiveTab('management');
                    }}
                  >
                    <div className="game-card-header">
                      <div className="game-card-title">{game.gameName}</div>
                      <div className={`game-card-status ${game.status}`}>{game.status}</div>
                    </div>
                    <div className="game-card-meta">
                      {game.winnerNames.length > 0 && `Winners: ${game.winnerNames.join(', ')}`}
                    </div>
                    <button
                      className="ah-btn-danger"
                      onClick={e => {
                        e.stopPropagation();
                        deleteGame(game.id);
                      }}
                      style={{ marginTop: '8px' }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MANAGEMENT TAB */}
        {activeTab === 'management' && selectedGameId && (
          <div>
            <h2>{games.find(g => g.id === selectedGameId)?.gameName}</h2>
            <button className="ah-btn-primary" onClick={createRound}>Create New Round</button>
            <button
              className="ah-btn-outline"
              onClick={() => declareWinner(selectedGameId)}
              style={{ marginLeft: '8px' }}
            >
              Declare Winner
            </button>

            <div className="round-list">
              {rounds.map(round => (
                <div key={round.id} className="round-item">
                  <div className="round-header">
                    <div className="round-title">Round {round.roundNumber} - {round.status}</div>
                    <div className="round-actions">
                      <button
                        className="ah-btn-outline"
                        onClick={() => setSelectedRoundId(round.id)}
                      >
                        {selectedRoundId === round.id ? 'Hide' : 'Manage'}
                      </button>
                      {round.status === 'open' && (
                        <button className="ah-btn-outline" onClick={() => closeRound(round.id)}>
                          Close
                        </button>
                      )}
                      {round.status === 'closed' && (
                        <button className="ah-btn-primary" onClick={() => processRound(round.id)}>
                          Process
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedRoundId === round.id && (
                    <div>
                      {availablePlayers.length > 0 && availableTeams.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <h4>Add Pick</h4>
                          <div className="form-row">
                            <select
                              className="ah-select"
                              id="pick-player"
                              defaultValue=""
                            >
                              <option value="" disabled>Select player</option>
                              {availablePlayers.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                            <select
                              className="ah-select"
                              id="pick-team"
                              defaultValue=""
                            >
                              <option value="" disabled>Select team</option>
                              {availableTeams.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <button
                              className="ah-btn-primary"
                              onClick={() => {
                                const playerSelect = document.getElementById('pick-player') as HTMLSelectElement;
                                const teamSelect = document.getElementById('pick-team') as HTMLSelectElement;
                                if (playerSelect.value && teamSelect.value) {
                                  createPick(playerSelect.value, teamSelect.value);
                                  playerSelect.value = '';
                                  teamSelect.value = '';
                                }
                              }}
                            >
                              Add Pick
                            </button>
                          </div>
                        </div>
                      )}

                      <h4>Picks</h4>
                      {picks.length === 0 ? (
                        <div className="list-empty">No picks yet</div>
                      ) : (
                        <table className="pick-table">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Team</th>
                              <th>Result</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {picks.map(pick => (
                              <tr key={pick.id}>
                                <td>{pick.playerNickname}</td>
                                <td>{pick.teamName}</td>
                                <td>
                                  {pick.result && (
                                    <span className={`result-indicator ${pick.result}`}>
                                      {pick.result}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {!pick.result && (
                                    <>
                                      <button
                                        className="ah-btn-outline"
                                        onClick={() => setPickResult(pick.id, 'win')}
                                        style={{ marginRight: '4px' }}
                                      >
                                        Win
                                      </button>
                                      <button
                                        className="ah-btn-outline"
                                        onClick={() => setPickResult(pick.id, 'lose')}
                                      >
                                        Lose
                                      </button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
