import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './Shell.css';
import { User, AppDefinition } from '../types';
import Lobby from './Lobby';
import AppContainer from './AppContainer';

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
    type: 'static',
    url: 'http://localhost:5000', // Would be actual sweepstakes URL
    description: 'Draw competitions',
    category: 'game',
  },
];

const Shell: React.FC<ShellProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [notificationCount] = useState(0); // Will be dynamic with lobby

  const handleAppClick = (appId: string) => {
    navigate(`/app/${appId}`);
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

      {/* Main Content Area */}
      <main className="shell-content">
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route
            path="/lobby"
            element={<Lobby apps={APPS} onAppClick={handleAppClick} />}
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
