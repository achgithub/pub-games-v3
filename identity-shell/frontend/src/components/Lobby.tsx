import React, { useState, useEffect } from 'react';
import './Lobby.css';
import { AppDefinition, UserPresence, Challenge } from '../types';

interface LobbyProps {
  apps: AppDefinition[];
  onAppClick: (appId: string) => void;
  userEmail: string;
  onlineUsers: UserPresence[];
  receivedChallenges: Challenge[];
  sentChallenges: Challenge[];
  notification: string | null;
  onSendChallenge: (toUser: string, appId: string) => Promise<boolean>;
  onAcceptChallenge: (challengeId: string) => Promise<boolean>;
  onRejectChallenge: (challengeId: string) => Promise<boolean>;
}

const Lobby: React.FC<LobbyProps> = ({
  apps,
  onAppClick,
  userEmail,
  onlineUsers,
  receivedChallenges,
  sentChallenges,
  notification,
  onSendChallenge,
  onAcceptChallenge,
  onRejectChallenge,
}) => {
  // Force re-render every second to update timers and filter expired challenges
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(tick => tick + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Filter out expired challenges
  const now = Date.now();
  const activeReceivedChallenges = receivedChallenges.filter(
    challenge => challenge.expiresAt * 1000 > now
  );
  const activeSentChallenges = sentChallenges.filter(
    challenge => challenge.expiresAt * 1000 > now
  );

  // Filter out lobby itself from the grid
  const availableGames = apps.filter(app => app.id !== 'lobby');

  const handleChallengeUser = async (opponentEmail: string, appId: string) => {
    await onSendChallenge(opponentEmail, appId);
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    await onAcceptChallenge(challengeId);
    // TODO: Navigate to game with challenge details
  };

  const handleRejectChallenge = async (challengeId: string) => {
    await onRejectChallenge(challengeId);
  };

  return (
    <div className="lobby">
      {/* Notification Toast */}
      {notification && (
        <div className="lobby-notification">
          {notification}
        </div>
      )}

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
          <h2>⚔️ Challenges</h2>

          {/* Received Challenges */}
          <div className="challenge-subsection">
            <h3>📥 Received ({activeReceivedChallenges.length})</h3>
            <div className="challenges">
              {activeReceivedChallenges.length === 0 ? (
                <p className="placeholder-text">No incoming challenges</p>
              ) : (
                activeReceivedChallenges.map((challenge) => (
                  <div key={challenge.id} className="challenge-item">
                    <div className="challenge-info">
                      <strong>{challenge.fromUser}</strong> → <strong>{challenge.appId}</strong>
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
          </div>

          {/* Sent Challenges */}
          <div className="challenge-subsection">
            <h3>📤 Sent ({activeSentChallenges.length})</h3>
            <div className="challenges">
              {activeSentChallenges.length === 0 ? (
                <p className="placeholder-text">No outgoing challenges</p>
              ) : (
                activeSentChallenges.map((challenge) => (
                  <div key={challenge.id} className="challenge-item sent">
                    <div className="challenge-info">
                      <strong>{challenge.toUser}</strong> → <strong>{challenge.appId}</strong>
                    </div>
                    <div className="challenge-status">
                      Waiting for response...
                    </div>
                    <div className="challenge-timer">
                      Expires in {Math.max(0, Math.floor((challenge.expiresAt * 1000 - Date.now()) / 1000))}s
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Lobby;
