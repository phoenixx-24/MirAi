import React from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';
import './HomeScreen.css';

export default function HomeScreen() {
  const { selectDance } = useGameState();

  const handleStartPractice = () => {
    // Launch complete 16-step training routine directly
    selectDance('all');
  };

  return (
    <div className="home-screen-container">
      {/* Dynamic concert stage lighting effects */}
      <div className="concert-spotlight-beam beam-left"></div>
      <div className="concert-spotlight-beam beam-center"></div>
      <div className="concert-spotlight-beam beam-right"></div>
      <div className="ambient-stage-glow"></div>

      {/* Main Single Action Screen */}
      <div className="home-single-action-wrapper">
        <h1 className="dance-hero-title" style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '2px', color: '#00f0ff', marginBottom: '1.5rem', textTransform: 'uppercase' }}>Dance Practice Arena</h1>
        <button
          type="button"
          id="btn-dance-start-practice"
          data-voice-target="start, let's start, start practice, practice, let's dance, dance, play, begin, go"
          className="btn-start-practice-hero"
          onClick={handleStartPractice}
          title="Say 'Start' or 'Practice' to begin"
        >
          LET'S START OUR PRACTICE
        </button>
      </div>
    </div>
  );
}
