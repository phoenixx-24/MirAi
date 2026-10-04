import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook to manage webcam streams, permissions, and device lifecycle.
 * Handles permission states gracefully, prevents duplicate loop re-starts,
 * and guarantees proper video attachment and track cleanup.
 */
export function useCamera({ onStreamReady, onStreamStopped, defaultMirrored = true } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const onStreamReadyRef = useRef(onStreamReady);
  onStreamReadyRef.current = onStreamReady;
  const onStreamStoppedRef = useRef(onStreamStopped);
  onStreamStoppedRef.current = onStreamStopped;

  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMirrored, setIsMirrored] = useState(defaultMirrored);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('idle');

  // Stop camera and cleanup tracks
  const stopCamera = useCallback(() => {
    const curStream = streamRef.current;
    if (curStream && !(typeof window !== 'undefined' && window.fitness?.getCamera)) {
      curStream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    streamRef.current = null;
    setStream(null);
    setIsStreaming(false);
    setIsLoading(false);

    if (onStreamStoppedRef.current) {
      onStreamStoppedRef.current();
    }
  }, []);

  // Start camera with requested constraints
  const startCamera = useCallback(async (constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    },
    audio: false,
  }) => {
    // If active stream already exists in memory, re-attach to video element immediately
    if (streamRef.current && streamRef.current.active) {
      setIsStreaming(true);
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const unsupportedMsg = 'Webcam access is not supported in this browser environment.';
      setError(unsupportedMsg);
      setPermissionStatus('unsupported');
      return;
    }

    setIsLoading(true);
    setPermissionStatus('prompt');

    try {
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

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsStreaming(true);
      setPermissionStatus('granted');
      setIsLoading(false);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((playErr) => {
          console.warn('Auto-play notice:', playErr);
        });
      }

      if (onStreamReadyRef.current) {
        onStreamReadyRef.current(mediaStream);
      }
    } catch (err) {
      setIsLoading(false);
      setIsStreaming(false);

      let userFriendlyMessage = 'Could not access the camera. Please check permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        userFriendlyMessage = 'Camera permission was denied. Please allow camera access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionStatus('error');
        userFriendlyMessage = 'No camera device found. Please connect a webcam.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setPermissionStatus('error');
        userFriendlyMessage = 'Camera is currently in use by another tab or app.';
      } else {
        setPermissionStatus('error');
        userFriendlyMessage = err.message || userFriendlyMessage;
      }

      setError(userFriendlyMessage);
    }
  }, []);

  const toggleMirror = useCallback(() => {
    setIsMirrored((prev) => !prev);
  }, []);

  // Re-attach video stream if video element re-mounts
  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Start camera once on mount
  useEffect(() => {
    startCamera();
    return () => {
      // Don't stop tracks if using host fitness camera
      if (streamRef.current && !(typeof window !== 'undefined' && window.fitness?.getCamera)) {
        streamRef.current.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
      }
    };
  }, [startCamera]);

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
