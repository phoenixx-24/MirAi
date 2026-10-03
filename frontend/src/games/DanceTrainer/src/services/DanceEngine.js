/**
 * DanceEngine.js
 * 
 * Central Dance Engine for AI Dance Trainer.
 * Manages the repository of the 10 available dances, active dance selection,
 * and loading routine data without duplicating dance logic.
 */

import { DANCE_STEPS, REST_POSE_COORDINATES } from '../dance/DanceSteps.js';

// User-facing normalized dance catalogue formatted for Dance Selection screen
export const DANCE_CATALOGUE = DANCE_STEPS.map((step) => ({
  danceNumber: `Dance ${String(step.stepNumber).padStart(2, '0')}`,
  number: step.stepNumber,
  id: step.id,
  name: step.name,
  displayName: step.displayName || step.name,
  difficulty: step.difficulty === 'hard' ? 'Advanced' : (step.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner'),
  difficultyKey: step.difficulty,
  targetBpm: step.bpm,
  duration: step.duration,
  beats: step.beats,
  description: step.description,
  movementType: step.movementType,
  bodyFocus: step.mainLandmarks,
}));

export const ROUTINE_METADATA = {
  id: 'arabic_kuthu_hook',
  name: 'Arabic Kuthu Hook',
  displayName: 'Arabic Kuthu Hook',
  totalSteps: 16,
  description: 'Iconic 16-step hook groove: wide stance, weight shifts, arm sweeps, chest groove, deep knee drop, and final rhythmic pose.',
};

export class DanceEngine {
  constructor() {
    this.catalogue = DANCE_CATALOGUE;
    this.allSteps = DANCE_STEPS;
    this.activeDanceId = 'all';
    this.activeSequence = [...DANCE_STEPS];
    this.selectedDance = { ...ROUTINE_METADATA };
    this.listeners = new Set();
  }

  /**
   * Retrieve all dance definitions
   */
  getAllDances() {
    return this.catalogue;
  }

  /**
   * Retrieve dance definition by ID or number
   */
  getDanceById(id) {
    if (!id || id === 'all') return null;
    return this.catalogue.find((d) => d.id === id || String(d.number) === String(id)) || null;
  }

  /**
   * Load selected dance or full routine into the engine
   * @param {string|object} danceOrId - Dance object or ID or 'all'
   */
  loadDance(danceOrId) {
    if (!danceOrId || danceOrId === 'all' || danceOrId?.id === 'all') {
      this.activeDanceId = 'all';
      this.selectedDance = { ...ROUTINE_METADATA };
      this.activeSequence = [...this.allSteps];
    } else {
      const id = typeof danceOrId === 'string' ? danceOrId : danceOrId.id;
      const found = this.getDanceById(id);
      const stepData = this.allSteps.find((s) => s.id === id);

      if (found && stepData) {
        this.activeDanceId = id;
        this.selectedDance = found;
        const stepIdx = this.allSteps.findIndex((s) => s.id === id);
        // Routine sequence starting from the selected dance through all 10 movements
        this.activeSequence = [
          ...this.allSteps.slice(stepIdx),
          ...this.allSteps.slice(0, stepIdx),
        ];
      } else {
        // Fallback safely to full routine
        this.activeDanceId = 'all';
        this.selectedDance = null;
        this.activeSequence = [...this.allSteps];
      }
    }

    this.notify();
    return this.getState();
  }

  /**
   * Current engine state
   */
  getState() {
    return {
      activeDanceId: this.activeDanceId,
      selectedDance: this.selectedDance,
      activeSequence: this.activeSequence,
      isFullRoutine: this.activeDanceId === 'all',
      totalSteps: this.activeSequence.length,
      currentStep: this.activeSequence[0] || this.allSteps[0],
      restPose: REST_POSE_COORDINATES,
    };
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.warn('DanceEngine listener error:', err);
      }
    });
  }
}

export const danceEngine = new DanceEngine();
export default danceEngine;
