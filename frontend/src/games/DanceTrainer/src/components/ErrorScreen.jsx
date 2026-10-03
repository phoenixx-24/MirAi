import React from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';
import './ErrorScreen.css';

export default function ErrorScreen({ message, onRetry }) {
  const { transitionTo, clearError } = useGameState();

  const handleReturnHome = () => {
    clearError();
    transitionTo(GAME_STATES.HOME);
  };

  const handleReturnSelection = () => {
    clearError();
    transitionTo(GAME_STATES.DANCE_SELECTION);
  };

  return (
    <div className="error-screen-container">
      <div className="error-card">
        <h2 className="error-title">System Notice</h2>
        
        <p className="error-message">
          {message || 'A device or audio connection event occurred. Please check your settings and retry.'}
        </p>

        <div className="error-tips-box">
          <span className="tips-header">Troubleshooting Guidelines:</span>
          <ul className="tips-list">
            <li>Ensure camera permissions are enabled in your browser address bar.</li>
            <li>Confirm no other applications are currently accessing your webcam.</li>
            <li>Stand 5–8 feet back in a well-lit area so your full frame is visible.</li>
            <li>Click the page to resume audio if browser autoplay was suspended.</li>
          </ul>
        </div>

        <div className="error-actions-group">
          {onRetry && (
            <button
              type="button"
              className="btn-error-primary"
              onClick={onRetry}
            >
              Retry Setup
            </button>
          )}

          <button
            type="button"
            className="btn-error-secondary"
            onClick={handleReturnSelection}
          >
            Select Another Routine
          </button>

          <button
            type="button"
            className="btn-error-text"
            onClick={handleReturnHome}
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
