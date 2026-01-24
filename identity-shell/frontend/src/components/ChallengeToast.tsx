import React, { useEffect } from 'react';
import './ChallengeToast.css';

interface ChallengeToastProps {
  fromUser: string;
  appId: string;
  onClick: () => void;
  onDismiss: () => void;
}

const ChallengeToast: React.FC<ChallengeToastProps> = ({
  fromUser,
  appId,
  onClick,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="challenge-toast" onClick={onClick}>
      <div className="challenge-toast-icon">⚔️</div>
      <div className="challenge-toast-content">
        <p className="challenge-toast-message">
          <strong>{fromUser}</strong> challenges you to <strong>{appId}</strong>
        </p>
        <p className="challenge-toast-hint">Click to view challenges</p>
      </div>
    </div>
  );
};

export default ChallengeToast;
