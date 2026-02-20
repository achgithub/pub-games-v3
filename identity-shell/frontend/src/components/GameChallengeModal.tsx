import React, { useState, useEffect } from 'react';
import { AppDefinition, UserPresence, GameConfig, GameOption, ChallengeOptions } from '../types';
import './GameChallengeModal.css';

interface GameChallengeModalProps {
  app: AppDefinition;
  currentUserEmail: string;
  currentUserName: string;
  onlineUsers: UserPresence[];
  onConfirm: (appId: string, playerIds: string[], options: ChallengeOptions) => void;
  onCancel: () => void;
  fetchGameConfig: (appId: string, backendPort: number) => Promise<GameConfig | null>;
}

const GameChallengeModal: React.FC<GameChallengeModalProps> = ({
  app,
  currentUserEmail,
  currentUserName,
  onlineUsers,
  onConfirm,
  onCancel,
  fetchGameConfig,
}) => {
  const [step, setStep] = useState<'select-players' | 'game-options'>('select-players');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ChallengeOptions>({});

  // Determine if this is a 1v1 or group game
  const isGroupGame = app.minPlayers && app.minPlayers > 2;
  const minPlayers = app.minPlayers || 1;
  const maxPlayers = app.maxPlayers || (isGroupGame ? 6 : 1);

  // Filter online users
  const filteredUsers = onlineUsers.filter(user =>
    user.email !== currentUserEmail &&
    (filterText === '' ||
      user.displayName.toLowerCase().includes(filterText.toLowerCase()) ||
      user.email.toLowerCase().includes(filterText.toLowerCase()))
  );

  // Load game config when component mounts
  useEffect(() => {
    const loadConfig = async () => {
      if (app.backendPort) {
        setLoading(true);
        const gameConfig = await fetchGameConfig(app.id, app.backendPort);
        setConfig(gameConfig);

        // Initialize options with defaults
        if (gameConfig?.gameOptions) {
          const defaults: ChallengeOptions = {};
          gameConfig.gameOptions.forEach(opt => {
            defaults[opt.id] = opt.default;
          });
          setOptions(defaults);
        }
        setLoading(false);
      }
    };

    loadConfig();
  }, [app, fetchGameConfig]);

  const togglePlayer = (email: string) => {
    if (isGroupGame) {
      // Multi-select for group games
      if (selectedPlayers.includes(email)) {
        setSelectedPlayers(selectedPlayers.filter(e => e !== email));
      } else if (selectedPlayers.length < maxPlayers) {
        setSelectedPlayers([...selectedPlayers, email]);
      }
    } else {
      // Single select for 1v1 games
      setSelectedPlayers([email]);
    }
  };

  const canProceed = selectedPlayers.length >= minPlayers && selectedPlayers.length <= maxPlayers;

  const handleOptionChange = (optionId: string, value: string | number | boolean) => {
    setOptions(prev => ({ ...prev, [optionId]: value }));
  };

  const renderOption = (option: GameOption) => {
    switch (option.type) {
      case 'select':
        return (
          <div key={option.id} className="game-option">
            <label>{option.label}</label>
            <select
              value={String(options[option.id] ?? option.default)}
              onChange={(e) => {
                const val = option.options?.find(o => String(o.value) === e.target.value)?.value;
                handleOptionChange(option.id, val ?? e.target.value);
              }}
            >
              {option.options?.map(opt => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'checkbox':
        return (
          <div key={option.id} className="game-option checkbox">
            <label>
              <input
                type="checkbox"
                checked={Boolean(options[option.id] ?? option.default)}
                onChange={(e) => handleOptionChange(option.id, e.target.checked)}
              />
              {option.label}
            </label>
          </div>
        );

      case 'number':
        return (
          <div key={option.id} className="game-option">
            <label>{option.label}</label>
            <input
              type="number"
              value={Number(options[option.id] ?? option.default)}
              min={option.min}
              max={option.max}
              onChange={(e) => handleOptionChange(option.id, parseInt(e.target.value, 10))}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="game-challenge-modal-overlay" onClick={onCancel}>
      <div className="game-challenge-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="game-challenge-header">
          <div className="game-challenge-icon">{app.icon}</div>
          <h2>{app.name}</h2>
        </div>

        {/* Step 1: Select Players */}
        {step === 'select-players' && (
          <>
            <div className="game-challenge-body">
              <p className="challenge-prompt">
                {isGroupGame
                  ? `Select ${minPlayers} to ${maxPlayers} players`
                  : 'Who are you challenging?'}
              </p>

              {/* Filter input */}
              <input
                type="text"
                className="player-filter"
                placeholder="Search players..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                autoFocus
              />

              {/* Player selection */}
              <div className="player-list">
                {filteredUsers.length === 0 ? (
                  <p className="no-players">No players available</p>
                ) : (
                  filteredUsers.map(user => (
                    <div
                      key={user.email}
                      className={`player-item ${selectedPlayers.includes(user.email) ? 'selected' : ''}`}
                      onClick={() => togglePlayer(user.email)}
                    >
                      <div className="player-info">
                        <span className={`status-dot ${user.status}`}></span>
                        <span className="player-name">{user.displayName}</span>
                        {user.currentApp && (
                          <span className="player-app">Playing {user.currentApp}</span>
                        )}
                      </div>
                      <div className="player-checkbox">
                        {selectedPlayers.includes(user.email) && '✓'}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Selected count for group games */}
              {isGroupGame && (
                <p className="selected-count">
                  Selected: {selectedPlayers.length} / {maxPlayers}
                  {selectedPlayers.length < minPlayers && ` (min ${minPlayers})`}
                </p>
              )}
            </div>

            <div className="game-challenge-footer">
              <button className="gcm-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="gcm-next-btn"
                onClick={() => setStep('game-options')}
                disabled={!canProceed}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 2: Game Options */}
        {step === 'game-options' && (
          <>
            <div className="game-challenge-body">
              <p className="challenge-prompt">
                Challenging: <strong>{selectedPlayers.map(email =>
                  onlineUsers.find(u => u.email === email)?.displayName || email
                ).join(', ')}</strong>
              </p>

              {loading ? (
                <div className="gcm-loading">Loading game options...</div>
              ) : config?.gameOptions && config.gameOptions.length > 0 ? (
                <div className="game-options">
                  <h3>Game Settings</h3>
                  {config.gameOptions.map(renderOption)}
                </div>
              ) : (
                <p className="no-options">No additional options for this game.</p>
              )}
            </div>

            <div className="game-challenge-footer">
              <button className="gcm-back-btn" onClick={() => setStep('select-players')}>
                Back
              </button>
              <button className="gcm-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="gcm-confirm-btn"
                onClick={() => onConfirm(app.id, selectedPlayers, options)}
                disabled={loading}
              >
                Send Challenge
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GameChallengeModal;
