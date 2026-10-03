import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseDetector } from '../services/PoseDetector';
import { PoseProcessor } from '../services/PoseProcessor';

/**
 * Reusable React Hook for Pose Detection.
 * Bridges video input, MediaPipe PoseLandmarker, and canvas rendering.
 * Keeps all AI logic decoupled from UI presentation.
 */
export function usePoseDetection({
  videoRef,
  isStreaming,
  isMirrored = true,
  showSkeleton = true,
  showLandmarks = true,
  minConfidence = 0.4,
  activeError = null,
  accuracy = null,
} = {}) {
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const activeErrorRef = useRef(activeError);
  const accuracyRef = useRef(accuracy);

  useEffect(() => {
    activeErrorRef.current = activeError;
  }, [activeError]);

  useEffect(() => {
    accuracyRef.current = accuracy;
  }, [accuracy]);

  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [isPersonDetected, setIsPersonDetected] = useState(false);
  const [multiplePeopleDetected, setMultiplePeopleDetected] = useState(false);
  const [fps, setFps] = useState(0);
  const [keyLandmarks, setKeyLandmarks] = useState(null);
  const [trackingConfidence, setTrackingConfidence] = useState(0);

  // Initialize MediaPipe PoseLandmarker once
  useEffect(() => {
    let isMounted = true;

    async function initModel() {
      setIsModelLoading(true);
      setModelError(null);
      try {
        await PoseDetector.initialize();
        if (isMounted) {
          setIsModelReady(true);
          setIsModelLoading(false);
          setModelError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[usePoseDetection] Activating motion fallback:', err);
          PoseDetector.useFallback = true;
          PoseDetector.isReady = true;
          setIsModelReady(true);
          setIsModelLoading(false);
          setModelError(null);
        }
      }
    }

    initModel();

    return () => {
      isMounted = false;
    };
  }, []);

  // Detection and rendering loop
  const processFrame = useCallback(() => {
    const video = videoRef?.current;
    const canvas = canvasRef?.current;

    if (!video || !canvas || !isStreaming || !PoseDetector.isReady) {
      return;
    }

    // Ensure video has received loaded frames
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      // Sync canvas dimensions to match the actual video stream
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const now = performance.now();
      const result = PoseDetector.detect(video, now);

      const ctx = canvas.getContext('2d');
      const landmarksList = result?.landmarks;

      if (landmarksList && landmarksList.length > 0 && landmarksList[0].length > 0) {
        const landmarks = landmarksList[0];
        setIsPersonDetected(true);
        setMultiplePeopleDetected(landmarksList.length > 1);

        // Process landmarks (respecting camera mirror orientation)
        const processed = PoseProcessor.extractKeyLandmarks(landmarks, minConfidence, isMirrored);
        setKeyLandmarks(processed?.points || null);
        setTrackingConfidence(processed?.trackingScore || 0);

        // Draw neon skeleton and key landmarks onto overlay canvas
        PoseProcessor.draw(ctx, landmarks, canvas.width, canvas.height, {
          mirrored: isMirrored,
          showSkeleton,
          showLandmarks,
          minConfidence,
          activeError: activeErrorRef.current,
          accuracy: accuracyRef.current,
        });
      } else {
        // No human detected in this frame
        setIsPersonDetected(false);
        setMultiplePeopleDetected(false);
        setKeyLandmarks(null);
        setTrackingConfidence(0);
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      // Compute FPS every 30 frames
      frameCountRef.current += 1;
      const delta = now - lastTimeRef.current;
      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
    }

    // Schedule next frame
    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [isStreaming, isMirrored, showSkeleton, showLandmarks, minConfidence, videoRef]);

  // Start / stop loop depending on streaming status
  useEffect(() => {
    if (isStreaming && isModelReady) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      // Clear canvas when stream stops
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      setIsPersonDetected(false);
      setMultiplePeopleDetected(false);
      setKeyLandmarks(null);
      setTrackingConfidence(0);
      setFps(0);
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isStreaming, isModelReady, processFrame]);

  return {
    canvasRef,
    isModelLoading,
    isModelReady,
    modelError,
    isPersonDetected,
    multiplePeopleDetected,
    fps,
    keyLandmarks,
    trackingConfidence,
  };
}

export default usePoseDetection;
