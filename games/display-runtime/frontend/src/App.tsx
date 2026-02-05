import React, { useState, useEffect } from 'react';
import SetupPage from './SetupPage';
import SlideshowPage from './SlideshowPage';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for token in localStorage on mount
    const savedToken = localStorage.getItem('display_token');
    if (savedToken) {
      setToken(savedToken);
    }
    setIsLoading(false);
  }, []);

  const handleTokenSubmit = (newToken: string) => {
    localStorage.setItem('display_token', newToken);
    setToken(newToken);
  };

  const handleResetToken = () => {
    localStorage.removeItem('display_token');
    setToken(null);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        fontSize: '24px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (!token) {
    return <SetupPage onTokenSubmit={handleTokenSubmit} />;
  }

  return <SlideshowPage token={token} onResetToken={handleResetToken} />;
};

export default App;
