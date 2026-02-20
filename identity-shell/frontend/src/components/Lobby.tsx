import React, { useState } from 'react';
import './Lobby.css';
import { AppDefinition, UserPresence, Challenge, ChallengeOptions, GameConfig } from '../types';
import ChallengeModal from './ChallengeModal';
import MultiPlayerChallengeModal from './MultiPlayerChallengeModal';
import GameChallengeModal from './GameChallengeModal';

interface LobbyProps {
  apps: AppDefinition[];
  onAppClick: (appId: string) => void;
  userEmail: string;
  userName: string;
  onlineUsers: UserPresence[];
  onSendChallenge: (toUser: string, appId: string, options?: ChallengeOptions) => Promise<boolean>;
  onSendMultiChallenge: (playerIds: string[], appId: string, minPlayers: number, maxPlayers: number, options?: ChallengeOptions) => Promise<boolean>;
  fetchGameConfig: (appId: string, backendPort: number) => Promise<GameConfig | null>;
}

const Lobby: React.FC<LobbyProps> = ({
  apps,
  onAppClick,
  userEmail,
  userName,
  onlineUsers,
  onSendChallenge,
  onSendMultiChallenge,
  fetchGameConfig,
}) => {
  // Online users overlay state
  const [showOnlineUsersOverlay, setShowOnlineUsersOverlay] = useState(false);

  // Challenge modal state - now starts with game selection
  const [challengeModal, setChallengeModal] = useState<{
    targetUser: string;
  } | null>(null);

  // Multi-player challenge modal state
  const [multiPlayerModalOpen, setMultiPlayerModalOpen] = useState(false);

  // New challenge flow modal state - starts with game, then selects users
  const [newChallengeModal, setNewChallengeModal] = useState<{
    app: AppDefinition;
  } | null>(null);

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

  // Filter out lobby itself from the grid
  const availableGames = apps.filter(app => app.id !== 'lobby');

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

  // Handle new challenge flow confirmation
  const handleNewChallengeConfirm = async (appId: string, playerIds: string[], options: ChallengeOptions) => {
    const app = apps.find(a => a.id === appId);
    const isGroupGame = app?.minPlayers && app.minPlayers > 2;

    if (isGroupGame) {
      // Multi-player challenge
      const minPlayers = app?.minPlayers || playerIds.length;
      const maxPlayers = app?.maxPlayers || playerIds.length;
      await onSendMultiChallenge(playerIds, appId, minPlayers, maxPlayers, options);
    } else {
      // 1v1 challenge (take first player)
      if (playerIds.length > 0) {
        await onSendChallenge(playerIds[0], appId, options);
      }
    }

    setNewChallengeModal(null);
  };

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>Game Lobby</h1>
        <p>Select a game to start playing</p>

        {/* User status and online users button */}
        <div className="user-status-bar">
          <div className="user-status-self">
            <span className="status-dot online"></span>
            <span className="user-name">{userName}</span>
          </div>

          {onlineUsers.length > 0 && (
            <button
              className="online-users-btn"
              onClick={() => setShowOnlineUsersOverlay(!showOnlineUsersOverlay)}
            >
              {onlineUsers.length} online
            </button>
          )}
        </div>
      </div>

      {/* Online Users Floating Overlay */}
      {showOnlineUsersOverlay && (
        <>
          <div
            className="overlay-backdrop"
            onClick={() => setShowOnlineUsersOverlay(false)}
          />
          <div className="online-users-overlay">
            <div className="overlay-header">
              <h3>Online Users ({onlineUsers.length})</h3>
              <button
                className="overlay-close"
                onClick={() => setShowOnlineUsersOverlay(false)}
              >
                ✕
              </button>
            </div>
            <div className="online-users-list">
              {onlineUsers.map((user) => (
                <div key={user.email} className="user-item">
                  <div className="user-info">
                    <span className={`status-dot ${user.status}`}></span>
                    <span className="user-name">{user.displayName}</span>
                    {user.currentApp && (
                      <span className="user-app">in {user.currentApp}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="lobby-sections">
        {/* Available Apps Section */}
        <section className="lobby-section lobby-apps-full">
          <h2>Available Games</h2>
          <div className="app-grid">
            {availableGames.map((app) => {
              const isChallengeable = challengeableApps.some(ca => ca.id === app.id);

              return (
                <button
                  key={app.id}
                  className={`app-card ${app.type}`}
                  onClick={() => {
                    if (isChallengeable) {
                      // Open challenge modal for challengeable games
                      setNewChallengeModal({ app });
                    } else {
                      // Navigate directly for non-challengeable apps
                      onAppClick(app.id);
                    }
                  }}
                >
                  <div className="app-icon">{app.icon}</div>
                  <h3>{app.name}</h3>
                  <p>{app.description}</p>
                  <span className="app-type-badge">{app.category}</span>
                </button>
              );
            })}
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

      {/* New Game Challenge Modal */}
      {newChallengeModal && (
        <GameChallengeModal
          app={newChallengeModal.app}
          currentUserEmail={userEmail}
          onlineUsers={onlineUsers}
          onConfirm={handleNewChallengeConfirm}
          onCancel={() => setNewChallengeModal(null)}
          fetchGameConfig={fetchGameConfig}
        />
      )}
    </div>
  );
};

export default Lobby;
