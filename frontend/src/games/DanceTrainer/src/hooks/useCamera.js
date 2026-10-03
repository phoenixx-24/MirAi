import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook to manage webcam streams, permissions, and device lifecycle.
 * Handles permission states gracefully and guarantees proper track cleanup.
 */
export function useCamera({ onStreamReady, onStreamStopped, defaultMirrored = true } = {}) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMirrored, setIsMirrored] = useState(defaultMirrored);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('idle'); // 'idle' | 'prompt' | 'granted' | 'denied' | 'error' | 'unsupported'

  // Stop camera and cleanup tracks
  const stopCamera = useCallback(() => {
    if (stream && !(typeof window !== 'undefined' && window.fitness?.getCamera)) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStream(null);
    setIsStreaming(false);
    setIsLoading(false);

    if (onStreamStopped) {
      onStreamStopped();
    }
  }, [stream, onStreamStopped]);

  // Start camera with requested constraints
  const startCamera = useCallback(async (constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    },
    audio: false,
  }) => {
    setError(null);

    // Check if mediaDevices API is supported in browser
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const unsupportedMsg = 'Webcam access is not supported in this browser environment.';
      setError(unsupportedMsg);
      setPermissionStatus('unsupported');
      return;
    }

    setIsLoading(true);
    setPermissionStatus('prompt');

    try {
      // Clean up previous stream if any (never stop tracks if using host fitness camera)
      if (stream && !(typeof window !== 'undefined' && window.fitness?.getCamera)) {
        stream.getTracks().forEach((t) => t.stop());
      }

      let mediaStream = null;
      if (typeof window !== 'undefined' && window.fitness?.getCamera) {
        try {
          mediaStream = await window.fitness.getCamera();
        } catch (camErr) {
          console.warn('fitness.getCamera failed, falling back to getUserMedia:', camErr);
        }
      }

      if (!mediaStream && navigator.mediaDevices?.getUserMedia) {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      if (!mediaStream) {
        throw new Error('Unable to acquire camera video stream.');
      }

      setStream(mediaStream);
      setIsStreaming(true);
      setPermissionStatus('granted');
      setIsLoading(false);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Some mobile/modern browsers require explicit play()
        videoRef.current.play().catch((playErr) => {
          console.warn('Auto-play was prevented by browser policy:', playErr);
        });
      }

      if (onStreamReady) {
        onStreamReady(mediaStream);
      }
    } catch (err) {
      setIsLoading(false);
      setIsStreaming(false);

      let userFriendlyMessage = 'Could not access the camera. Please try again.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        userFriendlyMessage = 'Camera permission was denied. Please allow camera access in your browser settings to continue.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionStatus('error');
        userFriendlyMessage = 'No camera device found. Please connect a webcam and retry.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setPermissionStatus('error');
        userFriendlyMessage = 'Camera is currently in use by another application or tab.';
      } else if (err.name === 'OverconstrainedError') {
        setPermissionStatus('error');
        userFriendlyMessage = 'Requested camera resolution is not supported by your hardware.';
      } else {
        setPermissionStatus('error');
        userFriendlyMessage = err.message || userFriendlyMessage;
      }

      setError(userFriendlyMessage);
    }
  }, [stream, onStreamReady]);

  const toggleMirror = useCallback(() => {
    setIsMirrored((prev) => !prev);
  }, []);

  // Always start camera when mounted
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Cleanup tracks automatically when component unmounts
  useEffect(() => {
    return () => {
      if (stream && !(typeof window !== 'undefined' && window.fitness?.getCamera)) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    videoRef,
    stream,
    isStreaming,
    isLoading,
    isMirrored,
    error,
    permissionStatus,
    startCamera,
    stopCamera,
    toggleMirror,
    clearError: () => setError(null),
  };
}

export default useCamera;
