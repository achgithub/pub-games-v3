import React, { useState, useEffect, useCallback } from 'react';

// Types
interface Team {
  id: number;
  userId: string;
  sport: string;
  name: string;
  createdAt: string;
}

interface Match {
  id?: number;
  scheduleId?: number;
  matchDate: string;
  homeTeam: string;
  awayTeam: string | null;
  matchOrder: number;
  createdAt?: string;
}

interface Schedule {
  id?: number;
  userId: string;
  sport: string;
  name: string;
  version: number;
  dayOfWeek: string;
  seasonStart: string;
  seasonEnd: string;
  createdAt?: string;
  matches?: Match[];
}

interface Holiday {
  date: string;
  title: string;
  notes: string;
}

type TabType = 'setup' | 'schedule' | 'output';

const App: React.FC = () => {
  // Get URL parameters
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId') || 'demo-user';
  const userName = params.get('userName') || 'Demo User';

  // State
  const [activeTab, setActiveTab] = useState<TabType>('setup');
  const [sport, setSport] = useState<string>('darts');
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('wednesday');
  const [seasonStart, setSeasonStart] = useState('');
  const [seasonEnd, setSeasonEnd] = useState('');
  const [excludeDates] = useState<string[]>([]); // Future feature: exclude specific dates
  const [generatedMatches, setGeneratedMatches] = useState<Match[]>([]);
  const [scheduleMessage, setScheduleMessage] = useState<string>('');
  const [savedSchedules, setSavedSchedules] = useState<Schedule[]>([]);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleVersion, setScheduleVersion] = useState(1);
  const [loading, setLoading] = useState(false);

  const API_BASE = window.location.origin;

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/teams?userId=${userId}&sport=${sport}`);
      const data = await res.json();
      setTeams(data || []);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  }, [API_BASE, userId, sport]);

  const loadSavedSchedules = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/schedules?userId=${userId}`);
      const data = await res.json();
      setSavedSchedules(data || []);
    } catch (err) {
      console.error('Failed to load saved schedules:', err);
    }
  }, [API_BASE, userId]);

  // Load teams when sport changes
  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Load saved schedules on mount
  useEffect(() => {
    loadSavedSchedules();
  }, [loadSavedSchedules]);

  const addTeam = async () => {
    if (!newTeamName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sport, name: newTeamName }),
      });

      if (res.ok) {
        setNewTeamName('');
        loadTeams();
      } else {
        const error = await res.text();
        alert(`Failed to add team: ${error}`);
      }
    } catch (err) {
      console.error('Failed to add team:', err);
    }
  };

  const deleteTeam = async (teamId: number) => {
    try {
      await fetch(`${API_BASE}/api/teams/${teamId}?userId=${userId}`, {
        method: 'DELETE',
      });
      loadTeams();
    } catch (err) {
      console.error('Failed to delete team:', err);
    }
  };

  const loadHolidays = async () => {
    if (!seasonStart || !seasonEnd) return;

    try {
      const res = await fetch(`${API_BASE}/api/holidays?start=${seasonStart}&end=${seasonEnd}`);
      const data = await res.json();
      setHolidays(data || []);
    } catch (err) {
      console.error('Failed to load holidays:', err);
    }
  };

  const generateSchedule = async () => {
    if (teams.length < 2) {
      alert('Need at least 2 teams');
      return;
    }

    if (!seasonStart || !seasonEnd) {
      alert('Please set season start and end dates');
      return;
    }

    setLoading(true);
    try {
      const teamNames = teams.map(t => t.name);
      const res = await fetch(`${API_BASE}/api/schedule/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sport,
          teams: teamNames,
          dayOfWeek,
          seasonStart,
          seasonEnd,
          excludeDates,
        }),
      });

      const data = await res.json();
      setGeneratedMatches(data.matches || []);
      setScheduleMessage(data.message);

      if (data.status === 'ok') {
        setActiveTab('schedule');
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Failed to generate schedule:', err);
      alert('Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  };

  const moveMatch = (fromIndex: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let toIndex = fromIndex;

    if (direction === 'up' && fromIndex > 0) {
      toIndex = fromIndex - 1;
    } else if (direction === 'down' && fromIndex < generatedMatches.length - 1) {
      toIndex = fromIndex + 1;
    } else if (direction === 'top') {
      toIndex = 0;
    } else if (direction === 'bottom') {
      toIndex = generatedMatches.length - 1;
    } else {
      return; // No movement needed
    }

    const newMatches = [...generatedMatches];
    const [removed] = newMatches.splice(fromIndex, 1);
    newMatches.splice(toIndex, 0, removed);

    // Update match order
    const updated = newMatches.map((m, i) => ({ ...m, matchOrder: i }));
    setGeneratedMatches(updated);
  };

  const saveSchedule = async () => {
    if (!scheduleName.trim()) {
      alert('Please enter a schedule name');
      return;
    }

    try {
      const schedule: Schedule = {
        userId,
        sport,
        name: scheduleName,
        version: scheduleVersion,
        dayOfWeek,
        seasonStart,
        seasonEnd,
      };

      const res = await fetch(`${API_BASE}/api/schedule/0`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule,
          matches: generatedMatches,
          dates: [],
        }),
      });

      if (res.ok) {
        alert('Schedule saved successfully!');
        loadSavedSchedules();
        setActiveTab('output');
      } else {
        alert('Failed to save schedule');
      }
    } catch (err) {
      console.error('Failed to save schedule:', err);
      alert('Failed to save schedule');
    }
  };

  const downloadSchedule = async (scheduleId: number) => {
    window.open(`${API_BASE}/api/schedules/${scheduleId}/download?userId=${userId}`, '_blank');
  };

  // Styles
  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      fontFamily: 'Arial, sans-serif',
      maxWidth: '900px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f9f9f9',
    },
    header: {
      textAlign: 'center',
      marginBottom: '20px',
    },
    tabs: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      borderBottom: '2px solid #ddd',
    },
    tab: {
      padding: '10px 20px',
      cursor: 'pointer',
      backgroundColor: '#fff',
      border: '1px solid #ddd',
      borderBottom: 'none',
      borderRadius: '5px 5px 0 0',
    },
    activeTab: {
      backgroundColor: '#4CAF50',
      color: '#fff',
      fontWeight: 'bold',
    },
    content: {
      backgroundColor: '#fff',
      padding: '20px',
      borderRadius: '5px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    input: {
      width: '100%',
      padding: '8px',
      marginBottom: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      boxSizing: 'border-box' as const,
    },
    button: {
      padding: '10px 20px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      marginRight: '10px',
    },
    deleteButton: {
      padding: '5px 10px',
      backgroundColor: '#f44336',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
    },
    teamList: {
      listStyle: 'none',
      padding: 0,
    },
    teamItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px',
      backgroundColor: '#f0f0f0',
      marginBottom: '5px',
      borderRadius: '4px',
    },
    matchRow: {
      display: 'grid',
      gridTemplateColumns: '150px 1fr 1fr 200px',
      gap: '10px',
      alignItems: 'center',
      padding: '10px',
      backgroundColor: '#f9f9f9',
      marginBottom: '5px',
      borderRadius: '4px',
    },
    arrowButton: {
      padding: '5px 10px',
      margin: '0 2px',
      backgroundColor: '#2196F3',
      color: '#fff',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '12px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🗓️ Season Scheduler</h1>
        <p>Welcome, {userName}</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <div
          style={{ ...styles.tab, ...(activeTab === 'setup' ? styles.activeTab : {}) }}
          onClick={() => setActiveTab('setup')}
        >
          Setup
        </div>
        <div
          style={{ ...styles.tab, ...(activeTab === 'schedule' ? styles.activeTab : {}) }}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule
        </div>
        <div
          style={{ ...styles.tab, ...(activeTab === 'output' ? styles.activeTab : {}) }}
          onClick={() => setActiveTab('output')}
        >
          Output
        </div>
      </div>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <div style={styles.content}>
          <h2>Setup</h2>

          {/* Sport Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label>Sport:</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} style={styles.input}>
              <option value="darts">Darts</option>
              <option value="pool">Pool</option>
              <option value="crib">Crib</option>
            </select>
          </div>

          {/* Team Management */}
          <div style={{ marginBottom: '20px' }}>
            <h3>Teams</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTeam()}
                style={styles.input}
              />
              <button onClick={addTeam} style={styles.button}>Add Team</button>
            </div>
            <ul style={styles.teamList}>
              {teams.map((team) => (
                <li key={team.id} style={styles.teamItem}>
                  <span>{team.name}</span>
                  <button onClick={() => deleteTeam(team.id)} style={styles.deleteButton}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Season Settings */}
          <div style={{ marginBottom: '20px' }}>
            <h3>Season Settings</h3>
            <label>Day of Week:</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} style={styles.input}>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
              <option value="sunday">Sunday</option>
            </select>

            <label>Season Start:</label>
            <input
              type="date"
              value={seasonStart}
              onChange={(e) => setSeasonStart(e.target.value)}
              style={styles.input}
            />

            <label>Season End:</label>
            <input
              type="date"
              value={seasonEnd}
              onChange={(e) => setSeasonEnd(e.target.value)}
              style={styles.input}
            />
          </div>

          <button
            onClick={generateSchedule}
            disabled={loading}
            style={styles.button}
          >
            {loading ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div style={styles.content}>
          <h2>Generated Schedule</h2>

          {scheduleMessage && (
            <div style={{ padding: '10px', backgroundColor: '#fff3cd', marginBottom: '20px', borderRadius: '4px' }}>
              {scheduleMessage}
            </div>
          )}

          {generatedMatches.length === 0 ? (
            <p>No schedule generated yet. Go to Setup tab to create one.</p>
          ) : (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label>Schedule Name:</label>
                <input
                  type="text"
                  placeholder="e.g., Spring 2026 Darts"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  style={styles.input}
                />
                <label>Version:</label>
                <input
                  type="number"
                  value={scheduleVersion}
                  onChange={(e) => setScheduleVersion(parseInt(e.target.value))}
                  style={styles.input}
                  min="1"
                />
              </div>

              <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
                <div style={styles.matchRow}>
                  <span>Date</span>
                  <span>Home Team</span>
                  <span>Away Team</span>
                  <span>Reorder</span>
                </div>
              </div>

              {generatedMatches.map((match, index) => (
                <div key={index} style={styles.matchRow}>
                  <span>{new Date(match.matchDate).toLocaleDateString()}</span>
                  <span>{match.homeTeam}</span>
                  <span>{match.awayTeam || 'BYE'}</span>
                  <div>
                    <button
                      onClick={() => moveMatch(index, 'top')}
                      disabled={index === 0}
                      style={styles.arrowButton}
                    >
                      ⬆️ Top
                    </button>
                    <button
                      onClick={() => moveMatch(index, 'up')}
                      disabled={index === 0}
                      style={styles.arrowButton}
                    >
                      ↑ Up
                    </button>
                    <button
                      onClick={() => moveMatch(index, 'down')}
                      disabled={index === generatedMatches.length - 1}
                      style={styles.arrowButton}
                    >
                      ↓ Down
                    </button>
                    <button
                      onClick={() => moveMatch(index, 'bottom')}
                      disabled={index === generatedMatches.length - 1}
                      style={styles.arrowButton}
                    >
                      ⬇️ Bottom
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={saveSchedule} style={{ ...styles.button, marginTop: '20px' }}>
                Save Schedule
              </button>
            </>
          )}
        </div>
      )}

      {/* Output Tab */}
      {activeTab === 'output' && (
        <div style={styles.content}>
          <h2>Saved Schedules</h2>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
            Note: Schedules are automatically deleted after 30 days
          </p>

          {savedSchedules.length === 0 ? (
            <p>No saved schedules yet.</p>
          ) : (
            <div>
              {savedSchedules.map((sched) => (
                <div key={sched.id} style={{ padding: '15px', backgroundColor: '#f0f0f0', marginBottom: '10px', borderRadius: '4px' }}>
                  <h3>{sched.name} (v{sched.version})</h3>
                  <p>Sport: {sched.sport.charAt(0).toUpperCase() + sched.sport.slice(1)}</p>
                  <p>Day: {sched.dayOfWeek.charAt(0).toUpperCase() + sched.dayOfWeek.slice(1)}</p>
                  <p>Season: {new Date(sched.seasonStart).toLocaleDateString()} - {new Date(sched.seasonEnd).toLocaleDateString()}</p>
                  <p>Created: {new Date(sched.createdAt!).toLocaleDateString()}</p>
                  <button onClick={() => downloadSchedule(sched.id!)} style={styles.button}>
                    Download CSV
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
