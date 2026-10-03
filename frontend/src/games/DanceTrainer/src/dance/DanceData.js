/**
 * DanceData.js
 * 
 * Centralized dance data module for AI Dance Trainer.
 * Contains:
 * - REST position specifications
 * - Speed presets (LEARN, PRACTICE, FINAL PERFORMANCE)
 * - Complete 10-step dance routine sequence in exact order
 * - Clean accessors for the upcoming Dance Engine
 */

import { DANCE_STEPS, REST_POSE_COORDINATES } from './DanceSteps.js';

/**
 * 1. REST POSITION
 * The canonical standing rest pose for the stick man and dancer alignment.
 */
export const REST_POSITION = {
  id: 'rest_position',
  name: 'Standard Rest Position',
  description: 'Upright neutral stance with shoulders relaxed, arms hanging naturally, and feet shoulder-width apart.',
  jointCoordinates: { ...REST_POSE_COORDINATES },
  angles: {
    leftElbowAngle: 165,
    rightElbowAngle: 165,
    leftKneeAngle: 175,
    rightKneeAngle: 175,
    torsoAngle: 90,
  },
  acceptableTolerance: 20, // angle degrees tolerance
};

/**
 * 2. SPEED PRESETS
 * Separate configuration data for training tempos.
 */
export const LEARN_SPEED = {
  id: 'learn',
  name: 'Learn Speed',
  bpm: 80,
  speedMultiplier: 0.75,
  description: 'Slow, guided tempo for learning movements with clear visual cues and relaxed timing.',
  cueIntervalMs: 750,
};

export const PRACTICE_SPEED = {
  id: 'practice',
  name: 'Practice Speed',
  bpm: 105,
  speedMultiplier: 1.0,
  description: 'Standard moderate rhythm pace designed to build muscle memory and smooth transitions.',
  cueIntervalMs: 571,
};

export const FINAL_PERFORMANCE_SPEED = {
  id: 'final_performance',
  name: 'Final Performance Speed',
  bpm: 125,
  speedMultiplier: 1.25,
  description: 'Full concert tempo for high-energy execution and real-time rhythmic scoring.',
  cueIntervalMs: 480,
};

export const SPEED_PRESETS = {
  LEARN: LEARN_SPEED,
  PRACTICE: PRACTICE_SPEED,
  FINAL_PERFORMANCE: FINAL_PERFORMANCE_SPEED,
};

/**
 * 3. COMPLETE DANCE SEQUENCE
 * All 16 dance movements organized in strict chronological order with timing offsets.
 */
export const COMPLETE_DANCE_SEQUENCE = DANCE_STEPS.map((step, index) => {
  return {
    sequenceIndex: index,
    stepId: step.id,
    name: step.name,
    duration: step.duration,
    bpm: step.bpm,
    difficulty: step.difficulty,
    movementType: step.movementType,
    bodyParts: step.bodyParts,
    stepData: step,
  };
});

/**
 * 4. DANCE ENGINE ACCESSOR HELPERS
 * Clean, lightweight utility functions for querying dance data programmatically.
 */

/**
 * Retrieve a dance step by its unique ID
 * @param {string} stepId 
 * @returns {object|null}
 */
export function getDanceStepById(stepId) {
  return DANCE_STEPS.find((step) => step.id === stepId) || null;
}

/**
 * Retrieve a dance step by its sequence index (0 to 15)
 * @param {number} index 
 * @returns {object|null}
 */
export function getDanceStepByIndex(index) {
  if (index < 0 || index >= DANCE_STEPS.length) return null;
  return DANCE_STEPS[index];
}

/**
 * Retrieve all 16 dance steps
 * @returns {Array<object>}
 */
export function getAllDanceSteps() {
  return DANCE_STEPS;
}

/**
 * Retrieve the full ordered dance sequence
 * @returns {Array<object>}
 */
export function getCompleteSequence() {
  return COMPLETE_DANCE_SEQUENCE;
}

/**
 * Calculate total routine duration in seconds
 * @param {number} [speedMultiplier=1.0]
 * @returns {number}
 */
export function getTotalDanceDuration(speedMultiplier = 1.0) {
  const baseTotal = DANCE_STEPS.reduce((sum, step) => sum + step.duration, 0);
  return baseTotal / speedMultiplier;
}

/**
 * Get configuration for a specific speed mode
 * @param {'learn'|'practice'|'final_performance'} speedId 
 * @returns {object}
 */
export function getSpeedConfig(speedId) {
  const key = (speedId || '').toUpperCase();
  return SPEED_PRESETS[key] || PRACTICE_SPEED;
}

// Default export combining dance data for streamlined access
const DanceData = {
  REST_POSITION,
  LEARN_SPEED,
  PRACTICE_SPEED,
  FINAL_PERFORMANCE_SPEED,
  SPEED_PRESETS,
  DANCE_STEPS,
  COMPLETE_DANCE_SEQUENCE,
  getDanceStepById,
  getDanceStepByIndex,
  getAllDanceSteps,
  getCompleteSequence,
  getTotalDanceDuration,
  getSpeedConfig,
};

export default DanceData;
