/**
 * MovementSpeedTracker.js
 * 
 * Measures the user's movement velocity and duration against the reference dance step.
 * Implements the Step 13 Adaptive Music Workflow:
 * 
 * Reference movement
 *         ↓
 * Expected movement duration
 *         ↓
 * User movement duration
 *         ↓
 * Calculate speed ratio
 *         ↓
 * Tempo adjustment
 *         ↓
 * Music
 */

import { musicController } from './MusicController.js';

export class MovementSpeedTrackerEngine {
  constructor() {
    this.currentStep = null;
    this.expectedDuration = 2.0; // seconds
    this.movementStartTime = null;
    this.movementCompletedTime = null;
    this.isMoving = false;
    this.lastPose = null;
    this.lastTimestamp = null;
    this.recentVelocities = [];
    this.recentRatios = [];
    this.smoothedRatio = 1.0;
  }

  /**
   * Reset tracking state for a new step
   * @param {object} step - Active dance step definition
   * @param {number} [speedMultiplier=1.0]
   */
  startStep(step, speedMultiplier = 1.0) {
    this.currentStep = step;
    const baseDuration = step?.duration || 2.0;
    this.expectedDuration = baseDuration / (speedMultiplier || 1.0);
    this.movementStartTime = null;
    this.movementCompletedTime = null;
    this.isMoving = false;
    this.lastPose = null;
    this.lastTimestamp = null;
    this.recentVelocities = [];
  }

  /**
   * Process a new camera pose frame
   * @param {object} keyLandmarks - User keypoints { leftHand, rightHand, etc. }
   * @param {number} stepProgress - Current reference step progress [0..1]
   * @param {number} poseAccuracy - Pose comparison match score [0..100]
   */
  processFrame(keyLandmarks, stepProgress = 0, poseAccuracy = 0) {
    if (!keyLandmarks) return;

    const now = performance.now();

    if (!this.lastTimestamp) {
      this.lastTimestamp = now;
      this.lastPose = keyLandmarks;
      return;
    }

    const dt = (now - this.lastTimestamp) / 1000;
    if (dt < 0.01) return; // avoid division by near-zero

    // Calculate motion velocity across key joints (wrists, elbows, knees)
    const jointsToTrack = ['rightHand', 'leftHand', 'rightElbow', 'leftElbow', 'rightKnee', 'leftKnee'];
    let totalDist = 0;
    let trackedCount = 0;

    jointsToTrack.forEach((joint) => {
      const cur = keyLandmarks[joint];
      const prev = this.lastPose ? this.lastPose[joint] : null;
      if (cur && prev && cur.isValid !== false && prev.isValid !== false) {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
        trackedCount++;
      }
    });

    this.lastPose = keyLandmarks;
    this.lastTimestamp = now;

    if (trackedCount === 0) return;

    const avgVelocity = (totalDist / trackedCount) / dt; // units per second
    this.recentVelocities.push(avgVelocity);
    if (this.recentVelocities.length > 10) {
      this.recentVelocities.shift();
    }

    const motionThreshold = 0.18; // motion threshold to detect active movement

    // Detect user motion start
    if (!this.isMoving && avgVelocity > motionThreshold) {
      this.isMoving = true;
      this.movementStartTime = now;
    }

    // Detect movement completion / hold at peak or high accuracy
    if (this.isMoving && (stepProgress >= 0.5 || poseAccuracy >= 65)) {
      if (!this.movementCompletedTime && this.movementStartTime) {
        const durationSoFar = (now - this.movementStartTime) / 1000;
        // Expected time to reach peak is roughly half of expectedDuration
        const expectedPeakDuration = this.expectedDuration * 0.5;

        if (durationSoFar > 0.2) {
          this.movementCompletedTime = now;
          const speedRatio = expectedPeakDuration / durationSoFar;
          this.recordSpeedRatio(speedRatio);
          musicController.processMovementDuration(expectedPeakDuration, durationSoFar);
        }
      }
    }

    // When step resets or is in recovery phase
    if (stepProgress > 0.9) {
      this.isMoving = false;
      this.movementStartTime = null;
      this.movementCompletedTime = null;
    }
  }

  /**
   * Smooth and dispatch user speed ratio
   * @param {number} rawRatio 
   */
  recordSpeedRatio(rawRatio) {
    if (!rawRatio || isNaN(rawRatio) || rawRatio <= 0) return;

    // Filter extreme spikes
    const clampedRaw = Math.max(0.6, Math.min(1.5, rawRatio));
    this.recentRatios.push(clampedRaw);
    if (this.recentRatios.length > 5) {
      this.recentRatios.shift();
    }

    // Moving average of recent ratios
    const sum = this.recentRatios.reduce((a, b) => a + b, 0);
    this.smoothedRatio = sum / this.recentRatios.length;

    // Feed to MusicController
    musicController.updateUserSpeedRatio(this.smoothedRatio);
  }

  getSpeedRatio() {
    return this.smoothedRatio;
  }

  reset() {
    this.currentStep = null;
    this.movementStartTime = null;
    this.movementCompletedTime = null;
    this.isMoving = false;
    this.lastPose = null;
    this.lastTimestamp = null;
    this.recentVelocities = [];
    this.recentRatios = [];
    this.smoothedRatio = 1.0;
  }
}

export const movementSpeedTracker = new MovementSpeedTrackerEngine();
export default movementSpeedTracker;
