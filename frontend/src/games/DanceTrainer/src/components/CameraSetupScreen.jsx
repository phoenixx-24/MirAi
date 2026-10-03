import React from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';
import './CameraSetupScreen.css';

export default function CameraSetupScreen({
  isStreaming,
  isPersonDetected,
  cameraComponent,
  trackingConfidence = 0,
}) {
  const { transitionTo } = useGameState();

  return (
    <div className="camera-setup-container">
      <div className="setup-viewport-card">
        {cameraComponent}

        <div className="setup-status-strip">
          <div className="status-indicators-left">
            <span className={`setup-dot ${isStreaming ? 'dot-live' : 'dot-off'}`}></span>
            <span className="setup-status-label">
              {!isStreaming
                ? 'Camera starting up...'
                : isPersonDetected
                ? `Dancer Detected (${trackingConfidence}% Confidence)`
                : 'Positioning dancer in frame...'}
            </span>
          </div>

          <div className="setup-actions-right">
            <button
              type="button"
              id="btn-dance-setup-back"
              data-voice-target="select different routine, choose routine, select routine, change routine, routines, back"
              className="btn-setup-back"
              onClick={() => transitionTo(GAME_STATES.DANCE_SELECTION)}
              title="Say 'Select routine' or 'Back'"
            >
              Select Different Routine
            </button>

            <button
              type="button"
              id="btn-dance-setup-next"
              data-voice-target="next, continue, rest calibration, rest position, calibration, ready"
              className="btn-setup-next"
              onClick={() => transitionTo(GAME_STATES.REST_CHECK)}
              title="Say 'Next' or 'Continue'"
            >
              Next: Rest Position Calibration →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
