import { useState, useEffect, useCallback } from 'react';
import { ttsService } from '../services/TTS.js';

/**
 * React hook to interface with the TTS feedback system.
 * Keeps React UI in sync with active speech prompts.
 */
export function useTTS() {
  const [currentText, setCurrentText] = useState(ttsService.currentText);
  const [isMuted, setIsMuted] = useState(ttsService.isMuted);

  useEffect(() => {
    const unsubscribe = ttsService.subscribe((text) => {
      setCurrentText(text);
    });
    return () => unsubscribe();
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = ttsService.toggleMute();
    setIsMuted(newMuted);
    return newMuted;
  }, []);

  const speak = useCallback((text, force = false) => {
    ttsService.speak(text, force);
  }, []);

  const processComparison = useCallback((comparisonResult, context = {}) => {
    ttsService.processComparison(comparisonResult, context);
  }, []);

  const stop = useCallback(() => {
    ttsService.stop();
  }, []);

  const setMode = useCallback((mode) => {
    ttsService.setMode(mode);
  }, []);

  return {
    currentText,
    isMuted,
    toggleMute,
    speak,
    processComparison,
    stop,
    setMode,
    isSupported: ttsService.isSupported,
  };
}

export default useTTS;
