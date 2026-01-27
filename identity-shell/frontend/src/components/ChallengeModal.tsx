import React, { useState, useEffect } from 'react';
import { GameConfig, GameOption, ChallengeOptions, AppDefinition } from '../types';
import './ChallengeModal.css';

interface ChallengeModalProps {
  targetUser: string;
  challengeableApps: AppDefinition[];
  onConfirm: (appId: string, options: ChallengeOptions) => void;
  onCancel: () => void;
  fetchGameConfig: (appId: string, backendPort: number) => Promise<GameConfig | null>;
}

const ChallengeModal: React.FC<ChallengeModalProps> = ({
  targetUser,
  challengeableApps,
  onConfirm,
  onCancel,
  fetchGameConfig,
}) => {
  // Step 1: Game selection, Step 2: Game options
  const [selectedApp, setSelectedApp] = useState<AppDefinition | null>(
    challengeableApps.length === 1 ? challengeableApps[0] : null
  );
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ChallengeOptions>({});

  // Load game config when app is selected
  useEffect(() => {
    const loadConfig = async () => {
      if (selectedApp?.backendPort) {
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

    if (selectedApp) {
      loadConfig();
    }
  }, [selectedApp, fetchGameConfig]);

  const handleOptionChange = (optionId: string, value: string | number | boolean) => {
    setOptions(prev => ({ ...prev, [optionId]: value }));
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

  // Go back to game selection
  const handleBack = () => {
    setSelectedApp(null);
    setConfig(null);
    setOptions({});
  };

  return (
    <div className="challenge-modal-overlay" onClick={onCancel}>
      <div className="challenge-modal" onClick={(e) => e.stopPropagation()}>
        {/* Game Selection Step */}
        {!selectedApp ? (
          <>
            <div className="challenge-modal-header">
              <span className="challenge-modal-icon">🎮</span>
              <h2>Challenge {targetUser}</h2>
            </div>

            <div className="challenge-modal-body">
              <p className="challenge-prompt">Select a game:</p>
              <div className="game-selector">
                {challengeableApps.map(app => (
                  <button
                    key={app.id}
                    className="game-select-btn"
                    onClick={() => setSelectedApp(app)}
                  >
                    <span className="game-icon">{app.icon}</span>
                    <span className="game-name">{app.name}</span>
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
        ) : (
          <>
            {/* Game Options Step */}
            <div className="challenge-modal-header">
              <span className="challenge-modal-icon">{selectedApp.icon}</span>
              <h2>Challenge to {selectedApp.name}</h2>
            </div>

            <div className="challenge-modal-body">
              <p className="challenge-target">
                Challenging: <strong>{targetUser}</strong>
              </p>

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
              {challengeableApps.length > 1 && (
                <button className="challenge-back-btn" onClick={handleBack}>
                  Back
                </button>
              )}
              <button className="challenge-cancel-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="challenge-confirm-btn"
                onClick={() => onConfirm(selectedApp.id, options)}
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

export default ChallengeModal;
