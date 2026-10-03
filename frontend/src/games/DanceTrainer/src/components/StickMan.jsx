import React, { useRef, useEffect } from 'react';
import { REST_POSE } from '../utils/stickManPoses';
import { stickManRenderer } from '../services/StickManRenderer';
import './StickMan.css';

/**
 * StickMan Component
 * Renders the AI Dance Instructor on a concert-style dark stage with spotlight and concert lights.
 * 
 * @param {object} [props.pose=REST_POSE] - Programmatically changeable joint coordinates
 * @param {number} [props.width=480] - Canvas internal width
 * @param {number} [props.height=540] - Canvas internal height
 * @param {string} [props.className=""] - Extra CSS class
 */
export default function StickMan({
  pose = REST_POSE,
  width = 540,
  height = 640,
  className = '',
}) {
  const canvasRef = useRef(null);
  const animIdRef = useRef(null);
  const poseRef = useRef(pose);

  // Keep latest pose in ref for smooth animation loop access
  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Set physical buffer size for high DPI crispness
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let startTime = performance.now();

    const renderLoop = (now) => {
      const elapsed = now - startTime;
      ctx.save();
      // Reset transform before re-applying scale
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Render stage, spotlight, concert lights, bones, and joints
      stickManRenderer.render(ctx, width, height, poseRef.current, elapsed);
      ctx.restore();

      animIdRef.current = requestAnimationFrame(renderLoop);
    };

    animIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, [width, height]);

  return (
    <div className={`stickman-canvas-container ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        className="stickman-canvas"
        aria-label="AI Stick Man Dance Instructor on concert stage"
      />
    </div>
  );
}
