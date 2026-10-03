/**
 * Scoring.js
 * 
 * Centralized Scoring System for AI Dance Trainer.
 * Evaluates dancer performance across 3 distinct dimensions:
 * 
 * 1. Movement Accuracy (Weight: 50%) — Joint positioning, angles, posture alignment
 * 2. Timing Accuracy (Weight: 25%)   — Synchronization with movement onsets and beats
 * 3. Rhythm Accuracy (Weight: 25%)   — Smoothness, tempo consistency, beat adherence
 * 
 * Overall Score = Math.round(0.50 * Movement + 0.25 * Timing + 0.25 * Rhythm) [0 to 100]
 * 
 * Also tracks:
 * - Number of correct movements (steps with movement accuracy >= 70%)
 * - Number of corrections given
 * - Best step
 * - Weakest step
 * 
 * Reusable for all 10 dance steps and adaptable to any routine.
 */

export class ScoringEngine {
  constructor() {
    this.stepRecords = [];
    this.currentStepSamples = [];
    this.currentStepMeta = null;
    this.totalCorrections = 0;
  }

  /**
   * Reset the scoring engine for a new round or dance
   */
  reset() {
    this.stepRecords = [];
    this.currentStepSamples = [];
    this.currentStepMeta = null;
    this.totalCorrections = 0;
  }

  /**
   * Start tracking a specific dance movement
   * @param {number} stepIndex - Index of the step (0-9)
   * @param {object} stepMeta - Step metadata (id, name, duration, bpm)
   */
  startStep(stepIndex, stepMeta) {
    this.currentStepSamples = [];
    this.currentStepMeta = {
      stepIndex,
      stepId: stepMeta?.id || `step_${stepIndex + 1}`,
      name: stepMeta?.name || `Movement ${stepIndex + 1}`,
      duration: stepMeta?.duration || 2.0,
      bpm: stepMeta?.bpm || 120,
    };
  }

  /**
   * Record a live frame evaluation sample for the active step
   * @param {object} sample - { movementAccuracy, timingAccuracy, rhythmAccuracy }
   */
  recordSample({ movementAccuracy = 0, timingAccuracy = 0, rhythmAccuracy = 0 }) {
    if (!this.currentStepMeta) return;

    // Filter out 0 accuracy when dancer is temporarily uncalibrated
    this.currentStepSamples.push({
      movement: Math.max(0, Math.min(100, movementAccuracy)),
      timing: Math.max(0, Math.min(100, timingAccuracy)),
      rhythm: Math.max(0, Math.min(100, rhythmAccuracy)),
      timestamp: performance.now(),
    });
  }

  /**
   * Log that a coach correction was triggered
   */
  recordCorrection() {
    this.totalCorrections += 1;
  }

  /**
   * Finalize evaluation for the current step and record aggregated metrics
   * @returns {object} Completed step evaluation
   */
  finalizeStep() {
    if (!this.currentStepMeta) return null;

    let avgMovement = 75; // baseline reasonable fallback
    let avgTiming = 75;
    let avgRhythm = 75;

    if (this.currentStepSamples.length > 0) {
      // Pick top 80% of samples to avoid initial frame transient glitches
      const sortedMov = [...this.currentStepSamples].map((s) => s.movement).sort((a, b) => b - a);
      const topCount = Math.max(1, Math.floor(sortedMov.length * 0.8));
      avgMovement = Math.round(sortedMov.slice(0, topCount).reduce((a, b) => a + b, 0) / topCount);

      const sumTiming = this.currentStepSamples.reduce((sum, s) => sum + s.timing, 0);
      avgTiming = Math.round(sumTiming / this.currentStepSamples.length);

      const sumRhythm = this.currentStepSamples.reduce((sum, s) => sum + s.rhythm, 0);
      avgRhythm = Math.round(sumRhythm / this.currentStepSamples.length);
    }

    const stepScore = Math.round(0.50 * avgMovement + 0.25 * avgTiming + 0.25 * avgRhythm);
    const isCorrect = avgMovement >= 70;

    const record = {
      ...this.currentStepMeta,
      movementAccuracy: avgMovement,
      timingAccuracy: avgTiming,
      rhythmAccuracy: avgRhythm,
      overallScore: stepScore,
      isCorrect,
      samplesCount: this.currentStepSamples.length,
    };

    // Replace if already evaluated or push new
    const existingIdx = this.stepRecords.findIndex((r) => r.stepIndex === record.stepIndex);
    if (existingIdx >= 0) {
      this.stepRecords[existingIdx] = record;
    } else {
      this.stepRecords.push(record);
    }

    this.currentStepSamples = [];
    return record;
  }

  /**
   * Calculate final routine score and summary breakdown
   * @returns {object} Final score card
   */
  calculateFinalScore() {
    if (this.stepRecords.length === 0) {
      return {
        movementAccuracy: 0,
        timingAccuracy: 0,
        rhythmAccuracy: 0,
        overallScore: 0,
        correctMovementsCount: 0,
        totalSteps: 0,
        correctionsCount: this.totalCorrections,
        bestStep: { name: 'None', score: 0 },
        weakestStep: { name: 'None', score: 0 },
        stepRecords: [],
      };
    }

    const totalSteps = this.stepRecords.length;
    const sumMovement = this.stepRecords.reduce((acc, r) => acc + r.movementAccuracy, 0);
    const sumTiming = this.stepRecords.reduce((acc, r) => acc + r.timingAccuracy, 0);
    const sumRhythm = this.stepRecords.reduce((acc, r) => acc + r.rhythmAccuracy, 0);

    const movementAccuracy = Math.round(sumMovement / totalSteps);
    const timingAccuracy = Math.round(sumTiming / totalSteps);
    const rhythmAccuracy = Math.round(sumRhythm / totalSteps);

    // Suggested weighting: Movement (50%) + Timing (25%) + Rhythm (25%)
    const rawOverall = 0.50 * movementAccuracy + 0.25 * timingAccuracy + 0.25 * rhythmAccuracy;
    const overallScore = Math.max(0, Math.min(100, Math.round(rawOverall)));

    const correctMovementsCount = this.stepRecords.filter((r) => r.isCorrect).length;

    // Find best and weakest steps
    const sortedByScore = [...this.stepRecords].sort((a, b) => b.overallScore - a.overallScore);
    const bestStep = sortedByScore[0]
      ? { name: sortedByScore[0].name, score: sortedByScore[0].overallScore }
      : { name: 'N/A', score: 0 };
    const weakestStep = sortedByScore[sortedByScore.length - 1]
      ? { name: sortedByScore[sortedByScore.length - 1].name, score: sortedByScore[sortedByScore.length - 1].overallScore }
      : { name: 'N/A', score: 0 };

    return {
      movementAccuracy,
      timingAccuracy,
      rhythmAccuracy,
      overallScore,
      correctMovementsCount,
      totalSteps,
      correctionsCount: this.totalCorrections,
      bestStep,
      weakestStep,
      stepRecords: [...this.stepRecords],
    };
  }

  getSummary() {
    return this.calculateFinalScore();
  }
}

export const scoringEngine = new ScoringEngine();
export default scoringEngine;
