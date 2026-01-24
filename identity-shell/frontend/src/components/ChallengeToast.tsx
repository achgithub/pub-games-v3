import React, { useEffect } from 'react';
import './ChallengeToast.css';

interface ChallengeToastProps {
  fromUser: string;
  appId: string;
  onDismiss: () => void;
}

const ChallengeToast: React.FC<ChallengeToastProps> = ({
  fromUser,
  appId,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="challenge-toast">
      <div className="challenge-toast-icon">⚔️</div>
      <div className="challenge-toast-content">
        <p className="challenge-toast-message">
          <strong>{fromUser}</strong> challenges you to <strong>{appId}</strong>
        </p>
      </div>
    </div>
  );
};

export default ChallengeToast;
