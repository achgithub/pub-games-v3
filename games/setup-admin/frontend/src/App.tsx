import React, { useState, useEffect } from 'react';

const API_BASE = window.location.origin;

// Helper to identify the identity-shell (Lobby) app - cannot be disabled or modified
const isIdentityShell = (app: AppRecord): boolean => {
  return app.id === 'lobby' || app.name === 'Lobby' || app.id === 'identity-shell';
};

// Available roles in the system
const AVAILABLE_ROLES = [
  { id: 'setup_admin', label: 'Setup Admin', color: '#9C27B0' },
  { id: 'game_admin', label: 'Game Admin', color: '#2196F3' },
  { id: 'super_user', label: 'Super User', color: '#FF9800' },
  { id: 'game_manager', label: 'Game Manager', color: '#4CAF50' },
  { id: 'quiz_master', label: 'Quiz Master', color: '#E91E63' },
  { id: 'admin', label: 'Admin', color: '#F44336' },
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
  type: string;
  description: string;
  category: string;
  url: string;
  backendPort: number;
  realtime: string;
  requiredRoles: string[];
  enabled: boolean;
  displayOrder: number;
}

interface RoleChipsProps {
  userRoles: string[];
  onToggleRole: (role: string) => void;
  disabled: boolean;
}

function RoleChips({ userRoles, onToggleRole, disabled }: RoleChipsProps) {
  return (
    <div className="ah-role-chips">
      {AVAILABLE_ROLES.map(role => {
        const isActive = userRoles.includes(role.id);
        return (
          <button
            key={role.id}
            className={`ah-role-chip ${isActive ? 'active' : 'inactive'}`}
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
  const [activeTab, setActiveTab] = useState<'users' | 'apps' | 'registry'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>('');
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [editingApp, setEditingApp] = useState<AppRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingAppId, setTogglingAppId] = useState<string | null>(null);

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
    } else if (activeTab === 'apps' || activeTab === 'registry') {
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
    setTogglingAppId(appId);
    try {
      const response = await fetch(`${API_BASE}/api/apps/${appId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchApps();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to toggle app');
      }
    } catch (error) {
      console.error('Failed to toggle app:', error);
      alert('Failed to toggle app');
    }
    setTogglingAppId(null);
  };

  const saveApp = async (app: AppRecord) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/apps/${app.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(app)
      });

      if (response.ok) {
        fetchApps();
        setEditingApp(null);
        alert('App updated successfully');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update app');
      }
    } catch (error) {
      console.error('Failed to save app:', error);
      alert('Failed to save app');
    }
    setSaving(false);
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
          <h2 className="mb-3">⚙️ Setup Admin</h2>
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

      <div className="ah-container ah-container--wide pt-5">
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
          <button
            className={`ah-tab ${activeTab === 'registry' ? 'active' : ''}`}
            onClick={() => setActiveTab('registry')}
          >
            ⚙️ Registry Editor
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
      ) : activeTab === 'registry' ? (
        <div className="ah-card">
          <h3 className="ah-section-title">Registry Editor</h3>
          <p className="ah-meta mb-3">View and edit all fields in the applications registry table</p>

          {editingApp ? (
            <div>
              {isIdentityShell(editingApp) && (
                <div className="ah-banner ah-banner--warning mb-3">
                  🔒 This is the Identity Shell (core platform). Editing is disabled to prevent breaking the system.
                </div>
              )}

              <div className="ah-flex ah-flex-between mb-3">
                <h4>Editing: {editingApp.name}</h4>
                <button
                  className="ah-btn-outline text-xs"
                  onClick={() => setEditingApp(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>

              <div className="ah-flex-col gap-2">
                <div>
                  <label className="ah-label block mb-1">ID (read-only)</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.id}
                    disabled
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Name</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.name}
                    onChange={(e) => setEditingApp({ ...editingApp, name: e.target.value })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Icon (emoji)</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.icon}
                    onChange={(e) => setEditingApp({ ...editingApp, icon: e.target.value })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Type</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.type}
                    onChange={(e) => setEditingApp({ ...editingApp, type: e.target.value })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Description</label>
                  <textarea
                    className="ah-input w-full"
                    rows={3}
                    value={editingApp.description}
                    onChange={(e) => setEditingApp({ ...editingApp, description: e.target.value })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Category</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.category}
                    onChange={(e) => setEditingApp({ ...editingApp, category: e.target.value })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">URL</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.url}
                    onChange={(e) => setEditingApp({ ...editingApp, url: e.target.value })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Backend Port</label>
                  <input
                    type="number"
                    className="ah-input w-full"
                    value={editingApp.backendPort}
                    onChange={(e) => setEditingApp({ ...editingApp, backendPort: parseInt(e.target.value) || 0 })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Realtime (none/sse/websocket)</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.realtime}
                    onChange={(e) => setEditingApp({ ...editingApp, realtime: e.target.value })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Required Roles (comma-separated)</label>
                  <input
                    type="text"
                    className="ah-input w-full"
                    value={editingApp.requiredRoles.join(', ')}
                    onChange={(e) => setEditingApp({ ...editingApp, requiredRoles: e.target.value.split(',').map(r => r.trim()).filter(r => r) })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div>
                  <label className="ah-label block mb-1">Display Order</label>
                  <input
                    type="number"
                    className="ah-input w-full"
                    value={editingApp.displayOrder}
                    onChange={(e) => setEditingApp({ ...editingApp, displayOrder: parseInt(e.target.value) || 0 })}
                    disabled={readOnly || saving}
                  />
                </div>

                <div className="ah-flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={editingApp.enabled}
                    onChange={(e) => setEditingApp({ ...editingApp, enabled: e.target.checked })}
                    disabled={readOnly || saving}
                  />
                  <label htmlFor="enabled" className="ah-label">Enabled</label>
                </div>

                <div className="mt-3">
                  <button
                    className="ah-btn-primary"
                    onClick={() => saveApp(editingApp)}
                    disabled={readOnly || saving || isIdentityShell(editingApp)}
                  >
                    {saving ? 'Saving...' : isIdentityShell(editingApp) ? 'Cannot Save (Protected)' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <table className="ah-html-table">
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Port</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(app => {
                  const isCore = isIdentityShell(app);
                  return (
                  <tr key={app.id} className={isCore ? 'opacity-60' : ''}>
                    <td className="icon">{app.icon}</td>
                    <td>
                      {app.name}
                      {isCore && <div className="ah-meta text-xs">Core Platform - Cannot Edit</div>}
                    </td>
                    <td><span className="ah-meta">{app.type}</span></td>
                    <td><span className="ah-meta">{app.category}</span></td>
                    <td><span className="ah-meta">{app.backendPort}</span></td>
                    <td>
                      {app.enabled ? (
                        <span className="ah-badge ah-badge--success">Yes</span>
                      ) : (
                        <span className="ah-badge ah-badge--neutral">No</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="ah-btn-outline text-xs"
                        onClick={() => setEditingApp({ ...app })}
                        disabled={readOnly || isCore}
                        title={isCore ? 'Identity Shell cannot be modified' : ''}
                      >
                        {isCore ? 'Protected' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === 'users' ? (
        <div className="ah-card">
          <h3 className="ah-section-title">User Management</h3>
          <table className="ah-html-table">
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
                        className="ah-btn-outline text-xs"
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
        <div className="ah-card">
          <h3 className="ah-section-title">App Registry</h3>
          <table className="ah-html-table">
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
              {apps.map(app => {
                const isCore = isIdentityShell(app);
                return (
                <tr key={app.id} className={isCore ? 'opacity-60' : ''}>
                  <td className="icon">{app.icon}</td>
                  <td>
                    {app.name}
                    {isCore && <div className="ah-meta text-xs">Core Platform</div>}
                  </td>
                  <td>
                    {isCore ? (
                      <span className="ah-badge ah-badge--neutral text-xs">Always On</span>
                    ) : (
                      <button
                        className={`${app.enabled ? 'ah-btn-primary' : 'ah-btn-outline'} text-xs`}
                        onClick={() => toggleApp(app.id, app.enabled)}
                        disabled={readOnly || togglingAppId === app.id}
                      >
                        {togglingAppId === app.id ? '...' : app.enabled ? '✓ Enabled' : 'Disabled'}
                      </button>
                    )}
                  </td>
                  <td>
                    {app.requiredRoles.length > 0 ? (
                      <div className="ah-flex ah-flex-wrap gap-1">
                        {app.requiredRoles.map(role => (
                          <span key={role} className="ah-badge ah-badge--info">
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  );
}

export default App;
