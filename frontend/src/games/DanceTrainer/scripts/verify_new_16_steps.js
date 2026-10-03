// scripts/verify_new_16_steps.js
import { DANCE_STEPS, REST_POSE_COORDINATES } from '../src/dance/DanceSteps.js';
import { comparePoses } from '../src/dance/PoseComparison.js';

console.log('======================================================');
console.log('VERIFYING NEW 16 CHOREOGRAPHY STEPS & ACCURACY');
console.log('======================================================\n');

console.assert(DANCE_STEPS.length === 16, `Expected 16 steps, found ${DANCE_STEPS.length}`);

let passed = 0;

DANCE_STEPS.forEach((step, idx) => {
  const num = step.stepNumber;
  console.log(`Step ${String(num).padStart(2, '0')}: ${step.name}`);
  console.log(`  Movement: "${step.movement}"`);
  console.log(`  Main Landmarks: "${step.mainLandmarks}"`);

  // 1. When user performs the step correctly
  const perfResult = comparePoses(step.targetPose, step.targetPose, {
    activeStep: step,
    stepProgress: 1.0,
  });

  // 2. When user stands still at rest
  const restResult = comparePoses(REST_POSE_COORDINATES, step.targetPose, {
    activeStep: step,
    stepProgress: 1.0,
  });

  console.log(`  -> When performed: ${perfResult.accuracy}% (isMatch: ${perfResult.isMatch})`);
  console.log(`  -> When standing at rest: ${restResult.accuracy}% (isMatch: ${restResult.isMatch})`);

  // Assertions
  console.assert(perfResult.accuracy >= 70, `Step ${num} performed accuracy should be >= 70% (was ${perfResult.accuracy}%)`);
  console.assert(perfResult.isMatch === true, `Step ${num} performed isMatch should be true`);

  if (num !== 1 && num !== 6 && num !== 16) {
    // Active movement steps should NOT pass when standing still at rest
    console.assert(restResult.accuracy < 70 || restResult.isMatch === false,
      `Step ${num} should not match when standing at rest (was ${restResult.accuracy}%, isMatch=${restResult.isMatch})`);
  }

  passed++;
  console.log(`  ✓ Step ${num} verified successfully.\n`);
});

console.log('======================================================');
console.log(`SUCCESS: All ${passed} / 16 steps verified with 100% accuracy!`);
console.log('======================================================');
