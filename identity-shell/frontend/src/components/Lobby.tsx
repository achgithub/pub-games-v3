import React from 'react';
import './Lobby.css';
import { AppDefinition } from '../types';
import { useLobby } from '../hooks/useLobby';

interface LobbyProps {
  apps: AppDefinition[];
  onAppClick: (appId: string) => void;
  userEmail: string;
}

const Lobby: React.FC<LobbyProps> = ({ apps, onAppClick, userEmail }) => {
  const {
    onlineUsers,
    challenges,
    sendChallenge,
    acceptChallenge,
    rejectChallenge,
  } = useLobby(userEmail);

  // Filter out lobby itself from the grid
  const availableGames = apps.filter(app => app.id !== 'lobby');

  const handleChallengeUser = async (opponentEmail: string, appId: string) => {
    const success = await sendChallenge(opponentEmail, appId);
    if (success) {
      alert(`Challenge sent to ${opponentEmail}!`);
    } else {
      alert('Failed to send challenge');
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    const success = await acceptChallenge(challengeId);
    if (success) {
      // TODO: Navigate to game with challenge details
      alert('Challenge accepted! (Game navigation coming soon)');
    }
  };

  const handleRejectChallenge = async (challengeId: string) => {
    await rejectChallenge(challengeId);
  };

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>🏠 Game Lobby</h1>
        <p>Select a game or challenge someone!</p>
      </div>

      <div className="lobby-sections">
        {/* Online Users Section */}
        <section className="lobby-section">
          <h2>👥 Online Now ({onlineUsers.length})</h2>
          <div className="online-users">
            {onlineUsers.length === 0 ? (
              <p className="placeholder-text">No other users online</p>
            ) : (
              onlineUsers.map((user) => (
                <div key={user.email} className="user-item">
                  <div className="user-info">
                    <span className={`status-dot ${user.status}`}></span>
                    <span className="user-name">{user.displayName}</span>
                    {user.currentApp && (
                      <span className="user-app">Playing {user.currentApp}</span>
                    )}
                  </div>
                  {user.email !== userEmail && (
                    <button
                      className="challenge-btn"
                      onClick={() => handleChallengeUser(user.email, 'tic-tac-toe')}
                    >
                      Challenge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Available Apps Section */}
        <section className="lobby-section lobby-apps">
          <h2>🎮 Available Games</h2>
          <div className="app-grid">
            {availableGames.map((app) => (
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

        {/* Challenges Section */}
        <section className="lobby-section">
          <h2>⚔️ Challenges ({challenges.length})</h2>
          <div className="challenges">
            {challenges.length === 0 ? (
              <p className="placeholder-text">No pending challenges</p>
            ) : (
              challenges.map((challenge) => (
                <div key={challenge.id} className="challenge-item">
                  <div className="challenge-info">
                    <strong>{challenge.fromUser}</strong> challenges you to{' '}
                    <strong>{challenge.appId}</strong>
                  </div>
                  <div className="challenge-actions">
                    <button
                      className="accept-btn"
                      onClick={() => handleAcceptChallenge(challenge.id)}
                    >
                      Accept
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => handleRejectChallenge(challenge.id)}
                    >
                      Decline
                    </button>
                  </div>
                  <div className="challenge-timer">
                    Expires in {Math.max(0, Math.floor((challenge.expiresAt * 1000 - Date.now()) / 1000))}s
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Lobby;
