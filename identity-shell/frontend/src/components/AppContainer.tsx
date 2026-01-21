import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './AppContainer.css';
import { AppDefinition, User } from '../types';

interface AppContainerProps {
  apps: AppDefinition[];
  user: User;
}

const AppContainer: React.FC<AppContainerProps> = ({ apps, user }) => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

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
        {app.type === 'static' && app.url ? (
          <iframe
            src={app.url}
            title={app.name}
            className="app-iframe"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        ) : app.type === 'interactive' && app.component ? (
          <app.component user={user} />
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
