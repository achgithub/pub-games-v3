import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import './AppContainer.css';
import { AppDefinition, User } from '../types';
import { buildAppUrl } from '../hooks/useApps';

interface AppContainerProps {
  apps: AppDefinition[];
  user: User;
}

const AppContainer: React.FC<AppContainerProps> = ({ apps, user }) => {
  const { appId } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get gameId from URL if present (for challenge-based games)
  const gameId = searchParams.get('gameId') || undefined;

  const app = apps.find((a) => a.id === appId);

  if (!app) {
    return (
      <div className="app-not-found">
        <h2>App Not Found</h2>
        <p>The requested app "{appId}" could not be found.</p>
        <button onClick={() => navigate('/lobby')}>Return to Lobby</button>
      </div>
    );
  }

  // Build the iframe URL with user context
  const iframeUrl = app.type === 'iframe' && app.url
    ? buildAppUrl(app, {
        userId: user.email,
        userName: user.name,
        isAdmin: user.is_admin,
        gameId,
      })
    : null;

  // Debug: Log user info and URL
  console.log('🔍 AppContainer Debug:', {
    userEmail: user.email,
    userName: user.name,
    isAdmin: user.is_admin,
    appId: app.id,
    iframeUrl,
  });

  return (
    <div className="app-container">
      <div className="app-header">
        <button className="back-button" onClick={() => navigate('/lobby')}>
          ← Back to Lobby
        </button>
        <div className="app-title">
          <span className="app-icon">{app.icon}</span>
          <h2>{app.name}</h2>
        </div>
      </div>

      <div className="app-content">
        {app.type === 'iframe' && iframeUrl ? (
          <iframe
            src={iframeUrl}
            title={app.name}
            className="app-iframe"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        ) : app.type === 'internal' ? (
          <div className="app-placeholder">
            <div className="app-icon-large">{app.icon}</div>
            <h3>{app.name}</h3>
            <p>{app.description}</p>
            <p className="coming-soon">Internal app - handled by shell routing</p>
          </div>
        ) : (
          <div className="app-placeholder">
            <div className="app-icon-large">{app.icon}</div>
            <h3>{app.name}</h3>
            <p>{app.description}</p>
            <p className="coming-soon">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppContainer;
