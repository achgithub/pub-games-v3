import React, { useState, useEffect } from 'react';
import './Settings.css';
import { AppDefinition } from '../types';

const API_BASE = `http://${window.location.hostname}:3001/api`;

interface SettingsProps {
  apps: AppDefinition[];
  onClose: () => void;
  onSave: () => void;
}

interface AppPreference {
  appId: string;
  isHidden: boolean;
  isFavorite: boolean;
  customOrder: number | null;
}

const Settings: React.FC<SettingsProps> = ({ apps, onClose, onSave }) => {
  const [appPreferences, setAppPreferences] = useState<AppPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreferences = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/user/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      // Build preference map from existing preferences
      const prefsMap = new Map<string, AppPreference>();
      if (data.preferences) {
        data.preferences.forEach((pref: any) => {
          prefsMap.set(pref.appId, {
            appId: pref.appId,
            isHidden: pref.isHidden,
            isFavorite: pref.isFavorite || false,
            customOrder: pref.customOrder
          });
        });
      }

      // Create preferences for all apps (use existing or defaults), exclude lobby
      const allPrefs = apps
        .filter(app => app.id !== 'lobby')
        .map((app) => {
          const existing = prefsMap.get(app.id);
          return {
            appId: app.id,
            isHidden: existing?.isHidden || false,
            isFavorite: existing?.isFavorite || false,
            customOrder: existing?.customOrder !== null && existing?.customOrder !== undefined
              ? existing.customOrder
              : (app.displayOrder ?? null)
          };
        });

      // Sort by custom order
      allPrefs.sort((a, b) => {
        const aOrder = (a.customOrder !== null && a.customOrder !== undefined) ? a.customOrder : 999;
        const bOrder = (b.customOrder !== null && b.customOrder !== undefined) ? b.customOrder : 999;
        return aOrder - bOrder;
      });

      setAppPreferences(allPrefs);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
    setLoading(false);
  };

  const handleToggleVisibility = (appId: string) => {
    setAppPreferences(prefs =>
      prefs.map(p => p.appId === appId ? { ...p, isHidden: !p.isHidden } : p)
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;

    setAppPreferences(prefs => {
      const newPrefs = [...prefs];
      [newPrefs[index - 1], newPrefs[index]] = [newPrefs[index], newPrefs[index - 1]];
      // Reassign custom orders based on new positions
      return newPrefs.map((p, i) => ({ ...p, customOrder: i * 10 }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === appPreferences.length - 1) return;

    setAppPreferences(prefs => {
      const newPrefs = [...prefs];
      [newPrefs[index], newPrefs[index + 1]] = [newPrefs[index + 1], newPrefs[index]];
      // Reassign custom orders based on new positions
      return newPrefs.map((p, i) => ({ ...p, customOrder: i * 10 }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/user/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preferences: appPreferences })
      });

      if (response.ok) {
        onSave(); // Refresh apps
        onClose();
      } else {
        alert('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all app settings to default? This will unhide all apps and restore original order.')) {
      return;
    }

    // Reset to defaults
    const resetPrefs = apps
      .filter(app => app.id !== 'lobby')
      .map((app, index) => ({
        appId: app.id,
        isHidden: false,
        isFavorite: false,
        customOrder: app.displayOrder ?? index * 10
      }));

    // Sort by display order
    resetPrefs.sort((a, b) => {
      const aOrder = (a.customOrder !== null && a.customOrder !== undefined) ? a.customOrder : 999;
      const bOrder = (b.customOrder !== null && b.customOrder !== undefined) ? b.customOrder : 999;
      return aOrder - bOrder;
    });

    setAppPreferences(resetPrefs);
  };

  const getAppName = (appId: string) => {
    const app = apps.find(a => a.id === appId);
    return app ? `${app.icon} ${app.name}` : appId;
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>App Settings</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="settings-loading">Loading preferences...</div>
        ) : (
          <>
            <div className="settings-content">
              <p className="settings-hint">
                Show/hide apps and reorder them to customize your experience.
              </p>
              <div className="app-preferences-list">
                {appPreferences.map((pref, index) => (
                  <div key={pref.appId} className="app-preference-item">
                    <label className="visibility-toggle">
                      <input
                        type="checkbox"
                        checked={!pref.isHidden}
                        onChange={() => handleToggleVisibility(pref.appId)}
                      />
                      <span className={pref.isHidden ? 'app-name hidden' : 'app-name'}>
                        {getAppName(pref.appId)}
                      </span>
                    </label>
                    <div className="app-controls">
                      <button
                        className="move-button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="move-button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === appPreferences.length - 1}
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-footer">
              <button className="reset-button" onClick={handleReset}>
                Reset to Default
              </button>
              <div className="footer-actions">
                <button className="cancel-button" onClick={onClose}>
                  Cancel
                </button>
                <button className="save-button" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;
