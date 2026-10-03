import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { danceEngine } from '../services/DanceEngine.js';
import { musicController } from '../services/MusicController.js';
import { scoringEngine } from '../services/Scoring.js';
import { GAME_STATES } from './gameStates.js';

export { GAME_STATES };

const GameStateContext = createContext(null);

export function GameStateProvider({ children, initialGameState = GAME_STATES.HOME }) {
  const [gameState, setGameState] = useState(initialGameState);
  const [previousState, setPreviousState] = useState(null);
  const [activeDanceState, setActiveDanceState] = useState(() => danceEngine.getState());
  const [errorMessage, setErrorMessage] = useState(null);

  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Safe state transition with synchronization
  const transitionTo = useCallback((newState, options = {}) => {
    if (!GAME_STATES[newState]) {
      console.warn(`Attempted invalid state transition to: ${newState}`);
      return;
    }

    const isDanceRound = [GAME_STATES.ROUND_1, GAME_STATES.ROUND_2, GAME_STATES.ROUND_3].includes(newState);
    if (typeof window !== 'undefined' && window.fitness?.state?.paused && isDanceRound) {
      return;
    }

    const prevState = gameStateRef.current;
    setPreviousState(prevState);
    gameStateRef.current = newState;
    setGameState(newState);

    // Synchronize Music and Audio on state exit/entry
    if (newState === GAME_STATES.PAUSED) {
      musicController.pause();
    } else if (newState === GAME_STATES.HOME || newState === GAME_STATES.DANCE_SELECTION || newState === GAME_STATES.ERROR) {
      musicController.stop();
    } else if (newState === GAME_STATES.ROUND_1) {
      musicController.setTempo('slow');
      musicController.setAdaptiveMode('learn');
      try { musicController.play(); } catch (e) { console.warn('Music play deferred:', e); }
    } else if (newState === GAME_STATES.ROUND_2) {
      musicController.setTempo('medium');
      musicController.setAdaptiveMode('practice');
      try { musicController.play(); } catch (e) { console.warn('Music play deferred:', e); }
    } else if (newState === GAME_STATES.ROUND_3) {
      musicController.setTempo('target');
      musicController.setAdaptiveMode('performance');
      try { musicController.play(); } catch (e) { console.warn('Music play deferred:', e); }
    }

    if (options.error) {
      setErrorMessage(options.error);
    }
  }, []);

  // Select dance from Dance Selection screen
  const selectDance = useCallback((danceOrId) => {
    const updated = danceEngine.loadDance(danceOrId);
    setActiveDanceState(updated);
    scoringEngine.reset();
    transitionTo(GAME_STATES.CAMERA_SETUP);
  }, [transitionTo]);

  // Pause game during active round
  const pauseGame = useCallback(() => {
    if (typeof window !== 'undefined' && window.fitness?.pause) {
      window.fitness.pause();
      return;
    }
    if (
      gameStateRef.current === GAME_STATES.ROUND_1 ||
      gameStateRef.current === GAME_STATES.ROUND_2 ||
      gameStateRef.current === GAME_STATES.ROUND_3
    ) {
      transitionTo(GAME_STATES.PAUSED);
    }
  }, [transitionTo]);

  // Resume game from paused state
  const resumeGame = useCallback(() => {
    if (typeof window !== 'undefined' && window.fitness?.state?.paused) {
      window.fitness.resume();
      return;
    }
    if (gameStateRef.current === GAME_STATES.PAUSED) {
      const returnState = previousState || GAME_STATES.ROUND_1;
      transitionTo(returnState);
    }
  }, [previousState, transitionTo]);

  const handleDanceCommand = useCallback((cmd) => {
    const f = typeof window !== 'undefined' ? window.fitness : null;
    const text = (cmd || '').toLowerCase();
    if (text.includes('start') || text.includes('dance') || text.includes('play') || text.includes('begin') || text.includes('go')) {
      if (gameStateRef.current === GAME_STATES.HOME || gameStateRef.current === GAME_STATES.DANCE_SELECTION) {
        selectDance('all');
        f?.speak("Starting dance. Step back into camera view!");
      } else if (gameStateRef.current === GAME_STATES.CAMERA_SETUP) {
        transitionTo(GAME_STATES.ROUND_1);
        f?.speak("Round 1. Match the dancer's moves to the beat!");
      } else if (gameStateRef.current === GAME_STATES.PAUSED) {
        resumeGame();
      }
    } else if (text.includes('round 1') || text.includes('round one') || text.includes('learn')) {
      transitionTo(GAME_STATES.ROUND_1);
      f?.speak("Round 1 learning mode.");
    } else if (text.includes('round 2') || text.includes('round two') || text.includes('practice')) {
      transitionTo(GAME_STATES.ROUND_2);
      f?.speak("Round 2 practice mode.");
    } else if (text.includes('round 3') || text.includes('round three') || text.includes('performance')) {
      transitionTo(GAME_STATES.ROUND_3);
      f?.speak("Round 3 full performance mode.");
    } else if (text.includes('next') || text.includes('continue') || text.includes('advance')) {
      if (gameStateRef.current === GAME_STATES.ROUND_1) {
        transitionTo(GAME_STATES.ROUND_2);
        f?.speak("Advancing to Round 2.");
      } else if (gameStateRef.current === GAME_STATES.ROUND_2) {
        transitionTo(GAME_STATES.ROUND_3);
        f?.speak("Advancing to Round 3.");
      } else if (gameStateRef.current === GAME_STATES.ROUND_3 || gameStateRef.current === GAME_STATES.SCORE_SUMMARY) {
        f?.complete();
      }
    } else if (text.includes('repeat') || text.includes('again') || text.includes('retry') || text.includes('restart')) {
      const cur = gameStateRef.current;
      if (cur === GAME_STATES.ROUND_1 || cur === GAME_STATES.ROUND_2 || cur === GAME_STATES.ROUND_3) {
        scoringEngine.reset();
        transitionTo(cur);
        f?.speak("Restarting round.");
      }
    } else if (text.includes('pause') || text.includes('hold')) {
      pauseGame();
      f?.speak("Dance paused.");
    } else if (text.includes('resume') || text.includes('unpause')) {
      resumeGame();
      f?.speak("Resuming dance.");
    } else if (text.includes('finish') || text.includes('save') || text.includes('complete') || text.includes('stop')) {
      f?.complete();
    }
  }, [selectDance, transitionTo, resumeGame, pauseGame]);

  useEffect(() => {
    const f = typeof window !== 'undefined' ? window.fitness : null;
    if (!f) return;
    const unsubscribe = f.onMessage(m => {
      if (['pause', 'stop'].includes(m.type) || (m.type === 'initialize' && m.paused)) {
        if (gameStateRef.current !== GAME_STATES.PAUSED) transitionTo(GAME_STATES.PAUSED);
      }
      if (m.type === 'resume' || (m.type === 'initialize' && !m.paused)) resumeGame();
      if (m.type === 'command') handleDanceCommand(m.text || m.raw || '');
      if (m.type === 'initialize') {
        f.speak("Welcome to Dance Trainer. Say Start or pick a routine to dance.");
      }
    });
    f.ready();
    return unsubscribe;
  }, [transitionTo, resumeGame, handleDanceCommand]);

  // Error handling dispatch
  const reportError = useCallback((friendlyMsg) => {
    setErrorMessage(friendlyMsg || 'A temporary issue occurred. You can return to the main menu.');
    transitionTo(GAME_STATES.ERROR, { error: friendlyMsg });
  }, [transitionTo]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    transitionTo(GAME_STATES.HOME);
  }, [transitionTo]);

  return (
    <GameStateContext.Provider
      value={{
        gameState,
        previousState,
        activeDanceState,
        errorMessage,
        transitionTo,
        selectDance,
        pauseGame,
        resumeGame,
        reportError,
        clearError,
        isRoundActive:
          gameState === GAME_STATES.ROUND_1 ||
          gameState === GAME_STATES.ROUND_2 ||
          gameState === GAME_STATES.ROUND_3,
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return ctx;
}

export default GameStateContext;
