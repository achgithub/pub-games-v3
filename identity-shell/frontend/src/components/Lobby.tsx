import React, { useState, useEffect } from 'react';
import './Lobby.css';
import { AppDefinition, UserPresence, Challenge, ChallengeOptions, GameConfig } from '../types';
import ChallengeModal from './ChallengeModal';
import MultiPlayerChallengeModal from './MultiPlayerChallengeModal';
import ChallengeProgress from './ChallengeProgress';

interface LobbyProps {
  apps: AppDefinition[];
  onAppClick: (appId: string) => void;
  userEmail: string;
  userName: string; // Add display name for multi-player modal
  onlineUsers: UserPresence[];
  receivedChallenges: Challenge[];
  sentChallenges: Challenge[];
  notification: string | null;
  onSendChallenge: (toUser: string, appId: string, options?: ChallengeOptions) => Promise<boolean>;
  onSendMultiChallenge: (playerIds: string[], appId: string, minPlayers: number, maxPlayers: number, options?: ChallengeOptions) => Promise<boolean>;
  onAcceptChallenge: (challengeId: string, userId?: string) => Promise<boolean>;
  onRejectChallenge: (challengeId: string) => Promise<boolean>;
  fetchGameConfig: (appId: string, backendPort: number) => Promise<GameConfig | null>;
}

const Lobby: React.FC<LobbyProps> = ({
  apps,
  onAppClick,
  userEmail,
  userName,
  onlineUsers,
  receivedChallenges,
  sentChallenges,
  notification,
  onSendChallenge,
  onSendMultiChallenge,
  onAcceptChallenge,
  onRejectChallenge,
  fetchGameConfig,
}) => {
  // Force re-render every second to update timers and filter expired challenges
  const [, setTick] = useState(0);

  // Challenge modal state - just target user, game is selected in modal
  const [challengeModal, setChallengeModal] = useState<{
    targetUser: string;
  } | null>(null);

  // Multi-player challenge modal state
  const [multiPlayerModalOpen, setMultiPlayerModalOpen] = useState(false);

  // Get challengeable games (category: game, has realtime support, has backend port)
  const challengeableApps = apps.filter(app =>
    app.category === 'game' &&
    app.realtime &&
    app.realtime !== 'none' &&
    app.backendPort
  );

  // Split into 2-player and multi-player apps
  const twoPlayerApps = challengeableApps.filter(app =>
    !app.minPlayers || app.minPlayers <= 2
  );

  const multiPlayerApps = challengeableApps.filter(app =>
    app.minPlayers && app.minPlayers > 2
  );

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

  // Open challenge modal for a user
  const handleChallengeUser = (opponentEmail: string) => {
    setChallengeModal({ targetUser: opponentEmail });
  };

  // Send challenge from modal (appId now comes from modal)
  const handleConfirmChallenge = async (appId: string, options: ChallengeOptions) => {
    if (challengeModal) {
      await onSendChallenge(challengeModal.targetUser, appId, options);
      setChallengeModal(null);
    }
  };

  // Send multi-player challenge from modal
  const handleConfirmMultiChallenge = async (appId: string, playerIds: string[], options: ChallengeOptions) => {
    const app = apps.find(a => a.id === appId);
    const minPlayers = app?.minPlayers || playerIds.length;
    const maxPlayers = app?.maxPlayers || playerIds.length;

    await onSendMultiChallenge(playerIds, appId, minPlayers, maxPlayers, options);
    setMultiPlayerModalOpen(false);
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    // Check if it's a multi-player challenge
    const challenge = receivedChallenges.find(c => c.id === challengeId);
    const isMultiPlayer = challenge?.playerIds && challenge.playerIds.length > 0;

    if (isMultiPlayer) {
      // Pass userId for multi-player challenges
      await onAcceptChallenge(challengeId, userEmail);
    } else {
      // Legacy 2-player challenge
      await onAcceptChallenge(challengeId);
    }
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
          <div className="section-header-with-action">
            <h2>👥 Online Now ({onlineUsers.length})</h2>
            {multiPlayerApps.length > 0 && onlineUsers.length >= 2 && (
              <button
                className="multi-challenge-btn"
                onClick={() => setMultiPlayerModalOpen(true)}
              >
                🎮 Challenge Multiple
              </button>
            )}
          </div>
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
                  {user.email !== userEmail && challengeableApps.length > 0 && (
                    <button
                      className="challenge-btn"
                      onClick={() => handleChallengeUser(user.email)}
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
                activeReceivedChallenges.map((challenge) => {
                  const isMultiPlayer = challenge.playerIds && challenge.playerIds.length > 0;
                  const appName = apps.find(a => a.id === challenge.appId)?.name || challenge.appId;

                  // Multi-player challenge with progress display
                  if (isMultiPlayer) {
                    const allUsers = [
                      { email: userEmail, displayName: userName, status: 'online' as const },
                      ...onlineUsers
                    ];

                    return (
                      <div key={challenge.id}>
                        <ChallengeProgress
                          challenge={challenge}
                          users={allUsers}
                          appName={appName}
                        />
                        {!challenge.accepted?.includes(userEmail) && (
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
                        )}
                      </div>
                    );
                  }

                  // Legacy 2-player challenge
                  return (
                    <div key={challenge.id} className="challenge-item">
                      <div className="challenge-info">
                        <strong>{challenge.fromUser}</strong> → <strong>{appName}</strong>
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
                  );
                })
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
                activeSentChallenges.map((challenge) => {
                  const isMultiPlayer = challenge.playerIds && challenge.playerIds.length > 0;
                  const appName = apps.find(a => a.id === challenge.appId)?.name || challenge.appId;

                  // Multi-player challenge with progress display
                  if (isMultiPlayer) {
                    const allUsers = [
                      { email: userEmail, displayName: userName, status: 'online' as const },
                      ...onlineUsers
                    ];

                    return (
                      <ChallengeProgress
                        key={challenge.id}
                        challenge={challenge}
                        users={allUsers}
                        appName={appName}
                      />
                    );
                  }

                  // Legacy 2-player challenge
                  return (
                    <div key={challenge.id} className="challenge-item sent">
                      <div className="challenge-info">
                        <strong>{challenge.toUser}</strong> → <strong>{appName}</strong>
                      </div>
                      <div className="challenge-status">
                        Waiting for response...
                      </div>
                      <div className="challenge-timer">
                        Expires in {Math.max(0, Math.floor((challenge.expiresAt * 1000 - Date.now()) / 1000))}s
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Challenge Modal (2-player) */}
      {challengeModal && (
        <ChallengeModal
          targetUser={challengeModal.targetUser}
          challengeableApps={twoPlayerApps}
          onConfirm={handleConfirmChallenge}
          onCancel={() => setChallengeModal(null)}
          fetchGameConfig={fetchGameConfig}
        />
      )}

      {/* Multi-Player Challenge Modal */}
      {multiPlayerModalOpen && (
        <MultiPlayerChallengeModal
          currentUser={{ email: userEmail, displayName: userName, status: 'online' }}
          onlineUsers={onlineUsers}
          multiPlayerApps={multiPlayerApps}
          onConfirm={handleConfirmMultiChallenge}
          onCancel={() => setMultiPlayerModalOpen(false)}
          fetchGameConfig={fetchGameConfig}
        />
      )}
    </div>
  );
};

export default Lobby;
