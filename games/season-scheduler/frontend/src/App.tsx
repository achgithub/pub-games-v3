import React, { useState, useEffect, useCallback } from 'react';

// Types
interface Team {
  id: number;
  userId: string;
  sport: string;
  name: string;
  createdAt: string;
}

interface ExcludedDate {
  date: string;
  type: 'catchup' | 'free' | 'special';
  notes: string;
}

interface ScheduleRow {
  date: string;
  rowType: 'match' | 'catchup' | 'free' | 'special' | 'bye';
  homeTeam?: string;
  awayTeam?: string | null;
  notes?: string;
  rowOrder: number;
  holidayWarning?: string; // Warning if near UK bank holiday
  hasConflict?: boolean; // True if team plays multiple games same day
  conflictMessage?: string; // Description of conflict
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
  const [excludedDates, setExcludedDates] = useState<ExcludedDate[]>([]);
  const [newExcludeDate, setNewExcludeDate] = useState('');
  const [showSpecialEventDialog, setShowSpecialEventDialog] = useState(false);
  const [specialEventNotes, setSpecialEventNotes] = useState('');
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleMessage, setScheduleMessage] = useState<string>('');
  const [savedSchedules, setSavedSchedules] = useState<Schedule[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
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

  const addExcludeDateWithType = (type: 'catchup' | 'free' | 'special') => {
    if (!newExcludeDate) {
      alert('Please select a date first');
      return;
    }

    // Check if date already excluded
    if (excludedDates.some(d => d.date === newExcludeDate)) {
      alert('This date is already excluded');
      return;
    }

    if (type === 'special') {
      // Show dialog for special event
      setShowSpecialEventDialog(true);
    } else {
      // Add directly for catchup and free
      const notes = type === 'catchup' ? 'Catch-up Week' : 'Free Week';
      setExcludedDates([...excludedDates, { date: newExcludeDate, type, notes }]);
      setNewExcludeDate('');
    }
  };

  const addSpecialEvent = () => {
    if (!specialEventNotes.trim()) {
      alert('Please enter event details');
      return;
    }

    setExcludedDates([...excludedDates, {
      date: newExcludeDate,
      type: 'special',
      notes: specialEventNotes
    }]);
    setNewExcludeDate('');
    setSpecialEventNotes('');
    setShowSpecialEventDialog(false);
  };

  const removeExcludeDate = (date: string) => {
    setExcludedDates(excludedDates.filter(d => d.date !== date));
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
          excludeDates: excludedDates,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to generate schedule');
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }

      const data = await res.json();
      const rowsWithConflicts = detectConflicts(data.rows || []);
      setScheduleRows(rowsWithConflicts);
      setScheduleMessage(data.message || '');

      if (data.status === 'ok' || data.status === 'too_many_dates') {
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

  // Detect conflicts - teams playing multiple games on same date
  const detectConflicts = (rows: ScheduleRow[]): ScheduleRow[] => {
    // Group rows by date
    const rowsByDate = new Map<string, ScheduleRow[]>();
    rows.forEach(row => {
      const existing = rowsByDate.get(row.date) || [];
      existing.push(row);
      rowsByDate.set(row.date, existing);
    });

    // Check each date for team conflicts
    const updatedRows = rows.map(row => {
      const sameDate = rowsByDate.get(row.date) || [];
      const teams = new Set<string>();
      const conflicts: string[] = [];

      sameDate.forEach(r => {
        if (r.rowType === 'match' && r.homeTeam) {
          if (teams.has(r.homeTeam)) {
            conflicts.push(r.homeTeam);
          }
          teams.add(r.homeTeam);

          if (r.awayTeam && r.awayTeam !== 'BYE') {
            if (teams.has(r.awayTeam)) {
              conflicts.push(r.awayTeam);
            }
            teams.add(r.awayTeam);
          }
        }
      });

      // Check if this row involves a conflicted team
      let hasConflict = false;
      let conflictMessage = '';

      if (row.rowType === 'match' && conflicts.length > 0) {
        if (row.homeTeam && conflicts.includes(row.homeTeam)) {
          hasConflict = true;
          conflictMessage = `${row.homeTeam} plays multiple times on this date`;
        } else if (row.awayTeam && conflicts.includes(row.awayTeam)) {
          hasConflict = true;
          conflictMessage = `${row.awayTeam} plays multiple times on this date`;
        }
      }

      return { ...row, hasConflict, conflictMessage };
    });

    return updatedRows;
  };

  const moveRow = (fromIndex: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    let toIndex = fromIndex;

    if (direction === 'up' && fromIndex > 0) {
      toIndex = fromIndex - 1;
    } else if (direction === 'down' && fromIndex < scheduleRows.length - 1) {
      toIndex = fromIndex + 1;
    } else if (direction === 'top') {
      toIndex = 0;
    } else if (direction === 'bottom') {
      toIndex = scheduleRows.length - 1;
    } else {
      return;
    }

    const newRows = [...scheduleRows];
    const fromRow = newRows[fromIndex];
    const toRow = newRows[toIndex];

    const fromIsExclusion = fromRow.rowType === 'catchup' || fromRow.rowType === 'free' || fromRow.rowType === 'special';
    const toIsExclusion = toRow.rowType === 'catchup' || toRow.rowType === 'free' || toRow.rowType === 'special';

    // Special case: Moving an exclusion into a date with matches
    // The exclusion should take over the entire date, displacing all matches
    if (fromIsExclusion && !toIsExclusion) {
      const targetDate = newRows[toIndex].date;

      // Find all rows with the target date
      const targetDateIndices: number[] = [];
      newRows.forEach((row, idx) => {
        if (row.date === targetDate) {
          targetDateIndices.push(idx);
        }
      });

      // Move exclusion to target date (replace first match on that date)
      const fromDate = newRows[fromIndex].date;
      const fromWarning = newRows[fromIndex].holidayWarning;
      const toDate = targetDate;
      const toWarning = newRows[targetDateIndices[0]].holidayWarning;

      // Get the exclusion content
      const exclusionContent = { ...newRows[fromIndex] };

      // Get all matches from target date
      const displacedMatches = targetDateIndices.map(idx => ({ ...newRows[idx] }));

      // Place exclusion at first row of target date
      newRows[targetDateIndices[0]] = {
        ...exclusionContent,
        date: toDate,
        rowOrder: targetDateIndices[0],
        holidayWarning: toWarning
      };

      // Delete other rows from target date (work backwards to maintain indices)
      for (let i = targetDateIndices.length - 1; i > 0; i--) {
        newRows.splice(targetDateIndices[i], 1);
      }

      // Place displaced matches at the original exclusion date
      const oldExclusionIndex = fromIndex < targetDateIndices[0] ? fromIndex : fromIndex - (targetDateIndices.length - 1);

      // Insert displaced matches at old exclusion position
      for (let i = 0; i < displacedMatches.length; i++) {
        newRows.splice(oldExclusionIndex + i, i === 0 ? 1 : 0, {
          ...displacedMatches[i],
          date: fromDate,
          rowOrder: oldExclusionIndex + i,
          holidayWarning: fromWarning
        });
      }

      // Renumber all rows
      newRows.forEach((row, idx) => {
        row.rowOrder = idx;
      });

    } else {
      // Normal swap (both are same type or both are exclusions or both are matches)
      const fromDate = newRows[fromIndex].date;
      const toDate = newRows[toIndex].date;
      const fromWarning = newRows[fromIndex].holidayWarning;
      const toWarning = newRows[toIndex].holidayWarning;

      const tempRow = { ...newRows[fromIndex] };
      newRows[fromIndex] = {
        ...newRows[toIndex],
        date: fromDate,
        rowOrder: fromIndex,
        holidayWarning: fromWarning
      };
      newRows[toIndex] = {
        ...tempRow,
        date: toDate,
        rowOrder: toIndex,
        holidayWarning: toWarning
      };
    }

    // Detect conflicts after move
    const rowsWithConflicts = detectConflicts(newRows);
    setScheduleRows(rowsWithConflicts);
  };

  const moveSelectedRows = (direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (selectedRows.size === 0) {
      alert('Please select rows to move');
      return;
    }

    const selectedIndices = Array.from(selectedRows).sort((a, b) => a - b);
    let newRows = [...scheduleRows];

    if (direction === 'up') {
      // Move each selected row up by 1
      for (const index of selectedIndices) {
        if (index > 0) {
          const fromDate = newRows[index].date;
          const toDate = newRows[index - 1].date;
          const fromWarning = newRows[index].holidayWarning;
          const toWarning = newRows[index - 1].holidayWarning;

          const temp = { ...newRows[index] };
          newRows[index] = { ...newRows[index - 1], date: fromDate, rowOrder: index, holidayWarning: fromWarning };
          newRows[index - 1] = { ...temp, date: toDate, rowOrder: index - 1, holidayWarning: toWarning };
        }
      }
      // Update selection indices
      setSelectedRows(new Set(selectedIndices.map(i => Math.max(0, i - 1))));
    } else if (direction === 'down') {
      // Move each selected row down by 1 (reverse order to avoid conflicts)
      for (let i = selectedIndices.length - 1; i >= 0; i--) {
        const index = selectedIndices[i];
        if (index < newRows.length - 1) {
          const fromDate = newRows[index].date;
          const toDate = newRows[index + 1].date;
          const fromWarning = newRows[index].holidayWarning;
          const toWarning = newRows[index + 1].holidayWarning;

          const temp = { ...newRows[index] };
          newRows[index] = { ...newRows[index + 1], date: fromDate, rowOrder: index, holidayWarning: fromWarning };
          newRows[index + 1] = { ...temp, date: toDate, rowOrder: index + 1, holidayWarning: toWarning };
        }
      }
      // Update selection indices
      setSelectedRows(new Set(selectedIndices.map(i => Math.min(newRows.length - 1, i + 1))));
    } else if (direction === 'top') {
      // Move all selected to top (preserve their relative order)
      const selectedRowObjects = selectedIndices.map(i => newRows[i]);
      const unselectedRowObjects = newRows.filter((_, i) => !selectedRows.has(i));
      newRows = [...selectedRowObjects, ...unselectedRowObjects];

      // Reassign dates and warnings
      newRows.forEach((row, i) => {
        row.rowOrder = i;
        row.date = scheduleRows[i].date;
        row.holidayWarning = scheduleRows[i].holidayWarning;
      });

      // Update selection indices
      setSelectedRows(new Set(selectedRowObjects.map((_, i) => i)));
    } else if (direction === 'bottom') {
      // Move all selected to bottom (preserve their relative order)
      const selectedRowObjects = selectedIndices.map(i => newRows[i]);
      const unselectedRowObjects = newRows.filter((_, i) => !selectedRows.has(i));
      newRows = [...unselectedRowObjects, ...selectedRowObjects];

      // Reassign dates and warnings
      newRows.forEach((row, i) => {
        row.rowOrder = i;
        row.date = scheduleRows[i].date;
        row.holidayWarning = scheduleRows[i].holidayWarning;
      });

      // Update selection indices
      const startIndex = unselectedRowObjects.length;
      setSelectedRows(new Set(selectedRowObjects.map((_, i) => startIndex + i)));
    }

    // Detect conflicts after move
    const rowsWithConflicts = detectConflicts(newRows);
    setScheduleRows(rowsWithConflicts);
  };

  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const selectAll = () => {
    setSelectedRows(new Set(scheduleRows.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedRows(new Set());
  };

  const saveSchedule = async () => {
    if (!scheduleName.trim()) {
      alert('Please enter a schedule name');
      return;
    }

    try {
      // Helper to convert YYYY-MM-DD to RFC3339 format for Go's time.Time
      // Skip conversion if already in RFC3339 format
      const toRFC3339 = (dateStr: string) => {
        if (dateStr.includes('T')) {
          return dateStr; // Already in RFC3339 format
        }
        return `${dateStr}T00:00:00Z`;
      };

      const schedule: Schedule = {
        userId: userId || '',
        sport,
        name: scheduleName,
        version: scheduleVersion,
        dayOfWeek,
        seasonStart: toRFC3339(seasonStart),
        seasonEnd: toRFC3339(seasonEnd),
      };

      // Convert rows to matches and schedule_dates
      const matches: Match[] = [];
      const scheduleDatesMap = new Map<string, any>(); // Use Map to deduplicate by date
      let matchOrder = 0;

      scheduleRows.forEach((row) => {
        const dateKey = row.date; // row.date is already a string in YYYY-MM-DD format

        if (row.rowType === 'match') {
          matches.push({
            matchDate: toRFC3339(row.date),
            homeTeam: row.homeTeam!,
            awayTeam: row.awayTeam || null,
            matchOrder: matchOrder++,
          });
          // Only add to schedule_dates if this date isn't already recorded
          if (!scheduleDatesMap.has(dateKey)) {
            scheduleDatesMap.set(dateKey, {
              matchDate: toRFC3339(row.date),
              dateType: 'normal',
              notes: null
            });
          }
        } else {
          // Non-match rows go to schedule_dates (these are exclusions, only 1 per date)
          scheduleDatesMap.set(dateKey, {
            matchDate: toRFC3339(row.date),
            dateType: row.rowType,
            notes: row.notes || null
          });
        }
      });

      const scheduleDates = Array.from(scheduleDatesMap.values());

      const payload = {
        schedule,
        matches,
        dates: scheduleDates,
      };

      console.log('Save payload:', JSON.stringify(payload, null, 2));

      const res = await fetch(`${API_BASE}/api/schedule/0`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Schedule saved successfully!');
        loadSavedSchedules();
        setActiveTab('output');
      } else {
        const errorText = await res.text();
        console.error('Save failed:', res.status, errorText);
        alert(`Failed to save schedule: ${errorText}`);
      }
    } catch (err) {
      console.error('Failed to save schedule:', err);
      alert(`Failed to save schedule: ${err}`);
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
              Mark dates to exclude from scheduling - select a date then choose the type
            </p>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Select Date:</label>
              <input
                type="date"
                value={newExcludeDate}
                onChange={(e) => setNewExcludeDate(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <button
                onClick={() => addExcludeDateWithType('catchup')}
                style={{ padding: '8px 16px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1, minWidth: '150px' }}
              >
                📅 Catch-up Week
              </button>
              <button
                onClick={() => addExcludeDateWithType('free')}
                style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1, minWidth: '150px' }}
              >
                🏖️ Free Week
              </button>
              <button
                onClick={() => addExcludeDateWithType('special')}
                style={{ padding: '8px 16px', backgroundColor: '#FF9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1, minWidth: '150px' }}
              >
                🏆 Special Event
              </button>
            </div>

            {/* Special Event Dialog */}
            {showSpecialEventDialog && (
              <div style={{ padding: '15px', backgroundColor: '#fff3cd', marginBottom: '15px', borderRadius: '4px', border: '2px solid #FF9800' }}>
                <h4 style={{ marginTop: 0 }}>Special Event Details</h4>
                <input
                  type="text"
                  placeholder="e.g., Knockout Competition, Captain's Cup"
                  value={specialEventNotes}
                  onChange={(e) => setSpecialEventNotes(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSpecialEvent()}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '10px' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={addSpecialEvent}
                    style={{ padding: '8px 16px', backgroundColor: '#FF9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Add Event
                  </button>
                  <button
                    onClick={() => { setShowSpecialEventDialog(false); setSpecialEventNotes(''); }}
                    style={{ padding: '8px 16px', backgroundColor: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Excluded Dates List */}
            {excludedDates.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {excludedDates.map((excluded, index) => {
                  const bgColors = {
                    catchup: '#E3F2FD',
                    free: '#E8F5E9',
                    special: '#FFF3E0'
                  };
                  const borderColors = {
                    catchup: '#2196F3',
                    free: '#4CAF50',
                    special: '#FF9800'
                  };
                  const icons = {
                    catchup: '📅',
                    free: '🏖️',
                    special: '🏆'
                  };

                  return (
                    <li
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px',
                        backgroundColor: bgColors[excluded.type],
                        marginBottom: '5px',
                        borderRadius: '4px',
                        border: `2px solid ${borderColors[excluded.type]}`
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          {icons[excluded.type]} {new Date(excluded.date + 'T00:00:00').toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {excluded.notes}
                        </div>
                      </div>
                      <button
                        onClick={() => removeExcludeDate(excluded.date)}
                        style={{ padding: '4px 8px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
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

          {scheduleRows.length === 0 ? (
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
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                  <div style={{ flex: '0 0 auto' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Version:</label>
                    <input
                      type="number"
                      value={scheduleVersion}
                      onChange={(e) => setScheduleVersion(parseInt(e.target.value))}
                      style={{ width: '100px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      min="1"
                    />
                  </div>
                  <button onClick={saveSchedule} style={{ padding: '8px 24px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                    💾 Save Schedule
                  </button>
                </div>
              </div>

              {/* Multi-select controls */}
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <button onClick={selectAll} style={{ padding: '6px 12px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    Select All
                  </button>
                  <button onClick={deselectAll} style={{ padding: '6px 12px', backgroundColor: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    Deselect All
                  </button>
                  <span style={{ marginLeft: '10px', color: '#666', fontSize: '14px' }}>
                    {selectedRows.size} selected
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => moveSelectedRows('top')}
                    disabled={selectedRows.size === 0}
                    style={{ padding: '8px 16px', backgroundColor: selectedRows.size === 0 ? '#ccc' : '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                  >
                    ⬆️ Move Selected to Top
                  </button>
                  <button
                    onClick={() => moveSelectedRows('up')}
                    disabled={selectedRows.size === 0}
                    style={{ padding: '8px 16px', backgroundColor: selectedRows.size === 0 ? '#ccc' : '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                  >
                    ↑ Move Selected Up
                  </button>
                  <button
                    onClick={() => moveSelectedRows('down')}
                    disabled={selectedRows.size === 0}
                    style={{ padding: '8px 16px', backgroundColor: selectedRows.size === 0 ? '#ccc' : '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                  >
                    ↓ Move Selected Down
                  </button>
                  <button
                    onClick={() => moveSelectedRows('bottom')}
                    disabled={selectedRows.size === 0}
                    style={{ padding: '8px 16px', backgroundColor: selectedRows.size === 0 ? '#ccc' : '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedRows.size === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                  >
                    ⬇️ Move Selected to Bottom
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '10px', fontWeight: 'bold', display: 'grid', gridTemplateColumns: '40px 150px 250px 1fr 200px', gap: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                <span></span>
                <span>Date</span>
                <span>Type</span>
                <span>Details</span>
                <span>Reorder</span>
              </div>

              {scheduleRows.map((row, index) => {
                const rowIcons = {
                  match: '⚔️',
                  catchup: '📅',
                  free: '🏖️',
                  special: '🏆',
                  bye: '🔄'
                };

                const rowColors = {
                  match: '#fff',
                  catchup: '#e3f2fd',
                  free: '#e8f5e9',
                  special: '#fff3e0',
                  bye: '#f5f5f5'
                };

                const canMoveUp = index > 0;
                const canMoveDown = index < scheduleRows.length - 1;

                // Determine border color: red for conflicts, orange for holidays, default gray
                let borderColor = '#ddd';
                let borderWidth = '1px';
                if (row.hasConflict) {
                  borderColor = '#f44336';
                  borderWidth = '3px';
                } else if (row.holidayWarning) {
                  borderColor = '#ff9800';
                  borderWidth = '2px';
                }

                const backgroundColor = row.hasConflict
                  ? '#ffebee' // Light red for conflicts
                  : rowColors[row.rowType as keyof typeof rowColors];

                return (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 150px 250px 1fr 200px',
                      gap: '10px',
                      alignItems: 'center',
                      padding: '10px',
                      backgroundColor,
                      marginBottom: '5px',
                      borderRadius: '4px',
                      border: `${borderWidth} solid ${borderColor}`
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRows.has(index)}
                      onChange={() => toggleRowSelection(index)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 'bold' }}>{new Date(row.date).toLocaleDateString()}</span>
                    <span>{rowIcons[row.rowType as keyof typeof rowIcons]} {row.rowType === 'match' ? 'Match' : row.rowType === 'catchup' ? 'Catch-up Week' : row.rowType === 'free' ? 'Free Week' : row.rowType === 'special' ? 'Special Event' : 'Bye Week'}</span>
                    <span>
                      {row.hasConflict && (
                        <div style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>
                          🚨 CONFLICT: {row.conflictMessage}
                        </div>
                      )}
                      {row.holidayWarning && (
                        <div style={{ color: '#ff6f00', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>
                          {row.holidayWarning}
                        </div>
                      )}
                      {row.rowType === 'match' && (
                        <>{row.homeTeam} vs {row.awayTeam || 'BYE'}</>
                      )}
                      {(row.rowType === 'catchup' || row.rowType === 'free' || row.rowType === 'special') && (
                        <span style={{ fontStyle: 'italic', color: '#666' }}>{row.notes || ''}</span>
                      )}
                    </span>
                    <div>
                      <button
                        onClick={() => moveRow(index, 'top')}
                        disabled={!canMoveUp}
                        style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: canMoveUp ? '#2196F3' : '#ccc', color: '#fff', border: 'none', borderRadius: '3px', cursor: canMoveUp ? 'pointer' : 'not-allowed', fontSize: '12px' }}
                      >
                        ⬆️ Top
                      </button>
                      <button
                        onClick={() => moveRow(index, 'up')}
                        disabled={!canMoveUp}
                        style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: canMoveUp ? '#2196F3' : '#ccc', color: '#fff', border: 'none', borderRadius: '3px', cursor: canMoveUp ? 'pointer' : 'not-allowed', fontSize: '12px' }}
                      >
                        ↑ Up
                      </button>
                      <button
                        onClick={() => moveRow(index, 'down')}
                        disabled={!canMoveDown}
                        style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: canMoveDown ? '#2196F3' : '#ccc', color: '#fff', border: 'none', borderRadius: '3px', cursor: canMoveDown ? 'pointer' : 'not-allowed', fontSize: '12px' }}
                      >
                        ↓ Down
                      </button>
                      <button
                        onClick={() => moveRow(index, 'bottom')}
                        disabled={!canMoveDown}
                        style={{ padding: '5px 10px', margin: '0 2px', backgroundColor: canMoveDown ? '#2196F3' : '#ccc', color: '#fff', border: 'none', borderRadius: '3px', cursor: canMoveDown ? 'pointer' : 'not-allowed', fontSize: '12px' }}
                      >
                        ⬇️ Bottom
                      </button>
                    </div>
                  </div>
                );
              })}

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
