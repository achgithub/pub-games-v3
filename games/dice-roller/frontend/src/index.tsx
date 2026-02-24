import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Platform requirement: load shared Activity Hub CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;
document.head.appendChild(link);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
