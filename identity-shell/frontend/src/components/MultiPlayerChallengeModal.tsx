import React, { useState, useEffect } from 'react';
import { GameConfig, GameOption, ChallengeOptions, AppDefinition } from '../types';
import './ChallengeModal.css'; // Reuse existing styles

interface User {
  email: string;
  displayName: string;
  status: string;
}

interface MultiPlayerChallengeModalProps {
  currentUser: User;
  onlineUsers: User[];
  multiPlayerApps: AppDefinition[]; // Apps with minPlayers > 2 or maxPlayers > 2
  onConfirm: (appId: string, playerIds: string[], options: ChallengeOptions) => void;
  onCancel: () => void;
  fetchGameConfig: (appId: string, backendPort: number) => Promise<GameConfig | null>;
}

const MultiPlayerChallengeModal: React.FC<MultiPlayerChallengeModalProps> = ({
  currentUser,
  onlineUsers,
  multiPlayerApps,
  onConfirm,
  onCancel,
  fetchGameConfig,
}) => {
  // Step 1: Game selection, Step 2: Player selection, Step 3: Game options
  const [step, setStep] = useState<'game' | 'players' | 'options'>('game');
  const [selectedApp, setSelectedApp] = useState<AppDefinition | null>(
    multiPlayerApps.length === 1 ? multiPlayerApps[0] : null
  );
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([currentUser.email]);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ChallengeOptions>({});

  // Auto-advance to player selection if only one game
  useEffect(() => {
    if (multiPlayerApps.length === 1 && step === 'game') {
      setStep('players');
    }
  }, [multiPlayerApps.length, step]);

  // Load game config when moving to options step
  useEffect(() => {
    const loadConfig = async () => {
      if (selectedApp?.backendPort && step === 'options') {
        setLoading(true);
        const gameConfig = await fetchGameConfig(selectedApp.id, selectedApp.backendPort);
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
  }, [step, selectedApp, fetchGameConfig]);

  const handleOptionChange = (optionId: string, value: string | number | boolean) => {
    setOptions(prev => ({ ...prev, [optionId]: value }));
  };

  const togglePlayer = (email: string) => {
    if (email === currentUser.email) return; // Can't deselect self

    setSelectedPlayers(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const isValidPlayerCount = () => {
    if (!selectedApp) return false;
    const count = selectedPlayers.length;
    return count >= (selectedApp.minPlayers || 2) && count <= (selectedApp.maxPlayers || 10);
  };

  const renderOption = (option: GameOption) => {
    switch (option.type) {
      case 'select':
        return (
          <div key={option.id} className="challenge-option">
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
          <div key={option.id} className="challenge-option checkbox">
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
          <div key={option.id} className="challenge-option">
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

  const handleBack = () => {
    if (step === 'options') {
      setStep('players');
      setConfig(null);
      setOptions({});
    } else if (step === 'players' && multiPlayerApps.length > 1) {
      setStep('game');
      setSelectedPlayers([currentUser.email]);
    }
  };

  const handleNext = () => {
    if (step === 'game' && selectedApp) {
      setStep('players');
    } else if (step === 'players' && isValidPlayerCount()) {
      setStep('options');
    }
  };

  return (
    <div className="challenge-modal-overlay" onClick={onCancel}>
      <div className="challenge-modal" onClick={(e) => e.stopPropagation()}>
        {/* Step 1: Game Selection */}
        {step === 'game' && (
          <>
            <div className="challenge-modal-header">
              <span className="challenge-modal-icon">🎮</span>
              <h2>Multi-Player Challenge</h2>
            </div>

            <div className="challenge-modal-body">
              <p className="challenge-prompt">Select a game:</p>
              <div className="game-selector">
                {multiPlayerApps.map(app => (
                  <button
                    key={app.id}
                    className="game-select-btn"
                    onClick={() => {
                      setSelectedApp(app);
                      handleNext();
                    }}
                  >
                    <span className="game-icon">{app.icon}</span>
                    <span className="game-name">{app.name}</span>
                    <span className="game-players">
                      {app.minPlayers}-{app.maxPlayers} players
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="challenge-modal-footer">
              <button className="challenge-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Step 2: Player Selection */}
        {step === 'players' && selectedApp && (
          <>
            <div className="challenge-modal-header">
              <span className="challenge-modal-icon">{selectedApp.icon}</span>
              <h2>{selectedApp.name}</h2>
            </div>

            <div className="challenge-modal-body">
              <p className="challenge-prompt">
                Select players ({selectedApp.minPlayers}-{selectedApp.maxPlayers} total):
              </p>

              <div className="player-selector">
                {/* Show current user first (always selected) */}
                <div className="player-item selected disabled">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                  />
                  <span className="player-name">
                    {currentUser.displayName} <em>(you)</em>
                  </span>
                </div>

                {/* Other online users */}
                {onlineUsers
                  .filter(u => u.email !== currentUser.email)
                  .map(user => (
                    <div
                      key={user.email}
                      className={`player-item ${selectedPlayers.includes(user.email) ? 'selected' : ''}`}
                      onClick={() => togglePlayer(user.email)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlayers.includes(user.email)}
                        onChange={() => togglePlayer(user.email)}
                      />
                      <span className="player-name">{user.displayName}</span>
                    </div>
                  ))}
              </div>

              <div className="player-count-status">
                Selected: {selectedPlayers.length} / {selectedApp.maxPlayers || 10}
                {!isValidPlayerCount() && (
                  <span className="player-count-error">
                    {selectedPlayers.length < (selectedApp.minPlayers || 2)
                      ? ` (need ${(selectedApp.minPlayers || 2) - selectedPlayers.length} more)`
                      : ' (too many players)'}
                  </span>
                )}
              </div>
            </div>

            <div className="challenge-modal-footer">
              {multiPlayerApps.length > 1 && (
                <button className="challenge-back-btn" onClick={handleBack}>
                  Back
                </button>
              )}
              <button className="challenge-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="challenge-confirm-btn"
                onClick={handleNext}
                disabled={!isValidPlayerCount()}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 3: Game Options */}
        {step === 'options' && selectedApp && (
          <>
            <div className="challenge-modal-header">
              <span className="challenge-modal-icon">{selectedApp.icon}</span>
              <h2>Challenge to {selectedApp.name}</h2>
            </div>

            <div className="challenge-modal-body">
              <div className="challenge-summary">
                <strong>Players ({selectedPlayers.length}):</strong>
                <ul className="player-list-summary">
                  {selectedPlayers.map(email => {
                    const user = [currentUser, ...onlineUsers].find(u => u.email === email);
                    return (
                      <li key={email}>
                        {user?.displayName || email}
                        {email === currentUser.email && ' (you)'}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {loading ? (
                <div className="challenge-loading">Loading game options...</div>
              ) : config?.gameOptions && config.gameOptions.length > 0 ? (
                <div className="challenge-options">
                  <h3>Game Settings</h3>
                  {config.gameOptions.map(renderOption)}
                </div>
              ) : (
                <p className="challenge-no-options">No additional options for this game.</p>
              )}
            </div>

            <div className="challenge-modal-footer">
              <button className="challenge-back-btn" onClick={handleBack}>
                Back
              </button>
              <button className="challenge-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="challenge-confirm-btn"
                onClick={() => onConfirm(selectedApp.id, selectedPlayers, options)}
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

export default MultiPlayerChallengeModal;
