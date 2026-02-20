import React, { useState, useEffect } from 'react';
import { Challenge, AppDefinition, UserPresence } from '../types';
import ChallengeProgress from './ChallengeProgress';
import './ChallengesOverlay.css';

interface ChallengesOverlayProps {
  receivedChallenges: Challenge[];
  sentChallenges: Challenge[];
  apps: AppDefinition[];
  userEmail: string;
  userName: string;
  onlineUsers: UserPresence[];
  onAccept: (challengeId: string, userId?: string) => Promise<boolean>;
  onReject: (challengeId: string) => Promise<boolean>;
  onClose: () => void;
}

const ChallengesOverlay: React.FC<ChallengesOverlayProps> = ({
  receivedChallenges,
  sentChallenges,
  apps,
  userEmail,
  userName,
  onlineUsers,
  onAccept,
  onReject,
  onClose,
}) => {
  // Force re-render every second to update timers
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

  const handleAcceptChallenge = async (challengeId: string) => {
    const challenge = receivedChallenges.find(c => c.id === challengeId);
    const isMultiPlayer = challenge?.playerIds && challenge.playerIds.length > 0;

    if (isMultiPlayer) {
      await onAccept(challengeId, userEmail);
    } else {
      await onAccept(challengeId);
    }
  };

  const handleRejectChallenge = async (challengeId: string) => {
    await onReject(challengeId);
  };

  return (
    <>
      <div className="challenges-overlay-backdrop" onClick={onClose} />
      <div className="challenges-overlay">
        <div className="overlay-header">
          <h3>Challenges</h3>
          <button className="overlay-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="challenges-overlay-body">
          {/* Received Challenges */}
          <div className="challenge-section">
            <h4>Received ({activeReceivedChallenges.length})</h4>
            {activeReceivedChallenges.length === 0 ? (
              <p className="no-challenges">No incoming challenges</p>
            ) : (
              <div className="challenge-list">
                {activeReceivedChallenges.map((challenge) => {
                  const isMultiPlayer = challenge.playerIds && challenge.playerIds.length > 0;
                  const appName = apps.find(a => a.id === challenge.appId)?.name || challenge.appId;

                  if (isMultiPlayer) {
                    const allUsers = [
                      { email: userEmail, displayName: userName, status: 'online' as const },
                      ...onlineUsers
                    ];

                    return (
                      <div key={challenge.id} className="challenge-item">
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
                })}
              </div>
            )}
          </div>

          {/* Sent Challenges */}
          <div className="challenge-section">
            <h4>Sent ({activeSentChallenges.length})</h4>
            {activeSentChallenges.length === 0 ? (
              <p className="no-challenges">No outgoing challenges</p>
            ) : (
              <div className="challenge-list">
                {activeSentChallenges.map((challenge) => {
                  const isMultiPlayer = challenge.playerIds && challenge.playerIds.length > 0;
                  const appName = apps.find(a => a.id === challenge.appId)?.name || challenge.appId;

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
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChallengesOverlay;
