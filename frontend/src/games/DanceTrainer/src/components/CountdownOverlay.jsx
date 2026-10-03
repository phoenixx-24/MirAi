import React, { useState, useEffect } from 'react';
import { useGameState, GAME_STATES } from '../context/GameStateContext';
import './CountdownOverlay.css';

export default function CountdownOverlay({
  targetState = GAME_STATES.ROUND_1,
  targetLabel,
}) {
  const { transitionTo } = useGameState();
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      const timer = setTimeout(() => {
        transitionTo(targetState);
      }, 700);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      setCount((c) => c - 1);
    }, 900);

    return () => clearInterval(interval);
  }, [count, targetState, transitionTo]);

  const defaultLabel =
    targetState === GAME_STATES.ROUND_2
      ? 'Round 2: Practice begins now'
      : targetState === GAME_STATES.ROUND_3
      ? 'Round 3: Final Performance begins now'
      : 'Round 1: Learn begins now';

  return (
    <div className="countdown-overlay-backdrop">
      <div className="countdown-burst-glow"></div>
      <div className="countdown-content">
        <span className="countdown-subtext">GET READY TO DANCE</span>
        <div className={`countdown-number-display count-${count}`}>
          {count > 0 ? count : 'DANCE!'}
        </div>
        <span className="countdown-hint">{targetLabel || defaultLabel}</span>
      </div>
    </div>
  );
}
