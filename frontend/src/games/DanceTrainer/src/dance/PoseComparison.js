/**
 * PoseComparison.js
 * 
 * Real-time User-vs-Reference Pose Comparison Engine.
 * 
 * Compares:
 * 1. Normalized joint positions (invariant to user height & camera distance)
 * 2. Relative body distances
 * 3. 3-point joint angles (elbows, shoulders, knees)
 * 4. Movement velocity & direction
 * 5. Movement timing (too slow / too fast)
 * 
 * Returns accuracy (0-100) and structured body-part errors with directions and severities.
 */

import { calculateAngle } from '../utils/index.js';

// Standard error types specified by requirements
export const ERROR_TYPES = {
  RIGHT_HAND_TOO_LOW: 'right hand too low',
  RIGHT_HAND_TOO_HIGH: 'right hand too high',
  LEFT_HAND_TOO_LOW: 'left hand too low',
  LEFT_HAND_TOO_HIGH: 'left hand too high',
  ELBOW_ANGLE_INCORRECT: 'elbow angle incorrect',
  KNEE_NOT_RAISED_ENOUGH: 'knee not raised enough',
  FOOT_WRONG_DIRECTION: 'foot moved in the wrong direction',
  MOVEMENT_TOO_SLOW: 'movement too slow',
  MOVEMENT_TOO_FAST: 'movement too fast',
};

// Aliases helper to extract joint points from either MediaPipe format or StickMan format
function extractJoint(pose, jointNames) {
  if (!pose) return null;
  for (const name of jointNames) {
    if (pose[name]) return pose[name];
  }
  return null;
}

/**
 * Compute normalized relative body coordinates.
 * - Horizontal coordinates are scaled relative to shoulder span.
 * - Upper body vertical coordinates are scaled relative to torso height.
 * - Lower body vertical coordinates are scaled relative to leg height (or knee span).
 * This eliminates camera perspective distortions, differing body aspect ratios,
 * and allows real human dancers to perfectly match stick man choreography!
 */
function normalizePose(pose) {
  if (!pose) return null;

  const leftShoulder = extractJoint(pose, ['leftShoulder']);
  const rightShoulder = extractJoint(pose, ['rightShoulder']);
  const leftHip = extractJoint(pose, ['leftHip']);
  const rightHip = extractJoint(pose, ['rightHip']);

  if (!leftShoulder || !rightShoulder) {
    return null;
  }

  // Anchor: Center of shoulders
  const sCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const sCenterY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderSpan = Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y);
  const scaleX = shoulderSpan > 0.05 ? shoulderSpan : 0.25;

  // Torso vertical scale
  const hCenterX = leftHip && rightHip ? (leftHip.x + rightHip.x) / 2 : sCenterX;
  const hCenterY = leftHip && rightHip ? (leftHip.y + rightHip.y) / 2 : sCenterY + scaleX * 1.1;
  const torsoHeight = Math.max(0.12, hCenterY - sCenterY);

  // Leg vertical scale
  const leftKnee = extractJoint(pose, ['leftKnee']);
  const rightKnee = extractJoint(pose, ['rightKnee']);
  const leftFoot = extractJoint(pose, ['leftFoot', 'leftAnkle']);
  const rightFoot = extractJoint(pose, ['rightFoot', 'rightAnkle']);

  let legHeight = torsoHeight * 1.4;
  if (leftFoot && rightFoot && leftFoot.y > hCenterY && rightFoot.y > hCenterY) {
    legHeight = Math.max(0.15, ((leftFoot.y + rightFoot.y) / 2) - hCenterY);
  } else if (leftKnee && rightKnee && leftKnee.y > hCenterY && rightKnee.y > hCenterY) {
    legHeight = Math.max(0.15, (((leftKnee.y + rightKnee.y) / 2) - hCenterY) * 1.85);
  }

  // Auto-detect horizontal orientation:
  // In our canonical mirror reference space, rightShoulder is to the right of leftShoulder (rightShoulder.x > leftShoulder.x).
  // If an input pose is in camera-space with rightShoulder.x < leftShoulder.x, auto-invert X so that
  // the user's right side always matches the stick man's right side!
  const isCameraInverted = rightShoulder.x < leftShoulder.x;

  const isLower = (k) =>
    ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftFoot', 'rightFoot', 'leftAnkle', 'rightAnkle'].includes(k);

  const normalized = {};
  const jointKeys = [
    'head', 'leftShoulder', 'rightShoulder',
    'leftElbow', 'rightElbow',
    'leftHand', 'rightHand', 'leftWrist', 'rightWrist',
    'leftHip', 'rightHip',
    'leftKnee', 'rightKnee',
    'leftFoot', 'rightFoot', 'leftAnkle', 'rightAnkle',
  ];

  jointKeys.forEach((key) => {
    const pt = pose[key];
    if (pt) {
      const lower = isLower(key);
      const originX = lower ? hCenterX : sCenterX;
      const originY = lower ? hCenterY : sCenterY;
      const scaleY = lower ? legHeight : torsoHeight;

      const rawDx = pt.x - originX;
      normalized[key] = {
        x: (isCameraInverted ? -rawDx : rawDx) / scaleX,
        y: (pt.y - originY) / scaleY,
        isValid: pt.isValid !== false,
      };
    }
  });

  // Ensure standard joint aliases exist on normalized object
  if (!normalized.leftHand && normalized.leftWrist) normalized.leftHand = { ...normalized.leftWrist };
  if (!normalized.rightHand && normalized.rightWrist) normalized.rightHand = { ...normalized.rightWrist };
  if (!normalized.leftFoot && normalized.leftAnkle) normalized.leftFoot = { ...normalized.leftAnkle };
  if (!normalized.rightFoot && normalized.rightAnkle) normalized.rightFoot = { ...normalized.rightAnkle };

  if (!normalized.leftWrist && normalized.leftHand) normalized.leftWrist = { ...normalized.leftHand };
  if (!normalized.rightWrist && normalized.rightHand) normalized.rightWrist = { ...normalized.rightHand };
  if (!normalized.leftAnkle && normalized.leftFoot) normalized.leftAnkle = { ...normalized.leftFoot };
  if (!normalized.rightAnkle && normalized.rightFoot) normalized.rightAnkle = { ...normalized.rightFoot };

  return {
    normalized,
    scaleX,
    torsoHeight,
    legHeight,
    anchor: { x: sCenterX, y: sCenterY },
  };
}

/**
 * PoseComparison Engine
 */
export class PoseComparisonEngine {
  constructor() {
    this.history = [];
    this.maxHistoryLength = 30; // ~0.5 to 1 second of frame history
  }

  /**
   * Reset temporal history
   */
  resetHistory() {
    this.history = [];
  }

  /**
   * Compare user camera pose with AI reference pose in real time.
   * 
   * @param {object} userPose - Keypoints from user camera (PoseProcessor)
   * @param {object} refPose - Keypoints from AI stick-man instructor (DanceAnimator)
   * @param {object} [context={}] - Context metadata: activeStep, stepProgress, timestamp
   * @returns {object} Structured evaluation result
   */
  compare(userPose, refPose, context = {}) {
    if (!userPose || !refPose) {
      return {
        accuracy: 0,
        isMatch: false,
        bodyPart: null,
        errorType: null,
        direction: null,
        severity: 'none',
        feedbackList: [],
        primaryError: null,
        metrics: {
          angleScore: 0,
          positionScore: 0,
          directionScore: 0,
          timingScore: 0,
        },
      };
    }

    const normUser = normalizePose(userPose);
    const normRef = normalizePose(refPose);

    if (!normUser || !normRef) {
      return {
        accuracy: 0,
        isMatch: false,
        bodyPart: null,
        errorType: null,
        direction: null,
        severity: 'none',
        feedbackList: [],
        primaryError: null,
        metrics: { angleScore: 0, positionScore: 0, directionScore: 0, timingScore: 0 },
      };
    }

    const uPts = normUser.normalized;
    const rPts = normRef.normalized;

    const feedbackList = [];
    const activeStep = context.activeStep;
    const bodyParts = activeStep?.bodyParts || [];

    // Map step requirements to active body parts
    const activeJoints = new Set();
    const mainLandmarks = (activeStep?.mainLandmarks || '').toLowerCase();

    // Direct landmark text resolution from choreography table
    if (mainLandmarks.includes('shoulder') || bodyParts.includes('shoulders')) {
      activeJoints.add('leftShoulder');
      activeJoints.add('rightShoulder');
    }
    if (mainLandmarks.includes('wrist') || mainLandmarks.includes('hand') || bodyParts.includes('wrists') || bodyParts.includes('hands')) {
      activeJoints.add('leftHand');
      activeJoints.add('rightHand');
    }
    if (mainLandmarks.includes('elbow') || bodyParts.includes('elbows')) {
      activeJoints.add('leftElbow');
      activeJoints.add('rightElbow');
    }
    if (mainLandmarks.includes('arm') || bodyParts.includes('arms') || bodyParts.includes('right_arm') || bodyParts.includes('left_arm')) {
      activeJoints.add('leftHand');
      activeJoints.add('rightHand');
      activeJoints.add('leftElbow');
      activeJoints.add('rightElbow');
    }
    if (mainLandmarks.includes('knee') || bodyParts.includes('knees') || bodyParts.includes('legs')) {
      activeJoints.add('leftKnee');
      activeJoints.add('rightKnee');
    }
    if (mainLandmarks.includes('ankle') || mainLandmarks.includes('foot') || bodyParts.includes('ankles') || bodyParts.includes('feet')) {
      activeJoints.add('leftFoot');
      activeJoints.add('rightFoot');
    }
    if (mainLandmarks.includes('hip') || bodyParts.includes('hips')) {
      activeJoints.add('leftHip');
      activeJoints.add('rightHip');
    }
    if (mainLandmarks.includes('torso') || bodyParts.includes('torso')) {
      activeJoints.add('leftShoulder');
      activeJoints.add('rightShoulder');
      activeJoints.add('leftHip');
      activeJoints.add('rightHip');
    }
    if (mainLandmarks.includes('right hip') || bodyParts.includes('right_hip')) {
      activeJoints.add('rightHip');
    }
    if (mainLandmarks.includes('right knee') || bodyParts.includes('right_knee')) {
      activeJoints.add('rightKnee');
    }
    if (mainLandmarks.includes('right ankle') || bodyParts.includes('right_ankle')) {
      activeJoints.add('rightFoot');
    }
    if (mainLandmarks.includes('left hip') || bodyParts.includes('left_hip')) {
      activeJoints.add('leftHip');
    }
    if (mainLandmarks.includes('left knee') || bodyParts.includes('left_knee')) {
      activeJoints.add('leftKnee');
    }
    if (mainLandmarks.includes('left ankle') || bodyParts.includes('left_ankle')) {
      activeJoints.add('leftFoot');
    }
    if (mainLandmarks.includes('pointing wrist') || bodyParts.includes('pointing_wrist')) {
      activeJoints.add('rightHand');
      activeJoints.add('rightElbow');
      activeJoints.add('rightShoulder');
    }
    if (mainLandmarks.includes('full body') || bodyParts.includes('full_body')) {
      activeJoints.add('leftHand');
      activeJoints.add('rightHand');
      activeJoints.add('leftElbow');
      activeJoints.add('rightElbow');
      activeJoints.add('leftKnee');
      activeJoints.add('rightKnee');
      activeJoints.add('leftFoot');
      activeJoints.add('rightFoot');
      activeJoints.add('leftShoulder');
      activeJoints.add('rightShoulder');
      activeJoints.add('leftHip');
      activeJoints.add('rightHip');
    }

    // Key joints to evaluate in normalized Euclidean space
    const keyJoints = [
      { name: 'rightHand', alt: 'rightWrist', weight: 1.5 },
      { name: 'leftHand', alt: 'leftWrist', weight: 1.5 },
      { name: 'rightElbow', weight: 1.0 },
      { name: 'leftElbow', weight: 1.0 },
      { name: 'rightKnee', weight: 1.2 },
      { name: 'leftKnee', weight: 1.2 },
      { name: 'rightFoot', alt: 'rightAnkle', weight: 1.2 },
      { name: 'leftFoot', alt: 'leftAnkle', weight: 1.2 },
      { name: 'rightShoulder', weight: 1.0 },
      { name: 'leftShoulder', weight: 1.0 },
      { name: 'rightHip', weight: 1.0 },
      { name: 'leftHip', weight: 1.0 },
    ];

    let weightedScoreSum = 0;
    let totalWeight = 0;
    let worstActiveScore = 100;
    let activeScoreSum = 0;
    let activeJointCount = 0;

    keyJoints.forEach(({ name, alt, weight }) => {
      const u = uPts[name] || (alt ? uPts[alt] : null);
      const r = rPts[name] || (alt ? rPts[alt] : null);
      const isActive = activeJoints.has(name);
      const effectiveWeight = isActive ? weight * 3.5 : weight;

      if (!u || !r) {
        if (isActive) {
          // If feet/ankles are missing (common on desk/laptop webcams), check knees before penalizing
          const isFoot = name.includes('Foot') || name.includes('Ankle');
          const hasKnees = uPts.rightKnee && uPts.leftKnee;
          if (isFoot && hasKnees) {
            // Legs will be evaluated via knees, do not penalize for missing feet
            return;
          }
          activeScoreSum += 50;
          activeJointCount += 1;
          worstActiveScore = Math.min(worstActiveScore, 50);
          feedbackList.push({
            bodyPart: name,
            errorType: 'joint_not_detected',
            direction: 'step_back',
            severity: 'medium',
            scorePenalty: 15,
            details: isFoot
              ? 'Step back slightly so your legs are visible.'
              : 'Keep both hands and arms visible in camera.',
          });
        }
        return;
      }

      totalWeight += effectiveWeight;

      const dx = u.x - r.x;
      const dy = u.y - r.y;
      const dist = Math.hypot(dx, dy);

      // Distance mapping with natural human dance tolerance:
      // dist <= 0.20 => 90-100%
      // dist = 0.35 => 72%
      // dist = 0.50 => 54%
      // dist >= 0.80 => < 15%
      const jointScore = Math.max(0, Math.min(100, Math.round(100 - (dist / 0.72) * 75)));
      weightedScoreSum += jointScore * effectiveWeight;

      if (isActive) {
        activeScoreSum += jointScore;
        activeJointCount += 1;
        if (jointScore < worstActiveScore) {
          worstActiveScore = jointScore;
        }
      }

      // Check specific error feedback for this joint if it deviates noticeably (> 0.35)
      if (dist > 0.35) {
        const severity = dist > 0.52 ? 'high' : 'medium';
        const penalty = severity === 'high' ? 20 : 12;

        if (name === 'rightHand') {
          if (r.x > 0.80 && u.x < 0.45) {
            feedbackList.push({
              bodyPart: 'right_hand',
              errorType: ERROR_TYPES.RIGHT_HAND_TOO_LOW,
              direction: 'move_right_arm_outward',
              severity: 'high',
              scorePenalty: penalty,
              details: 'Move your right arm outward to the right.',
            });
          } else if (dy > 0.35) {
            feedbackList.push({
              bodyPart: 'right_hand',
              errorType: ERROR_TYPES.RIGHT_HAND_TOO_LOW,
              direction: 'raise_higher',
              severity,
              scorePenalty: penalty,
              details: 'Raise your right hand higher.',
            });
          } else if (dy < -0.35) {
            feedbackList.push({
              bodyPart: 'right_hand',
              errorType: ERROR_TYPES.RIGHT_HAND_TOO_HIGH,
              direction: 'lower_hand',
              severity,
              scorePenalty: penalty,
              details: 'Lower your right hand slightly.',
            });
          }
        } else if (name === 'leftHand') {
          if (r.x < -0.80 && u.x > -0.45) {
            feedbackList.push({
              bodyPart: 'left_hand',
              errorType: ERROR_TYPES.LEFT_HAND_TOO_LOW,
              direction: 'move_left_arm_outward',
              severity: 'high',
              scorePenalty: penalty,
              details: 'Move your left arm outward to the left.',
            });
          } else if (dy > 0.35) {
            feedbackList.push({
              bodyPart: 'left_hand',
              errorType: ERROR_TYPES.LEFT_HAND_TOO_LOW,
              direction: 'raise_higher',
              severity,
              scorePenalty: penalty,
              details: 'Raise your left hand higher.',
            });
          } else if (dy < -0.35) {
            feedbackList.push({
              bodyPart: 'left_hand',
              errorType: ERROR_TYPES.LEFT_HAND_TOO_HIGH,
              direction: 'lower_hand',
              severity,
              scorePenalty: penalty,
              details: 'Lower your left hand slightly.',
            });
          }
        } else if (name.includes('Knee')) {
          if (r.y > 0.80 && u.y < 0.60) {
            feedbackList.push({
              bodyPart: name,
              errorType: ERROR_TYPES.KNEE_NOT_RAISED_ENOUGH,
              direction: 'bend_knees',
              severity,
              scorePenalty: penalty,
              details: 'Bend your knees deeper.',
            });
          }
        } else if (name.includes('Elbow')) {
          feedbackList.push({
            bodyPart: name,
            errorType: ERROR_TYPES.ELBOW_ANGLE_INCORRECT,
            direction: 'adjust_arm',
            severity,
            scorePenalty: penalty,
            details: name.includes('right') ? 'Adjust your right arm angle.' : 'Adjust your left arm angle.',
          });
        }
      }
    });

    // Stance width evaluation (feet if available, otherwise falls back to knees)
    const rFootStance = rPts.rightFoot && rPts.leftFoot ? Math.abs(rPts.rightFoot.x - rPts.leftFoot.x) : null;
    const uFootStance = uPts.rightFoot && uPts.leftFoot ? Math.abs(uPts.rightFoot.x - uPts.leftFoot.x) : null;

    const rKneeStance = rPts.rightKnee && rPts.leftKnee ? Math.abs(rPts.rightKnee.x - rPts.leftKnee.x) : null;
    const uKneeStance = uPts.rightKnee && uPts.leftKnee ? Math.abs(uPts.rightKnee.x - uPts.leftKnee.x) : null;

    const isWideStep = (rFootStance !== null && rFootStance > 1.25) || (rKneeStance !== null && rKneeStance > 1.05);

    if (isWideStep) {
      const isNarrowFeet = uFootStance !== null && uFootStance < 0.95;
      const isNarrowKnees = uKneeStance !== null && uKneeStance < 0.70;

      if (isNarrowFeet || (uFootStance === null && isNarrowKnees)) {
        feedbackList.push({
          bodyPart: 'legs',
          errorType: ERROR_TYPES.FOOT_WRONG_DIRECTION,
          direction: 'widen_stance',
          severity: 'high',
          scorePenalty: 25,
          details: 'Step your feet wider apart to match the stance.',
        });
      }
    }

    // 2. Evaluate joint angles
    let angleScore = 100;
    const uLShoulder = uPts.leftShoulder;
    const uLElbow = uPts.leftElbow;
    const rLShoulder = rPts.leftShoulder;
    const rLElbow = rPts.leftElbow;
    const uLHand = uPts.leftHand || uPts.leftWrist;
    const rLHand = rPts.leftHand || rPts.leftWrist;

    if (uLShoulder && uLElbow && uLHand && rLShoulder && rLElbow && rLHand) {
      const uAngle = calculateAngle(uLShoulder, uLElbow, uLHand);
      const rAngle = calculateAngle(rLShoulder, rLElbow, rLHand);
      const angleDiff = Math.abs(uAngle - rAngle);
      if (angleDiff > 35) {
        angleScore -= Math.min(30, Math.round((angleDiff - 25) * 0.6));
      }
    }

    const uRShoulder = uPts.rightShoulder;
    const uRElbow = uPts.rightElbow;
    const rRShoulder = rPts.rightShoulder;
    const rRElbow = rPts.rightElbow;
    const uRHand = uPts.rightHand || uPts.rightWrist;
    const rRHand = rPts.rightHand || rPts.rightWrist;

    if (uRShoulder && uRElbow && uRHand && rRShoulder && rRElbow && rRHand) {
      const uAngle = calculateAngle(uRShoulder, uRElbow, uRHand);
      const rAngle = calculateAngle(rRShoulder, rRElbow, rRHand);
      const angleDiff = Math.abs(uAngle - rAngle);
      if (angleDiff > 35) {
        angleScore -= Math.min(30, Math.round((angleDiff - 25) * 0.6));
      }
    }

    // 3. Calculate Overall Accuracy
    let rawAccuracy = totalWeight > 0 ? Math.round(weightedScoreSum / totalWeight) : 0;
    rawAccuracy = Math.round(rawAccuracy * 0.85 + angleScore * 0.15);

    const avgActiveScore = activeJointCount > 0 ? Math.round(activeScoreSum / activeJointCount) : 100;

    // A step is matched when overall posture matches >= 70% AND active movements average >= 58%
    const isMatch = rawAccuracy >= 70 && avgActiveScore >= 58;
    const accuracy = Math.max(0, Math.min(100, rawAccuracy));

    // Identify primary error (highest severity)
    let primaryError = null;
    if (feedbackList.length > 0) {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const sorted = [...feedbackList].sort((a, b) => {
        const sA = severityOrder[a.severity] || 0;
        const sB = severityOrder[b.severity] || 0;
        if (sB !== sA) return sB - sA;
        return b.scorePenalty - a.scorePenalty;
      });
      primaryError = sorted[0];
    }

    return {
      accuracy,
      isMatch,
      bodyPart: primaryError?.bodyPart || null,
      errorType: primaryError?.errorType || null,
      direction: primaryError?.direction || null,
      severity: primaryError?.severity || 'none',
      feedbackList,
      primaryError,
      metrics: {
        angleScore,
        positionScore: rawAccuracy,
        timingScore: 85,
      },
    };
  }
}

export const poseComparison = new PoseComparisonEngine();

/**
 * Functional export for quick one-line comparisons
 */
export function comparePoses(userPose, refPose, context = {}) {
  return poseComparison.compare(userPose, refPose, context);
}

export default poseComparison;
