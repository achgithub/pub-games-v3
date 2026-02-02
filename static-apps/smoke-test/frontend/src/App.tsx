import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_BASE = '/api';

interface User {
  email: string;
  name: string;
  is_admin: boolean;
}

interface AppConfig {
  app_name: string;
  app_icon: string;
}

interface Item {
  id: number;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
}

type ViewType = 'loading' | 'no-user' | 'dashboard' | 'items' | 'admin';

function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      userName: params.get('userName'),
      isAdmin: params.get('isAdmin') === 'true',
      token: params.get('token'),
    };
  }, []);
}

function App() {
  const { userId, userName, isAdmin, token } = useQueryParams();

  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewType>('loading');
  const [items, setItems] = useState<Item[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    app_name: 'Smoke Test',
    app_icon: '🧪'
  });
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');

  // Create authenticated axios instance
  const api = useMemo(() => {
    if (!token) return axios.create({ baseURL: API_BASE });

    return axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }, [token]);

  // Handle 401 responses (expired/invalid token)
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          alert('Session expired. Please login again.');
          window.location.href = `http://${window.location.hostname}:3001`;
        }
        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
  }, [api]);

  // Initialize: Get user from URL params
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (!userId) {
        if (isMounted) {
          setView('no-user');
        }
        return;
      }

      const userData: User = {
        email: userId,
        name: userName || userId,
        is_admin: isAdmin
      };

      // User sync now happens automatically in backend AuthMiddleware
      // No need for explicit sync call

      if (isMounted) {
        setUser(userData);
        setView('dashboard');
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [userId, userName, isAdmin]);

  // Load app config (no auth required)
  useEffect(() => {
    let isMounted = true;

    api.get('/config')
      .then(res => {
        if (isMounted) {
          setConfig(res.data);
        }
      })
      .catch(() => console.log('Using default config'));

    return () => {
      isMounted = false;
    };
  }, [api]);

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
      const response = await api.get('/items');
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

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !user) return;

    try {
      await api.post('/items', {
        name: newItemName,
        description: newItemDescription
      });

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

  // No user provided
  if (view === 'no-user') {
    return (
      <div className="App" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', padding: '20px'}}>
          <h1>Smoke Test</h1>
          <p style={{fontSize: '18px', margin: '30px 0', color: '#666'}}>
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
                  <li>Shell-integrated authentication</li>
                  <li>PostgreSQL database (microservice isolation)</li>
                  <li>Protected API routes</li>
                  <li>TypeScript frontend</li>
                  <li>Admin functionality</li>
                  <li>Mobile-friendly</li>
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

  return null;
}

export default App;
