import React from 'react';
import './ChallengeProgress.css';

interface Challenge {
  id: string;
  initiatorId: string;
  playerIds: string[];
  accepted: string[];
  minPlayers: number;
  maxPlayers: number;
  appId: string;
  status: string;
}

interface User {
  email: string;
  displayName: string;
}

interface ChallengeProgressProps {
  challenge: Challenge;
  users: User[]; // All users (online + info)
  appName: string;
}

const ChallengeProgress: React.FC<ChallengeProgressProps> = ({
  challenge,
  users,
  appName,
}) => {
  const getUserName = (email: string) => {
    const user = users.find(u => u.email === email);
    return user?.displayName || email;
  };

  const acceptedCount = challenge.accepted?.length || 0;
  const totalInvited = challenge.playerIds?.length || 0;
  const minRequired = challenge.minPlayers || 2;
  const progressPercent = Math.min((acceptedCount / minRequired) * 100, 100);
  const isReady = acceptedCount >= minRequired;

  return (
    <div className="challenge-progress">
      <div className="challenge-progress-header">
        <h4>{appName} Challenge</h4>
        <div className={`challenge-status ${isReady ? 'ready' : 'waiting'}`}>
          {isReady ? '✓ Ready to Start' : '⏳ Waiting for Players'}
        </div>
      </div>

      <div className="challenge-progress-bar">
        <div
          className={`challenge-progress-fill ${isReady ? 'ready' : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="challenge-progress-stats">
        <span className="stat-label">Accepted:</span>
        <span className={`stat-value ${isReady ? 'ready' : ''}`}>
          {acceptedCount} / {minRequired} required
        </span>
        <span className="stat-secondary">
          ({totalInvited} invited)
        </span>
      </div>

      <div className="challenge-player-list">
        {challenge.playerIds?.map(playerId => {
          const hasAccepted = challenge.accepted?.includes(playerId);
          const isInitiator = playerId === challenge.initiatorId;

          return (
            <div key={playerId} className={`challenge-player-item ${hasAccepted ? 'accepted' : 'pending'}`}>
              <span className="player-status-icon">
                {hasAccepted ? '✓' : '○'}
              </span>
              <span className="player-name-text">
                {getUserName(playerId)}
                {isInitiator && <em> (host)</em>}
              </span>
            </div>
          );
        })}
      </div>

      {isReady && (
        <div className="challenge-ready-message">
          Game will start automatically...
        </div>
      )}
    </div>
  );
};

export default ChallengeProgress;
