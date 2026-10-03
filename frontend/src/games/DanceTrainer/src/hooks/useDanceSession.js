/**
 * useDanceSession.js
 * 
 * Orchestrates the 3-Round Progression System:
 * - ROUND 1: LEARN (Slow 80 BPM, step-by-step demonstration, player copy pauses, TTS guidance, pass criteria)
 * - ROUND 2: PRACTICE (Medium 105 BPM, reduced pauses, continuous follow-along, adaptive tempo, accuracy & timing tracking)
 * - ROUND 3: FINAL PERFORMANCE (Target 125 BPM, continuous choreography, zero teaching pauses, tight adaptive tempo, minimal TTS)
 * - STEP 17: Comprehensive Scoring Engine Integration (Movement 50%, Timing 25%, Rhythm 25%)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DANCE_STEPS, REST_POSE_COORDINATES } from '../dance/DanceSteps.js';
import { danceAnimator } from '../dance/DanceAnimator.js';
import { scoringEngine } from '../dance/Scoring.js';
import { musicController } from '../services/MusicController.js';
import { movementSpeedTracker } from '../services/MovementSpeedTracker.js';
import { ttsService } from '../services/TTS.js';

export const ROUNDS_CONFIG = {
  1: {
    round: 1,
    id: 'learn',
    title: 'ROUND 1 - LEARN',
    name: 'Learn',
    tempoKey: 'slow',
    baseBpm: 68,
    speedMultiplier: 0.65,
    description: 'Learn each of the 16 steps slowly. The entire step must be matched at 70% to advance.',
    adaptiveMode: 'learn',
    ttsMode: 'learning',
  },
  2: {
    round: 2,
    id: 'practice',
    title: 'ROUND 2 - PRACTICE',
    name: 'Practice',
    tempoKey: 'medium',
    baseBpm: 100, // Little fast, not too fast
    speedMultiplier: 1.0,
    description: 'Continuous groove practice through all 16 steps at a steady, moderate tempo.',
    adaptiveMode: 'practice',
    ttsMode: 'practice',
  },
  3: {
    round: 3,
    id: 'final_performance',
    title: 'ROUND 3 - FINAL PERFORMANCE',
    name: 'Final Performance',
    tempoKey: 'target',
    baseBpm: 115, // Correct phase / authentic concert tempo for the dance
    speedMultiplier: 1.15,
    description: 'Complete 16-step choreography at the correct dance tempo with live scoring.',
    adaptiveMode: 'performance',
    ttsMode: 'minimal',
  },
};

export function useDanceSession({
  initialRound = 1,
  steps = DANCE_STEPS,
  autoStart = true,
  onRoundComplete,
} = {}) {
  const [currentRound, setCurrentRound] = useState(initialRound);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoStart);
  
  // Round 1 sub-phase: 'demonstrating' | 'user_turn' | 'step_passed'
  const [round1Phase, setRound1Phase] = useState('demonstrating');
  const [userHoldProgress, setUserHoldProgress] = useState(0); // 0 to 1 for holding correct pose in Round 1
  
  // Stick man animation states
  const [currentPose, setCurrentPose] = useState(REST_POSE_COORDINATES);
  const [currentPhase, setCurrentPhase] = useState('rest_start');
  const [phaseLabel, setPhaseLabel] = useState('Starting Rest Stance');
  const [coachPrompt, setCoachPrompt] = useState('Stand in starting rest position.');
  const [stepProgress, setStepProgress] = useState(0);

  // Score Modal states
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [scoreSummary, setScoreSummary] = useState(null);

  const roundConfig = ROUNDS_CONFIG[currentRound] || ROUNDS_CONFIG[1];
  const currentStep = steps[currentStepIndex] || steps[0];

  const animFrameRef = useRef(null);
  const stepStartTimeRef = useRef(performance.now());
  const elapsedOffsetRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const currentRoundRef = useRef(currentRound);
  const currentStepIndexRef = useRef(currentStepIndex);
  const round1PhaseRef = useRef(round1Phase);
  const userHoldStartTimeRef = useRef(null);
  const userTurnStartTimeRef = useRef(null);
  const masteredStepsCountRef = useRef(0);
  const onRoundCompleteRef = useRef(onRoundComplete);
  const isAdvancingRef = useRef(false);
  const stepProgressRef = useRef(0);

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  // Reset step index when steps change
  useEffect(() => {
    setCurrentStepIndex(0);
    currentStepIndexRef.current = 0;
    masteredStepsCountRef.current = 0;
    setStepProgress(0);
    setUserHoldProgress(0);
    userHoldStartTimeRef.current = null;
    userTurnStartTimeRef.current = null;
    stepStartTimeRef.current = performance.now();
    elapsedOffsetRef.current = 0;
  }, [steps]);

  // Sync refs
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    round1PhaseRef.current = round1Phase;
  }, [round1Phase]);

  // Configure Audio, TTS, and Speed Tracker on round change
  const applyRoundSettings = useCallback((roundNum) => {
    const config = ROUNDS_CONFIG[roundNum] || ROUNDS_CONFIG[1];
    
    // Music setup
    musicController.setTempo(config.tempoKey);
    musicController.setAdaptiveMode(config.adaptiveMode);
    
    // TTS setup (minimal speech in Round 3)
    ttsService.setMode(config.ttsMode);

    // Reset scoring engine for the round
    scoringEngine.reset();
    movementSpeedTracker.reset();

    // Notify speech coach
    if (roundNum === 1) {
      const step1 = steps[0];
      const stepName = step1 ? step1.name : 'Feet Wide Stance';
      ttsService.speak(`Round 1: Learn. Step 1: ${stepName}. Watch the demo.`);
    } else if (roundNum === 2) {
      ttsService.speak('Round 2: Practice. Music tempo increased. Follow the complete sequence together.');
    } else if (roundNum === 3) {
      ttsService.speak('Round 3: Final Performance. Full concert tempo. Show your best choreography!');
    }
  }, []);

  // Initialize round settings
  useEffect(() => {
    applyRoundSettings(currentRound);
  }, [currentRound, applyRoundSettings]);

  // Start step scoring tracking
  const initStepTracking = useCallback((stepIdx) => {
    const step = steps[stepIdx] || steps[0];
    scoringEngine.startStep(stepIdx, step);
    movementSpeedTracker.startStep(step, roundConfig.speedMultiplier);
  }, [steps, roundConfig.speedMultiplier]);

  useEffect(() => {
    initStepTracking(currentStepIndex);
  }, [currentStepIndex, initStepTracking]);

  // Round progression handlers
  const finishCurrentRound = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    musicController.pause();
    const finalScore = scoringEngine.calculateFinalScore();

    // Evaluate Round 1 Pass Criteria
    if (currentRoundRef.current === 1) {
      const mastered = masteredStepsCountRef.current;
      const total = steps.length;
      finalScore.passed = true;
      finalScore.masteredCount = mastered;
      finalScore.totalRequired = total;
      finalScore.passThreshold = 70;

      ttsService.speak(
        `Round 1 complete! Advancing to Round 2 Practice in 5 seconds.`,
        true
      );
    } else if (currentRoundRef.current === 2) {
      finalScore.passed = true;
      ttsService.speak(`Round 2 practice complete! Ready for Final Performance in 5 seconds.`, true);
    } else {
      finalScore.passed = true;
      const verdict = finalScore.overallScore >= 85
        ? 'Excellent'
        : finalScore.overallScore >= 70
        ? 'Great Job'
        : 'Keep Practicing';
      finalScore.performanceResult = verdict;
      ttsService.speak(`Final score: ${finalScore.overallScore} out of 100. ${verdict}!`, true);
    }

    if (typeof window !== 'undefined' && window.fitness?.score) {
      window.fitness.score(finalScore.overallScore, finalScore.overallScore);
    }

    setScoreSummary(finalScore);
    setIsScoreModalOpen(true);

    if (onRoundCompleteRef.current) {
      onRoundCompleteRef.current(currentRoundRef.current, finalScore);
    }
  }, [steps.length]);

  // Advance to next step in routine
  const advanceToNextStep = useCallback(() => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    // Finalize score for step just completed
    scoringEngine.finalizeStep();
    if (typeof window !== 'undefined' && window.fitness?.score) {
      const result = scoringEngine.calculateFinalScore();
      window.fitness.score(result.overallScore, result.movementAccuracy);
    }

    const nextIdx = currentStepIndexRef.current + 1;
    if (nextIdx >= steps.length) {
      // Completed all movements in this round!
      finishCurrentRound();
    } else {
      currentStepIndexRef.current = nextIdx;
      setCurrentStepIndex(nextIdx);
      stepStartTimeRef.current = performance.now();
      elapsedOffsetRef.current = 0;
      setStepProgress(0);
      setUserHoldProgress(0);
      userHoldStartTimeRef.current = null;
      userTurnStartTimeRef.current = null;

      if (currentRoundRef.current === 1) {
        round1PhaseRef.current = 'demonstrating';
        setRound1Phase('demonstrating');
        const nextStep = steps[nextIdx];
        if (nextStep) {
          ttsService.speak(`Step ${nextStep.stepNumber}: ${nextStep.name}. Watch the demo.`);
        }
      }
    }

    setTimeout(() => {
      isAdvancingRef.current = false;
    }, 450);
  }, [steps.length, finishCurrentRound]);

  // Main animation / demonstration tick loop
  const animate = useCallback((now) => {
    if (!isPlayingRef.current) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const round = currentRoundRef.current;
    const activeStep = steps[currentStepIndexRef.current] || steps[0];
    const config = ROUNDS_CONFIG[round] || ROUNDS_CONFIG[1];

    // Effective duration adjusted for round speed multiplier
    const effectiveDurationMs = (activeStep.duration / config.speedMultiplier) * 1000;

    if (round === 1) {
      // ROUND 1: LEARN (Demonstrate -> Copy Pause -> Wait for match)
      if (round1PhaseRef.current === 'demonstrating') {
        const elapsed = now - stepStartTimeRef.current + elapsedOffsetRef.current;
        let progress = elapsed / effectiveDurationMs;

        if (progress >= 1.0) {
          // Demonstration complete! Instruct user to do the same
          round1PhaseRef.current = 'user_turn';
          setRound1Phase('user_turn');
          userTurnStartTimeRef.current = {
            startTime: now,
            lastCorrectionTime: 0,
            lastHintTime: 0,
          };
          userHoldStartTimeRef.current = null;
          setUserHoldProgress(0);
          stepProgressRef.current = 1.0;
          setStepProgress(1.0);
          ttsService.speak('Now your turn! Do the same.');
        } else {
          const evalRes = danceAnimator.evaluateStep(activeStep, progress);
          setCurrentPose(evalRes.pose);
          setCurrentPhase(evalRes.phase);
          const nextLabel = `Instructor Demo: Step ${activeStep.stepNumber} — ${activeStep.name}`;
          setPhaseLabel((prev) => (prev !== nextLabel ? nextLabel : prev));
          const nextPrompt = `Watch the stick man demo for Step ${activeStep.stepNumber}.`;
          setCoachPrompt((prev) => (prev !== nextPrompt ? nextPrompt : prev));
          stepProgressRef.current = progress;
          const roundedProgress = Math.round(progress * 40) / 40;
          setStepProgress((prev) => (prev !== roundedProgress ? roundedProgress : prev));
        }
      } else if (round1PhaseRef.current === 'user_turn') {
        // Show target pose for user reference — waiting for user to match at 70%+
        const target = activeStep.targetPose || REST_POSE_COORDINATES;
        setCurrentPose((prev) => (prev !== target ? target : prev));
        const label = `Step ${activeStep.stepNumber}: Your Turn — Match Stick Man`;
        setPhaseLabel((prev) => (prev !== label ? label : prev));
        const prompt = `Copy Step ${activeStep.stepNumber}: ${activeStep.name} until you get it right (70% match needed).`;
        setCoachPrompt((prev) => (prev !== prompt ? prompt : prev));
      } else if (round1PhaseRef.current === 'step_passed') {
        // Brief victory rest before advancing
        setCurrentPose((prev) => (prev !== REST_POSE_COORDINATES ? REST_POSE_COORDINATES : prev));
        setPhaseLabel((prev) => (prev !== 'Movement Passed! Great Job!' ? 'Movement Passed! Great Job!' : prev));
        setCoachPrompt((prev) => (prev !== 'Prepare for the next dance movement.' ? 'Prepare for the next dance movement.' : prev));
      }
    } else if (round === 2) {
      // ROUND 2: PRACTICE (Continuous flow through all 16 steps, slightly faster, not too fast)
      const elapsed = now - stepStartTimeRef.current + elapsedOffsetRef.current;
      let progress = elapsed / effectiveDurationMs;

      if (progress >= 1.0) {
        advanceToNextStep();
      } else {
        const evalRes = danceAnimator.evaluateStep(activeStep, progress);
        setCurrentPose(evalRes.pose);
        setCurrentPhase(evalRes.phase);
        const label = `Continuous Practice: Step ${currentStepIndexRef.current + 1} of ${steps.length}`;
        setPhaseLabel((prev) => (prev !== label ? label : prev));
        const prompt = `Keep the groove going! Moving through ${activeStep.name}.`;
        setCoachPrompt((prev) => (prev !== prompt ? prompt : prev));
        stepProgressRef.current = progress;
        const roundedProgress = Math.round(progress * 40) / 40;
        setStepProgress((prev) => (prev !== roundedProgress ? roundedProgress : prev));
      }
    } else {
      // ROUND 3: FINAL PERFORMANCE (Continuous full concert choreography, zero teaching pauses)
      const elapsed = now - stepStartTimeRef.current + elapsedOffsetRef.current;
      let progress = elapsed / effectiveDurationMs;

      if (progress >= 1.0) {
        advanceToNextStep();
      } else {
        const evalRes = danceAnimator.evaluateStep(activeStep, progress);
        setCurrentPose(evalRes.pose);
        setCurrentPhase(evalRes.phase);
        const label = `Live Performance: ${evalRes.phaseLabel}`;
        setPhaseLabel((prev) => (prev !== label ? label : prev));
        const prompt = `Keep dancing to the rhythm! Step ${currentStepIndexRef.current + 1} of ${steps.length}`;
        setCoachPrompt((prev) => (prev !== prompt ? prompt : prev));
        stepProgressRef.current = progress;
        const roundedProgress = Math.round(progress * 40) / 40;
        setStepProgress((prev) => (prev !== roundedProgress ? roundedProgress : prev));
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [steps, advanceToNextStep]);

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

  // Feed user live comparison into the active round
  const processLiveComparison = useCallback((comparison, poseData) => {
    if (typeof window !== 'undefined' && window.fitness?.state?.paused) return;
    if (!comparison || !poseData?.isPersonDetected) return;

    // 1. Feed frame into MovementSpeedTracker (for Adaptive Music Speed in Step 13)
    movementSpeedTracker.processFrame(poseData.keyLandmarks, stepProgressRef.current, comparison.accuracy);

    // 2. Feed frame sample into ScoringEngine (for Step 17 scoring)
    const timingAccuracy = comparison.metrics?.timingScore ?? 75;
    // Calculate rhythm accuracy based on music synchronization and speed ratio match
    const speedRatio = movementSpeedTracker.getSpeedRatio();
    const rhythmDeviation = Math.abs(speedRatio - 1.0);
    const rhythmAccuracy = Math.max(0, Math.round(100 - rhythmDeviation * 60));

    scoringEngine.recordSample({
      movementAccuracy: comparison.accuracy,
      timingAccuracy,
      rhythmAccuracy,
    });

    if (comparison.primaryError && (comparison.severity === 'high' || comparison.severity === 'medium')) {
      // Track correction count
      scoringEngine.recordCorrection();
    }

    // 3. Step Matching & Progression:
    // Flowchart Specification: Is Match >= 70%? (Scaled with difficulty if set)
    const PASS_ACCURACY = (typeof window !== 'undefined' && window.fitness?.state?.difficulty)
      ? (60 + 5 * window.fitness.state.difficulty)
      : 70;
    const isMatching = comparison.accuracy >= PASS_ACCURACY && comparison.isMatch !== false;

    // When NO (< 70%): Compare stick man posture with user -> Give instructions to user until pose is correct
    if (currentRoundRef.current === 1 && !isMatching && round1PhaseRef.current === 'user_turn') {
      const now = performance.now();
      if (!userTurnStartTimeRef.current) {
        userTurnStartTimeRef.current = { startTime: now, lastCorrectionTime: 0, lastHintTime: 0 };
      }
      const lastCorrection = userTurnStartTimeRef.current.lastCorrectionTime || 0;

      // Update real-time on-screen posture instruction prompt without render thrashing
      const targetPrompt = comparison.primaryError?.details
        ? `👉 ${comparison.primaryError.details}`
        : `👉 Adjust posture to match stick man (70% match needed)`;
      setCoachPrompt((prev) => (prev !== targetPrompt ? targetPrompt : prev));

      // Provide spoken posture instruction every 3.0 seconds until user gets the pose correct
      if (now - lastCorrection > 3000) {
        userTurnStartTimeRef.current.lastCorrectionTime = now;
        let instructionCue = '';
        if (comparison.primaryError?.details) {
          instructionCue = comparison.primaryError.details;
        } else if (comparison.direction) {
          instructionCue = `Adjust: ${comparison.direction.replace(/_/g, ' ')}.`;
        }
        // If user struggles for > 6 seconds, speak the exact choreography instruction
        const timeInTurn = now - (userTurnStartTimeRef.current.startTime || now);
        if (!instructionCue && timeInTurn > 6000) {
          const lastHint = userTurnStartTimeRef.current.lastHintTime || 0;
          if (now - lastHint > 5000) {
            userTurnStartTimeRef.current.lastHintTime = now;
            const currentStep = steps[currentStepIndexRef.current];
            if (currentStep) {
              instructionCue = `${currentStep.footLeg}. ${currentStep.armsHands}.`;
            }
          }
        }
        if (instructionCue) {
          ttsService.speak(instructionCue, false);
        }
      }
    }

    // When YES (>= 70%): THEN ONLY give celebratory comments like "Good!", "Great!"
    if (isMatching && (currentRoundRef.current !== 1 || round1PhaseRef.current === 'user_turn')) {
      const now = performance.now();
      if (!userHoldStartTimeRef.current) {
        userHoldStartTimeRef.current = now;
      }
      const holdDuration = now - userHoldStartTimeRef.current;
      // 650ms stable hold ensures the entire step posture is genuinely matched
      const requiredHoldTime = currentRoundRef.current === 1 ? 650 : 200;
      const progress = Math.min(1.0, holdDuration / requiredHoldTime);
      const roundedProgress = Math.round(progress * 50) / 50;
      setUserHoldProgress((prev) => (Math.abs(prev - roundedProgress) >= 0.02 || roundedProgress === 1 || roundedProgress === 0 ? roundedProgress : prev));

      if (progress >= 1.0 && !isAdvancingRef.current) {
        masteredStepsCountRef.current += 1;
        userHoldStartTimeRef.current = null;
        setUserHoldProgress(0);

        if (currentRoundRef.current === 1) {
          isAdvancingRef.current = true;
          round1PhaseRef.current = 'step_passed';
          setRound1Phase('step_passed');
          const stepNum = steps[currentStepIndexRef.current]?.stepNumber || (currentStepIndexRef.current + 1);
          
          // Select comment like "Good!" or "Great!"
          const praiseWord = stepNum % 2 === 1 ? 'Good!' : 'Great!';
          setCoachPrompt(`${praiseWord} Step ${stepNum} posture correct!`);
          setPhaseLabel(`${praiseWord.toUpperCase()} Step ${stepNum} Matched`);
          ttsService.speak(praiseWord, true);

          // Display on-screen comment for 1.4s before advancing to next step
          setTimeout(() => {
            isAdvancingRef.current = false;
            advanceToNextStep();
          }, 1400);
        } else {
          ttsService.speak('Great!', true);
          advanceToNextStep();
        }
      }
    } else if (!isMatching && round1PhaseRef.current !== 'step_passed') {
      userHoldStartTimeRef.current = null;
      setUserHoldProgress((prev) => (prev !== 0 ? 0 : prev));
    }
  }, [advanceToNextStep]);

  // Round Switcher
  const selectRound = useCallback((roundNum) => {
    const validRound = Math.max(1, Math.min(3, roundNum));
    setCurrentRound(validRound);
    currentRoundRef.current = validRound;
    setCurrentStepIndex(0);
    currentStepIndexRef.current = 0;
    round1PhaseRef.current = 'demonstrating';
    setRound1Phase('demonstrating');
    setUserHoldProgress(0);
    userHoldStartTimeRef.current = null;
    userTurnStartTimeRef.current = null;
    masteredStepsCountRef.current = 0;
    stepStartTimeRef.current = performance.now();
    elapsedOffsetRef.current = 0;
    setStepProgress(0);
    setIsScoreModalOpen(false);
    setIsPlaying(true);
    applyRoundSettings(validRound);
  }, [applyRoundSettings]);

  const nextRound = useCallback(() => {
    if (currentRound < 3) {
      selectRound(currentRound + 1);
    } else {
      selectRound(1); // loop back or replay
    }
  }, [currentRound, selectRound]);

  const restartRound = useCallback(() => {
    selectRound(currentRound);
  }, [currentRound, selectRound]);

  // Manual Step Controls
  const play = useCallback(() => {
    if (typeof window !== 'undefined' && window.fitness?.state?.paused) return;
    setIsPlaying(true);
    isPlayingRef.current = true;
    stepStartTimeRef.current = performance.now();
    elapsedOffsetRef.current = 0;
    musicController.resume();
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    musicController.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const replayStep = useCallback(() => {
    round1PhaseRef.current = 'demonstrating';
    setRound1Phase('demonstrating');
    stepStartTimeRef.current = performance.now();
    elapsedOffsetRef.current = 0;
    setStepProgress(0);
    setUserHoldProgress(0);
    userHoldStartTimeRef.current = null;
    setIsPlaying(true);
    isPlayingRef.current = true;
    musicController.resume();
    ttsService.speak(`Watch instructor demonstrate: ${currentStep.name}`);
  }, [currentStep.name]);

  const passCurrentStepManually = useCallback(() => {
    advanceToNextStep();
  }, [advanceToNextStep]);

  const selectStep = useCallback((idx) => {
    if (idx >= 0 && idx < steps.length) {
      currentStepIndexRef.current = idx;
      setCurrentStepIndex(idx);
      stepStartTimeRef.current = performance.now();
      elapsedOffsetRef.current = 0;
      setStepProgress(0);
      setUserHoldProgress(0);
      userHoldStartTimeRef.current = null;
      if (currentRoundRef.current === 1) {
        round1PhaseRef.current = 'demonstrating';
        setRound1Phase('demonstrating');
        const targetStep = steps[idx];
        if (targetStep) {
          ttsService.speak(`Step ${targetStep.stepNumber}: ${targetStep.name}. Watch the demo.`);
        }
      }
    }
  }, [steps]);

  return {
    currentRound,
    roundConfig,
    currentStepIndex,
    currentStep,
    allSteps: steps,
    isPlaying,
    round1Phase,
    userHoldProgress,
    currentPose,
    currentPhase,
    phaseLabel,
    coachPrompt,
    stepProgress,
    isScoreModalOpen,
    scoreSummary,
    play,
    pause,
    togglePlay,
    replayStep,
    selectRound,
    nextRound,
    restartRound,
    passCurrentStepManually,
    selectStep,
    processLiveComparison,
    closeScoreModal: () => setIsScoreModalOpen(false),
  };
}

export default useDanceSession;
