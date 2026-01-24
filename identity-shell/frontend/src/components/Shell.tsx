import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './Shell.css';
import { User, AppDefinition } from '../types';
import { useLobby } from '../hooks/useLobby';
import Lobby from './Lobby';
import AppContainer from './AppContainer';
import ChallengeToast from './ChallengeToast';

interface ShellProps {
  user: User;
  onLogout: () => void;
}

// Demo app registry
const APPS: AppDefinition[] = [
  {
    id: 'lobby',
    name: 'Lobby',
    icon: '🏠',
    type: 'interactive',
    description: 'View online users and challenges',
    category: 'utility',
  },
  {
    id: 'smoke-test',
    name: 'Smoke Test',
    icon: '🧪',
    type: 'static',
    description: 'Template validation and smoke testing',
    category: 'utility',
    url: `http://${window.location.hostname}:5010`,
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic-Tac-Toe',
    icon: '⭕',
    type: 'interactive',
    description: 'Classic grid game',
    category: 'game',
  },
  {
    id: 'sweepstakes',
    name: 'Sweepstakes',
    icon: '🎁',
    type: 'interactive',
    description: 'Draw competitions',
    category: 'game',
  },
];

const Shell: React.FC<ShellProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [toastChallenge, setToastChallenge] = useState<any | null>(null);

  const handleNewChallenge = (challenge: any) => {
    setToastChallenge(challenge);
  };

  const {
    onlineUsers,
    receivedChallenges,
    sentChallenges,
    notification,
    sendChallenge,
    acceptChallenge,
    rejectChallenge,
  } = useLobby(user.email, handleNewChallenge);
  const notificationCount = receivedChallenges.filter(c => c.status === 'pending').length;

  const handleAppClick = (appId: string) => {
    navigate(`/app/${appId}`);
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
          <button
            className="nav-button"
            onClick={() => navigate('/lobby')}
            title="Lobby"
          >
            🏠
          </button>
          <button
            className="nav-button"
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            👤
          </button>
        </nav>

        <div className="shell-header-right">
          <button className="notification-button" title="Notifications">
            🔔
            {notificationCount > 0 && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </button>
          <div className="user-menu">
            <span className="user-email">{user.email}</span>
            <button className="logout-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

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
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route
            path="/lobby"
            element={
              <Lobby
                apps={APPS}
                onAppClick={handleAppClick}
                userEmail={user.email}
                onlineUsers={onlineUsers}
                receivedChallenges={receivedChallenges}
                sentChallenges={sentChallenges}
                notification={notification}
                onSendChallenge={sendChallenge}
                onAcceptChallenge={acceptChallenge}
                onRejectChallenge={rejectChallenge}
              />
            }
          />
          <Route
            path="/app/:appId"
            element={<AppContainer apps={APPS} user={user} />}
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
      </main>
    </div>
  );
};

export default Shell;
