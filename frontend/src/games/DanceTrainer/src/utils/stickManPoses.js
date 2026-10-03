/**
 * Stick Man Pose Definitions & Animation Math
 * Separates pose data and joint definitions from canvas rendering logic.
 */

// Normalized coordinates (0.0 to 1.0) for standard REST pose
export const REST_POSE = {
  head: { x: 0.50, y: 0.20 },
  neck: { x: 0.50, y: 0.28 },
  leftShoulder: { x: 0.42, y: 0.29 },
  rightShoulder: { x: 0.58, y: 0.29 },
  leftElbow: { x: 0.38, y: 0.42 },
  rightElbow: { x: 0.62, y: 0.42 },
  leftHand: { x: 0.35, y: 0.55 },
  rightHand: { x: 0.65, y: 0.55 },
  leftHip: { x: 0.45, y: 0.55 },
  rightHip: { x: 0.55, y: 0.55 },
  leftKnee: { x: 0.44, y: 0.72 },
  rightKnee: { x: 0.56, y: 0.72 },
  leftFoot: { x: 0.43, y: 0.88 },
  rightFoot: { x: 0.57, y: 0.88 },
};

// Line connections between joints
export const STICK_MAN_CONNECTIONS = [
  // Head to neck
  ['head', 'neck'],
  // Shoulders & Chest
  ['neck', 'leftShoulder'],
  ['neck', 'rightShoulder'],
  ['leftShoulder', 'rightShoulder'],
  // Left arm
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftHand'],
  // Right arm
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightHand'],
  // Torso / Spine
  ['neck', 'leftHip'],
  ['neck', 'rightHip'],
  ['leftHip', 'rightHip'],
  // Left leg
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftFoot'],
  // Right leg
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightFoot'],
];

/**
 * Linearly interpolate between two poses
 * (Supports future programmatic animations smoothly)
 */
export function interpolatePose(poseA, poseB, t) {
  const result = {};
  for (const joint in poseA) {
    if (poseB[joint]) {
      result[joint] = {
        x: poseA[joint].x + (poseB[joint].x - poseA[joint].x) * t,
        y: poseA[joint].y + (poseB[joint].y - poseA[joint].y) * t,
      };
    } else {
      result[joint] = { ...poseA[joint] };
    }
  }
  return result;
}
