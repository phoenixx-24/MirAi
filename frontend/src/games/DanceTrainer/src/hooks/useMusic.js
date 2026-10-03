import { useState, useEffect, useCallback } from 'react';
import { musicController, TEMPO_TRACKS } from '../services/MusicController.js';

/**
 * Custom React hook for MusicController with Adaptive Tempo support.
 * Keeps React state in sync with music playback, adaptive BPM, and movement speeds.
 */
export function useMusic() {
  const [snapshot, setSnapshot] = useState(() => musicController.getSnapshot());

  useEffect(() => {
    const unsubscribe = musicController.subscribe((info) => {
      setSnapshot(info);
    });

    return () => unsubscribe();
  }, []);

  const play = useCallback((tempo) => {
    musicController.play(tempo);
  }, []);

  const pause = useCallback(() => {
    musicController.pause();
  }, []);

  const stop = useCallback(() => {
    musicController.stop();
  }, []);

  const setTempo = useCallback((tempo) => {
    musicController.setTempo(tempo);
  }, []);

  const setVolume = useCallback((vol) => {
    musicController.setVolume(vol);
  }, []);

  const toggleMute = useCallback(() => {
    return musicController.toggleMute();
  }, []);

  const setAdaptive = useCallback((enabled) => {
    musicController.setAdaptive(enabled);
  }, []);

  const setAdaptiveMode = useCallback((mode) => {
    musicController.setAdaptiveMode(mode);
  }, []);

  const updateUserSpeed = useCallback((speedRatio) => {
    musicController.updateUserSpeedRatio(speedRatio);
  }, []);

  const processMovementDuration = useCallback((expectedDuration, actualDuration) => {
    musicController.processMovementDuration(expectedDuration, actualDuration);
  }, []);

  return {
    musicState: snapshot.state,
    isPlaying: snapshot.state === 'playing',
    isPaused: snapshot.state === 'paused',
    isStopped: snapshot.state === 'stopped',
    currentBpm: snapshot.currentBpm,
    targetBpm: snapshot.targetBpm,
    userMovementSpeed: snapshot.userMovementSpeed,
    userSpeedRatio: snapshot.userSpeedRatio,
    playbackRate: snapshot.playbackRate,
    isAdaptive: snapshot.isAdaptive,
    adaptiveMode: snapshot.adaptiveMode,
    tempoKey: snapshot.tempoKey,
    currentTrack: snapshot.track,
    isMuted: snapshot.isMuted,
    volume: snapshot.volume,
    play,
    pause,
    stop,
    setTempo,
    setVolume,
    toggleMute,
    setAdaptive,
    setAdaptiveMode,
    updateUserSpeed,
    processMovementDuration,
    tracks: TEMPO_TRACKS,
  };
}

export default useMusic;
