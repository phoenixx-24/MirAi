/**
 * MusicController.js
 * 
 * Independent Music Controller with Adaptive Tempo for AI Dance Trainer.
 * Manages loading, rhythmic looping, tempo switching, volume fading,
 * and real-time movement-speed-adaptive playback rate scaling.
 * 
 * Adaptive Tempo Workflow:
 * Reference movement
 *         ↓
 * Expected movement duration
 *         ↓
 * User movement duration
 *         ↓
 * Calculate speed ratio
 *         ↓
 * Slew-rate-limited smooth tempo adjustment
 *         ↓
 * Web Audio / HTML5 Audio (safe limits & anti-oscillation)
 */

export const TEMPO_TRACKS = {
  slow: {
    id: 'slow',
    name: 'Slow Tempo (Arabic BGM)',
    bpm: 68,
    file: '/music/arabic_bgm.mp3',
    description: 'Slow, relaxed tempo for learning new dance steps and mastering joint positions.',
  },
  medium: {
    id: 'medium',
    name: 'Medium Tempo (Arabic BGM)',
    bpm: 100,
    file: '/music/arabic_bgm.mp3',
    description: 'Moderate steady pace for continuous 16-step practice.',
  },
  target: {
    id: 'target',
    name: 'Target Tempo (Arabic BGM)',
    bpm: 115,
    file: '/music/arabic_bgm.mp3',
    description: 'Authentic dance tempo for the full 16-step choreography and live scoring.',
  },
};

export class MusicControllerEngine {
  constructor() {
    this.currentTempoKey = 'slow';
    this.targetBpm = TEMPO_TRACKS.slow.bpm;
    this.currentBpm = TEMPO_TRACKS.slow.bpm;

    // Adaptive Tempo configuration & states
    this.isAdaptive = true;
    this.adaptiveMode = 'learn';        // 'learn' | 'practice' | 'performance'
    this.userSpeedRatio = 1.0;          // Raw user speed ratio (1.0 = match)
    this.targetPlaybackRate = 1.0;      // Target rate calculated from user speed
    this.currentPlaybackRate = 1.0;     // Current smoothed playback rate
    this.minPlaybackRate = 0.75;        // Safe minimum (e.g. 60 BPM for slow track)
    this.maxPlaybackRate = 1.30;        // Safe maximum (e.g. 162 BPM for target track)
    this.deadbandThreshold = 0.05;      // ±5% match maintains target tempo (prevents jitter)
    this.smoothingRate = 0.04;          // Exponential smoothing step
    this.maxRateChangePerFrame = 0.003; // Slew rate limiter: ~0.18 change per second

    this.audioElements = {};
    this.audioContext = null;
    this.gainNode = null;
    this.isMuted = false;
    this.volume = 0.7; // Default balanced volume
    this.state = 'stopped'; // 'stopped' | 'playing' | 'paused'
    this.subscribers = new Set();
    this.initialized = false;
    this.animationFrameId = null;

    // Start background smoothing loop
    this.startAdaptiveSmoothingLoop();
  }

  /**
   * Base speed ratio for each training round tempo
   */
  getBaseRateForTempo(key) {
    if (key === 'slow') return 0.70;
    if (key === 'medium') return 0.88;
    return 1.0;
  }

  /**
   * Lazy initialize Web Audio API on first user gesture
   */
  initAudio() {
    if (this.initialized) return;

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      this.initialized = true;
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        this.gainNode.connect(this.audioContext.destination);
      }
    } catch (e) {
      console.warn('Web Audio API not available or restricted, using fallback audio element:', e);
    }

    // Preload HTML5 audio elements for the 3 tempo modes
    Object.keys(TEMPO_TRACKS).forEach((key) => {
      const track = TEMPO_TRACKS[key];
      const primarySrc = track.file;
      const audio = new Audio(primarySrc);
      audio.onerror = () => {
        if (!audio.dataset.retried) {
          audio.dataset.retried = '1';
          audio.src = `/games/DanceTrainer${track.file.replace(/^\./, '')}`;
          audio.load();
        } else if (audio.dataset.retried === '1') {
          audio.dataset.retried = '2';
          audio.src = `/music/arabic_bgm.mp3`;
          audio.load();
        }
      };
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = this.volume;
      const baseRate = this.getBaseRateForTempo(key);
      audio.playbackRate = baseRate * this.currentPlaybackRate;
      if ('preservesPitch' in audio) {
        audio.preservesPitch = true;
      }

      if (this.audioContext && this.gainNode) {
        try {
          const source = this.audioContext.createMediaElementSource(audio);
          source.connect(this.gainNode);
        } catch (mediaErr) {
          console.warn(`Direct AudioContext route fallback for ${key}:`, mediaErr);
        }
      }

      this.audioElements[key] = audio;
    });

    this.initialized = true;
  }

  /**
   * Continuous smooth adaptive tempo tick loop
   */
  startAdaptiveSmoothingLoop() {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    let lastBpmEmitted = this.currentBpm;

    const tick = () => {
      if (this.state === 'playing' && this.isAdaptive) {
        const diff = this.targetPlaybackRate - this.currentPlaybackRate;

        if (Math.abs(diff) > 0.001) {
          // Apply slew-rate limiter: smooth gradual change without sudden jumps
          const step = Math.sign(diff) * Math.min(Math.abs(diff) * this.smoothingRate, this.maxRateChangePerFrame);
          this.currentPlaybackRate += step;

          // Apply smoothed playback rate to active audio
          const activeAudio = this.audioElements[this.currentTempoKey];
          if (activeAudio) {
            const baseRate = this.getBaseRateForTempo(this.currentTempoKey);
            activeAudio.playbackRate = baseRate * this.currentPlaybackRate;
          }

          // Calculate current BPM
          this.currentBpm = Math.round(this.targetBpm * this.currentPlaybackRate);

          if (this.currentBpm !== lastBpmEmitted) {
            lastBpmEmitted = this.currentBpm;
            this.notify();
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  /**
   * Feed user movement duration vs expected duration
   * @param {number} expectedDuration - Reference duration in seconds
   * @param {number} actualDuration - User measured duration in seconds
   */
  processMovementDuration(expectedDuration, actualDuration) {
    if (!expectedDuration || !actualDuration || actualDuration <= 0) return;
    const speedRatio = expectedDuration / actualDuration;
    this.updateUserSpeedRatio(speedRatio);
  }

  /**
   * Feed real-time user speed ratio
   * @param {number} speedRatio - e.g. 0.85 (slower), 1.0 (match), 1.15 (faster)
   */
  updateUserSpeedRatio(speedRatio) {
    if (typeof speedRatio !== 'number' || isNaN(speedRatio) || speedRatio <= 0) return;

    this.userSpeedRatio = speedRatio;

    if (!this.isAdaptive) {
      this.targetPlaybackRate = 1.0;
      return;
    }

    // Deadband check: if within ±5% of target tempo, maintain exact target tempo (anti-oscillation)
    if (Math.abs(speedRatio - 1.0) <= this.deadbandThreshold) {
      this.targetPlaybackRate = 1.0;
    } else {
      // Clamp between safe minimum and maximum limits
      this.targetPlaybackRate = Math.max(
        this.minPlaybackRate,
        Math.min(this.maxPlaybackRate, speedRatio)
      );
    }

    this.notify();
  }

  /**
   * Set adaptive mode: 'learn' | 'practice' | 'performance'
   * In 'performance' mode, tempo changes are strictly restrained closer to target tempo.
   */
  setAdaptiveMode(mode) {
    this.adaptiveMode = mode;
    if (mode === 'performance') {
      this.minPlaybackRate = 0.92;
      this.maxPlaybackRate = 1.08;
      this.deadbandThreshold = 0.08;
      this.smoothingRate = 0.025;
    } else {
      this.minPlaybackRate = 0.75;
      this.maxPlaybackRate = 1.30;
      this.deadbandThreshold = 0.05;
      this.smoothingRate = 0.04;
    }
    this.updateUserSpeedRatio(this.userSpeedRatio);
    this.notify();
  }

  /**
   * Toggle adaptive tempo on/off
   */
  setAdaptive(enabled) {
    this.isAdaptive = !!enabled;
    if (!this.isAdaptive) {
      this.targetPlaybackRate = 1.0;
      this.userSpeedRatio = 1.0;
    }
    this.notify();
  }

  /**
   * Subscribe to state / BPM / adaptive metrics changes
   * @param {function(object): void} callback 
   * @returns {function(): void} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getSnapshot());
    return () => this.subscribers.delete(callback);
  }

  getSnapshot() {
    return {
      state: this.state,
      tempoKey: this.currentTempoKey,
      currentBpm: this.currentBpm,
      targetBpm: this.targetBpm,
      userMovementSpeed: Math.round(this.userSpeedRatio * 100),
      userSpeedRatio: this.userSpeedRatio,
      playbackRate: Number(this.currentPlaybackRate.toFixed(2)),
      isAdaptive: this.isAdaptive,
      adaptiveMode: this.adaptiveMode,
      track: TEMPO_TRACKS[this.currentTempoKey],
      isMuted: this.isMuted,
      volume: this.volume,
    };
  }

  notify() {
    const payload = this.getSnapshot();
    this.subscribers.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.warn('Music subscriber error:', err);
      }
    });
  }

  /**
   * Normalize input to a valid tempo key: 'slow' | 'medium' | 'target'
   */
  resolveTempoKey(tempoInput) {
    if (!tempoInput) return 'slow';
    const s = String(tempoInput).toLowerCase();
    if (s.includes('slow') || s.includes('learn') || s === '80') return 'slow';
    if (s.includes('med') || s.includes('practice') || s === '105') return 'medium';
    if (s.includes('targ') || s.includes('final') || s.includes('fast') || s === '125') return 'target';
    return 'slow';
  }

  /**
   * Set active dance tempo
   * @param {'slow'|'medium'|'target'|number} tempoInput 
   */
  setTempo(tempoInput) {
    const newKey = this.resolveTempoKey(tempoInput);
    const wasPlaying = this.state === 'playing';

    if (newKey === this.currentTempoKey && this.state !== 'stopped') {
      return;
    }

    if (wasPlaying) {
      this.stopCurrentTrack();
    }

    this.currentTempoKey = newKey;
    this.targetBpm = TEMPO_TRACKS[newKey].bpm;
    this.currentBpm = Math.round(this.targetBpm * this.currentPlaybackRate);

    if (wasPlaying) {
      this.playTrack(newKey);
    }

    this.notify();
  }

  /**
   * Play music for the dance
   * @param {'slow'|'medium'|'target'} [tempoInput]
   */
  play(tempoInput) {
    this.initAudio();

    // Resume AudioContext if suspended by browser autoplay policy
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (tempoInput) {
      const targetKey = this.resolveTempoKey(tempoInput);
      if (targetKey !== this.currentTempoKey) {
        this.stopCurrentTrack();
        this.currentTempoKey = targetKey;
        this.targetBpm = TEMPO_TRACKS[targetKey].bpm;
        this.currentBpm = Math.round(this.targetBpm * this.currentPlaybackRate);
      }
    }

    this.playTrack(this.currentTempoKey);
    this.state = 'playing';
    this.notify();
  }

  /**
   * Internal helper to start playing track audio
   */
  playTrack(key) {
    const audio = this.audioElements[key];
    if (audio) {
      audio.volume = this.isMuted ? 0 : this.volume;
      const baseRate = this.getBaseRateForTempo(key);
      audio.playbackRate = baseRate * this.currentPlaybackRate;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Playback prevented by browser policy (awaiting user gesture):', err);
        });
      }
    }
  }

  /**
   * Pause music when dance pauses
   */
  pause() {
    const audio = this.audioElements[this.currentTempoKey];
    if (audio && !audio.paused) {
      audio.pause();
    }
    this.state = 'paused';
    this.notify();
  }

  /**
   * Resume paused music
   */
  resume() {
    this.play();
  }

  /**
   * Stop music when dance ends
   */
  stop() {
    this.stopCurrentTrack();
    this.state = 'stopped';
    this.targetPlaybackRate = 1.0;
    this.currentPlaybackRate = 1.0;
    this.userSpeedRatio = 1.0;
    this.currentBpm = this.targetBpm;
    this.notify();
  }

  /**
   * Internal helper to stop and rewind current track
   */
  stopCurrentTrack() {
    const audio = this.audioElements[this.currentTempoKey];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  /**
   * Adjust master music volume (0.0 to 1.0)
   */
  setVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;

    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : clamped, this.audioContext.currentTime);
    }

    Object.values(this.audioElements).forEach((audio) => {
      audio.volume = this.isMuted ? 0 : clamped;
    });

    this.notify();
  }

  /**
   * Toggle music mute
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    this.setVolume(this.volume);
    this.notify();
    return this.isMuted;
  }

  getCurrentBpm() {
    return this.currentBpm;
  }

  getTargetBpm() {
    return this.targetBpm;
  }

  getUserMovementSpeed() {
    return Math.round(this.userSpeedRatio * 100);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.stop();
  }
}

export const musicController = new MusicControllerEngine();
export default musicController;
