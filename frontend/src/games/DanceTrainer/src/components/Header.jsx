import React from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';

export default function Header() {
  const { gameState, transitionTo, activeDanceState } = useGameState();

  const isArenaActive =
    gameState === GAME_STATES.ROUND_1 ||
    gameState === GAME_STATES.ROUND_2 ||
    gameState === GAME_STATES.ROUND_3 ||
    gameState === GAME_STATES.REST_CHECK ||
    gameState === GAME_STATES.READY;

  return (
    <header className="app-header">
      <div
        className="header-brand"
        onClick={() => transitionTo(GAME_STATES.HOME)}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        title="Return to Main Menu"
      >
        <div className="brand-text">
          <h1 className="brand-title">Dance Trainer</h1>
        </div>
      </div>
      <nav className="header-nav-links" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        {gameState !== GAME_STATES.HOME && (
          <>
            <button
              type="button"
              className={`btn-toggle-sm ${gameState === GAME_STATES.HOME ? 'toggle-active' : ''}`}
              onClick={() => transitionTo(GAME_STATES.HOME)}
            >
              Home
            </button>

            <button
              type="button"
              className={`btn-toggle-sm ${gameState === GAME_STATES.DANCE_SELECTION ? 'toggle-active' : ''}`}
              onClick={() => transitionTo(GAME_STATES.DANCE_SELECTION)}
            >
              Dances (1–16)
            </button>
          </>
        )}

        {isArenaActive && (
          <div className="header-status" style={{ borderColor: 'rgba(0, 240, 255, 0.4)', background: 'rgba(0, 240, 255, 0.1)' }}>
            <span className="status-dot" style={{ backgroundColor: '#00f0ff', boxShadow: '0 0 8px #00f0ff' }}></span>
            <span className="status-text" style={{ color: '#00f0ff' }}>
              {activeDanceState.selectedDance ? activeDanceState.selectedDance.displayName : 'Full Routine'} &bull; {gameState.replace('_', ' ')}
            </span>
          </div>
        )}
      </nav>
    </header>
  );
}
