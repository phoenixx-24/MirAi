import React from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';
import './PauseModal.css';

export default function PauseModal() {
  const { resumeGame, transitionTo } = useGameState();

  return (
    <div className="pause-modal-backdrop" role="dialog" aria-modal="true">
      <div className="pause-modal-card">
        <h2 className="pause-title">PAUSED</h2>
        <p className="pause-sub">Session paused. Resume when you are ready to continue.</p>

        <div className="pause-actions-list">
          <button
            type="button"
            id="btn-dance-pause-resume"
            data-voice-target="resume, resume practice, continue, keep going, unpause"
            className="btn-pause-primary"
            onClick={resumeGame}
            title="Say 'Resume' to continue"
          >
            Resume Practice
          </button>

          <button
            type="button"
            id="btn-dance-pause-restart"
            data-voice-target="restart, restart round 1, start over, replay"
            className="btn-pause-secondary"
            onClick={() => transitionTo(GAME_STATES.ROUND_1)}
            title="Say 'Restart'"
          >
            Restart Round 1
          </button>

          <button
            type="button"
            id="btn-dance-pause-select-routine"
            data-voice-target="select another routine, change routine, routines, choose routine"
            className="btn-pause-secondary"
            onClick={() => transitionTo(GAME_STATES.DANCE_SELECTION)}
            title="Say 'Select routine'"
          >
            Select Another Routine
          </button>

          <button
            type="button"
            id="btn-dance-pause-exit"
            data-voice-target="exit to home, exit, home"
            className="btn-pause-text"
            onClick={() => transitionTo(GAME_STATES.HOME)}
            title="Say 'Exit'"
          >
            Exit to Home
          </button>
        </div>
      </div>
    </div>
  );
}
