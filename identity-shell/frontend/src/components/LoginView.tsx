import React, { useState } from 'react';
import './LoginView.css';

interface LoginViewProps {
  onLogin: (email: string, code: string) => Promise<boolean>;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await onLogin(email, code);

    if (!success) {
      setError('Invalid email or code');
      setLoading(false);
    }
  };

  return (
    <div className="login-view">
      <div className="login-container">
        <div className="login-header">
          <h1>🎮 PubGames V3</h1>
          <p>Identity Shell Prototype</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="code">Access Code</label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p className="demo-hint">Demo: Use code <code>123456</code></p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
