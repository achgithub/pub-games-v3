import React from 'react';
import './Lobby.css';
import { AppDefinition } from '../types';

interface LobbyProps {
  apps: AppDefinition[];
  onAppClick: (appId: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ apps, onAppClick }) => {
  // Filter out lobby itself from the grid
  const displayApps = apps.filter(app => app.id !== 'lobby');

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>🏠 Game Lobby</h1>
        <p>Choose a game to play or view the leaderboard</p>
      </div>

      <div className="lobby-sections">
        {/* Online Users Section (Placeholder) */}
        <section className="lobby-section">
          <h2>👥 Online Now</h2>
          <div className="online-users-placeholder">
            <p className="placeholder-text">Presence tracking coming soon...</p>
            <div className="demo-users">
              <div className="user-item">
                <span className="status-dot online"></span>
                <span>demo@user.com</span>
              </div>
            </div>
          </div>
        </section>

        {/* Available Apps Section */}
        <section className="lobby-section lobby-apps">
          <h2>🎮 Available Games</h2>
          <div className="app-grid">
            {displayApps.map((app) => (
              <button
                key={app.id}
                className={`app-card ${app.type}`}
                onClick={() => onAppClick(app.id)}
              >
                <div className="app-icon">{app.icon}</div>
                <h3>{app.name}</h3>
                <p>{app.description}</p>
                <span className="app-type-badge">{app.type}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Challenges Section (Placeholder) */}
        <section className="lobby-section">
          <h2>⚔️ Challenges</h2>
          <div className="challenges-placeholder">
            <p className="placeholder-text">No active challenges</p>
            <p className="hint-text">Challenge system coming in Phase 2</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Lobby;
