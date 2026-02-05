import React, { useState } from 'react';

interface SetupPageProps {
  onTokenSubmit: (token: string) => void;
}

const SetupPage: React.FC<SetupPageProps> = ({ onTokenSubmit }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      // Verify token with Display Admin API
      const response = await fetch(`http://192.168.1.45:5050/api/display/by-token/${token.trim()}`);

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Token is valid
        onTokenSubmit(token.trim());
      } else {
        setError('Invalid token');
        setIsVerifying(false);
      }
    } catch (err) {
      setError('Invalid token or connection error');
      setIsVerifying(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#ffffff'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '600px',
        padding: '40px'
      }}>
        <h1 style={{
          fontSize: '48px',
          marginBottom: '20px',
          fontWeight: 'bold'
        }}>
          📺 Display Setup
        </h1>

        <p style={{
          fontSize: '20px',
          marginBottom: '40px',
          color: '#cccccc'
        }}>
          Enter your display token to begin
        </p>

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter display token"
            disabled={isVerifying}
            style={{
              fontSize: '24px',
              padding: '20px',
              borderRadius: '8px',
              border: '2px solid #444',
              backgroundColor: '#2a2a2a',
              color: '#ffffff',
              textAlign: 'center',
              fontFamily: 'monospace'
            }}
          />

          {error && (
            <div style={{
              padding: '15px',
              backgroundColor: '#ff4444',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '18px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            style={{
              fontSize: '24px',
              padding: '20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isVerifying ? '#666666' : '#4CAF50',
              color: '#ffffff',
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              transition: 'background-color 0.3s'
            }}
          >
            {isVerifying ? 'Verifying...' : 'Start Display'}
          </button>
        </form>

        <p style={{
          marginTop: '40px',
          fontSize: '16px',
          color: '#888888'
        }}>
          Get your token from the Display Admin interface
        </p>
      </div>
    </div>
  );
};

export default SetupPage;
