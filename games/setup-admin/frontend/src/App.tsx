import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = window.location.origin;

// Available roles in the system
const AVAILABLE_ROLES = [
  { id: 'setup_admin', label: 'Setup Admin', color: '#9C27B0' },
  { id: 'game_admin', label: 'Game Admin', color: '#2196F3' },
  { id: 'super_user', label: 'Super User', color: '#FF9800' },
  { id: 'game_manager', label: 'Game Manager', color: '#4CAF50' },
  { id: 'quiz_master', label: 'Quiz Master', color: '#E91E63' },
];

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

interface RoleChipsProps {
  userRoles: string[];
  onToggleRole: (role: string) => void;
  disabled: boolean;
}

function RoleChips({ userRoles, onToggleRole, disabled }: RoleChipsProps) {
  return (
    <div className="role-chips">
      {AVAILABLE_ROLES.map(role => {
        const isActive = userRoles.includes(role.id);
        return (
          <button
            key={role.id}
            className={`role-chip ${isActive ? 'active' : 'inactive'}`}
            onClick={() => onToggleRole(role.id)}
            disabled={disabled}
            title={isActive ? `Remove ${role.label}` : `Add ${role.label}`}
          >
            {isActive ? '✓' : '+'} {role.label}
          </button>
        );
      })}
    </div>
  );
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
      <div className="ah-container ah-container--narrow text-center mt-10">
        <div className="ah-card">
          <h2 style={{ marginBottom: 12 }}>⚙️ Setup Admin</h2>
          <p className="ah-meta">
            This app must be opened through the Activity Hub with proper authentication.
          </p>
          <button
            className="ah-btn-primary mt-5"
            onClick={() => {
              window.location.href = `http://${window.location.hostname}:3001`;
            }}
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* App Header Bar */}
      <div className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">⚙️ Setup Admin</h1>
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
      </div>

      <div className="ah-container ah-container--wide" style={{ paddingTop: 20 }}>
        {/* Tabs */}
        <div className="ah-tabs">
          <button
            className={`ah-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
          <button
            className={`ah-tab ${activeTab === 'apps' ? 'active' : ''}`}
            onClick={() => setActiveTab('apps')}
          >
            📱 Apps
          </button>
        </div>

      {/* Read-only notice */}
      {readOnly && (
        <div className="ah-banner ah-banner--warning">
          ℹ️ Read-Only Mode: You have super_user access but cannot modify settings. Full setup_admin role required for changes.
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="ah-card">
          <p className="ah-meta">Loading...</p>
        </div>
      ) : activeTab === 'users' ? (
        <div className="ah-card">
          <h3 className="ah-section-title">User Management</h3>
          <table className="setup-admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Roles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.email}>
                  <td>{user.email}</td>
                  <td>{user.name}</td>
                  <td>
                    {user.roles.length === 0 ? (
                      <span className="ah-meta">No roles assigned</span>
                    ) : (
                      <RoleChips
                        userRoles={user.roles}
                        onToggleRole={(role) => toggleUserRole(user.email, role, user.roles)}
                        disabled={readOnly}
                      />
                    )}
                    {readOnly === false && user.roles.length === 0 && (
                      <RoleChips
                        userRoles={user.roles}
                        onToggleRole={(role) => toggleUserRole(user.email, role, user.roles)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td>
                    {currentUserRoles.includes('super_user') && (
                      <button
                        className="ah-btn-outline"
                        onClick={() => handleImpersonate(user.email)}
                        style={{ fontSize: 13 }}
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
        <div className="ah-card">
          <h3 className="ah-section-title">App Registry</h3>
          <table className="setup-admin-table">
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
                      className={app.enabled ? 'ah-btn-primary' : 'ah-btn-outline'}
                      onClick={() => toggleApp(app.id, app.enabled)}
                      disabled={readOnly}
                      style={{ fontSize: 13 }}
                    >
                      {app.enabled ? '✓ Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td>
                    {app.requiredRoles.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {app.requiredRoles.map(role => (
                          <span
                            key={role}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 8,
                              background: '#E3F2FD',
                              color: '#1976D2',
                              fontSize: 12,
                            }}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="ah-meta">Public</span>
                    )}
                  </td>
                  <td>{app.displayOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  );
}

export default App;
