import React, { useState, useEffect } from 'react';
import { GameConfig, GameOption, ChallengeOptions, AppDefinition } from '../types';
import './ChallengeModal.css';

interface ChallengeModalProps {
  targetUser: string;
  app: AppDefinition;
  onConfirm: (options: ChallengeOptions) => void;
  onCancel: () => void;
  fetchGameConfig: (appId: string, backendPort: number) => Promise<GameConfig | null>;
}

const ChallengeModal: React.FC<ChallengeModalProps> = ({
  targetUser,
  app,
  onConfirm,
  onCancel,
  fetchGameConfig,
}) => {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<ChallengeOptions>({});

  useEffect(() => {
    const loadConfig = async () => {
      if (app.backendPort) {
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
      }
      setLoading(false);
    };

    loadConfig();
  }, [app, fetchGameConfig]);

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

  return (
    <div className="challenge-modal-overlay" onClick={onCancel}>
      <div className="challenge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="challenge-modal-header">
          <span className="challenge-modal-icon">{app.icon}</span>
          <h2>Challenge to {app.name}</h2>
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
          <button className="challenge-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="challenge-confirm-btn"
            onClick={() => onConfirm(options)}
            disabled={loading}
          >
            Send Challenge
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeModal;
