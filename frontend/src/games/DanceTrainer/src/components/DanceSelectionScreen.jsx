import React from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';
import { DANCE_CATALOGUE } from '../services/DanceEngine';
import './DanceSelectionScreen.css';

export default function DanceSelectionScreen() {
  const { selectDance, transitionTo } = useGameState();

  const handleSelectSingleDance = (dance) => {
    selectDance(dance);
  };

  return (
    <div className="dance-selection-container">
      <div className="selection-routine-title-bar">
        <h2 className="routine-silver-heading">ARABIC KUTHU HOOK</h2>
        <span className="routine-silver-sub">16-Step Choreography Sequence</span>
      </div>

      {/* 16 Dance Cards Grid */}
      <div className="dances-grid">
        {DANCE_CATALOGUE.map((dance) => {
          const diffClass =
            dance.difficulty === 'Beginner'
              ? 'diff-beginner'
              : dance.difficulty === 'Intermediate'
              ? 'diff-intermediate'
              : 'diff-advanced';

          const numInt = parseInt(dance.danceNumber || '0', 10);
          return (
            <div
              key={dance.id}
              id={`btn-dance-card-${dance.id}`}
              data-voice-target={`${dance.displayName || dance.name}, dance ${numInt}, dance ${dance.danceNumber}, routine ${numInt}`}
              className="dance-card"
              onClick={() => handleSelectSingleDance(dance)}
              role="button"
              tabIndex={0}
              title={`Say 'Dance ${numInt}' or '${dance.displayName || dance.name}'`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectSingleDance(dance);
                }
              }}
            >
              <div className="dance-card-glow"></div>

              <div className="card-top-row">
                <span className="dance-card-number">{dance.danceNumber}</span>
                <span className={`dance-card-difficulty ${diffClass}`}>
                  {dance.difficulty}
                </span>
              </div>

              <h3 className="dance-card-name">{dance.displayName || dance.name}</h3>

              <p className="dance-card-desc">{dance.description}</p>

              <div className="card-bottom-row">
                <div className="dance-card-bpm">
                  <span className="bpm-number">{dance.targetBpm}</span>
                  <span className="bpm-unit">BPM</span>
                </div>

                <span className="btn-select-arrow" title="Select Dance">
                  Select →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Back button */}
      <div className="selection-footer-nav">
        <button
          type="button"
          id="btn-dance-nav-back"
          data-voice-target="back to home, back, home"
          className="btn-nav-back"
          onClick={() => transitionTo(GAME_STATES.HOME)}
          title="Say 'Back' or 'Home'"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
