import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import HomeScreen from './components/HomeScreen';
import DanceSelectionScreen from './components/DanceSelectionScreen';
import CameraSetupScreen from './components/CameraSetupScreen';
import RestCheckScreen from './components/RestCheckScreen';
import CountdownOverlay from './components/CountdownOverlay';
import PauseModal from './components/PauseModal';
import ErrorScreen from './components/ErrorScreen';
import ErrorBoundary from './components/ErrorBoundary';
import DanceStage from './components/DanceStage';
import CameraView from './components/CameraView';
import PoseOverlay from './components/PoseOverlay';
import ScoreModal from './components/ScoreModal';
import { GameStateProvider, useGameState, GAME_STATES } from './context/GameStateContext';
import { useDanceSession } from './hooks/useDanceSession';
import { useTTS } from './hooks/useTTS';
import { useMusic } from './hooks/useMusic';
import { useCamera } from './hooks/useCamera';
import { comparePoses } from './dance/PoseComparison';
import { REST_POSITION } from './dance/DanceData';
import { KEY_LANDMARK_KEYS } from './services/PoseProcessor';
import { APP_NAME } from './constants';
import './App.css';

// Friendly display labels for tracked joints
const LANDMARK_LABELS = {
  head: 'Head',
  leftShoulder: 'Left Shoulder',
  rightShoulder: 'Right Shoulder',
  leftElbow: 'Left Elbow',
  rightElbow: 'Right Elbow',
  leftWrist: 'Left Hand',
  rightWrist: 'Right Hand',
  leftKnee: 'Left Knee',
  rightKnee: 'Right Knee',
  leftAnkle: 'Left Foot',
  rightAnkle: 'Right Foot',
};

function MainAppContent() {
  const {
    gameState,
    transitionTo,
    activeDanceState,
    pauseGame,
    errorMessage,
    reportError,
  } = useGameState();

  const [streamActive, setStreamActive] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  // Map gameState to session round (1, 2, 3)
  const sessionRound =
    gameState === GAME_STATES.ROUND_2
      ? 2
      : gameState === GAME_STATES.ROUND_3
      ? 3
      : 1;

  const handleRoundComplete = useCallback((completedRound) => {
    if (completedRound === 3) {
      transitionTo(GAME_STATES.RESULT);
    }
  }, [transitionTo]);

  // Dance Session Engine managing 3-Round Progression and Scoring
  const session = useDanceSession({
    initialRound: sessionRound,
    steps: activeDanceState.activeSequence,
    autoStart: gameState === GAME_STATES.ROUND_1 || gameState === GAME_STATES.ROUND_2 || gameState === GAME_STATES.ROUND_3,
    onRoundComplete: handleRoundComplete,
  });

  // Destructure session controls
  const {
    currentRound,
    isPlaying: isSessionPlaying,
    selectRound,
    play: playSession,
    pause: pauseSession,
    togglePlay: toggleSessionPlay,
    processLiveComparison,
  } = session;

  // Sync session round & playback with game state
  useEffect(() => {
    const isDancing =
      gameState === GAME_STATES.ROUND_1 ||
      gameState === GAME_STATES.ROUND_2 ||
      gameState === GAME_STATES.ROUND_3;

    if (isDancing) {
      const targetRound =
        gameState === GAME_STATES.ROUND_1 ? 1 : gameState === GAME_STATES.ROUND_2 ? 2 : 3;

      if (currentRound !== targetRound) {
        selectRound(targetRound);
      } else if (!isSessionPlaying) {
        playSession();
      }
    } else {
      if (isSessionPlaying) {
        pauseSession();
      }
    }
  }, [gameState, currentRound, isSessionPlaying, selectRound, playSession, pauseSession]);

  // Audio Music System with Adaptive Tempo (Step 13)
  const music = useMusic();
  const { play: playMusic, pause: pauseMusic, setAdaptiveMode: setMusicAdaptiveMode } = music;

  // Sync music with active state
  useEffect(() => {
    const isDancing =
      gameState === GAME_STATES.ROUND_1 ||
      gameState === GAME_STATES.ROUND_2 ||
      gameState === GAME_STATES.ROUND_3;

    if (isDancing && isSessionPlaying) {
      playMusic(session.roundConfig.tempoKey);
      setMusicAdaptiveMode(session.roundConfig.adaptiveMode);
    } else {
      pauseMusic();
    }
  }, [
    gameState,
    isSessionPlaying,
    session.roundConfig.tempoKey,
    session.roundConfig.adaptiveMode,
    playMusic,
    pauseMusic,
    setMusicAdaptiveMode,
  ]);

  // TTS Speech Coach
  const {
    currentText: ttsFeedbackText,
    isMuted: isTTSMuted,
    toggleMute: toggleTTSMute,
    processComparison: processTTSComparison,
    setMode: setTTSMode,
  } = useTTS();

  // Mirror Dashboard PostMessage Bridge (AI Fitness Platform Integration)
  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'GAME_READY', game_id: 'dance_trainer' }, '*');
    }

    const handleParentMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'PAUSE_SESSION') {
        pauseGame();
      } else if (data.type === 'STOP_SESSION') {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'GAME_OVER',
            score: session.scoreSummary?.totalScore || 100,
            reps: session.scoreSummary?.perfectPoses || 12,
            duration_sec: 180
          }, '*');
        }
      }
    };
    window.addEventListener('message', handleParentMessage);
    return () => window.removeEventListener('message', handleParentMessage);
  }, [pauseGame, session.scoreSummary]);

  // Send real-time score updates to mirror dashboard
  useEffect(() => {
    if (window.parent && window.parent !== window && session.scoreSummary) {
      window.parent.postMessage({
        type: 'SCORE_UPDATE',
        score: session.scoreSummary.totalScore || 0
      }, '*');
      window.parent.postMessage({
        type: 'REP_UPDATE',
        reps: (session.scoreSummary.perfectPoses || 0) + (session.scoreSummary.goodPoses || 0)
      }, '*');
    }
  }, [session.scoreSummary]);

  useEffect(() => {
    setTTSMode(session.roundConfig.ttsMode);
  }, [session.roundConfig.ttsMode, setTTSMode]);

  // Real-time pose telemetry from PoseOverlay (user camera)
  const [poseData, setPoseData] = useState({
    isPersonDetected: false,
    multiplePeopleDetected: false,
    keyLandmarks: null,
    trackingConfidence: 0,
    fps: 0,
  });

  // Real-time pose comparison with active reference pose
  const comparison = useMemo(() => {
    if (!poseData.isPersonDetected || !poseData.keyLandmarks || !session.currentPose) {
      return null;
    }

    // In Round 1:
    if (session.currentRound === 1) {
      if (session.round1Phase === 'demonstrating') {
        // While stick man demonstrates, evaluate against target pose for observation only (cannot match)
        const targetComp = comparePoses(poseData.keyLandmarks, session.currentStep?.targetPose || session.currentPose, {
          activeStep: session.currentStep,
          stepProgress: 1.0,
        });
        return {
          ...targetComp,
          isMatch: false,
          isDemonstrating: true,
        };
      }
      // During user_turn, strictly compare against choreography target pose
      return comparePoses(poseData.keyLandmarks, session.currentStep?.targetPose || session.currentPose, {
        activeStep: session.currentStep,
        stepProgress: 1.0,
      });
    }

    // In Round 2 & Round 3: continuous reference pose comparison
    return comparePoses(poseData.keyLandmarks, session.currentPose, {
      activeStep: session.currentStep,
      stepProgress: session.stepProgress,
    });
  }, [poseData.isPersonDetected, poseData.keyLandmarks, session.currentPose, session.currentStep, session.stepProgress, session.currentRound, session.round1Phase]);

  // Pose comparison against REST stance for REST_CHECK calibration
  const restCalibrationComparison = useMemo(() => {
    if (!poseData.isPersonDetected || !poseData.keyLandmarks) {
      return null;
    }
    return comparePoses(poseData.keyLandmarks, REST_POSITION.jointCoordinates);
  }, [poseData.isPersonDetected, poseData.keyLandmarks]);

  const lastComparisonTimeRef = useRef(0);
  // Feed comparison into Dance Session (Scoring + Speed ratio + Step completion)
  useEffect(() => {
    if (comparison && poseData.isPersonDetected && (gameState === GAME_STATES.ROUND_1 || gameState === GAME_STATES.ROUND_2 || gameState === GAME_STATES.ROUND_3)) {
      const now = performance.now();
      if (now - lastComparisonTimeRef.current >= 65) {
        lastComparisonTimeRef.current = now;
        processLiveComparison(comparison, poseData);
      }
    }
  }, [comparison, poseData, gameState, processLiveComparison]);

  // Feed comparison into TTS Speech Coach
  useEffect(() => {
    if (comparison && poseData.isPersonDetected && (gameState === GAME_STATES.ROUND_1 || gameState === GAME_STATES.ROUND_2 || gameState === GAME_STATES.ROUND_3)) {
      processTTSComparison(comparison, {
        isPersonDetected: poseData.isPersonDetected,
        activeStep: session.currentStep,
        round: session.currentRound,
        round1Phase: session.round1Phase,
      });
    }
  }, [comparison, poseData.isPersonDetected, session.currentStep, session.currentRound, session.round1Phase, gameState, processTTSComparison]);

  // Handle Spacebar hotkey for Pause / Play during rounds
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT')) {
        e.preventDefault();
        if (gameState === GAME_STATES.PAUSED) {
          toggleSessionPlay();
        } else if (gameState === GAME_STATES.ROUND_1 || gameState === GAME_STATES.ROUND_2 || gameState === GAME_STATES.ROUND_3) {
          pauseGame();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, pauseGame, toggleSessionPlay]);

  // Memoized handlers for Camera Lifecycle
  const handlePoseUpdate = useCallback((data) => {
    setPoseData((prev) => {
      if (
        prev.isPersonDetected === data.isPersonDetected &&
        prev.multiplePeopleDetected === data.multiplePeopleDetected &&
        prev.trackingConfidence === data.trackingConfidence &&
        prev.keyLandmarks === data.keyLandmarks &&
        prev.fps === data.fps
      ) {
        return prev;
      }
      return data;
    });
  }, []);

  const handleStreamReady = useCallback(() => {
    setStreamActive(true);
    setCameraError(null);
  }, []);

  const handleCameraError = useCallback((err) => {
    setCameraError(err);
    reportError(err);
  }, [reportError]);

  const handleStreamStopped = useCallback(() => {
    setStreamActive(false);
    setPoseData({
      isPersonDetected: false,
      multiplePeopleDetected: false,
      keyLandmarks: null,
      trackingConfidence: 0,
      fps: 0,
    });
  }, []);

  const renderOverlayCallback = useCallback(({ videoRef, isStreaming, isMirrored }) => (
    <PoseOverlay
      videoRef={videoRef}
      isStreaming={isStreaming}
      isMirrored={isMirrored}
      showSkeleton={showSkeleton}
      showLandmarks={showLandmarks}
      activeError={comparison?.primaryError || null}
      accuracy={comparison?.accuracy ?? null}
      onPoseUpdate={handlePoseUpdate}
    />
  ), [showSkeleton, showLandmarks, comparison, handlePoseUpdate]);

  const camera = useCamera({
    onStreamReady: handleStreamReady,
    onError: handleCameraError,
    onStreamStopped: handleStreamStopped,
  });

  // Camera Component Instance (shared between Camera Setup and Live Dance Stage)
  const renderCameraView = useCallback((isCompact = false) => (
    <CameraView
      title={isCompact ? 'Dancer Feed (Your Live Camera)' : 'Dancer Stage Camera'}
      camera={camera}
      renderOverlay={renderOverlayCallback}
    />
  ), [camera, renderOverlayCallback]);

  // 1. HOME SCREEN (Single button only)
  if (gameState === GAME_STATES.HOME) {
    return (
      <div className="app-layout">
        <HomeScreen />
      </div>
    );
  }

  // 2. DANCE SELECTION SCREEN (STEP 18)
  if (gameState === GAME_STATES.DANCE_SELECTION) {
    return (
      <div className="app-layout">
        <Header />
        <DanceSelectionScreen />
      </div>
    );
  }

  // 3. ERROR SCREEN (STEP 21)
  if (gameState === GAME_STATES.ERROR) {
    return (
      <div className="app-layout">
        <Header />
        <ErrorScreen
          message={errorMessage || cameraError}
          onRetry={() => transitionTo(GAME_STATES.CAMERA_SETUP)}
        />
      </div>
    );
  }

  // 4. CAMERA SETUP SCREEN (STEP 19)
  if (gameState === GAME_STATES.CAMERA_SETUP) {
    return (
      <div className="app-layout">
        <Header />
        <CameraSetupScreen
          isStreaming={streamActive}
          isPersonDetected={poseData.isPersonDetected}
          trackingConfidence={poseData.trackingConfidence}
          cameraComponent={renderCameraView(false)}
        />
      </div>
    );
  }

  // 5. ACTIVE STAGE ARENA (REST_CHECK, READY, ROUND_1, ROUND_2, ROUND_3, RESULT, PAUSED)
  return (
    <div className="app-layout">
      <Header />

      <main className="main-content">
        {/* Main Stage Arena: Left/Center = Instructor Concert Stage, Right/Side = Dancer Camera */}
        <div className="stage-arena-grid">
          {/* AI Stick Man Concert Stage (Center Focus) */}
          <div className="arena-column instructor-column">
            <DanceStage
              pose={session.currentPose}
              round={session.currentRound}
              roundTitle={session.roundConfig.title}
              round1Phase={session.round1Phase}
              userHoldProgress={session.userHoldProgress}
              stepNumber={String(session.currentStep.stepNumber).padStart(2, '0')}
              totalSteps={session.allSteps.length}
              stepName={session.currentStep.name}
              bpm={music.currentBpm || session.roundConfig.baseBpm}
              targetBpm={music.targetBpm || session.roundConfig.baseBpm}
              userMovementSpeed={music.userMovementSpeed}
              accuracy={comparison ? comparison.accuracy : null}
              ttsFeedback={ttsFeedbackText || session.coachPrompt}
              isPlaying={session.isPlaying}
              phaseLabel={session.phaseLabel}
              stepProgress={session.stepProgress}
              onPlayPause={session.togglePlay}
              onNextStep={() => session.selectStep((session.currentStepIndex + 1) % session.allSteps.length)}
              onPrevStep={() => session.selectStep((session.currentStepIndex - 1 + session.allSteps.length) % session.allSteps.length)}
              onPassStepManually={session.passCurrentStepManually}
              onReplayStep={session.replayStep}
              onSelectRound={(r) => {
                if (r === 1) transitionTo(GAME_STATES.ROUND_1);
                else if (r === 2) transitionTo(GAME_STATES.ROUND_2);
                else if (r === 3) transitionTo(GAME_STATES.ROUND_3);
              }}
              onOpenPause={pauseGame}
              isMuted={isTTSMuted}
              onToggleMute={toggleTTSMute}
              isMusicMuted={music.isMuted}
              onToggleMusicMute={music.toggleMute}
              musicTrackName={music.currentTrack?.name}
            />
          </div>

          {/* Player Live Camera View (Docked on Side) */}
          <div className="arena-column dancer-column">
            {renderCameraView(true)}

            {/* Real-time Pose Telemetry & Error / Diagnostics Card */}
            <div className="card dancer-telemetry-card">
              <div className="telemetry-top-bar">
                <div className="pose-toggles-inline">
                  <button
                    type="button"
                    className={`btn-toggle-sm ${showSkeleton ? 'toggle-active' : ''}`}
                    onClick={() => setShowSkeleton((v) => !v)}
                  >
                    ⚡ Skeleton: {showSkeleton ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    className={`btn-toggle-sm ${showLandmarks ? 'toggle-active' : ''}`}
                    onClick={() => setShowLandmarks((v) => !v)}
                  >
                    🎯 Joints: {showLandmarks ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className={`status-badge-compact ${poseData.isPersonDetected ? 'badge-detected' : 'badge-searching'}`}>
                  {poseData.isPersonDetected
                    ? `🟢 Locked (${poseData.trackingConfidence}%)`
                    : '🟡 Searching for Dancer'}
                </div>
              </div>

              {/* Multiple people detected warning banner (Step 21 requirement) */}
              {poseData.multiplePeopleDetected && (
                <div className="comparison-feedback-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }}>
                  <span className="feedback-text" style={{ color: '#fca5a5' }}>
                    👥 <strong>Multiple dancers detected!</strong> Ensure only 1 person is in frame for accurate scoring.
                  </span>
                </div>
              )}

              {/* Live Pose Comparison Diagnostics Banner */}
              {comparison && (
                <div className={`comparison-feedback-banner severity-${comparison.severity}`}>
                  <div className="feedback-main-row">
                    <span className="feedback-accuracy-pill">
                      {comparison.accuracy}% Match
                    </span>
                    <span className="feedback-text">
                      {session.currentRound === 1 && session.round1Phase === 'demonstrating'
                        ? `👀 Watch Stick Man Demo for Step ${session.currentStep?.stepNumber || 1}... Get ready to copy!`
                        : session.round1Phase === 'step_passed'
                        ? 'GREAT! Position correctly matched!'
                        : session.userHoldProgress > 0
                        ? `Holding posture: ${Math.round(session.userHoldProgress * 100)}% (keep holding!)`
                        : comparison.primaryError
                        ? `⚠️ ${comparison.primaryError.details}`
                        : 'Adjust posture to match stick man'}
                    </span>
                  </div>
                  {comparison.direction && (
                    <div className="correction-hint-pill">
                      👉 Correction: <strong>{comparison.direction.replace('_', ' ')}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Key Landmark Trackers */}
              <div className="compact-landmarks-grid">
                {KEY_LANDMARK_KEYS.map((key) => {
                  const pt = poseData.keyLandmarks?.[key];
                  const isTracked = poseData.isPersonDetected && pt && pt.isValid;
                  return (
                    <div
                      key={key}
                      className={`landmark-pill ${isTracked ? 'pill-tracked' : 'pill-missing'}`}
                    >
                      <span className="dot"></span>
                      <span>{LANDMARK_LABELS[key] || key}</span>
                    </div>
                  );
                })}
              </div>

              {poseData.fps > 0 && (
                <div className="fps-counter-subtle">
                  <span>Tracking Speed: {poseData.fps} FPS</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Overlays synchronized with Game State */}
      {/* 1. REST POSITION CALIBRATION (STEP 19) */}
      {gameState === GAME_STATES.REST_CHECK && (
        <RestCheckScreen
          poseAccuracy={restCalibrationComparison?.accuracy || 0}
          isPersonDetected={poseData.isPersonDetected}
        />
      )}

      {/* 2. 3-2-1 COUNTDOWN OVERLAY (STEP 19) */}
      {gameState === GAME_STATES.READY && <CountdownOverlay />}

      {/* 3. PAUSE OVERLAY (STEP 19) */}
      {gameState === GAME_STATES.PAUSED && <PauseModal />}

      {/* 4. RESULT / SCORE MODAL (STEP 17 & 19) */}
      <ScoreModal
        isOpen={session.isScoreModalOpen || gameState === GAME_STATES.RESULT}
        round={session.currentRound}
        scoreData={session.scoreSummary}
        onNextRound={() => {
          session.closeScoreModal();
          if (session.currentRound === 1) {
            transitionTo(GAME_STATES.READY);
            setTimeout(() => {
              session.selectRound(2);
              transitionTo(GAME_STATES.ROUND_2);
            }, 1500);
          } else if (session.currentRound === 2) {
            transitionTo(GAME_STATES.READY);
            setTimeout(() => {
              session.selectRound(3);
              transitionTo(GAME_STATES.ROUND_3);
            }, 1500);
          } else {
            transitionTo(GAME_STATES.DANCE_SELECTION);
          }
        }}
        onReplayRound={() => {
          session.closeScoreModal();
          session.restartRound();
          if (session.currentRound === 1) {
            transitionTo(GAME_STATES.ROUND_1);
          } else if (session.currentRound === 2) {
            transitionTo(GAME_STATES.ROUND_2);
          } else {
            transitionTo(GAME_STATES.ROUND_3);
          }
        }}
        onClose={() => {
          session.closeScoreModal();
          transitionTo(GAME_STATES.DANCE_SELECTION);
        }}
      />

      <footer className="app-footer">
        {typeof window !== 'undefined' && window.fitness && (
          <button
            type="button"
            id="btn-dance-finish-and-save"
            data-voice-target="finish and save, finish workout, save workout, finish session, finish, save"
            className="btn-primary btn-finish-host"
            style={{ padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600, marginRight: '1rem' }}
            onClick={() => window.fitness?.complete()}
            title="Say 'Finish & save' to complete"
          >
            Finish & save workout
          </button>
        )}
        <p>{APP_NAME} &bull; Concert Stage &bull; 16-Step Choreography &bull; Adaptive Music BPM &bull; React 19</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameStateProvider>
        <MainAppContent />
      </GameStateProvider>
    </ErrorBoundary>
  );
}
