import React, { useState, useMemo } from 'react';

// Component sections
import InteractiveDemo from './components/InteractiveDemo';
import LayoutSection from './components/LayoutSection';
import ButtonsSection from './components/ButtonsSection';
import FormsSection from './components/FormsSection';
import NavigationSection from './components/NavigationSection';
import CardsSection from './components/CardsSection';
import DataDisplaySection from './components/DataDisplaySection';
import StatusSection from './components/StatusSection';
import LoadingSection from './components/LoadingSection';
import ModalsSection from './components/ModalsSection';
import GameComponentsSection from './components/GameComponentsSection';
import PatternsSection from './components/PatternsSection';

// Parse query params from URL
function useQueryParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      userName: params.get('userName') || 'Unknown',
      token: params.get('token'),
    };
  }, []);
}

type TabType =
  | 'demo'
  | 'layout'
  | 'buttons'
  | 'forms'
  | 'navigation'
  | 'cards'
  | 'data'
  | 'status'
  | 'loading'
  | 'modals'
  | 'game'
  | 'patterns';

interface Tab {
  id: TabType;
  label: string;
  component: React.ComponentType<{ token: string }>;
}

const TABS: Tab[] = [
  { id: 'demo', label: 'Interactive Demo', component: InteractiveDemo },
  { id: 'layout', label: 'Layout & Structure', component: LayoutSection },
  { id: 'buttons', label: 'Buttons', component: ButtonsSection },
  { id: 'forms', label: 'Forms', component: FormsSection },
  { id: 'navigation', label: 'Navigation', component: NavigationSection },
  { id: 'cards', label: 'Cards & Banners', component: CardsSection },
  { id: 'data', label: 'Data Display', component: DataDisplaySection },
  { id: 'status', label: 'Status & Feedback', component: StatusSection },
  { id: 'loading', label: 'Loading States', component: LoadingSection },
  { id: 'modals', label: 'Modals', component: ModalsSection },
  { id: 'game', label: 'Game Components', component: GameComponentsSection },
  { id: 'patterns', label: 'Common Patterns', component: PatternsSection },
];

function App() {
  const { userId, userName, token } = useQueryParams();
  const [activeTab, setActiveTab] = useState<TabType>('demo');

  // Auth check
  if (!userId || !token) {
    return (
      <>
        <header className="ah-app-header">
          <div className="ah-app-header-left">
            <h1 className="ah-app-title">📚 Component Library</h1>
          </div>
        </header>
        <div className="ah-container ah-container--narrow">
          <div className="ah-card">
            <p className="ah-meta">
              Missing authentication. Please access this app through the Activity Hub.
            </p>
            <button
              className="ah-btn-primary"
              onClick={() => {
                window.location.href = `http://${window.location.hostname}:3001`;
              }}
            >
              Go to Lobby
            </button>
          </div>
        </div>
      </>
    );
  }

  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.component;

  return (
    <>
      {/* App Header Bar */}
      <header className="ah-app-header">
        <div className="ah-app-header-left">
          <h1 className="ah-app-title">📚 Component Library</h1>
        </div>
        <div className="ah-app-header-right">
          <span className="ah-meta" style={{ marginRight: '15px' }}>
            Admin: {userName}
          </span>
          <button
            className="ah-lobby-btn"
            onClick={() => {
              window.location.href = `http://${window.location.hostname}:3001`;
            }}
          >
            ← Lobby
          </button>
        </div>
      </header>

      <div className="ah-container ah-container--wide">
        {/* Welcome Banner */}
        <div className="ah-banner ah-banner--info">
          <strong>Activity Hub Component Library</strong> — Living style guide
          and reference for all Activity Hub CSS components. This is an admin-only
          tool for developers.
        </div>

        {/* Tab Navigation */}
        <div className="ah-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`ah-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Tab Content */}
        {ActiveComponent && <ActiveComponent token={token} />}
      </div>
    </>
  );
}

export default App;
