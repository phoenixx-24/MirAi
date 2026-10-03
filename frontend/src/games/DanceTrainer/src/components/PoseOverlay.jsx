import React from 'react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import './PoseOverlay.css';

/**
 * Reusable PoseOverlay component.
 * Renders the real-time landmark canvas and tracking indicators.
 */
export default function PoseOverlay({
  videoRef,
  isStreaming,
  isMirrored = true,
  showSkeleton = true,
  showLandmarks = true,
  activeError = null,
  accuracy = null,
  onPoseUpdate,
}) {
  const {
    canvasRef,
    isModelLoading,
    isModelReady,
    modelError,
    isPersonDetected,
    multiplePeopleDetected,
    fps,
    keyLandmarks,
    trackingConfidence,
  } = usePoseDetection({
    videoRef,
    isStreaming,
    isMirrored,
    showSkeleton,
    showLandmarks,
    activeError,
    accuracy,
  });

  // Keep onPoseUpdate callback in ref to prevent effect re-triggering
  const onPoseUpdateRef = React.useRef(onPoseUpdate);
  React.useEffect(() => {
    onPoseUpdateRef.current = onPoseUpdate;
  }, [onPoseUpdate]);

  const lastUpdateRef = React.useRef(0);

  // Notify parent with throttled updates (max 20 FPS) to prevent React render loops
  React.useEffect(() => {
    if (!onPoseUpdateRef.current) return;
    const now = performance.now();
    if (now - lastUpdateRef.current >= 50 || !isPersonDetected) {
      lastUpdateRef.current = now;
      onPoseUpdateRef.current({
        isPersonDetected,
        multiplePeopleDetected,
        keyLandmarks,
        trackingConfidence,
        fps,
      });
    }
  }, [isPersonDetected, multiplePeopleDetected, keyLandmarks, trackingConfidence, fps]);

  if (!isStreaming) {
    return null;
  }

  return (
    <div className="pose-overlay-container">
      {/* 2D Canvas rendering skeleton and landmark dots */}
      <canvas ref={canvasRef} className="pose-canvas" />

      {/* Real-time HUD Status */}
      <div className="pose-hud">
        {isModelLoading && (
          <div className="hud-pill loading-pill">
            <span className="hud-spinner"></span>
            <span>Initializing AI Pose Engine...</span>
          </div>
        )}

        {modelError && !isModelReady && !modelError.includes('undefined') && (
          <div className="hud-pill error-pill">
            <span>Notice: {modelError}</span>
          </div>
        )}

        {isModelReady && (
          <div className="hud-status-row">
            <div className={`hud-pill ${isPersonDetected ? 'detected-pill' : 'searching-pill'}`}>
              <span className={`status-indicator-dot ${isPersonDetected ? 'dot-active' : 'dot-pulsing'}`}></span>
              <span>
                {isPersonDetected ? 'Dancer Positioned' : 'Positioning Dancer...'}
              </span>
              {isPersonDetected && (
                <span className="confidence-tag">{trackingConfidence}% Match</span>
              )}
            </div>

            {fps > 0 && (
              <div className="hud-pill fps-pill">
                <span>{fps} FPS</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guide prompt when stream is live but human isn't detected yet */}
      {isModelReady && !isPersonDetected && (
        <div className="pose-guide-banner">
          <p>Please stand back so your head, arms, and legs are visible in frame</p>
        </div>
      )}

      {/* Warning prompt if multiple dancers detected */}
      {isModelReady && multiplePeopleDetected && (
        <div className="pose-guide-banner banner-warning" style={{ borderColor: '#ef4444', color: '#fca5a5' }}>
          <p>Multiple subjects detected. Please ensure only one person is in frame for accurate scoring.</p>
        </div>
      )}
    </div>
  );
}
