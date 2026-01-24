import React from 'react';
import './ChallengeToast.css';

interface ChallengeToastProps {
  fromUser: string;
  appId: string;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

const ChallengeToast: React.FC<ChallengeToastProps> = ({
  fromUser,
  appId,
  onAccept,
  onDecline,
  onDismiss,
}) => {
  return (
    <div className="challenge-toast">
      <div className="challenge-toast-header">
        <span className="challenge-toast-icon">⚔️</span>
        <button className="challenge-toast-close" onClick={onDismiss}>×</button>
      </div>
      <div className="challenge-toast-body">
        <p className="challenge-toast-message">
          <strong>{fromUser}</strong> challenges you to <strong>{appId}</strong>!
        </p>
        <div className="challenge-toast-actions">
          <button className="challenge-toast-accept" onClick={onAccept}>
            Accept
          </button>
          <button className="challenge-toast-decline" onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeToast;
