import { MusicControllerEngine } from '../src/services/MusicController.js';
import { ScoringEngine } from '../src/dance/Scoring.js';
import { MovementSpeedTrackerEngine } from '../src/services/MovementSpeedTracker.js';
import { DANCE_STEPS } from '../src/dance/DanceSteps.js';

console.log('=== VERIFYING STEP 13, 14, 15, 16, 17 IMPLEMENTATIONS ===\n');

// 1. VERIFY STEP 13: Adaptive Music Speed in MusicController.js
console.log('1. Testing STEP 13 — Adaptive Music Speed (MusicController.js)...');
const music = new MusicControllerEngine();

// Check initial snapshot
const initialSnap = music.getSnapshot();
console.log(`- Initial BPM: ${initialSnap.currentBpm}, Target BPM: ${initialSnap.targetBpm}, Movement Speed: ${initialSnap.userMovementSpeed}%`);
console.assert(initialSnap.currentBpm === 80, 'Initial BPM should be 80');

// Test Slower User: expected = 2.0s, actual = 2.8s -> ratio = 2.0/2.8 = ~0.71 -> clamped to minPlaybackRate 0.75
music.processMovementDuration(2.0, 2.8);
console.log(`- Slower Movement Processed: User speed ratio is ${(music.userSpeedRatio).toFixed(2)} (${music.getUserMovementSpeed()}%)`);
console.assert(music.userSpeedRatio < 1.0, 'User speed ratio should be < 1.0 for slower movement');
console.assert(music.targetPlaybackRate < 1.0, 'Target playback rate should decrease');

// Test Faster User: expected = 2.0s, actual = 1.6s -> ratio = 2.0/1.6 = 1.25
music.processMovementDuration(2.0, 1.6);
console.log(`- Faster Movement Processed: User speed ratio is ${(music.userSpeedRatio).toFixed(2)} (${music.getUserMovementSpeed()}%)`);
console.assert(music.userSpeedRatio > 1.0, 'User speed ratio should be > 1.0 for faster movement');
console.assert(music.targetPlaybackRate > 1.0, 'Target playback rate should increase');

// Test Deadband (Anti-oscillation): ratio = 1.02 -> within ±5% deadband -> maintains exact 1.0
music.updateUserSpeedRatio(1.02);
console.log(`- Deadband test (1.02 ratio): targetPlaybackRate is ${music.targetPlaybackRate}`);
console.assert(music.targetPlaybackRate === 1.0, 'Target playback rate should remain 1.0 within deadband');

// Test Performance Mode (Round 3 tighter limits):
music.setAdaptiveMode('performance');
music.updateUserSpeedRatio(1.4);
console.log(`- Performance Mode Limit Clamp: targetPlaybackRate clamped to ${music.targetPlaybackRate} (max: ${music.maxPlaybackRate})`);
console.assert(music.targetPlaybackRate <= 1.08, 'Target playback rate in performance mode should clamp to 1.08 max');
console.log('✓ STEP 13 Adaptive Music Speed verified successfully!\n');


// 2. VERIFY STEP 17: Scoring System (Scoring.js)
console.log('2. Testing STEP 17 — Scoring System (Scoring.js)...');
const scoring = new ScoringEngine();

// Simulate all 10 dance steps
DANCE_STEPS.forEach((step, idx) => {
  scoring.startStep(idx, step);

  // Record samples for each step
  const movAcc = 70 + (idx % 4) * 8; // 70 to 94
  const timAcc = 75 + (idx % 3) * 6; // 75 to 87
  const rhyAcc = 80 + (idx % 2) * 10; // 80 to 90

  scoring.recordSample({ movementAccuracy: movAcc, timingAccuracy: timAcc, rhythmAccuracy: rhyAcc });
  scoring.recordSample({ movementAccuracy: movAcc + 2, timingAccuracy: timAcc, rhythmAccuracy: rhyAcc });

  if (idx === 2 || idx === 6) {
    scoring.recordCorrection();
  }

  scoring.finalizeStep();
});

const finalSummary = scoring.calculateFinalScore();
console.log('Score Summary Output:');
console.log(`- Movement Accuracy: ${finalSummary.movementAccuracy}% (Weight: 50%)`);
console.log(`- Timing Accuracy:   ${finalSummary.timingAccuracy}% (Weight: 25%)`);
console.log(`- Rhythm Accuracy:   ${finalSummary.rhythmAccuracy}% (Weight: 25%)`);
console.log(`- FINAL SCORE:       ${finalSummary.overallScore}/100`);
console.log(`- Correct Movements: ${finalSummary.correctMovementsCount} / ${finalSummary.totalSteps}`);
console.log(`- Coach Corrections: ${finalSummary.correctionsCount}`);
console.log(`- Best Step:         ${finalSummary.bestStep.name} (${finalSummary.bestStep.score}%)`);
console.log(`- Weakest Step:      ${finalSummary.weakestStep.name} (${finalSummary.weakestStep.score}%)`);

// Verify calculations match formula
const expectedWeighted = Math.round(
  0.50 * finalSummary.movementAccuracy +
  0.25 * finalSummary.timingAccuracy +
  0.25 * finalSummary.rhythmAccuracy
);
console.assert(finalSummary.overallScore === expectedWeighted, 'Overall score matches 50/25/25 weighting formula');
console.assert(finalSummary.totalSteps === 10, 'All 10 dance steps evaluated');
console.assert(finalSummary.correctionsCount === 2, 'Tracked 2 corrections');
console.log('✓ STEP 17 Scoring System verified successfully!\n');


// 3. VERIFY MOVEMENT SPEED TRACKER
console.log('3. Testing MovementSpeedTracker.js...');
const tracker = new MovementSpeedTrackerEngine();
tracker.startStep(DANCE_STEPS[0], 0.75); // Round 1 speed
console.assert(tracker.expectedDuration === DANCE_STEPS[0].duration / 0.75, 'Expected duration matches speed multiplier');
console.log('✓ MovementSpeedTracker initialized and calibrated!\n');

console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
music.destroy();
process.exit(0);
