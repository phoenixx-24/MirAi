/**
 * DanceAnimator.js
 * 
 * Reusable animation engine for the AI Stick-Man Dance Instructor.
 * Implements smooth joint interpolation with easeInOut curves,
 * structured demonstration phases (REST -> Move -> Pause -> Return -> REST),
 * and zero sudden jumps.
 */

import { REST_POSE_COORDINATES, DANCE_STEPS } from './DanceSteps.js';

/**
 * Smooth cubic easing for natural human motion
 * Accelerates gently, moves smoothly, and decelerates softly into pose
 * @param {number} t - Normalized time 0..1
 * @returns {number} Eased value 0..1
 */
export function easeInOutCubic(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Interpolate all joint coordinates between two poses
 * @param {object} poseA - Starting pose
 * @param {object} poseB - Ending pose
 * @param {number} progress - Progress 0..1
 * @returns {object} Interpolated pose
 */
export function interpolatePose(poseA, poseB, progress) {
  const eased = easeInOutCubic(progress);
  const result = {};

  const allJoints = Object.keys(REST_POSE_COORDINATES);
  allJoints.forEach((joint) => {
    const ptA = poseA[joint] || REST_POSE_COORDINATES[joint];
    const ptB = poseB[joint] || REST_POSE_COORDINATES[joint];

    result[joint] = {
      x: ptA.x + (ptB.x - ptA.x) * eased,
      y: ptA.y + (ptB.y - ptA.y) * eased,
    };
  });

  return result;
}

/**
 * Phase timeline definitions for single-motion steps (Steps 1, 2, 4, 5, 6, 7, 8):
 * - REST_START: 0.00 to 0.15 (15% pause at rest)
 * - OUTWARD:    0.15 to 0.45 (30% smooth move from rest to target)
 * - PAUSE_HOLD: 0.45 to 0.65 (20% hold target pose for beginner to study)
 * - RETURN:     0.65 to 0.90 (25% smooth return from target to rest)
 * - REST_END:   0.90 to 1.00 (10% pause at rest before next move)
 */

export class DanceAnimator {
  constructor(danceSteps = DANCE_STEPS) {
    this.steps = danceSteps;
    this.restPose = { ...REST_POSE_COORDINATES };
  }

  /**
   * Calculate interpolated pose, phase metadata, and coach feedback
   * for a specific dance step at normalized progress [0..1]
   * 
   * @param {object|string|number} stepOrId - Step object or step id or index
   * @param {number} progress - Normalized step progress between 0.0 and 1.0
   * @returns {{ pose: object, phase: string, phaseLabel: string, coachPrompt: string }}
   */
  evaluateStep(stepOrId, progress) {
    const step = typeof stepOrId === 'object'
      ? stepOrId
      : (typeof stepOrId === 'number' ? this.steps[stepOrId] : this.steps.find((s) => s.id === stepOrId)) || this.steps[0];

    const p = Math.max(0, Math.min(1, progress));

    // Handle multi-part steps specifically (Move 3, 9, 10)
    if (step.id === 'double_arm_wave') {
      return this._evaluateDoubleArmWave(step, p);
    }
    if (step.id === 'body_bounce_alternating_arms') {
      return this._evaluateBodyBounce(step, p);
    }
    if (step.id === 'four_move_combination') {
      return this._evaluateFourMoveCombo(p);
    }

    // Standard 5-phase motion for Steps 1, 2, 4, 5, 6, 7, 8
    return this._evaluateStandardStep(step, p);
  }

  /**
   * Standard 5-Phase Movement:
   * REST -> Outward -> Pause/Hold -> Return -> REST
   */
  _evaluateStandardStep(step, p) {
    const targetPose = step.targetPose || this.restPose;
    const name = step.name;

    // Phase 1: Initial Rest Stance (0% - 15%)
    if (p < 0.15) {
      return {
        pose: { ...this.restPose },
        phase: 'rest_start',
        phaseLabel: 'Starting Rest Stance',
        coachPrompt: `Get ready in rest position for ${name}.`,
      };
    }

    // Phase 2: Moving Outward to Target (15% - 45%)
    if (p < 0.45) {
      const outwardProgress = (p - 0.15) / 0.30;
      const pose = interpolatePose(this.restPose, targetPose, outwardProgress);
      return {
        pose,
        phase: 'moving_to_target',
        phaseLabel: 'Demonstrating Move',
        coachPrompt: `Watch carefully: ${step.description}`,
      };
    }

    // Phase 3: Pause & Hold Target Pose (45% - 65%)
    if (p < 0.65) {
      return {
        pose: { ...targetPose },
        phase: 'pause_hold',
        phaseLabel: 'Hold Position (Study Pose)',
        coachPrompt: `Hold this stance! Notice the angle and balance.`,
      };
    }

    // Phase 4: Returning to Rest (65% - 90%)
    if (p < 0.90) {
      const returnProgress = (p - 0.65) / 0.25;
      const pose = interpolatePose(targetPose, this.restPose, returnProgress);
      return {
        pose,
        phase: 'returning_to_rest',
        phaseLabel: 'Returning to Rest',
        coachPrompt: `Smoothly lower back to neutral rest position.`,
      };
    }

    // Phase 5: Post-Move Rest (90% - 100%)
    return {
      pose: { ...this.restPose },
      phase: 'rest_end',
      phaseLabel: 'Rest Completed',
      coachPrompt: `Great! Reset and prepare for the next movement.`,
    };
  }

  /**
   * Step 3: Double Arm Wave
   * REST -> Shoulder Level -> Overhead Wave Peak -> Hold -> Return to REST
   */
  _evaluateDoubleArmWave(step, p) {
    const midPose = {
      ...this.restPose,
      leftElbow: { x: 0.35, y: 0.28 },
      rightElbow: { x: 0.65, y: 0.28 },
      leftHand: { x: 0.30, y: 0.28 },
      rightHand: { x: 0.70, y: 0.28 },
    };
    const peakPose = step.targetPose;

    if (p < 0.10) {
      return {
        pose: { ...this.restPose },
        phase: 'rest_start',
        phaseLabel: 'Starting Rest Stance',
        coachPrompt: 'Arms down in rest position.',
      };
    }
    if (p < 0.35) {
      const t = (p - 0.10) / 0.25;
      return {
        pose: interpolatePose(this.restPose, midPose, t),
        phase: 'moving_shoulder',
        phaseLabel: 'Raising Arms to Shoulder Level',
        coachPrompt: 'Smoothly lift both arms up to shoulder height.',
      };
    }
    if (p < 0.60) {
      const t = (p - 0.35) / 0.25;
      return {
        pose: interpolatePose(midPose, peakPose, t),
        phase: 'moving_overhead',
        phaseLabel: 'Wave Upward Overhead',
        coachPrompt: 'Continue both arms upward into an overhead wave.',
      };
    }
    if (p < 0.75) {
      return {
        pose: { ...peakPose },
        phase: 'pause_hold',
        phaseLabel: 'Hold Overhead Wave',
        coachPrompt: 'Hold the high wave with extended arms!',
      };
    }
    if (p < 0.92) {
      const t = (p - 0.75) / 0.17;
      return {
        pose: interpolatePose(peakPose, this.restPose, t),
        phase: 'returning_to_rest',
        phaseLabel: 'Returning Both Arms Down',
        coachPrompt: 'Slowly sweep both arms back down to rest.',
      };
    }
    return {
      pose: { ...this.restPose },
      phase: 'rest_end',
      phaseLabel: 'Rest Completed',
      coachPrompt: 'Reset in neutral rest stance.',
    };
  }

  /**
   * Step 9: Body Bounce + Alternating Arms
   * REST -> Bounce 1 + Right Arm Forward -> Center -> Bounce 2 + Left Arm Forward -> REST
   */
  _evaluateBodyBounce(step, p) {
    const rightForwardPose = step.targetPose;
    const leftForwardPose = {
      ...this.restPose,
      leftKnee: { x: 0.43, y: 0.74 },
      rightKnee: { x: 0.57, y: 0.74 },
      leftElbow: { x: 0.38, y: 0.38 },
      leftHand: { x: 0.35, y: 0.36 },
      rightElbow: { x: 0.62, y: 0.44 },
      rightHand: { x: 0.65, y: 0.52 },
    };

    if (p < 0.08) {
      return {
        pose: { ...this.restPose },
        phase: 'rest_start',
        phaseLabel: 'Starting Rest',
        coachPrompt: 'Stand tall with knees soft.',
      };
    }
    if (p < 0.32) {
      // Right punch forward with knee bounce
      const t = (p - 0.08) / 0.24;
      return {
        pose: interpolatePose(this.restPose, rightForwardPose, t),
        phase: 'bounce_right',
        phaseLabel: 'Bounce Down + Right Arm Forward',
        coachPrompt: 'Bend knees rhythmically and drive the right arm forward.',
      };
    }
    if (p < 0.52) {
      // Return to mid rest
      const t = (p - 0.32) / 0.20;
      return {
        pose: interpolatePose(rightForwardPose, this.restPose, t),
        phase: 'bounce_mid',
        phaseLabel: 'Rebound to Center',
        coachPrompt: 'Rebound slightly as the arm returns.',
      };
    }
    if (p < 0.76) {
      // Left punch forward with knee bounce
      const t = (p - 0.52) / 0.24;
      return {
        pose: interpolatePose(this.restPose, leftForwardPose, t),
        phase: 'bounce_left',
        phaseLabel: 'Bounce Down + Left Arm Forward',
        coachPrompt: 'Now bend knees and drive the opposite left arm forward.',
      };
    }
    if (p < 0.92) {
      // Return to rest
      const t = (p - 0.76) / 0.16;
      return {
        pose: interpolatePose(leftForwardPose, this.restPose, t),
        phase: 'returning_to_rest',
        phaseLabel: 'Returning Upright',
        coachPrompt: 'Straighten legs and return both hands to rest.',
      };
    }
    return {
      pose: { ...this.restPose },
      phase: 'rest_end',
      phaseLabel: 'Rest Completed',
      coachPrompt: 'Rest stance held.',
    };
  }

  /**
   * Step 10: Four-Move Combination
   * Part 1: Step Right + Sweep -> Return
   * Part 2: Step Left + Sweep -> Return
   * Part 3: Right Knee + Left Elbow -> Return
   * Part 4: Left Knee + Right Elbow -> Return
   */
  _evaluateFourMoveCombo(p) {
    const step4 = this.steps[3]; // Step right sweep
    const step5 = this.steps[4]; // Step left sweep
    const step6 = this.steps[5]; // Right knee + left elbow
    const step7 = this.steps[6]; // Left knee + right elbow

    // 4 quarter segments (0.00-0.25, 0.25-0.50, 0.50-0.75, 0.75-1.00)
    let activeSubStep = step4;
    let localP = 0;
    let comboPhaseName = 'Part 1: Right Sweep';

    if (p < 0.25) {
      activeSubStep = step4;
      localP = p / 0.25;
      comboPhaseName = 'Combo 1/4: Step Right + Right Arm Sweep';
    } else if (p < 0.50) {
      activeSubStep = step5;
      localP = (p - 0.25) / 0.25;
      comboPhaseName = 'Combo 2/4: Step Left + Left Arm Sweep';
    } else if (p < 0.75) {
      activeSubStep = step6;
      localP = (p - 0.50) / 0.25;
      comboPhaseName = 'Combo 3/4: Right Knee Lift + Opposite Elbow';
    } else {
      activeSubStep = step7;
      localP = (p - 0.75) / 0.25;
      comboPhaseName = 'Combo 4/4: Left Knee Lift + Opposite Elbow';
    }

    const subEval = this._evaluateStandardStep(activeSubStep, localP);
    return {
      pose: subEval.pose,
      phase: `combo_${activeSubStep.id}`,
      phaseLabel: comboPhaseName,
      coachPrompt: `${comboPhaseName}: ${subEval.coachPrompt}`,
    };
  }
}

export const danceAnimator = new DanceAnimator();
export default danceAnimator;
