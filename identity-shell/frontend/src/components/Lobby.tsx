import React, { useState } from 'react';
import './Lobby.css';
import { AppDefinition, UserPresence, ChallengeOptions, GameConfig } from '../types';
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

  // User preferences (favorite/block) - stored in local state for now
  const [favoriteUsers, setFavoriteUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  // Appear offline toggle
  const [appearOffline, setAppearOffline] = useState(false);

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const toggleFavorite = (email: string) => {
    const newFavorites = new Set(favoriteUsers);
    if (newFavorites.has(email)) {
      newFavorites.delete(email);
    } else {
      newFavorites.add(email);
      // Remove from blocked if favoriting
      const newBlocked = new Set(blockedUsers);
      newBlocked.delete(email);
      setBlockedUsers(newBlocked);
    }
    setFavoriteUsers(newFavorites);
  };

  const toggleBlock = (email: string) => {
    const newBlocked = new Set(blockedUsers);
    if (newBlocked.has(email)) {
      newBlocked.delete(email);
    } else {
      newBlocked.add(email);
      // Remove from favorites if blocking
      const newFavorites = new Set(favoriteUsers);
      newFavorites.delete(email);
      setFavoriteUsers(newFavorites);
    }
    setBlockedUsers(newBlocked);
  };

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
  const availableApps = apps.filter(app => app.id !== 'lobby');

  // Group apps by category
  // For now, favorites is empty - will be implemented with user preferences
  const favoriteApps: AppDefinition[] = [];
  const gameApps = availableApps.filter(app => app.category === 'game');
  const utilityApps = availableApps.filter(app => app.category === 'utility');
  const adminApps = availableApps.filter(app => app.category === 'admin');

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

        {/* User status and online users button */}
        <div className="user-status-bar">
          <div className="user-status-self">
            <span className={`status-dot ${appearOffline ? 'away' : 'online'}`}></span>
            <span className="user-name">{userName}</span>
            <button
              className={`status-toggle ${appearOffline ? 'offline' : ''}`}
              onClick={() => setAppearOffline(!appearOffline)}
              title={appearOffline ? 'Appear online' : 'Appear offline'}
            >
              {appearOffline ? 'Offline' : 'Online'}
            </button>
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
                  <div className="user-item-actions">
                    <button
                      className={`user-action-btn ${favoriteUsers.has(user.email) ? 'favorite' : ''}`}
                      onClick={() => toggleFavorite(user.email)}
                      title={favoriteUsers.has(user.email) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {favoriteUsers.has(user.email) ? '★' : '☆'}
                    </button>
                    <button
                      className={`user-action-btn ${blockedUsers.has(user.email) ? 'blocked' : ''}`}
                      onClick={() => toggleBlock(user.email)}
                      title={blockedUsers.has(user.email) ? 'Unblock' : 'Block'}
                    >
                      {blockedUsers.has(user.email) ? '🚫' : '○'}
                    </button>
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
          {/* Favorites Section - Always show */}
          <div className="app-section">
            <div className="app-section-header" onClick={() => toggleSection('favorites')}>
              <h3 className="app-section-title">Favorites</h3>
              <span className={`section-toggle ${collapsedSections.has('favorites') ? 'collapsed' : ''}`}>
                ▼
              </span>
            </div>
            <div className={`app-section-content ${collapsedSections.has('favorites') ? 'collapsed' : ''}`}>
              {favoriteApps.length === 0 ? (
                <div className="empty-favorites">
                  <p>No favorite apps yet</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Star users in the online list to see them first in challenges
                  </p>
                </div>
              ) : (
                <div className="app-grid">
                  {favoriteApps.map((app) => {
                    const isChallengeable = challengeableApps.some(ca => ca.id === app.id);
                    return (
                      <button
                        key={app.id}
                        className={`app-card ${app.type}`}
                        onClick={() => {
                          if (isChallengeable) {
                            setNewChallengeModal({ app });
                          } else {
                            onAppClick(app.id);
                          }
                        }}
                      >
                        <div className="app-icon">{app.icon}</div>
                        <h3>{app.name}</h3>
                        <p>{app.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Games Section */}
          {gameApps.length > 0 && (
            <div className="app-section">
              <div className="app-section-header" onClick={() => toggleSection('games')}>
                <h3 className="app-section-title">Games</h3>
                <span className={`section-toggle ${collapsedSections.has('games') ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </div>
              <div className={`app-section-content ${collapsedSections.has('games') ? 'collapsed' : ''}`}>
                <div className="app-grid">
                  {gameApps.map((app) => {
                    const isChallengeable = challengeableApps.some(ca => ca.id === app.id);
                    return (
                      <button
                        key={app.id}
                        className={`app-card ${app.type}`}
                        onClick={() => {
                          if (isChallengeable) {
                            setNewChallengeModal({ app });
                          } else {
                            onAppClick(app.id);
                          }
                        }}
                      >
                        <div className="app-icon">{app.icon}</div>
                        <h3>{app.name}</h3>
                        <p>{app.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Utility Section */}
          {utilityApps.length > 0 && (
            <div className="app-section">
              <div className="app-section-header" onClick={() => toggleSection('utility')}>
                <h3 className="app-section-title">Utility</h3>
                <span className={`section-toggle ${collapsedSections.has('utility') ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </div>
              <div className={`app-section-content ${collapsedSections.has('utility') ? 'collapsed' : ''}`}>
                <div className="app-grid">
                  {utilityApps.map((app) => (
                    <button
                      key={app.id}
                      className={`app-card ${app.type}`}
                      onClick={() => onAppClick(app.id)}
                    >
                      <div className="app-icon">{app.icon}</div>
                      <h3>{app.name}</h3>
                      <p>{app.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Admin Section */}
          {adminApps.length > 0 && (
            <div className="app-section">
              <div className="app-section-header" onClick={() => toggleSection('admin')}>
                <h3 className="app-section-title">Admin</h3>
                <span className={`section-toggle ${collapsedSections.has('admin') ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </div>
              <div className={`app-section-content ${collapsedSections.has('admin') ? 'collapsed' : ''}`}>
                <div className="app-grid">
                  {adminApps.map((app) => (
                    <button
                      key={app.id}
                      className={`app-card ${app.type}`}
                      onClick={() => onAppClick(app.id)}
                    >
                      <div className="app-icon">{app.icon}</div>
                      <h3>{app.name}</h3>
                      <p>{app.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
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
          favoriteUsers={favoriteUsers}
          onConfirm={handleNewChallengeConfirm}
          onCancel={() => setNewChallengeModal(null)}
          fetchGameConfig={fetchGameConfig}
        />
      )}
    </div>
  );
};

export default Lobby;
