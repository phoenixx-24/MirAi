import { useState, useEffect, useRef, useCallback } from 'react';
import { danceAnimator } from '../dance/DanceAnimator.js';
import { DANCE_STEPS, REST_POSE_COORDINATES } from '../dance/DanceSteps.js';
import { SPEED_PRESETS } from '../dance/DanceData.js';

/**
 * Custom hook to control the AI Stick-Man dance demonstration loop.
 * Orchestrates smooth, beginner-friendly demonstrations with clear pauses and recovery.
 */
export function useDanceAnimation({
  initialStepIndex = 0,
  initialSpeedKey = 'LEARN', // Default to slow & guided learn speed
  autoPlay = true,
  loopCurrentStep = false,
} = {}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [speedKey, setSpeedKey] = useState(initialSpeedKey);

  // Active interpolated pose rendered by StickMan
  const [currentPose, setCurrentPose] = useState(REST_POSE_COORDINATES);
  const [currentPhase, setCurrentPhase] = useState('rest_start');
  const [phaseLabel, setPhaseLabel] = useState('Starting Rest Stance');
  const [coachPrompt, setCoachPrompt] = useState('Stand in starting rest position.');
  const [stepProgress, setStepProgress] = useState(0);

  const animFrameRef = useRef(null);
  const stepStartTimeRef = useRef(performance.now());
  const elapsedOffsetRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const stepIndexRef = useRef(currentStepIndex);
  const speedKeyRef = useRef(speedKey);

  // Sync refs for animation loop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    stepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    speedKeyRef.current = speedKey;
  }, [speedKey]);

  const currentStep = DANCE_STEPS[currentStepIndex] || DANCE_STEPS[0];
  const speedConfig = SPEED_PRESETS[speedKey] || SPEED_PRESETS.LEARN;

  // Main continuous animation frame loop
  const animate = useCallback((now) => {
    if (!isPlayingRef.current) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const activeStep = DANCE_STEPS[stepIndexRef.current] || DANCE_STEPS[0];
    const activeSpeed = SPEED_PRESETS[speedKeyRef.current] || SPEED_PRESETS.LEARN;

    // Calculate actual duration based on step duration adjusted for speed multiplier
    // Learn speed (0.75x multiplier) = moves are 1.33x longer (slower & more understandable)
    const effectiveDurationMs = (activeStep.duration / activeSpeed.speedMultiplier) * 1000;

    const elapsed = now - stepStartTimeRef.current + elapsedOffsetRef.current;
    let progress = elapsed / effectiveDurationMs;

    if (progress >= 1.0) {
      // Step demonstration cycle complete!
      if (loopCurrentStep) {
        // Repeat current movement from rest
        progress = 0;
        stepStartTimeRef.current = now;
        elapsedOffsetRef.current = 0;
      } else {
        // Advance smoothly to the next movement in sequence
        const nextIndex = (stepIndexRef.current + 1) % DANCE_STEPS.length;
        stepIndexRef.current = nextIndex;
        setCurrentStepIndex(nextIndex);
        stepStartTimeRef.current = now;
        elapsedOffsetRef.current = 0;
        progress = 0;
      }
    }

    // Evaluate pose and phase through DanceAnimator
    const evaluation = danceAnimator.evaluateStep(DANCE_STEPS[stepIndexRef.current], progress);

    setCurrentPose(evaluation.pose);
    setCurrentPhase(evaluation.phase);
    setPhaseLabel(evaluation.phaseLabel);
    setCoachPrompt(evaluation.coachPrompt);
    setStepProgress(Math.min(1, Math.max(0, progress)));

    animFrameRef.current = requestAnimationFrame(animate);
  }, [loopCurrentStep]);

  // Start / stop RAF loop
  useEffect(() => {
    stepStartTimeRef.current = performance.now();
    elapsedOffsetRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [animate]);

  // Controls
  const play = useCallback(() => {
    stepStartTimeRef.current = performance.now();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const selectStep = useCallback((index) => {
    if (index >= 0 && index < DANCE_STEPS.length) {
      setCurrentStepIndex(index);
      stepIndexRef.current = index;
      stepStartTimeRef.current = performance.now();
      elapsedOffsetRef.current = 0;
      setStepProgress(0);
    }
  }, []);

  const nextStep = useCallback(() => {
    selectStep((currentStepIndex + 1) % DANCE_STEPS.length);
  }, [currentStepIndex, selectStep]);

  const prevStep = useCallback(() => {
    selectStep((currentStepIndex - 1 + DANCE_STEPS.length) % DANCE_STEPS.length);
  }, [currentStepIndex, selectStep]);

  const resetToRest = useCallback(() => {
    stepStartTimeRef.current = performance.now();
    elapsedOffsetRef.current = 0;
    setStepProgress(0);
    setCurrentPose({ ...REST_POSE_COORDINATES });
  }, []);

  return {
    isPlaying,
    currentStepIndex,
    currentStep,
    currentPose,
    currentPhase,
    phaseLabel,
    coachPrompt,
    stepProgress,
    speedKey,
    speedConfig,
    play,
    pause,
    togglePlay,
    nextStep,
    prevStep,
    selectStep,
    resetToRest,
    setSpeedKey,
    allSteps: DANCE_STEPS,
  };
}

export default useDanceAnimation;
