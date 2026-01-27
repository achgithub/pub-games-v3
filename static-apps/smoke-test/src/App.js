import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Dynamic URLs for mobile access
const getHostname = () => window.location.hostname;
const API_BASE = `http://${getHostname()}:5011/api`;

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading');
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState({
    app_name: 'Smoke Test',
    app_icon: '🧪'
  });
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');

  // Initialize: Get user from URL params (passed by shell)
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Shell passes user info via URL params
      // Standard params: userId, userName, gameId (optional)
      const params = new URLSearchParams(window.location.search);
      const userEmail = params.get('userId');
      const userName = params.get('userName');
      const isAdmin = params.get('admin') === 'true';

      if (!userEmail) {
        if (isMounted) {
          setView('no-user');
        }
        return;
      }

      // Create user object
      const userData = {
        email: userEmail,
        name: userName || userEmail,
        is_admin: isAdmin
      };

      // Sync user with backend
      try {
        await axios.post(`${API_BASE}/sync-user`, userData);
        if (isMounted) {
          setUser(userData);
          setView('dashboard');
        }
      } catch (error) {
        console.error('Failed to sync user:', error);
        if (isMounted) {
          setUser(userData);
          setView('dashboard');
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load app config
  useEffect(() => {
    let isMounted = true;

    axios.get(`${API_BASE}/config`)
      .then(res => {
        if (isMounted) {
          setConfig(res.data);
        }
      })
      .catch(err => console.log('Using default config'));

    return () => {
      isMounted = false;
    };
  }, []);

  // Load items when user is authenticated
  useEffect(() => {
    let isMounted = true;

    if (user) {
      loadItems(isMounted);
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  const loadItems = async (isMounted = true) => {
    if (!user) return;

    try {
      const response = await axios.get(`${API_BASE}/items?user=${encodeURIComponent(user.email)}`);
      if (isMounted) {
        setItems(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      if (isMounted) {
        setItems([]);
      }
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      await axios.post(
        `${API_BASE}/items?user=${encodeURIComponent(user.email)}`,
        {
          name: newItemName,
          description: newItemDescription
        }
      );

      setNewItemName('');
      setNewItemDescription('');
      loadItems();
    } catch (error) {
      console.error('Failed to create item:', error);
      alert('Failed to create item');
    }
  };

  // Loading state
  if (view === 'loading') {
    return (
      <div className="App" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // No user provided (shouldn't happen if loaded from shell)
  if (view === 'no-user') {
    return (
      <div className="App" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', padding: '20px'}}>
          <h1>⚠️ Access Error</h1>
          <p style={{fontSize: '18px', margin: '30px 0', color: '#666'}}>
            This app must be accessed through the Identity Shell.
          </p>
        </div>
      </div>
    );
  }

  // Main dashboard
  if (user) {
    return (
      <div className="App">
        <header style={{borderBottom: '2px solid #e0e0e0', padding: '15px 20px', marginBottom: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h1 style={{margin: 0}}>{config.app_icon} {config.app_name}</h1>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <span>Welcome, {user.name}!</span>
              {user.is_admin && <span className="admin-badge">ADMIN</span>}
            </div>
          </div>
        </header>

        <nav className="tabs">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            Dashboard
          </button>
          <button className={view === 'items' ? 'active' : ''} onClick={() => setView('items')}>
            Items
          </button>
          {user.is_admin && (
            <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
              Admin Panel
            </button>
          )}
        </nav>

        <main>
          {view === 'dashboard' && (
            <div className="dashboard">
              <h2>Welcome to {config.app_name}!</h2>

              <div className="rules">
                <h3>Getting Started</h3>
                <p>This is a static app template for PubGames V3.</p>
                <ul>
                  <li>✅ Shell-integrated authentication</li>
                  <li>✅ PostgreSQL database (microservice isolation)</li>
                  <li>✅ Protected API routes</li>
                  <li>✅ Shared CSS styling from shell</li>
                  <li>✅ Admin functionality</li>
                  <li>✅ Mobile-friendly (dynamic URLs)</li>
                  <li>✅ Iframe-embeddable</li>
                </ul>
              </div>

              {user.is_admin && (
                <div className="admin-dashboard">
                  <h3>Admin Quick Actions</h3>
                  <button onClick={() => setView('items')}>Manage Items</button>
                  <button onClick={() => setView('admin')}>Admin Panel</button>
                </div>
              )}
            </div>
          )}

          {view === 'items' && (
            <div>
              <h2>Sample Items</h2>

              <div className="admin-section">
                <h3>Create New Item</h3>
                <form onSubmit={handleCreateItem} className="inline-form">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                  />
                  <button type="submit">Create Item</button>
                </form>
              </div>

              <div className="admin-section">
                <h3>All Items</h3>
                {items.length === 0 ? (
                  <p className="info-text">No items yet. Create one above!</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Created By</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>
                          <td><strong>{item.name}</strong></td>
                          <td>{item.description || '-'}</td>
                          <td>{item.created_by}</td>
                          <td>{new Date(item.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {view === 'admin' && user.is_admin && (
            <div className="admin">
              <h2>Admin Panel</h2>

              <div className="admin-section">
                <h3>Admin Tools</h3>
                <p className="info-text">This section is only visible to administrators.</p>
                <p>You can add admin-only functionality here.</p>
              </div>

              <div className="admin-section">
                <h3>System Information</h3>
                <table className="compact-table">
                  <tbody>
                    <tr>
                      <td><strong>App Name:</strong></td>
                      <td>{config.app_name}</td>
                    </tr>
                    <tr>
                      <td><strong>Total Items:</strong></td>
                      <td>{items.length}</td>
                    </tr>
                    <tr>
                      <td><strong>Current User:</strong></td>
                      <td>{user.name}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Fallback
  return null;
}

export default App;
