import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './Shell.css';
import { User } from '../types';
import { useLobby } from '../hooks/useLobby';
import { useApps, buildAppUrl } from '../hooks/useApps';
import Lobby from './Lobby';
import AppContainer from './AppContainer';
import ChallengeToast from './ChallengeToast';
import Settings from './Settings';

interface ShellProps {
  user: User;
  onLogout: () => void;
  onEndImpersonation: () => void;
}

const Shell: React.FC<ShellProps> = ({ user, onLogout, onEndImpersonation }) => {
  const navigate = useNavigate();
  const [toastChallenge, setToastChallenge] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Debug: Log user info
  console.log('🔍 Shell received user:', user);

  // Fetch apps from registry
  const { apps, loading: appsLoading, refreshApps } = useApps();

  const handleNewChallenge = (challenge: any) => {
    setToastChallenge(challenge);
  };

  // Redirect to game (not popup - iOS Safari blocks popups from SSE handlers)
  const handleGameStart = (appId: string, gameId: string) => {
    const app = apps.find(a => a.id === appId);
    if (app) {
      const gameUrl = buildAppUrl(app, {
        userId: user.email,
        userName: user.name,
        isAdmin: user.is_admin,
        gameId,
      });
      console.log('🎮 Redirecting to game:', gameUrl);
      // Use location.href to redirect entirely - leaves the shell
      window.location.href = gameUrl;
    }
  };

  const {
    onlineUsers,
    receivedChallenges,
    sentChallenges,
    notification,
    sendChallenge,
    sendMultiChallenge,
    acceptChallenge,
    rejectChallenge,
    fetchGameConfig,
  } = useLobby(user.email, {
    onNewChallenge: handleNewChallenge,
    onGameStart: handleGameStart,
  });
  const notificationCount = receivedChallenges.filter(c => c.status === 'pending').length;

  // Redirect to app (leaves the shell entirely)
  const handleAppClick = (appId: string) => {
    const app = apps.find(a => a.id === appId);
    if (app) {
      const appUrl = buildAppUrl(app, {
        userId: user.email,
        userName: user.name,
        isAdmin: user.is_admin,
      });
      console.log('🎮 Redirecting to app:', appUrl);
      window.location.href = appUrl;
    }
  };

  const handleDismissToast = () => {
    setToastChallenge(null);
  };

  return (
    <div className="shell">
      {/* Shell Header */}
      <header className="shell-header">
        <div className="shell-header-left">
          <button className="logo-button" onClick={() => navigate('/lobby')}>
            🎮 <span className="logo-text">PubGames V3</span>
          </button>
        </div>

        <nav className="shell-nav">
          {!user.is_guest && (
            <button
              className="nav-button"
              onClick={() => navigate('/lobby')}
              title="Lobby"
            >
              🏠
            </button>
          )}
          <button
            className="nav-button"
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            👤
          </button>
        </nav>

        <div className="shell-header-right">
          {!user.is_guest && (
            <>
              <button className="settings-icon-button" onClick={() => setShowSettings(true)} title="Settings">
                ⚙️
              </button>
              <button className="notification-button" title="Notifications">
                🔔
                {notificationCount > 0 && (
                  <span className="notification-badge">{notificationCount}</span>
                )}
              </button>
            </>
          )}
          <div className="user-menu">
            <span className="user-email">{user.is_guest ? 'Guest' : user.email}</span>
            <button className="logout-button" onClick={onLogout}>
              {user.is_guest ? 'Exit' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      {/* Impersonation Banner */}
      {user.impersonating && (
        <div className="impersonation-banner">
          <span className="impersonation-warning">⚠️ Impersonating {user.email}</span>
          <span className="impersonation-info">(Super User: {user.superUser})</span>
          <button className="exit-impersonation-button" onClick={onEndImpersonation}>
            Exit Impersonation
          </button>
        </div>
      )}

      {/* Guest Mode Banner */}
      {user.is_guest && (
        <div className="guest-banner">
          <span className="guest-notice">👤 Guest Mode: Limited access to public apps only</span>
        </div>
      )}

      {/* Challenge Toast Notification */}
      {toastChallenge && (
        <ChallengeToast
          fromUser={toastChallenge.fromUser}
          appId={toastChallenge.appId}
          onDismiss={handleDismissToast}
        />
      )}

      {/* Main Content Area */}
      <main className="shell-content">
        {appsLoading ? (
          <div className="loading-apps">Loading apps...</div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to={user.is_guest ? "/apps" : "/lobby"} replace />} />
            {user.is_guest ? (
              <Route
                path="/apps"
                element={
                  <div className="guest-apps-view">
                    <h2>Available Apps</h2>
                    <p className="guest-notice-text">You are in guest mode. Only public apps are accessible.</p>
                    <div className="apps-grid">
                      {apps.map(app => (
                        <div key={app.id} className="app-card" onClick={() => handleAppClick(app.id)}>
                          <span className="app-icon">{app.icon}</span>
                          <span className="app-name">{app.name}</span>
                          <p className="app-description">{app.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              />
            ) : (
              <Route
                path="/lobby"
                element={
                  <Lobby
                    apps={apps}
                    onAppClick={handleAppClick}
                    userEmail={user.email}
                    userName={user.name}
                    onlineUsers={onlineUsers}
                    receivedChallenges={receivedChallenges}
                    sentChallenges={sentChallenges}
                    notification={notification}
                    onSendChallenge={sendChallenge}
                    onSendMultiChallenge={sendMultiChallenge}
                    onAcceptChallenge={acceptChallenge}
                    onRejectChallenge={rejectChallenge}
                    fetchGameConfig={fetchGameConfig}
                  />
                }
              />
            )}
            <Route
              path="/app/:appId"
              element={<AppContainer apps={apps} user={user} />}
            />
            <Route
              path="/profile"
              element={
                <div className="placeholder-view">
                  <h2>👤 Profile</h2>
                  <p>Profile management coming soon...</p>
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/lobby" replace />} />
          </Routes>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          apps={apps}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            refreshApps();
          }}
        />
      )}
    </div>
  );
};

export default Shell;
