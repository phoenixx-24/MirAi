import React, { useState, useEffect, useRef } from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';
import { ttsService } from '../services/TTS';
import './RestCheckScreen.css';

/**
 * RestCheckScreen
 * Evaluates dancer calibration in standard REST stance before the countdown starts.
 */
export default function RestCheckScreen({ poseAccuracy = 0, isPersonDetected = false }) {
  const { transitionTo } = useGameState();
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 1
  const [isLocked, setIsLocked] = useState(false);
  const holdStartTimeRef = useRef(null);

  // Announce instructions on mount
  useEffect(() => {
    ttsService.speak('Assume the starting rest position. Stand tall with your arms naturally down at your sides.');
  }, []);

  // Track hold stability
  useEffect(() => {
    if (isLocked) return;

    const now = performance.now();
    const REQUIRED_HOLD_MS = 1400; // 1.4s steady hold
    const MATCH_THRESHOLD = 68; // 68% match with rest pose

    if (isPersonDetected && poseAccuracy >= MATCH_THRESHOLD) {
      if (!holdStartTimeRef.current) {
        holdStartTimeRef.current = now;
      }
      const elapsed = now - holdStartTimeRef.current;
      const progress = Math.min(1.0, elapsed / REQUIRED_HOLD_MS);
      setHoldProgress(progress);

      if (progress >= 1.0) {
        setIsLocked(true);
        ttsService.speak('Rest position confirmed! Get ready to dance!', true);
        setTimeout(() => {
          transitionTo(GAME_STATES.READY);
        }, 900);
      }
    } else {
      holdStartTimeRef.current = null;
      setHoldProgress(0);
    }
  }, [poseAccuracy, isPersonDetected, isLocked, transitionTo]);

  return (
    <div className="rest-check-overlay">
      <div className="rest-check-card">
        <div className="rest-badge">
          {isLocked ? 'POSITION LOCKED' : 'POSTURE CALIBRATION'}
        </div>

        <h2 className="rest-title">
          {isLocked ? 'REST POSITION CONFIRMED' : 'ASSUME REST POSITION'}
        </h2>

        <p className="rest-description">
          Stand centered in frame facing the camera. Keep your shoulders relaxed, arms hanging naturally at sides, and feet shoulder-width apart.
        </p>

        {/* Circular Calibration Hold Gauge */}
        <div className="gauge-wrapper">
          <svg className="gauge-svg" viewBox="0 0 160 160">
            {/* Background circle */}
            <circle
              className="gauge-bg-circle"
              cx="80"
              cy="80"
              r="70"
            />
            {/* Progress circle */}
            <circle
              className="gauge-progress-circle"
              cx="80"
              cy="80"
              r="70"
              style={{
                strokeDashoffset: 440 - 440 * holdProgress,
              }}
            />
          </svg>

          <div className="gauge-content">
            <span className="gauge-pct">
              {isLocked ? '100%' : `${Math.round(holdProgress * 100)}%`}
            </span>
            <span className="gauge-status-label">
              {isLocked ? 'LOCKED' : holdProgress > 0 ? 'HOLD STILL...' : 'ALIGN POSE'}
            </span>
          </div>
        </div>

        {/* Real-time feedback status */}
        <div className="rest-feedback-box">
          {!isPersonDetected ? (
            <span className="feedback-warn">Please step into camera frame</span>
          ) : poseAccuracy < 68 ? (
            <span className="feedback-hint">
              Arms down naturally at sides &bull; Match: {poseAccuracy}%
            </span>
          ) : (
            <span className="feedback-good">
              Stance aligned. Keep holding... ({poseAccuracy}% match)
            </span>
          )}
        </div>

        {/* Manual Continue Button */}
        <div className="rest-actions">
          <button
            type="button"
            id="btn-dance-skip-rest"
            data-voice-target="skip, skip check, start countdown, ready, continue, skip calibration"
            className="btn-skip-rest"
            onClick={() => transitionTo(GAME_STATES.READY)}
            title="Say 'Skip' or 'Continue'"
          >
            Skip Check & Start Countdown →
          </button>
        </div>
      </div>
    </div>
  );
}
