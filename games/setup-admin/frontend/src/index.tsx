import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject shared Activity Hub styles from identity-shell
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

// Support font scale (future feature - passed via URL parameter)
const params = new URLSearchParams(window.location.search);
const fontSize = params.get('fontSize') || '1.0';
document.documentElement.style.setProperty('--font-scale', fontSize);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
