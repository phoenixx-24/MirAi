/**
 * Reusable PoseProcessor module.
 * Responsible for extracting required dance landmarks, computing confidence,
 * and rendering neon skeleton overlays on an HTML5 canvas.
 */

// MediaPipe 33 landmark indices mapping
export const LANDMARK_INDICES = {
  HEAD: 0,            // Nose / Head center
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

// Required landmarks for dance tracking according to specs
export const KEY_LANDMARK_KEYS = [
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
];

// Skeleton connections (pairs of landmark indices)
export const SKELETON_CONNECTIONS = [
  // Head to shoulders
  [LANDMARK_INDICES.HEAD, LANDMARK_INDICES.LEFT_SHOULDER],
  [LANDMARK_INDICES.HEAD, LANDMARK_INDICES.RIGHT_SHOULDER],
  
  // Upper body
  [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.RIGHT_SHOULDER],
  [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_ELBOW],
  [LANDMARK_INDICES.LEFT_ELBOW, LANDMARK_INDICES.LEFT_WRIST],
  [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW],
  [LANDMARK_INDICES.RIGHT_ELBOW, LANDMARK_INDICES.RIGHT_WRIST],

  // Torso
  [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_HIP],
  [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_HIP],
  [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.RIGHT_HIP],

  // Lower body
  [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.LEFT_KNEE],
  [LANDMARK_INDICES.LEFT_KNEE, LANDMARK_INDICES.LEFT_ANKLE],
  [LANDMARK_INDICES.RIGHT_HIP, LANDMARK_INDICES.RIGHT_KNEE],
  [LANDMARK_INDICES.RIGHT_KNEE, LANDMARK_INDICES.RIGHT_ANKLE],
];

export class PoseProcessorService {
  /**
   * Extract specified landmarks from raw MediaPipe 33-point array
   * @param {Array<{x: number, y: number, z: number, visibility?: number}>} landmarks 
   * @param {number} minConfidence 
   * @returns {object|null}
   */
  extractKeyLandmarks(landmarks, minConfidence = 0.4, mirrored = false) {
    if (!landmarks || landmarks.length === 0) {
      return null;
    }

    const getPoint = (index) => {
      const lm = landmarks[index];
      if (!lm) return null;
      const isVisible = lm.visibility === undefined || lm.visibility >= minConfidence;
      return {
        x: mirrored ? (1 - lm.x) : lm.x,
        y: lm.y,
        z: lm.z || 0,
        visibility: lm.visibility ?? 1,
        isValid: isVisible,
      };
    };

    const keyPoints = {
      head: getPoint(LANDMARK_INDICES.HEAD),
      leftShoulder: getPoint(LANDMARK_INDICES.LEFT_SHOULDER),
      rightShoulder: getPoint(LANDMARK_INDICES.RIGHT_SHOULDER),
      leftElbow: getPoint(LANDMARK_INDICES.LEFT_ELBOW),
      rightElbow: getPoint(LANDMARK_INDICES.RIGHT_ELBOW),
      leftWrist: getPoint(LANDMARK_INDICES.LEFT_WRIST),
      rightWrist: getPoint(LANDMARK_INDICES.RIGHT_WRIST),
      leftHip: getPoint(LANDMARK_INDICES.LEFT_HIP),
      rightHip: getPoint(LANDMARK_INDICES.RIGHT_HIP),
      leftKnee: getPoint(LANDMARK_INDICES.LEFT_KNEE),
      rightKnee: getPoint(LANDMARK_INDICES.RIGHT_KNEE),
      leftAnkle: getPoint(LANDMARK_INDICES.LEFT_ANKLE),
      rightAnkle: getPoint(LANDMARK_INDICES.RIGHT_ANKLE),
    };

    // Calculate tracking confidence
    const validCount = KEY_LANDMARK_KEYS.filter((k) => keyPoints[k]?.isValid).length;
    const trackingScore = Math.round((validCount / KEY_LANDMARK_KEYS.length) * 100);

    return {
      points: keyPoints,
      trackingScore,
      isFullyVisible: validCount >= KEY_LANDMARK_KEYS.length * 0.8,
    };
  }

  /**
   * Draw the skeleton and key landmarks on a 2D canvas context.
   * Supports mirroring and neon styling.
   */
  draw(ctx, landmarks, width, height, options = {}) {
    const {
      mirrored = true,
      showSkeleton = true,
      showLandmarks = true,
      skeletonColor = '#06b6d4',
      jointColor = '#ec4899',
      headColor = '#a855f7',
      minConfidence = 0.35,
      activeError = null,
      accuracy = null,
    } = options;

    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) {
      return;
    }

    const isMatchGood = accuracy !== null && accuracy >= 95;
    const currentSkeletonColor = isMatchGood ? '#10b981' : skeletonColor;

    const transformPoint = (pt) => {
      if (!pt) return null;
      // When mirrored, flip the X coordinate across canvas width
      const x = mirrored ? (1 - pt.x) * width : pt.x * width;
      const y = pt.y * height;
      return { x, y, visibility: pt.visibility ?? 1 };
    };

    // 1. Draw Skeleton Lines
    if (showSkeleton) {
      ctx.save();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];

        if (!p1 || !p2) return;
        if ((p1.visibility ?? 1) < minConfidence || (p2.visibility ?? 1) < minConfidence) return;

        const tp1 = transformPoint(p1);
        const tp2 = transformPoint(p2);

        // Neon glowing effect
        ctx.shadowColor = currentSkeletonColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = currentSkeletonColor;

        ctx.beginPath();
        ctx.moveTo(tp1.x, tp1.y);
        ctx.lineTo(tp2.x, tp2.y);
        ctx.stroke();
      });

      ctx.restore();
    }

    // 2. Draw Landmark Joints with Dynamic Error Highlights
    if (showLandmarks) {
      ctx.save();

      const keyIndices = [
        { idx: LANDMARK_INDICES.HEAD, key: 'head', radius: 8, defaultColor: headColor, label: 'Head' },
        { idx: LANDMARK_INDICES.LEFT_SHOULDER, key: 'left_shoulder', radius: 6, defaultColor: jointColor, label: 'L Shoulder' },
        { idx: LANDMARK_INDICES.RIGHT_SHOULDER, key: 'right_shoulder', radius: 6, defaultColor: jointColor, label: 'R Shoulder' },
        { idx: LANDMARK_INDICES.LEFT_ELBOW, key: 'left_elbow', radius: 6, defaultColor: jointColor, label: 'L Elbow' },
        { idx: LANDMARK_INDICES.RIGHT_ELBOW, key: 'right_elbow', radius: 6, defaultColor: jointColor, label: 'R Elbow' },
        { idx: LANDMARK_INDICES.LEFT_WRIST, key: 'left_hand', radius: 7, defaultColor: '#f59e0b', label: 'L Hand' },
        { idx: LANDMARK_INDICES.RIGHT_WRIST, key: 'right_hand', radius: 7, defaultColor: '#f59e0b', label: 'R Hand' },
        { idx: LANDMARK_INDICES.LEFT_KNEE, key: 'left_knee', radius: 6, defaultColor: jointColor, label: 'L Knee' },
        { idx: LANDMARK_INDICES.RIGHT_KNEE, key: 'right_knee', radius: 6, defaultColor: jointColor, label: 'R Knee' },
        { idx: LANDMARK_INDICES.LEFT_ANKLE, key: 'left_foot', radius: 6, defaultColor: '#10b981', label: 'L Foot' },
        { idx: LANDMARK_INDICES.RIGHT_ANKLE, key: 'right_foot', radius: 6, defaultColor: '#10b981', label: 'R Foot' },
      ];

      keyIndices.forEach(({ idx, key, radius, defaultColor }) => {
        const lm = landmarks[idx];
        if (!lm || (lm.visibility ?? 1) < minConfidence) return;

        const tp = transformPoint(lm);
        const isErrorJoint = activeError && activeError.bodyPart === key;

        let pointColor = defaultColor;
        if (isErrorJoint) {
          pointColor = '#ef4444'; // Glowing red for error point
        } else if (isMatchGood) {
          pointColor = '#10b981'; // Glowing green when form matches
        }

        // Draw pulsing halo if error joint
        if (isErrorJoint) {
          ctx.save();
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 20;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, radius + 7, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();

          // Draw actionable directional pill beside error joint
          let hintText = 'ADJUST';
          if (activeError.direction === 'raise_higher') hintText = 'RAISE';
          else if (activeError.direction === 'lower_hand') hintText = 'LOWER';
          else if (activeError.direction === 'extend_elbow') hintText = 'EXTEND';
          else if (activeError.direction === 'bend_elbow') hintText = 'BEND';
          else if (activeError.direction === 'lift_higher') hintText = 'LIFT';
          else if (activeError.direction === 'step_right') hintText = 'STEP RIGHT';
          else if (activeError.direction === 'step_left') hintText = 'STEP LEFT';

          ctx.save();
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          const textWidth = ctx.measureText(hintText).width;
          const px = tp.x + 12;
          const py = tp.y - 12;

          // Background pill
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.beginPath();
          ctx.roundRect(px - 4, py - 11, textWidth + 8, 16, 4);
          ctx.fill();

          // Text label
          ctx.fillStyle = '#ffffff';
          ctx.fillText(hintText, px, py + 1);
          ctx.restore();
        }

        // Outer glow
        ctx.shadowColor = pointColor;
        ctx.shadowBlur = isErrorJoint ? 20 : 14;

        // Outer circle
        ctx.fillStyle = pointColor;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, isErrorJoint ? radius + 2 : radius, 0, 2 * Math.PI);
        ctx.fill();

        // Inner white core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, radius * 0.45, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.restore();
    }
  }
}

export const PoseProcessor = new PoseProcessorService();
export default PoseProcessor;
