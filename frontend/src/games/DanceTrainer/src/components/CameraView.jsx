import React, { useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import './CameraView.css';

/**
 * Reusable Camera Component for AI Dance Trainer
 * 
 * Props:
 * @param {string} [title="Dancer Webcam Feed"] - Header label
 * @param {function} [onStreamReady] - Callback invoked with MediaStream
 * @param {function} [onStreamStopped] - Callback invoked when stream ends
 * @param {React.ReactNode} [overlay] - Static overlay node
 * @param {function} [renderOverlay] - Render prop `({ videoRef, isStreaming, isMirrored }) => React.ReactNode`
 * @param {boolean} [showFlipControl=true] - Toggle to flip/mirror camera feed
 * @param {object} [camera] - Optional external useCamera instance to lift state up
 */
export default function CameraView({
  title = 'Dancer Webcam Feed',
  onStreamReady,
  onStreamStopped,
  onError,
  overlay,
  renderOverlay,
  showFlipControl = true,
  camera,
}) {
  const internalCamera = useCamera({ onStreamReady, onStreamStopped });
  const activeCamera = camera || internalCamera;

  const {
    videoRef,
    isStreaming,
    isLoading,
    isMirrored,
    error,
    permissionStatus,
    startCamera,
    stopCamera,
    toggleMirror,
    clearError,
  } = activeCamera;

  const [resolutionInfo, setResolutionInfo] = useState(null);

  React.useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // When metadata loads, capture actual video dimensions
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      setResolutionInfo(`${videoWidth} × ${videoHeight}`);
    }
  };

  return (
    <section className="camera-card" aria-label="Webcam feed container">
      {/* Top Bar with Title and Status */}
      <div className="camera-header">
        <div className="camera-title-group">
          <div>
            <h2 className="camera-heading">{title}</h2>
            <span className="camera-subtext">
              {isStreaming ? 'Webcam active and tracking pose' : 'Webcam standby'}
            </span>
          </div>
        </div>

        <div className="camera-header-actions">
          {isStreaming && (
            <div className="live-pill" title="Webcam is actively streaming">
              <span className="live-indicator-dot"></span>
              <span className="live-indicator-text">LIVE</span>
              {resolutionInfo && <span className="resolution-badge">{resolutionInfo}</span>}
            </div>
          )}

          {isStreaming && showFlipControl && (
            <button
              type="button"
              className="btn-pill"
              onClick={toggleMirror}
              title={isMirrored ? 'Disable horizontal mirror' : 'Enable horizontal mirror'}
            >
              {isMirrored ? 'Mirrored' : 'Normal'}
            </button>
          )}
        </div>
      </div>

      {/* Video Viewport Area */}
      <div className="camera-viewport-wrapper">
        <div className={`camera-viewport ${isMirrored ? 'mirrored' : ''}`}>
          {/* Active Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handleLoadedMetadata}
            className={`webcam-video ${isStreaming ? 'visible' : 'hidden'}`}
          />

          {/* Overlay Layer for Pose landmarks, skeleton, canvas */}
          {isStreaming && (renderOverlay || overlay) && (
            <div className="camera-custom-overlay">
              {renderOverlay
                ? renderOverlay({ videoRef, isStreaming, isMirrored })
                : overlay}
            </div>
          )}

          {/* Standby / Off Placeholder State */}
          {!isStreaming && !isLoading && !error && (
            <div className="camera-placeholder">
              <h3 className="placeholder-title">Webcam Inactive</h3>
              <p className="placeholder-description">
                Click <strong>Start Camera</strong> below to begin. Video frames are processed locally in your browser and are never stored or transmitted.
              </p>
              <button
                type="button"
                className="btn-start-camera"
                onClick={() => startCamera()}
              >
                Start Camera
              </button>
            </div>
          )}

          {/* Loading / Requesting Permission State */}
          {isLoading && (
            <div className="camera-loading-state">
              <div className="loading-spinner"></div>
              <h3 className="loading-title">Requesting Camera Access</h3>
              <p className="loading-subtext">Please click <strong>Allow</strong> in your browser prompt...</p>
            </div>
          )}

          {/* Error / Permission Denied State */}
          {error && (
            <div className="camera-error-overlay">
              <h3 className="error-heading">
                {permissionStatus === 'denied' ? 'Camera Permission Required' : 'Camera Unavailable'}
              </h3>
              <p className="error-message">{error}</p>
              <div className="error-actions">
                <button
                  type="button"
                  className="btn-retry"
                  onClick={() => {
                    clearError();
                    startCamera();
                  }}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="btn-dismiss"
                  onClick={clearError}
                >
                  Dismiss
                </button>
              </div>
              {permissionStatus === 'denied' && (
                <div className="permission-guide">
                  <span>Tip: Click the lock or camera icon in your browser address bar to grant access.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Camera Controls Footer */}
      <div className="camera-controls">
        {!isStreaming ? (
          <button
            type="button"
            className="btn-control btn-start"
            disabled={isLoading}
            onClick={() => startCamera()}
          >
            Start Camera
          </button>
        ) : (
          <button
            type="button"
            className="btn-control btn-stop"
            onClick={stopCamera}
          >
            Stop Camera
          </button>
        )}

        <div className="controls-status-hint">
          {isStreaming
            ? 'Webcam active • MediaPipe AI Pose Tracking engaged'
            : 'Webcam offline • Ready to start'}
        </div>
      </div>
    </section>
  );
}
