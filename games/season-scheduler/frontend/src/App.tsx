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

type TabType = 'setup' | 'schedule' | 'output';

const App: React.FC = () => {
  // Get URL parameters
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId');
  const userName = params.get('userName') || 'User';

  // State
  const [activeTab, setActiveTab] = useState<TabType>('setup');
  const [sport, setSport] = useState<string>('darts');
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('wednesday');
  const [seasonStart, setSeasonStart] = useState('');
  const [seasonEnd, setSeasonEnd] = useState('');
  const [excludeDates, setExcludeDates] = useState<string[]>([]);
  const [newExcludeDate, setNewExcludeDate] = useState('');
  const [generatedMatches, setGeneratedMatches] = useState<Match[]>([]);
  const [scheduleMessage, setScheduleMessage] = useState<string>('');
  const [savedSchedules, setSavedSchedules] = useState<Schedule[]>([]);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleVersion, setScheduleVersion] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const API_BASE = window.location.origin;

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/teams?userId=${userId}&sport=${sport}`);
      if (!res.ok) throw new Error('Failed to load teams');
      const data = await res.json();
      setTeams(data || []);
    } catch (err) {
      console.error('Failed to load teams:', err);
      setError('Failed to load teams');
    }
  }, [API_BASE, userId, sport]);

  const loadSavedSchedules = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/schedules?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to load schedules');
      const data = await res.json();
      setSavedSchedules(data || []);
    } catch (err) {
      console.error('Failed to load saved schedules:', err);
    }
  }, [API_BASE, userId]);

  // Load teams when sport changes
  useEffect(() => {
    if (userId) {
      loadTeams();
    }
  }, [loadTeams, userId]);

  // Load saved schedules on mount
  useEffect(() => {
    if (userId) {
      loadSavedSchedules();
    }
  }, [loadSavedSchedules, userId]);

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
        const errorText = await res.text();
        alert(`Failed to add team: ${errorText}`);
      }
    } catch (err) {
      console.error('Failed to add team:', err);
      alert('Failed to add team');
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

  const addExcludeDate = () => {
    if (!newExcludeDate) return;
    if (!excludeDates.includes(newExcludeDate)) {
      setExcludeDates([...excludeDates, newExcludeDate]);
      setNewExcludeDate('');
    }
  };

  const removeExcludeDate = (date: string) => {
    setExcludeDates(excludeDates.filter(d => d !== date));
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
    setError('');
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

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to generate schedule');
      }

      const data = await res.json();
      setGeneratedMatches(data.matches || []);
      setScheduleMessage(data.message || '');

      if (data.status === 'ok') {
        setActiveTab('schedule');
      } else {
        setError(data.message || 'Schedule generation issue');
      }
    } catch (err) {
      console.error('Failed to generate schedule:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate schedule';
      setError(errorMsg);
      alert(errorMsg);
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
      return;
    }

    const newMatches = [...generatedMatches];
    const [removed] = newMatches.splice(fromIndex, 1);
    newMatches.splice(toIndex, 0, removed);

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
        userId: userId || '',
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

  // No user error
  if (!userId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h1>🗓️ Season Scheduler</h1>
          <p style={{ fontSize: '18px', margin: '30px 0', color: '#666' }}>
            Please access this app through the Identity Shell.
          </p>
          <button
            onClick={() => {
              window.location.href = `http://${window.location.hostname}:3001`;
            }}
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              padding: '12px 30px',
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ borderBottom: '2px solid #e0e0e0', padding: '15px 20px', marginBottom: '20px', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>🗓️ Season Scheduler</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span>Welcome, {userName}!</span>
            <button
              onClick={() => { window.parent.postMessage({ type: 'CLOSE_APP' }, '*'); }}
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              ← Back to Lobby
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '0 20px' }}>
        <button
          style={{
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'setup' ? '#4CAF50' : '#fff',
            color: activeTab === 'setup' ? '#fff' : '#333',
            border: '1px solid #ddd',
            borderRadius: '5px 5px 0 0',
            fontWeight: activeTab === 'setup' ? 'bold' : 'normal',
          }}
          onClick={() => setActiveTab('setup')}
        >
          Setup
        </button>
        <button
          style={{
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'schedule' ? '#4CAF50' : '#fff',
            color: activeTab === 'schedule' ? '#fff' : '#333',
            border: '1px solid #ddd',
            borderRadius: '5px 5px 0 0',
            fontWeight: activeTab === 'schedule' ? 'bold' : 'normal',
          }}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule
        </button>
        <button
          style={{
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'output' ? '#4CAF50' : '#fff',
            color: activeTab === 'output' ? '#fff' : '#333',
            border: '1px solid #ddd',
            borderRadius: '5px 5px 0 0',
            fontWeight: activeTab === 'output' ? 'bold' : 'normal',
          }}
          onClick={() => setActiveTab('output')}
        >
          Saved Schedules
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ margin: '0 20px 20px', padding: '15px', backgroundColor: '#ffe6e6', borderLeft: '4px solid #f44336', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <div style={{ backgroundColor: '#fff', padding: '20px', margin: '0 20px', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2>Setup</h2>

          {/* Sport Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Sport:</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
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
                style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button onClick={addTeam} style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Add Team
              </button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {teams.map((team) => (
                <li key={team.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '5px', borderRadius: '4px' }}>
                  <span>{team.name}</span>
                  <button onClick={() => deleteTeam(team.id)} style={{ padding: '5px 10px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Season Settings */}
          <div style={{ marginBottom: '20px' }}>
            <h3>Season Settings</h3>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Day of Week:</label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Season Start:</label>
              <input
                type="date"
                value={seasonStart}
                onChange={(e) => setSeasonStart(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Season End:</label>
              <input
                type="date"
                value={seasonEnd}
                onChange={(e) => setSeasonEnd(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          {/* Exclude Dates */}
          <div style={{ marginBottom: '20px' }}>
            <h3>Exclude Dates (Optional)</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
              Mark specific dates to skip (e.g., holidays, tournaments, venue closures)
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="date"
                value={newExcludeDate}
                onChange={(e) => setNewExcludeDate(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button onClick={addExcludeDate} style={{ padding: '8px 16px', backgroundColor: '#FF9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Exclude Date
              </button>
            </div>
            {excludeDates.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {excludeDates.map((date) => (
                  <li key={date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#fff3cd', marginBottom: '5px', borderRadius: '4px', border: '1px solid #ffc107' }}>
                    <span>{new Date(date + 'T00:00:00').toLocaleDateString()}</span>
                    <button onClick={() => removeExcludeDate(date)} style={{ padding: '4px 8px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={generateSchedule}
            disabled={loading}
            style={{ padding: '12px 24px', backgroundColor: loading ? '#ccc' : '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}
          >
            {loading ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div style={{ backgroundColor: '#fff', padding: '20px', margin: '0 20px', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2>Generated Schedule</h2>

          {scheduleMessage && (
            <div style={{ padding: '10px', backgroundColor: '#fff3cd', marginBottom: '20px', borderRadius: '4px', border: '1px solid #ffc107' }}>
              {scheduleMessage}
            </div>
          )}

          {generatedMatches.length === 0 ? (
            <p>No schedule generated yet. Go to Setup tab to create one.</p>
          ) : (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Schedule Name:</label>
                <input
                  type="text"
                  placeholder="e.g., Spring 2026 Darts"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '10px' }}
                />
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Version:</label>
                <input
                  type="number"
                  value={scheduleVersion}
                  onChange={(e) => setScheduleVersion(parseInt(e.target.value))}
                  style={{ width: '100px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  min="1"
                />
              </div>

              <div style={{ marginBottom: '10px', fontWeight: 'bold', display: 'grid', gridTemplateColumns: '150px 1fr 1fr 200px', gap: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                <span>Date</span>
                <span>Home Team</span>
                <span>Away Team</span>
                <span>Reorder</span>
              </div>

              {generatedMatches.map((match, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 200px', gap: '10px', alignItems: 'center', padding: '10px', backgroundColor: '#f9f9f9', marginBottom: '5px', borderRadius: '4px' }}>
                  <span>{new Date(match.matchDate).toLocaleDateString()}</span>
                  <span>{match.homeTeam}</span>
                  <span>{match.awayTeam || 'BYE'}</span>
                  <div>
                    <button
                      onClick={() => moveMatch(index, 'top')}
                      disabled={index === 0}
                      style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: index === 0 ? '#ccc' : '#2196F3', color: '#fff', border: 'none', borderRadius: '3px', cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      ⬆️ Top
                    </button>
                    <button
                      onClick={() => moveMatch(index, 'up')}
                      disabled={index === 0}
                      style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: index === 0 ? '#ccc' : '#2196F3', color: '#fff', border: 'none', borderRadius: '3px', cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      ↑ Up
                    </button>
                    <button
                      onClick={() => moveMatch(index, 'down')}
                      disabled={index === generatedMatches.length - 1}
                      style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: index === generatedMatches.length - 1 ? '#ccc' : '#2196F3', color: '#fff', border: 'none', borderRadius: '3px', cursor: index === generatedMatches.length - 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      ↓ Down
                    </button>
                    <button
                      onClick={() => moveMatch(index, 'bottom')}
                      disabled={index === generatedMatches.length - 1}
                      style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: index === generatedMatches.length - 1 ? '#ccc' : '#2196F3', color: '#fff', border: 'none', borderRadius: '3px', cursor: index === generatedMatches.length - 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      ⬇️ Bottom
                    </button>
                  </div>
                </div>
              ))}

              <button onClick={saveSchedule} style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                Save Schedule
              </button>
            </>
          )}
        </div>
      )}

      {/* Output Tab */}
      {activeTab === 'output' && (
        <div style={{ backgroundColor: '#fff', padding: '20px', margin: '0 20px', borderRadius: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
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
                  <button onClick={() => downloadSchedule(sched.id!)} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
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
