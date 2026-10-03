/**
 * TTS.js
 * 
 * Browser Web Speech API Feedback System for AI Dance Trainer.
 * Converts real-time PoseComparison results into natural, constructive audio coaching cues.
 * 
 * Features:
 * - Speech synthesis queue management & cancellation
 * - Smart cooldown throttles (never speaks every frame)
 * - Anti-repetition filters (avoids saying the same sentence over and over)
 * - Meaningful error thresholding (only speaks on medium/high severity)
 * - Praise cues on sustained high accuracy
 * - Mute / Unmute support
 */

import { ERROR_TYPES } from '../dance/PoseComparison.js';

export class TTSService {
  constructor({
    cooldownMs = 2800,           // Minimum time between speech cues
    sameSentenceCooldownMs = 5000, // Cooldown before repeating identical phrase
    praiseCooldownMs = 6500,     // Cooldown between success praise cues
  } = {}) {
    this.cooldownMs = cooldownMs;
    this.sameSentenceCooldownMs = sameSentenceCooldownMs;
    this.praiseCooldownMs = praiseCooldownMs;

    this.lastSpokenTime = 0;
    this.lastSpokenText = '';
    this.lastPraiseTime = 0;
    this.isMuted = false;
    this.mode = 'learning';      // 'learning' | 'practice' | 'minimal'
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    
    // Listeners for UI subscribers (e.g. displaying subtitles on screen)
    this.subscribers = new Set();
    this.currentText = 'Assume the starting rest stance. Keep shoulders relaxed and feet shoulder-width apart.';

    // Cache voice once loaded
    this.preferredVoice = null;
    if (this.isSupported) {
      this.initVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  initVoices() {
    if (!this.isSupported) return;
    const voices = window.speechSynthesis.getVoices();
    // Prefer friendly English voice (Google US English, Samantha, or standard en-US)
    this.preferredVoice =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))) ||
      voices.find((v) => v.lang === 'en-US') ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0] ||
      null;
  }

  /**
   * Subscribe to TTS text updates for on-screen display
   * @param {function(string): void} callback 
   * @returns {function(): void} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.currentText);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(text) {
    this.currentText = text;
    this.subscribers.forEach((cb) => {
      try {
        cb(text);
      } catch (err) {
        console.warn('TTS subscriber error:', err);
      }
    });
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.isSupported) {
      window.speechSynthesis.cancel();
    }
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.isMuted && this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Stop any currently ongoing speech
   */
  stop() {
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Speak a text sentence directly with cooldown checks
   * @param {string} text 
   * @param {boolean} [force=false] 
   */
  speak(text, force = false) {
    if (!text || typeof text !== 'string') return;

    // Update on-screen subtitle regardless of mute state
    this.notifySubscribers(text);

    if (this.isMuted || !this.isSupported) return;

    const now = performance.now();

    if (!force) {
      // General cooldown check
      if (now - this.lastSpokenTime < this.cooldownMs) {
        return;
      }
      // Anti-repetition check for identical sentence
      if (text === this.lastSpokenText && now - this.lastSpokenTime < this.sameSentenceCooldownMs) {
        return;
      }
    }

    if (typeof window !== 'undefined' && window.fitness) {
      if (window.fitness.state?.paused) return;
      this.lastSpokenTime = now;
      this.lastSpokenText = text;
      window.fitness.speak(text);
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel stale queued audio

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }
      utterance.rate = 1.05; // Slightly brisk, upbeat instructor pace
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      this.lastSpokenTime = now;
      this.lastSpokenText = text;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
    }
  }

  setMode(mode) {
    this.mode = mode; // 'learning' | 'practice' | 'minimal'
  }

  /**
   * Evaluate real-time PoseComparison results and generate constructive coach feedback.
   * 
   * @param {object} comparisonResult - Result from PoseComparison.js
   * @param {object} [context={}] - Active step, phase, isPersonDetected
   */
  processComparison(comparisonResult, context = {}) {
    if (!comparisonResult) return;

    const now = performance.now();
    const { accuracy, primaryError, severity } = comparisonResult;

    // If dancer is not tracked, prompt to step into frame
    if (context.isPersonDetected === false) {
      return;
    }

    // In 'minimal' mode (Round 3 Final Performance), do not talk constantly over music
    if (this.mode === 'minimal') {
      // Only speak if severe error and after long cooldown (8s)
      if (severity === 'high' && primaryError && now - this.lastSpokenTime > 8000) {
        const instruction = this.generateInstruction(primaryError);
        if (instruction) {
          this.speak(instruction);
        }
      }
      return;
    }

    // Round 1 Learn Phase Logic: If match < 70%, identify incorrect body part and give correction
    if (context.round === 1) {
      if (context.round1Phase === 'demonstrating' || context.round1Phase === 'step_passed') {
        return;
      }
      if (accuracy < 70) {
        let instruction = '';
        if (primaryError?.details) {
          instruction = primaryError.details;
        } else if (primaryError) {
          instruction = this.generateInstruction(primaryError);
        } else if (accuracy < 55) {
          instruction = 'Look at the stick man and adjust your posture to match.';
        }

        if (instruction) {
          const isSameSentence = instruction === this.lastSpokenText;
          const minCooldown = isSameSentence ? 4000 : 3200;
          if (now - this.lastSpokenTime >= minCooldown) {
            this.speak(instruction);
          }
        }
      }
      // If accuracy >= 70%, useDanceSession directly announces "Good!" and advances
      return;
    }

    // 1. High Accuracy Case ("Perfect!")
    if (accuracy >= 75 && (!primaryError || severity === 'low')) {
      if (now - this.lastPraiseTime > this.praiseCooldownMs && now - this.lastSpokenTime > this.cooldownMs) {
        const praiseList = [
          'Great!',
          'Good form!',
          'Great rhythm!',
          'Good alignment!',
        ];
        const randomPraise = praiseList[Math.floor(Math.random() * praiseList.length)];
        this.lastPraiseTime = now;
        this.speak(randomPraise);
      }
      return;
    }

    // 2. Meaningful Error Case: Only speak if error severity is medium or high
    if (!primaryError || severity === 'none' || severity === 'low') {
      return;
    }

    // Generate instructional sentence
    const instruction = this.generateInstruction(primaryError);
    if (instruction) {
      this.speak(instruction);
    }
  }

  /**
   * Map structured error object into clear beginner-friendly instructions
   * @param {object} errorObj - { errorType, bodyPart, direction, details }
   * @returns {string} Instructional sentence
   */
  generateInstruction(errorObj) {
    if (!errorObj) return '';

    const { errorType, bodyPart, direction, details } = errorObj;

    switch (errorType) {
      case ERROR_TYPES.RIGHT_HAND_TOO_LOW:
        return 'Raise your right hand higher.';

      case ERROR_TYPES.RIGHT_HAND_TOO_HIGH:
        return 'Lower your right hand slightly.';

      case ERROR_TYPES.LEFT_HAND_TOO_LOW:
        return 'Raise your left hand higher.';

      case ERROR_TYPES.LEFT_HAND_TOO_HIGH:
        return 'Lower your left hand slightly.';

      case ERROR_TYPES.ELBOW_ANGLE_INCORRECT:
        if (bodyPart === 'right_elbow') {
          return direction === 'extend_elbow'
            ? 'Extend your right arm more.'
            : 'Bend your right elbow more.';
        }
        return direction === 'extend_elbow'
          ? 'Extend your left arm more.'
          : 'Bend your left elbow more.';

      case ERROR_TYPES.KNEE_NOT_RAISED_ENOUGH:
        if (bodyPart === 'right_knee') {
          return 'Lift your right knee higher.';
        }
        return 'Lift your left knee higher.';

      case ERROR_TYPES.FOOT_WRONG_DIRECTION:
        if (bodyPart === 'right_foot' || direction === 'step_right') {
          return 'Step your right foot outward to the right.';
        }
        return 'Step your left foot outward to the left.';

      case ERROR_TYPES.MOVEMENT_TOO_SLOW:
        return 'Move a little faster.';

      case ERROR_TYPES.MOVEMENT_TOO_FAST:
        return 'Slow down and follow the rhythm.';

      default:
        if (details && typeof details === 'string') return details;
        return '';
    }
  }
}

export const ttsService = new TTSService();
export default ttsService;
