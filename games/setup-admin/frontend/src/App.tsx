import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = window.location.origin;

interface User {
  email: string;
  name: string;
  is_admin: boolean;
  roles: string[];
  createdAt: string;
}

interface AppRecord {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  requiredRoles: string[];
  displayOrder: number;
  description: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'users' | 'apps'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>('');
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
  const [readOnly, setReadOnly] = useState(false);

  // Get token and user info from URL parameters (passed from identity-shell)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      fetchCurrentUser(urlToken);
    }
  }, []);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      // Validate token to get current user roles
      const response = await fetch(`http://${window.location.hostname}:3001/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken })
      });
      const data = await response.json();
      if (data.valid && data.user) {
        setCurrentUserRoles(data.user.roles || []);
        // Check if user is super_user but NOT setup_admin (read-only mode)
        const isSuperUser = data.user.roles?.includes('super_user');
        const isSetupAdmin = data.user.roles?.includes('setup_admin');
        setReadOnly(isSuperUser && !isSetupAdmin);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  // Fetch data when tab changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!token) return;

    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchApps();
    }
  }, [activeTab, token]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
    setLoading(false);
  };

  const fetchApps = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/apps`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setApps(data.apps || []);
    } catch (error) {
      console.error('Failed to fetch apps:', error);
    }
    setLoading(false);
  };

  const toggleUserRole = async (email: string, role: string, currentRoles: string[]) => {
    const hasRole = currentRoles.includes(role);
    const newRoles = hasRole
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];

    try {
      const response = await fetch(`${API_BASE}/api/users/${email}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roles: newRoles })
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const toggleApp = async (appId: string, enabled: boolean) => {
    const action = enabled ? 'disable' : 'enable';
    try {
      const response = await fetch(`${API_BASE}/api/apps/${appId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchApps();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to toggle app');
      }
    } catch (error) {
      console.error('Failed to toggle app:', error);
    }
  };

  const handleImpersonate = async (targetEmail: string) => {
    try {
      const response = await fetch(`http://${window.location.hostname}:3001/api/admin/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetEmail })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Redirect to identity-shell with impersonation token
          window.location.href = `http://${window.location.hostname}:3001/?token=${data.token}`;
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to start impersonation');
      }
    } catch (error) {
      console.error('Failed to impersonate user:', error);
      alert('Failed to start impersonation');
    }
  };

  if (!token) {
    return (
      <div className="App">
        <div className="container">
          <h1>⚠️ Access Required</h1>
          <p>This app must be opened through the Activity Hub with proper authentication.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1>⚙️ Setup Admin</h1>
          <button
            className="ah-lobby-btn"
            onClick={() => { window.location.href = `http://${window.location.hostname}:3001`; }}
          >
            ← Lobby
          </button>
        </div>
        <div className="tabs">
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
          <button
            className={activeTab === 'apps' ? 'active' : ''}
            onClick={() => setActiveTab('apps')}
          >
            📱 Apps
          </button>
        </div>
      </header>

      {readOnly && (
        <div className="read-only-notice">
          ℹ️ Read-Only Mode: You have super_user access but cannot modify settings. Full setup_admin role required for changes.
        </div>
      )}

      <main>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : activeTab === 'users' ? (
          <div className="users-section">
            <h2>User Management</h2>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Setup Admin</th>
                  <th>Game Admin</th>
                  <th>Super User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>{user.name}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={user.roles.includes('setup_admin')}
                        onChange={() => toggleUserRole(user.email, 'setup_admin', user.roles)}
                        disabled={readOnly}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={user.roles.includes('game_admin')}
                        onChange={() => toggleUserRole(user.email, 'game_admin', user.roles)}
                        disabled={readOnly}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={user.roles.includes('super_user')}
                        onChange={() => toggleUserRole(user.email, 'super_user', user.roles)}
                        disabled={readOnly}
                      />
                    </td>
                    <td>
                      {currentUserRoles.includes('super_user') && (
                        <button
                          className="impersonate-button"
                          onClick={() => handleImpersonate(user.email)}
                        >
                          👤 Impersonate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="apps-section">
            <h2>App Registry</h2>
            <table>
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Name</th>
                  <th>Enabled</th>
                  <th>Roles Required</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(app => (
                  <tr key={app.id}>
                    <td className="icon">{app.icon}</td>
                    <td>{app.name}</td>
                    <td>
                      <button
                        className={app.enabled ? 'enabled' : 'disabled'}
                        onClick={() => toggleApp(app.id, app.enabled)}
                        disabled={readOnly}
                      >
                        {app.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </button>
                    </td>
                    <td>{app.requiredRoles.length > 0 ? app.requiredRoles.join(', ') : 'Public'}</td>
                    <td>{app.displayOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
