import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import './App.css';

interface Competition {
  id: number;
  name: string;
  type: 'knockout' | 'race';
  status: 'draft' | 'open' | 'locked' | 'completed' | 'archived';
  description?: string;
  start_date?: string;
  end_date?: string;
}

interface Entry {
  id: number;
  competition_id: number;
  name: string;
  status: string;
  seed?: number;
  number?: number;
  position?: number;
  stage?: string;
}

interface Draw {
  id: number;
  user_id: string;
  competition_id: number;
  entry_id: number;
  entry_name: string;
  user_name?: string;
  drawn_at: string;
  entry_status?: string;
  seed?: number;
  number?: number;
  position?: number;
}

interface BlindBox {
  box_number: number;
}

// Parse query params from URL
function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      userName: params.get('userName') || params.get('userId') || 'Player',
      isAdmin: params.get('isAdmin') === 'true',
      gameId: params.get('gameId'),
    };
  }, []);
}

const API_BASE = window.location.origin;

function App() {
  const { userId, userName, isAdmin } = useQueryParams();
  const [view, setView] = useState<string>('dashboard');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userDraws, setUserDraws] = useState<Draw[]>([]);
  const [blindBoxes, setBlindBoxes] = useState<BlindBox[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/competitions`);
      setCompetitions(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load competitions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserDraws = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_BASE}/api/draws?user_id=${userId}`);
      setUserDraws(response.data || []);
    } catch (err) {
      console.error('Error loading draws:', err);
    }
  }, [userId]);

  const loadEntries = async (compId: number) => {
    try {
      const response = await axios.get(`${API_BASE}/api/competitions/${compId}/entries`);
      setEntries(response.data || []);
    } catch (err) {
      console.error('Error loading entries:', err);
    }
  };

  const loadBlindBoxes = useCallback(async (compId: number) => {
    if (!userId) return;
    try {
      const response = await axios.get(`${API_BASE}/api/competitions/${compId}/blind-boxes?user_id=${userId}`);
      setBlindBoxes(response.data || []);
    } catch (err) {
      console.error('Error loading blind boxes:', err);
      setBlindBoxes([]);
    }
  }, [userId]);

  const loadAvailableCount = async (compId: number) => {
    try {
      const response = await axios.get(`${API_BASE}/api/competitions/${compId}/available-count`);
      setAvailableCount(response.data?.count || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (userId) {
      loadCompetitions();
      loadUserDraws();
    }
  }, [userId, loadUserDraws]);

  useEffect(() => {
    if (selectedComp && view === 'pick-box') {
      loadBlindBoxes(selectedComp.id);
      loadAvailableCount(selectedComp.id);
    }
  }, [selectedComp, view, loadBlindBoxes]);

  // Must have userId to play
  if (!userId) {
    return (
      <div style={styles.container}>
        <h2>Sweepstakes</h2>
        <p style={{ color: '#666', marginTop: 20 }}>
          Missing user information. Please access this app through the Identity Shell.
        </p>
        <button
          onClick={() => {
            const shellUrl = `http://${window.location.hostname}:3001`;
            window.location.href = shellUrl;
          }}
          style={styles.button}
        >
          Go to Identity Shell
        </button>
      </div>
    );
  }

  if (loading && competitions.length === 0) {
    return <div style={styles.container}>Loading...</div>;
  }

  const handleCreateCompetition = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await axios.post(`${API_BASE}/api/competitions`, {
        name: formData.get('name'),
        type: formData.get('type'),
        status: 'draft',
        description: formData.get('description') || '',
      });
      e.currentTarget.reset();
      loadCompetitions();
      alert('Competition created successfully!');
    } catch (err: any) {
      alert('Failed to create competition: ' + (err.response?.data || err.message));
    }
  };

  const handleUpdateCompetition = async (compId: number, updates: Partial<Competition>) => {
    try {
      await axios.put(`${API_BASE}/api/competitions/${compId}`, updates);
      loadCompetitions();
      if (selectedComp?.id === compId) {
        setSelectedComp({ ...selectedComp, ...updates });
      }
    } catch (err: any) {
      alert(err.response?.data || 'Failed to update competition');
    }
  };

  const handleChooseBlindBox = async (boxNumber: number) => {
    if (!selectedComp || !window.confirm(`Select Box #${boxNumber}?`)) return;

    try {
      const res = await axios.post(`${API_BASE}/api/competitions/${selectedComp.id}/choose-blind-box`, {
        user_id: userId,
        box_number: boxNumber
      });

      alert(`You got: ${res.data.entry_name}!`);
      loadUserDraws();
      setView('my-entries');
    } catch (err: any) {
      alert(err.response?.data || 'Failed to select box.');
    }
  };

  const handleRandomPick = async () => {
    if (!selectedComp || !window.confirm('Let the computer pick a random box for you?')) return;

    try {
      const res = await axios.post(`${API_BASE}/api/competitions/${selectedComp.id}/random-pick`, {
        user_id: userId
      });

      alert(`You got: ${res.data.entry_name}!`);
      loadUserDraws();
      setView('my-entries');
    } catch (err: any) {
      alert(err.response?.data || 'Failed to pick.');
    }
  };

  const handleUploadEntries = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const res = await axios.post(`${API_BASE}/api/entries/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(res.data);
      if (selectedComp) loadEntries(selectedComp.id);
      e.currentTarget.reset();
    } catch (err: any) {
      alert('Failed to upload entries: ' + (err.response?.data || err.message));
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!window.confirm('Delete this entry?') || !selectedComp) return;
    try {
      await axios.delete(`${API_BASE}/api/entries/${entryId}`);
      loadEntries(selectedComp.id);
    } catch (err) {
      alert('Failed to delete entry');
    }
  };

  const handleUpdatePosition = async (entryId: number, position: number | null) => {
    if (!selectedComp) return;
    try {
      await axios.post(`${API_BASE}/api/competitions/${selectedComp.id}/update-position`, {
        entry_id: entryId,
        position: position
      });
      loadEntries(selectedComp.id);
    } catch (err: any) {
      alert('Failed to update position: ' + (err.response?.data || err.message));
    }
  };

  const activeCompetitions = competitions.filter(c =>
    c.status === 'open' || c.status === 'locked' || c.status === 'completed'
  );

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1>🎁 Sweepstakes</h1>
        <p>Welcome, {userName}! {isAdmin && <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>(Admin)</span>}</p>
      </header>

      <nav style={styles.nav}>
        {!isAdmin && (
          <>
            <button onClick={() => setView('dashboard')} style={view === 'dashboard' ? styles.navButtonActive : styles.navButton}>
              Competitions
            </button>
            <button onClick={() => setView('my-entries')} style={view === 'my-entries' ? styles.navButtonActive : styles.navButton}>
              My Entries ({userDraws.length})
            </button>
          </>
        )}
        {isAdmin && (
          <>
            <button onClick={() => setView('admin-manage')} style={view === 'admin-manage' ? styles.navButtonActive : styles.navButton}>
              Manage Competitions
            </button>
            <button onClick={() => setView('admin-entries')} style={view === 'admin-entries' ? styles.navButtonActive : styles.navButton}>
              Entries
            </button>
            <button onClick={() => setView('admin-participants')} style={view === 'admin-participants' ? styles.navButtonActive : styles.navButton}>
              View Participants
            </button>
          </>
        )}
      </nav>

      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}

        {/* User Dashboard */}
        {!isAdmin && view === 'dashboard' && (
          <UserDashboard
            competitions={activeCompetitions}
            userDraws={userDraws}
            onSelectCompetition={(comp) => {
              setSelectedComp(comp);
              setView('pick-box');
            }}
          />
        )}

        {/* Blind Box Selection */}
        {!isAdmin && view === 'pick-box' && selectedComp && (
          <PickBoxView
            competition={selectedComp}
            blindBoxes={blindBoxes}
            availableCount={availableCount}
            onChooseBox={handleChooseBlindBox}
            onRandomPick={handleRandomPick}
            onBack={() => setView('dashboard')}
          />
        )}

        {/* My Entries */}
        {!isAdmin && view === 'my-entries' && (
          <MyEntriesView userDraws={userDraws} competitions={competitions} />
        )}

        {/* Admin: Manage Competitions */}
        {isAdmin && view === 'admin-manage' && (
          <ManageCompetitions
            competitions={competitions}
            onCreateCompetition={handleCreateCompetition}
            onUpdateCompetition={handleUpdateCompetition}
            onSelectCompetition={(comp) => {
              setSelectedComp(comp);
              loadEntries(comp.id);
              setView('admin-entries');
            }}
          />
        )}

        {/* Admin: Manage Entries */}
        {isAdmin && view === 'admin-entries' && (
          <ManageEntries
            competitions={competitions}
            entries={entries}
            selectedCompetition={selectedComp}
            onSelectCompetition={(comp) => {
              setSelectedComp(comp);
              loadEntries(comp.id);
            }}
            onUploadEntries={handleUploadEntries}
            onDeleteEntry={handleDeleteEntry}
            onUpdatePosition={handleUpdatePosition}
          />
        )}

        {/* Admin: View Participants */}
        {isAdmin && view === 'admin-participants' && (
          <ParticipantsView
            competitions={competitions}
            selectedComp={selectedComp}
            onSelectCompetition={async (comp) => {
              setSelectedComp(comp);
              try {
                const res = await axios.get(`${API_BASE}/api/competitions/${comp.id}/all-draws`);
                setUserDraws(res.data || []);
              } catch (err) {
                console.error(err);
              }
            }}
            draws={userDraws}
          />
        )}
      </main>
    </div>
  );
}

// Component: User Dashboard
function UserDashboard({ competitions, userDraws, onSelectCompetition }: {
  competitions: Competition[];
  userDraws: Draw[];
  onSelectCompetition: (comp: Competition) => void;
}) {
  return (
    <div style={styles.section}>
      <h2>Open Competitions</h2>
      {competitions.length > 0 ? (
        <div style={styles.grid}>
          {competitions.map(comp => {
            const draws = userDraws.filter(d => d.competition_id === comp.id);
            const hasEntry = draws.length > 0;

            return (
              <div key={comp.id} style={styles.card}>
                <h3>{comp.name}</h3>
                <div style={{marginBottom: 10}}>
                  <span style={{...styles.badge, backgroundColor: comp.status === 'open' ? '#10b981' : '#6b7280'}}>
                    {comp.status}
                  </span>
                  <span style={{...styles.badge, backgroundColor: '#3b82f6', marginLeft: 8}}>
                    {comp.type}
                  </span>
                </div>
                {comp.description && <p style={{color: '#6b7280', marginBottom: 15}}>{comp.description}</p>}

                {hasEntry && (
                  <div style={{...styles.card, backgroundColor: '#f0fdf4', marginTop: 10}}>
                    <h4 style={{marginBottom: 8}}>Your Entry</h4>
                    {draws.map(draw => (
                      <div key={draw.id}>
                        <p style={{fontWeight: 'bold'}}>{draw.entry_name}</p>
                        {draw.seed && <p>Seed #{draw.seed}</p>}
                        {draw.number && <p>#{draw.number}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {comp.status === 'open' && !hasEntry && (
                  <button onClick={() => onSelectCompetition(comp)} style={styles.button}>
                    📦 Pick Your Box
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p>No active competitions</p>
      )}
    </div>
  );
}

// Component: Blind Box Selection
function PickBoxView({ competition, blindBoxes, availableCount, onChooseBox, onRandomPick, onBack }: {
  competition: Competition;
  blindBoxes: BlindBox[];
  availableCount: number;
  onChooseBox: (boxNumber: number) => void;
  onRandomPick: () => void;
  onBack: () => void;
}) {
  return (
    <div style={styles.section}>
      <button onClick={onBack} style={{...styles.button, backgroundColor: '#6b7280', marginBottom: 20}}>
        ← Back
      </button>

      <h2>📦 Pick Your Mystery Box - {competition.name}</h2>
      <p>{availableCount} boxes remaining</p>

      <button onClick={onRandomPick} style={{...styles.button, fontSize: 18, padding: '15px 40px', margin: '20px 0'}}>
        🎲 Random Spin
      </button>

      <p style={{textAlign: 'center', color: '#6b7280', margin: '20px 0'}}>— OR —</p>

      {blindBoxes.length > 0 ? (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 15}}>
          {blindBoxes.map(box => (
            <div key={box.box_number} style={{...styles.card, textAlign: 'center', cursor: 'pointer'}}
                 onClick={() => onChooseBox(box.box_number)}>
              <div style={{fontSize: 40}}>📦</div>
              <h3>Box #{box.box_number}</h3>
            </div>
          ))}
        </div>
      ) : (
        <p>All boxes have been selected or you've already picked one!</p>
      )}
    </div>
  );
}

// Component: My Entries
function MyEntriesView({ userDraws, competitions }: {
  userDraws: Draw[];
  competitions: Competition[];
}) {
  return (
    <div style={styles.section}>
      <h2>My Entries ({userDraws.length})</h2>
      {userDraws.length > 0 ? (
        <div style={styles.grid}>
          {userDraws.map(draw => {
            const comp = competitions.find(c => c.id === draw.competition_id);
            return (
              <div key={draw.id} style={styles.card}>
                <p style={{fontWeight: 'bold', marginBottom: 10}}>{comp?.name || 'Unknown Competition'}</p>
                <h3>{draw.entry_name}</h3>
                {draw.seed && <p>Seed #{draw.seed}</p>}
                {draw.number && <p>#{draw.number}</p>}
                <p style={{color: '#6b7280', fontSize: 14, marginTop: 10}}>
                  Selected: {new Date(draw.drawn_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p>You haven't entered any competitions yet.</p>
      )}
    </div>
  );
}

// Component: Admin - Manage Competitions
function ManageCompetitions({ competitions, onCreateCompetition, onUpdateCompetition, onSelectCompetition }: {
  competitions: Competition[];
  onCreateCompetition: (e: React.FormEvent<HTMLFormElement>) => void;
  onUpdateCompetition: (id: number, updates: Partial<Competition>) => void;
  onSelectCompetition: (comp: Competition) => void;
}) {
  return (
    <div style={styles.section}>
      <h2>Manage Competitions</h2>

      <div style={{...styles.card, marginBottom: 30}}>
        <h3>Create New Competition</h3>
        <form onSubmit={onCreateCompetition}>
          <input type="text" name="name" placeholder="Competition Name" required style={styles.input} />
          <select name="type" required style={styles.input}>
            <option value="">Select Type</option>
            <option value="knockout">Knockout</option>
            <option value="race">Race</option>
          </select>
          <textarea name="description" placeholder="Description" style={styles.input} />
          <button type="submit" style={styles.button}>Create Competition</button>
        </form>
      </div>

      <h3>All Competitions</h3>
      <div style={styles.grid}>
        {competitions.map(comp => (
          <div key={comp.id} style={styles.card}>
            <h3>{comp.name}</h3>
            <div style={{marginBottom: 10}}>
              <span style={{...styles.badge, backgroundColor: getStatusColor(comp.status)}}>{comp.status}</span>
              <span style={{...styles.badge, backgroundColor: '#3b82f6', marginLeft: 8}}>{comp.type}</span>
            </div>
            <p>{comp.description}</p>

            <div style={{marginTop: 15, display: 'flex', flexDirection: 'column', gap: 8}}>
              {comp.status === 'draft' && (
                <button onClick={() => onUpdateCompetition(comp.id, {...comp, status: 'open'})} style={styles.button}>
                  📢 Open for Users
                </button>
              )}
              {comp.status === 'open' && (
                <button onClick={() => {
                  if (window.confirm('Lock the competition?')) {
                    onUpdateCompetition(comp.id, {...comp, status: 'locked'});
                  }
                }} style={styles.button}>
                  🔒 Lock Competition
                </button>
              )}
              {comp.status === 'locked' && (
                <button onClick={() => {
                  if (window.confirm('Mark as completed?')) {
                    onUpdateCompetition(comp.id, {...comp, status: 'completed'});
                  }
                }} style={styles.button}>
                  🏁 Complete
                </button>
              )}
              <button onClick={() => onSelectCompetition(comp)} style={{...styles.button, backgroundColor: '#6b7280'}}>
                Manage Entries
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component: Admin - Manage Entries
function ManageEntries({ competitions, entries, selectedCompetition, onSelectCompetition, onUploadEntries, onDeleteEntry, onUpdatePosition }: {
  competitions: Competition[];
  entries: Entry[];
  selectedCompetition: Competition | null;
  onSelectCompetition: (comp: Competition) => void;
  onUploadEntries: (e: React.FormEvent<HTMLFormElement>) => void;
  onDeleteEntry: (id: number) => void;
  onUpdatePosition: (entryId: number, position: number | null) => void;
}) {
  return (
    <div style={styles.section}>
      <h2>Manage Entries</h2>

      <select
        onChange={(e) => {
          const comp = competitions.find(c => c.id === parseInt(e.target.value));
          if (comp) onSelectCompetition(comp);
        }}
        value={selectedCompetition?.id || ''}
        style={styles.input}
      >
        <option value="">Select Competition</option>
        {competitions.map(c => (
          <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
        ))}
      </select>

      {selectedCompetition && (
        <>
          <div style={{...styles.card, marginTop: 20}}>
            <h3>Bulk Upload (CSV)</h3>
            <form onSubmit={onUploadEntries}>
              <input type="hidden" name="competition_id" value={selectedCompetition.id} />
              <input type="hidden" name="type" value={selectedCompetition.type} />
              <input type="file" name="file" accept=".csv" required style={styles.input} />
              <button type="submit" style={styles.button}>Upload CSV</button>
            </form>
            <p style={{color: '#6b7280', fontSize: 14, marginTop: 10}}>
              CSV Format - Knockout: Name, Seed | Race: Name, Number
            </p>
          </div>

          {entries.length > 0 && (
            <div style={{marginTop: 30, overflowX: 'auto'}}>
              <h3>Current Entries ({entries.length})</h3>
              <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 15}}>
                <thead>
                  <tr style={{backgroundColor: '#f3f4f6'}}>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Seed/Number</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Position</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                      <td style={styles.td}>{entry.name}</td>
                      <td style={styles.td}>{entry.seed || entry.number || '-'}</td>
                      <td style={styles.td}>
                        <span style={{...styles.badge, fontSize: 12}}>{entry.status}</span>
                      </td>
                      <td style={styles.td}>
                        <select
                          value={entry.position || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdatePosition(entry.id, val ? parseInt(val) : null);
                          }}
                          style={{padding: 5, width: 100}}
                        >
                          <option value="">None</option>
                          <option value="1">1st</option>
                          <option value="2">2nd</option>
                          <option value="3">3rd</option>
                          <option value="4">4th</option>
                          <option value="5">5th</option>
                          <option value="999">Last</option>
                        </select>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => onDeleteEntry(entry.id)}
                          style={{...styles.button, backgroundColor: '#ef4444', padding: '5px 10px', fontSize: 12}}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Component: Admin - View Participants
function ParticipantsView({ competitions, selectedComp, onSelectCompetition, draws }: {
  competitions: Competition[];
  selectedComp: Competition | null;
  onSelectCompetition: (comp: Competition) => void;
  draws: Draw[];
}) {
  return (
    <div style={styles.section}>
      <h2>View All Participants</h2>

      <select
        onChange={(e) => {
          const comp = competitions.find(c => c.id === parseInt(e.target.value));
          if (comp) onSelectCompetition(comp);
        }}
        value={selectedComp?.id || ''}
        style={styles.input}
      >
        <option value="">Select Competition</option>
        {competitions.map(c => (
          <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
        ))}
      </select>

      {selectedComp && draws.length > 0 && (
        <div style={{...styles.grid, marginTop: 30}}>
          {draws.map((draw, idx) => (
            <div key={idx} style={styles.card}>
              <h3>{draw.user_name || draw.user_id}</h3>
              <p style={{fontWeight: 'bold', fontSize: 18}}>{draw.entry_name}</p>
              {draw.position && draw.position !== 999 && (
                <div style={{fontSize: 20, fontWeight: 'bold', margin: '10px 0'}}>
                  🏆 {draw.position}{draw.position === 1 ? 'st' : draw.position === 2 ? 'nd' : draw.position === 3 ? 'rd' : 'th'} Place
                </div>
              )}
              {draw.position === 999 && (
                <div style={{fontSize: 20, fontWeight: 'bold', margin: '10px 0'}}>
                  🏴 Last Place
                </div>
              )}
              {draw.seed && <p>Seed #{draw.seed}</p>}
              {draw.number && <p>#{draw.number}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open': return '#10b981';
    case 'draft': return '#f59e0b';
    case 'locked': return '#ef4444';
    case 'completed': return '#3b82f6';
    case 'archived': return '#6b7280';
    default: return '#6b7280';
  }
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  container: {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  nav: {
    backgroundColor: '#ffffff',
    padding: '10px 20px',
    display: 'flex',
    gap: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  navButton: {
    padding: '10px 20px',
    border: 'none',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: 14,
  } as React.CSSProperties,
  navButtonActive: {
    padding: '10px 20px',
    border: 'none',
    backgroundColor: '#3b82f6',
    color: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: 14,
  } as React.CSSProperties,
  main: {
    padding: '20px',
  },
  section: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'white',
  } as React.CSSProperties,
  button: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    fontSize: 16,
    fontWeight: 500,
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '15px',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
    fontSize: 14,
  } as React.CSSProperties,
  error: {
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  th: {
    padding: '12px',
    textAlign: 'left' as const,
    fontWeight: 600,
  },
  td: {
    padding: '12px',
  },
};

export default App;
