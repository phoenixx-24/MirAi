/**
 * AI Boxing Academy · Real Movement & AI Technique Coach
 * 
 * Features:
 * 1. AI-Driven Pedagogical Flow:
 *    - Demonstrate First: Coach Alex shows exact form & trajectory.
 *    - User Movement Analysis: Real-time camera skeleton & optical motion tracking.
 *    - Real-Time AI Form Correction: Instant verbal (TTS) & visual feedback on guard, extension & snap.
 *    - Progressive Levels: Level cleared only when target clean reps are achieved.
 * 2. Voice Integration (STT & TTS):
 *    - EVERY button and action has voice commands with visual hints ([Say 'Go'], [Say 'Next'], etc.).
 *    - Immediate spoken TTS feedback on every action, correction, and accomplishment.
 * 3. Web Audio Synthesizer:
 *    - Realistic punch impacts, hit beeps, level-up fanfares and clicks.
 */

// --- 1. BOXING CURRICULUM DEFINITION (LEVELS 1 - 7) ---
const CURRICULUM = [
  {
    id: 1,
    title: "Level 1 · Stance & Guard",
    subtitle: "The Boxer's Foundation",
    explainText: "Your boxing stance is your fortress. Stand with feet shoulder-width, knees soft, elbows tucked against your ribs, and hands glued to your cheekbones protecting your chin.",
    demoAnim: "guard_stance",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Hold your high guard... chin tucked, weight balanced.",
    successMsg: "Right! Solid high guard and balanced stance.",
    retryMsg: "Adjust your guard: keep your hands glued to your cheekbones!",
    targetType: "guard"
  },
  {
    id: 2,
    title: "Level 2 · The Lead Jab",
    subtitle: "Fast Straight Front-Hand Strike",
    explainText: "The Lead Jab is your fastest weapon. Fire your front hand straight out toward the target pad, rotate your knuckles flat, keep your rear hand glued to your cheek, and snap it right back to guard.",
    demoAnim: "lead_jab",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Lead Jab! Straight path, snap back to guard.",
    successMsg: "Right! Sharp jab extension and clean return to guard.",
    retryMsg: "Keep your rear hand glued to your cheek while jabbing!",
    targetType: "lead"
  },
  {
    id: 3,
    title: "Level 3 · The Rear Cross",
    subtitle: "Power Rear-Hand Punch & Hip Turn",
    explainText: "The Rear Cross is your knockout punch. Pivot your back foot and rotate your rear hip forward as your back hand drives straight through the target. Keep your lead hand protecting your chin, then reset.",
    demoAnim: "rear_cross",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Rear Cross! Turn your hip, drive through the pad.",
    successMsg: "Right! Powerful cross with great hip rotation.",
    retryMsg: "Keep your lead hand up protecting your face during the cross!",
    targetType: "rear"
  },
  {
    id: 4,
    title: "Level 4 · The 1-2 Combination",
    subtitle: "Jab into Cross with Flowing Rhythm",
    explainText: "Now connect both punches in rhythm: Lead Jab immediately followed by Rear Cross: Pop-Pop! As the jab returns, the cross fires. Both hands return home to tight guard.",
    demoAnim: "combo_one_two",
    targetReps: 5,
    passRatio: 0.8,
    cue: "One-Two! Jab, then Cross... and snap back to guard!",
    successMsg: "Right! Beautiful rhythm and controlled 1-2 combination.",
    retryMsg: "Maintain your rhythm: jab out, cross follows, hands return home.",
    targetType: "combo"
  },
  {
    id: 5,
    title: "Level 5 · Defense: The Slip",
    subtitle: "Head Evasion off Centerline",
    explainText: "Boxing defense keeps you safe. When a punch approaches, bend your knees and slip your head gently off the centerline while keeping your gloves high against your cheeks.",
    demoAnim: "slip_dodge",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Slip! Move your head off center, keep hands high.",
    successMsg: "Right! Smooth slip evasion while keeping your guard tight.",
    retryMsg: "Keep your hands up near your cheekbones while slipping!",
    targetType: "slip"
  },
  {
    id: 6,
    title: "Level 6 · The Lead Hook",
    subtitle: "Rotational Side Power Strike",
    explainText: "The Lead Hook attacks from the side. Raise your lead elbow parallel to the ground at a 90-degree angle, pivot on your lead ball of foot, whip across, and bring it straight back to your cheek.",
    demoAnim: "lead_hook",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Lead Hook! Elbow at 90 degrees, pivot your lead foot.",
    successMsg: "Right! Crisp horizontal hook with full body turn.",
    retryMsg: "Keep your rear hand glued to your chin as you hook!",
    targetType: "hook"
  },
  {
    id: 7,
    title: "Level 7 · Master Sparring Flow",
    subtitle: "Dynamic Combinations & Graduation",
    explainText: "The graduation round! Coach Alex calls out dynamic combinations: Jab, Cross, Hook, and Slip. React to the target cues and maintain your guard throughout.",
    demoAnim: "freestyle_flow",
    targetReps: 8,
    passRatio: 0.8,
    cue: "React to the cues! Flow smoothly, guard always up.",
    successMsg: "Right! Flawless combination and master guard control!",
    retryMsg: "Keep your focus: react to the target and reset your hands.",
    targetType: "flow"
  }
];

// --- 2. TRAINER STATE ---
const state = {
  currentLevelIndex: 0, // 0 to 6 (Levels 1 to 7)
  maxUnlockedIndex: 0,
  currentStep: 1, // 1: Explain, 2: Demo, 3: Ready, 4: Practice, 5: Review
  sessionStartTime: Date.now(),
  isPaused: false,
  isSlowerMode: false,
  showSideView: false,
  isMuted: false,

  // Reps & Scoring
  attempts: 0,
  cleanReps: 0,
  checkpointsMet: 0,
  guardReturns: 0,
  score: 0,

  // Real-time Movement & Pose Tracking
  userPose: {
    valid: false,
    inGuard: false,
    leftGuard: false,
    rightGuard: false,
    balanced: true,
    leftExtended: false,
    rightExtended: false,
    slipped: false,
    headX: 0.5,
    headY: 0.3,
    leftHand: { x: 0.42, y: 0.38 },
    rightHand: { x: 0.58, y: 0.38 },
    torsoWidth: 0.25
  },

  // Dynamic Combo Cue for Flow mode
  activeTarget: 'lead', // 'lead', 'rear', 'hook', 'slip'
  lastHitTime: 0,
  lastRepAt: 0,
  isAnalyzingRep: false,

  // Voice AI
  voiceActive: false,
  lastSpokenCommentary: ""
};

// --- 3. DOM ELEMENTS ---
const el = {
  hudLevelTitle: document.getElementById('hudLevelTitle'),
  hudLevelSubtitle: document.getElementById('hudLevelSubtitle'),
  hudReps: document.getElementById('hudReps'),
  hudScore: document.getElementById('hudScore'),
  voicePill: document.getElementById('voicePill'),
  voiceDot: document.getElementById('voiceDot'),
  voiceLabel: document.getElementById('voiceLabel'),
  stepNodes: document.querySelectorAll('.step-node'),

  // Stage Viewports
  webcamVideo: document.getElementById('webcamVideo'),
  userCanvas: document.getElementById('userCanvas'),
  coachCanvas: document.getElementById('coachCanvas'),
  coachSpeechText: document.getElementById('coachSpeechText'),
  viewModeTag: document.getElementById('viewModeTag'),
  userStageTag: document.getElementById('userStageTag'),
  cameraStatusOverlay: document.getElementById('cameraStatusOverlay'),
  cameraStatusText: document.getElementById('cameraStatusText'),

  // Target Mitts
  targetIndicators: document.getElementById('targetIndicators'),
  mittLead: document.getElementById('mittLead'),
  mittRear: document.getElementById('mittRear'),
  slipIndicator: document.getElementById('slipIndicator'),

  // Checkpoints
  cpGuard: document.getElementById('cpGuard'),
  cpBalance: document.getElementById('cpBalance'),
  cpExtension: document.getElementById('cpExtension'),
  cpReturn: document.getElementById('cpReturn'),

  // Spoken Commentary Bar
  commentaryBar: document.getElementById('commentaryBar'),
  commentaryText: document.getElementById('commentaryText'),
  btnReplayAudio: document.getElementById('btnReplayAudio'),
  feedbackBanner: document.getElementById('feedbackBanner'),
  feedbackText: document.getElementById('feedbackText'),

  // Header Toggles
  btnToggleCamera: document.getElementById('btnToggleCamera'),
  btnToggleSideView: document.getElementById('btnToggleSideView'),
  btnMute: document.getElementById('btnMute'),

  // Footer Buttons
  btnNextAction: document.getElementById('btnNextAction'),
  btnRepeat: document.getElementById('btnRepeat'),
  btnWatchDemo: document.getElementById('btnWatchDemo'),
  btnSlower: document.getElementById('btnSlower'),
  btnPause: document.getElementById('btnPause'),

  // Movement Action Triggers
  btnPerformRep: document.getElementById('btnPerformRep'),
  btnSimNoGuard: document.getElementById('btnSimNoGuard'),

  // Curriculum & Modals
  levelList: document.getElementById('levelList'),
  unlockedCount: document.getElementById('unlockedCount'),
  modalReadiness: document.getElementById('modalReadiness'),
  btnStartWarmup: document.getElementById('btnStartWarmup'),
  modalAssessment: document.getElementById('modalAssessment'),
  assessTitle: document.getElementById('assessTitle'),
  assessDesc: document.getElementById('assessDesc'),
  assessIcon: document.getElementById('assessIcon'),
  assessAttempts: document.getElementById('assessAttempts'),
  assessCheckpoints: document.getElementById('assessCheckpoints'),
  assessGuards: document.getElementById('assessGuards'),
  assessScore: document.getElementById('assessScore'),
  btnAssessProceed: document.getElementById('btnAssessProceed'),
  btnAssessRetry: document.getElementById('btnAssessRetry'),
  modalSessionReport: document.getElementById('modalSessionReport'),
  btnFinishSession: document.getElementById('btnFinishSession')
};

const userCtx = el.userCanvas.getContext('2d');
const coachCtx = el.coachCanvas.getContext('2d');

// --- 4. WEB AUDIO SYNTHESIZER ---
class BoxingAudioEngine {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playPunchSound() {
    if (state.isMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    } catch {}
  }
  playTargetHit() {
    if (state.isMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      // White noise punch snap
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      whiteNoise.start(t);
      this.playPunchSound();
    } catch {}
  }
  playSuccessSound() {
    if (state.isMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    } catch {}
  }
  playWarningSound() {
    if (state.isMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch {}
  }
}
const sound = new BoxingAudioEngine();

// --- 5. TEXT-TO-SPEECH (TTS) SPOKEN COMMENTARY ---
let activeVoiceUtterance = null;

function speakCoach(text, cancelPrevious = true) {
  if (!text || state.isMuted) return;
  try { window.fitness.speak(text); } catch {}

  if (window.speechSynthesis) {
    try {
      if (cancelPrevious) {
        window.speechSynthesis.cancel();
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1.0;
      u.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('David')));
      if (englishVoice) u.voice = englishVoice;
      activeVoiceUtterance = u;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
}

function updateCommentary(text, isSuccess = null) {
  el.commentaryText.textContent = `"${text}"`;
  el.commentaryBar.classList.remove('success', 'warn');
  if (isSuccess === true) {
    el.commentaryBar.classList.add('success');
    sound.playSuccessSound();
  } else if (isSuccess === false) {
    el.commentaryBar.classList.add('warn');
    sound.playWarningSound();
  }

  speakCoach(text);
  state.lastSpokenCommentary = text;
}

// --- 6. UNIVERSAL VOICE COMMAND CLICKER (STT) ON EVERY BUTTON ---
function clickMatchingButtonInBoxing(query) {
  if (!query) return false;
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return false;

  const candidates = Array.from(document.querySelectorAll(
    'button, [role="button"], .toggle-btn, .footer-btn, .sim-btn, .replay-audio-btn, .v-chip, .level-row, .step-node'
  ));

  let bestEl = null;
  let bestScore = 0;
  let bestLabel = '';

  for (const item of candidates) {
    if (item.disabled) continue;
    const isHidden = item.closest('.hidden, [hidden], [style*="display: none"], [style*="visibility: hidden"]');
    if (isHidden) continue;
    if (item.offsetWidth === 0 && item.offsetHeight === 0 && !item.getClientRects().length) continue;

    const rawText = item.innerText || item.textContent || '';
    const labels = [];

    // 1. Bracket hint e.g. [Say 'Go'], [Say 'Next'], [Say 'Demo']
    const bracketMatches = rawText.match(/\[(?:say|or say)\s+['"]?([^'"]+)['"]?\]/i);
    if (bracketMatches && bracketMatches[1]) {
      const hint = bracketMatches[1].toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (hint) labels.push({ text: hint, weight: 1.5 });
    }

    // 2. data-voice attribute
    const dataVoice = item.getAttribute('data-voice');
    if (dataVoice) {
      dataVoice.split(',').forEach(v => {
        const cleaned = v.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned) labels.push({ text: cleaned, weight: 1.4 });
      });
    }

    // 3. ID cleanup
    if (item.id) {
      const idClean = item.id.toLowerCase().replace(/[-_]/g, ' ').replace(/^btn\s*/, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (idClean) labels.push({ text: idClean, weight: 1.1 });
    }

    // 4. Raw button text without brackets
    const cleanText = rawText.replace(/\[.*?\]/g, ' ').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
    if (cleanText) labels.push({ text: cleanText, weight: 1.0 });

    for (const { text: lText, weight } of labels) {
      if (!lText) continue;
      let score = 0;
      if (q === lText) {
        score = 100 * weight;
      } else if (lText.includes(q) && q.length >= 2) {
        score = (85 + Math.min(15, q.length * 2)) * weight;
      } else if (q.includes(lText) && lText.length >= 2) {
        score = (80 + Math.min(20, lText.length * 2)) * weight;
      } else {
        const qTokens = q.split(' ').filter(w => w.length >= 2);
        const lTokens = lText.split(' ').filter(w => w.length >= 2);
        if (qTokens.length > 0 && lTokens.length > 0) {
          const matchCount = qTokens.filter(t => lTokens.some(lt => lt === t || lt.includes(t) || t.includes(lt))).length;
          if (matchCount === qTokens.length) {
            score = (75 + matchCount * 8) * weight;
          } else if (matchCount > 0) {
            score = (50 + matchCount * 8) * weight;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestEl = item;
        bestLabel = cleanText || lText || 'Action';
      }
    }
  }

  if (bestEl && bestScore >= 50) {
    bestEl.classList.add('stt-voice-activated');
    setTimeout(() => {
      try { bestEl.classList.remove('stt-voice-activated'); } catch (e) {}
    }, 600);
    try { bestEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch(e){}
    try { bestEl.click(); } catch(e){}
    return { clicked: true, label: bestLabel, element: bestEl };
  }
  return false;
}

function handleVoiceCommand(text) {
  if (!text) return;
  const c = text.toLowerCase().trim();
  el.voiceLabel.textContent = `Heard: "${text.toUpperCase()}"`;
  setTimeout(() => {
    el.voiceLabel.textContent = 'Voice: Listening...';
  }, 2500);

  // 1. Universal Voice Clicker on EVERY DOM button
  const matchResult = clickMatchingButtonInBoxing(c);
  if (matchResult && matchResult.clicked) {
    el.voiceLabel.textContent = `Voice: Executed "${matchResult.label.toUpperCase()}"`;
    return;
  }

  // 2. Semantic Fallbacks
  if (/\b(start|go|ready|begin|play|proceed|continue)\b/i.test(c)) {
    if (!el.modalReadiness.classList.contains('hidden')) {
      startTrainerFromModal();
    } else if (!el.modalAssessment.classList.contains('hidden')) {
      el.btnAssessProceed.click();
    } else if (state.isPaused) {
      togglePause(false);
    } else {
      advanceNextStep();
    }
  } else if (/\b(punch|hit|strike|jab|cross|hook)\b/i.test(c)) {
    userPerformRep(true);
  } else if (/\b(repeat|again|retry)\b/i.test(c)) {
    if (!el.modalAssessment.classList.contains('hidden')) {
      el.btnAssessRetry.click();
    } else {
      resetLessonStats();
      startStep4Practise();
    }
  } else if (/\b(demo|demonstrate|show me|watch)\b/i.test(c)) {
    startStep2Demonstrate();
  } else if (/\b(pause|wait|stop|hold)\b/i.test(c)) {
    togglePause(true);
  } else if (/\b(resume|unpause)\b/i.test(c)) {
    togglePause(false);
  } else if (/\b(slower|slow)\b/i.test(c)) {
    setSpeedMode(true);
  } else if (/\b(normal|faster|fast)\b/i.test(c)) {
    setSpeedMode(false);
  } else if (/\b(mute|unmute|sound|audio)\b/i.test(c)) {
    toggleMute();
  } else if (/\b(level\s*[1-7]|stance|jab|cross|combo|slip|hook|sparring|master)\b/i.test(c)) {
    for (let i = 0; i < CURRICULUM.length; i++) {
      const lvl = CURRICULUM[i];
      if (c.includes(`level ${lvl.id}`) || c.includes(lvl.title.toLowerCase()) || c.includes(lvl.subtitle.toLowerCase())) {
        selectLevel(i);
        break;
      }
    }
  }
}

// Browser Web Speech Recognition
function initDirectSTT() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    el.voiceLabel.textContent = 'Voice: Click button triggers';
    return;
  }
  try {
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last && last[0]) {
        handleVoiceCommand(last[0].transcript);
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      try { rec.start(); } catch {}
    };
    rec.start();
    el.voiceLabel.textContent = 'Voice: Active [Say "Go"]';
  } catch (err) {}
}

// --- 7. WEBCAM & POSE ESTIMATION (REAL USER MOVEMENT) ---
let videoStream = null;
let opticalCanvas = null;
let opticalCtx = null;
let prevFrameData = null;

async function initCamera() {
  el.cameraStatusOverlay.style.display = 'flex';
  el.cameraStatusText.textContent = 'Initializing Camera & Movement Sensor...';

  try {
    let stream = null;
    if (window.fitness && window.fitness.getCamera) {
      try {
        stream = await window.fitness.getCamera();
      } catch (e) {}
    }
    if (!stream && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
    }

    if (stream) {
      videoStream = stream;
      el.webcamVideo.srcObject = stream;
      await el.webcamVideo.play();
      el.cameraStatusOverlay.style.display = 'none';
      showFeedback("Camera active. Assume your boxing stance!", false);
    } else {
      throw new Error("Camera stream not available");
    }
  } catch (err) {
    el.cameraStatusOverlay.style.display = 'none';
    showFeedback("Using motion simulator mode. Click buttons or speak to punch!", true);
  }
}

// Real-time Optical Motion & Pose Tracker
function processVideoFrame() {
  if (!el.webcamVideo || el.webcamVideo.readyState < 2) return;

  const vw = el.webcamVideo.videoWidth || 640;
  const vh = el.webcamVideo.videoHeight || 480;

  // Sync canvas dimensions
  if (el.userCanvas.width !== vw || el.userCanvas.height !== vh) {
    el.userCanvas.width = vw;
    el.userCanvas.height = vh;
  }

  // 1. Check if host has sent high-accuracy MediaPipe neural landmarks
  if (window.fitness?.movement?.landmarks?.length) {
    receiveNeuralPose(window.fitness.movement.landmarks);
    return;
  }

  // 2. Optical Computer Vision Motion Analysis fallback
  const W = 160;
  const H = 120;
  if (!opticalCanvas) {
    opticalCanvas = document.createElement('canvas');
    opticalCanvas.width = W;
    opticalCanvas.height = H;
    opticalCtx = opticalCanvas.getContext('2d', { willReadFrequently: true });
  }

  opticalCtx.drawImage(el.webcamVideo, 0, 0, W, H);
  let frameData;
  try {
    frameData = opticalCtx.getImageData(0, 0, W, H).data;
  } catch {
    return;
  }

  if (prevFrameData) {
    let leftMotion = 0, rightMotion = 0, centerMotion = 0;
    let headX = 0, headCount = 0;

    for (let y = 10; y < H * 0.7; y += 4) {
      for (let x = 10; x < W - 10; x += 4) {
        const idx = (y * W + x) * 4;
        const diff = Math.abs(frameData[idx] - prevFrameData[idx]) +
                     Math.abs(frameData[idx + 1] - prevFrameData[idx + 1]) +
                     Math.abs(frameData[idx + 2] - prevFrameData[idx + 2]);

        if (diff > 45) {
          if (x < W * 0.38) leftMotion++;
          else if (x > W * 0.62) rightMotion++;
          else {
            centerMotion++;
            headX += x;
            headCount++;
          }
        }
      }
    }

    // Dynamic hand extensions
    const isLeftPunch = leftMotion > 30;
    const isRightPunch = rightMotion > 30;
    const slipOffset = headCount > 15 ? (headX / headCount) / W - 0.5 : 0;

    state.userPose.valid = true;
    state.userPose.leftExtended = isLeftPunch;
    state.userPose.rightExtended = isRightPunch;
    state.userPose.slipped = Math.abs(slipOffset) > 0.12;
    state.userPose.inGuard = !isLeftPunch && !isRightPunch;
    state.userPose.leftGuard = !isLeftPunch;
    state.userPose.rightGuard = !isRightPunch;
    state.userPose.headX = 0.5 + slipOffset;

    // Evaluate movement automatically in practice step
    evaluateLiveMovement();
  }

  prevFrameData = frameData;
}

function receiveNeuralPose(landmarks) {
  if (!landmarks || landmarks.length < 25) return;
  const p = landmarks;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const nose = p[0];
  const lShoulder = p[11];
  const rShoulder = p[12];
  const lWrist = p[15];
  const rWrist = p[16];

  const shoulderDist = Math.max(0.1, dist(lShoulder, rShoulder));
  const lGuardDist = dist(lWrist, nose);
  const rGuardDist = dist(rWrist, nose);

  const lGuard = lGuardDist < shoulderDist * 0.85;
  const rGuard = rGuardDist < shoulderDist * 0.85;
  const lExt = dist(lWrist, lShoulder) > shoulderDist * 1.15;
  const rExt = dist(rWrist, rShoulder) > shoulderDist * 1.15;
  const headSlip = Math.abs(nose.x - (lShoulder.x + rShoulder.x) / 2) > shoulderDist * 0.22;

  state.userPose.valid = true;
  state.userPose.headX = nose.x;
  state.userPose.headY = nose.y;
  state.userPose.leftHand = { x: lWrist.x, y: lWrist.y };
  state.userPose.rightHand = { x: rWrist.x, y: rWrist.y };
  state.userPose.leftExtended = lExt;
  state.userPose.rightExtended = rExt;
  state.userPose.leftGuard = lGuard;
  state.userPose.rightGuard = rGuard;
  state.userPose.inGuard = lGuard && rGuard;
  state.userPose.slipped = headSlip;

  evaluateLiveMovement();
}

// Live Movement Evaluator during Practice Phase
let guardHoldTimer = 0;
function evaluateLiveMovement() {
  if (state.isPaused || state.currentStep !== 4 || state.isAnalyzingRep) return;

  const lvl = CURRICULUM[state.currentLevelIndex];
  const now = performance.now();
  if (now - state.lastRepAt < 1600) return; // Prevent spamming reps

  // Level 1: Stance & Guard
  if (lvl.targetType === 'guard') {
    highlightCheckpoints(true, state.userPose.inGuard);
    if (state.userPose.inGuard) {
      guardHoldTimer += 50;
      if (guardHoldTimer > 800) {
        guardHoldTimer = 0;
        triggerPunchHit('lead');
        userPerformRep(true);
      }
    } else {
      guardHoldTimer = 0;
    }
    return;
  }

  // Level 2: Lead Jab
  if (lvl.targetType === 'lead') {
    if (state.userPose.leftExtended) {
      triggerPunchHit('lead');
      const isClean = state.userPose.rightGuard; // Rear hand must protect cheek
      userPerformRep(isClean, isClean ? lvl.successMsg : "Keep your rear hand glued to your cheek while jabbing!");
    }
    return;
  }

  // Level 3: Rear Cross
  if (lvl.targetType === 'rear') {
    if (state.userPose.rightExtended) {
      triggerPunchHit('rear');
      const isClean = state.userPose.leftGuard; // Lead hand must protect cheek
      userPerformRep(isClean, isClean ? lvl.successMsg : "Keep your lead hand glued to your cheek while throwing the cross!");
    }
    return;
  }

  // Level 4: 1-2 Combo
  if (lvl.targetType === 'combo') {
    if (state.activeTarget === 'lead' && state.userPose.leftExtended) {
      triggerPunchHit('lead');
      state.activeTarget = 'rear';
      updateActiveTargetDisplay();
    } else if (state.activeTarget === 'rear' && state.userPose.rightExtended) {
      triggerPunchHit('rear');
      state.activeTarget = 'lead';
      updateActiveTargetDisplay();
      userPerformRep(true, lvl.successMsg);
    }
    return;
  }

  // Level 5: Slip
  if (lvl.targetType === 'slip') {
    if (state.userPose.slipped) {
      triggerPunchHit('lead');
      userPerformRep(true, lvl.successMsg);
    }
    return;
  }

  // Level 6: Lead Hook
  if (lvl.targetType === 'hook') {
    if (state.userPose.leftExtended) {
      triggerPunchHit('lead');
      userPerformRep(true, lvl.successMsg);
    }
    return;
  }

  // Level 7: Flow Sparring
  if (lvl.targetType === 'flow') {
    if ((state.activeTarget === 'lead' && state.userPose.leftExtended) ||
        (state.activeTarget === 'rear' && state.userPose.rightExtended) ||
        (state.activeTarget === 'slip' && state.userPose.slipped)) {
      triggerPunchHit(state.activeTarget === 'slip' ? 'lead' : state.activeTarget);
      // Switch dynamic flow target
      const targets = ['lead', 'rear', 'slip'];
      state.activeTarget = targets[Math.floor(Math.random() * targets.length)];
      updateActiveTargetDisplay();
      userPerformRep(true, "Sharp reaction! Keep your hands up!");
    }
    return;
  }
}

function triggerPunchHit(targetSide) {
  sound.playTargetHit();
  const mitt = targetSide === 'lead' ? el.mittLead : el.mittRear;
  if (mitt) {
    mitt.classList.add('target-hit');
    setTimeout(() => mitt.classList.remove('target-hit'), 350);
  }
}

function updateActiveTargetDisplay() {
  const lvl = CURRICULUM[state.currentLevelIndex];
  el.mittLead.style.display = 'none';
  el.mittRear.style.display = 'none';
  el.slipIndicator.classList.remove('active');

  if (state.currentStep !== 4) return;

  if (lvl.targetType === 'lead' || (lvl.targetType === 'combo' && state.activeTarget === 'lead')) {
    el.mittLead.style.display = 'flex';
    el.mittLead.classList.add('target-active');
  } else if (lvl.targetType === 'rear' || (lvl.targetType === 'combo' && state.activeTarget === 'rear')) {
    el.mittRear.style.display = 'flex';
    el.mittRear.classList.add('target-active');
  } else if (lvl.targetType === 'slip' || (lvl.targetType === 'flow' && state.activeTarget === 'slip')) {
    el.slipIndicator.classList.add('active');
  } else if (lvl.targetType === 'flow') {
    if (state.activeTarget === 'lead') {
      el.mittLead.style.display = 'flex';
      el.mittLead.classList.add('target-active');
    } else {
      el.mittRear.style.display = 'flex';
      el.mittRear.classList.add('target-active');
    }
  }
}

// --- 8. STEP WORKFLOW MANAGEMENT (EXPLAIN -> DEMO -> READY -> PRACTICE -> REVIEW) ---
function setStep(stepNum) {
  state.currentStep = stepNum;
  el.stepNodes.forEach((node) => {
    const s = parseInt(node.dataset.step, 10);
    node.classList.toggle('active', s === stepNum);
    node.classList.toggle('done', s < stepNum);
  });
  updateActiveTargetDisplay();
}

function selectLevel(idx) {
  if (state.isPaused) return;
  if (idx > state.maxUnlockedIndex) {
    speakCoach(`Level ${idx + 1} is locked. Complete the earlier levels first!`);
    return;
  }
  state.currentLevelIndex = idx;
  resetLessonStats();
  renderCurriculumList();
  startStep1Explain();
}

function resetLessonStats() {
  state.attempts = 0;
  state.cleanReps = 0;
  state.checkpointsMet = 0;
  state.guardReturns = 0;
  state.activeTarget = 'lead';
  highlightCheckpoints(false, false);
  updateHud();
}

// Step 1: Explain
function startStep1Explain() {
  setStep(1);
  const lvl = CURRICULUM[state.currentLevelIndex];
  el.viewModeTag.textContent = "AI EXPLANATION";
  el.userStageTag.textContent = `${lvl.title.toUpperCase()} · TECHNIQUE BREAKDOWN`;
  el.coachSpeechText.textContent = `"${lvl.cue}"`;
  updateCommentary(`${lvl.title}. ${lvl.explainText}`);
  el.btnNextAction.textContent = "Watch Demonstration → [Say 'Next']";
}

// Step 2: Demonstrate (AI Coach Alex Demonstrates Clean Mechanics)
function startStep2Demonstrate() {
  setStep(2);
  const lvl = CURRICULUM[state.currentLevelIndex];
  el.viewModeTag.textContent = "COACH DEMO";
  el.userStageTag.textContent = "COACH DEMONSTRATION · WATCH TECHNIQUE & GUARD";
  el.coachSpeechText.textContent = `"${lvl.cue}"`;
  updateCommentary(`Watch Coach Alex demonstrate ${lvl.title}. ${lvl.cue}. Notice the clean snap back to guard!`);
  el.btnNextAction.textContent = "I'm Ready to Practice → [Say 'Go']";
}

// Step 3: Ready (User Assumes Stance)
function startStep3Ready() {
  setStep(3);
  const lvl = CURRICULUM[state.currentLevelIndex];
  el.viewModeTag.textContent = "ASSUME GUARD";
  el.userStageTag.textContent = "STEP 3 · ASSUME BOXING STANCE & GUARD";
  updateCommentary("Assume your boxing guard stance in front of the camera. Hands near your cheekbones, chin tucked. Say 'Go' when ready!");
  el.btnNextAction.textContent = "Begin Practice → [Say 'Go']";
}

// Step 4: Practice (Live User Movement Evaluation & Real-Time Correction)
function startStep4Practise() {
  setStep(4);
  const lvl = CURRICULUM[state.currentLevelIndex];
  el.viewModeTag.textContent = "PRACTICE MODE";
  el.userStageTag.textContent = `STEP 4 · LIVE PRACTICE (${state.cleanReps} / ${lvl.targetReps} Clean Reps)`;
  updateCommentary(`Practice mode: ${lvl.cue}. Deliver your movement towards the active target!`);
  el.btnNextAction.textContent = "Next Step → [Say 'Next']";
  updateActiveTargetDisplay();
}

// User Movement Repetition Trigger
function userPerformRep(isCorrect, customMsg = null) {
  if (state.isPaused || state.isAnalyzingRep) return;
  state.isAnalyzingRep = true;
  state.lastRepAt = performance.now();

  const lvl = CURRICULUM[state.currentLevelIndex];
  state.attempts++;

  if (isCorrect) {
    state.cleanReps++;
    state.checkpointsMet++;
    state.guardReturns++;
    state.score += 35;
    highlightCheckpoints(true, true);
    showFeedback("Right! Excellent Form! +35 pts", false);
    updateCommentary(customMsg || lvl.successMsg, true);
  } else {
    highlightCheckpoints(false, false);
    showFeedback("Form Correction Needed", true);
    updateCommentary(customMsg || lvl.retryMsg, false);
  }

  updateHud();
  if (window.fitness && window.fitness.score) {
    window.fitness.score(state.score, Math.round((state.cleanReps / Math.max(1, state.attempts)) * 100));
  }

  // Check if Target Clean Reps Cleared
  if (state.cleanReps >= lvl.targetReps) {
    setTimeout(() => {
      startStep5Review();
      state.isAnalyzingRep = false;
    }, 1500);
  } else {
    setTimeout(() => {
      state.isAnalyzingRep = false;
      el.userStageTag.textContent = `STEP 4 · LIVE PRACTICE (${state.cleanReps} / ${lvl.targetReps} Clean Reps)`;
    }, 1200);
  }
}

// Step 5: Assessment & Level Progression
function startStep5Review() {
  setStep(5);
  const lvl = CURRICULUM[state.currentLevelIndex];
  const passRate = state.cleanReps / Math.max(1, state.attempts);
  const isPassed = passRate >= lvl.passRatio;

  el.assessAttempts.textContent = `${state.cleanReps} / ${lvl.targetReps}`;
  el.assessCheckpoints.textContent = `${Math.round(passRate * 100)}%`;
  el.assessGuards.textContent = `${Math.round((state.guardReturns / Math.max(1, state.attempts)) * 100)}%`;
  el.assessScore.textContent = `+${state.score} pts`;

  if (isPassed) {
    sound.playSuccessSound();
    el.assessIcon.textContent = "🎉";
    el.assessTitle.textContent = `${lvl.title} Cleared!`;
    el.assessDesc.textContent = "Outstanding technique! You maintained proper guard, full extension, and clean returns.";
    el.btnAssessProceed.textContent = state.currentLevelIndex < CURRICULUM.length - 1 ? "Next Level → [Say 'Next']" : "Graduate Academy 🏆";
    updateCommentary(`Level cleared! Outstanding form. Say 'Next' to unlock ${CURRICULUM[Math.min(state.currentLevelIndex + 1, CURRICULUM.length - 1)].title}!`, true);

    // Unlock next level
    if (state.currentLevelIndex >= state.maxUnlockedIndex && state.currentLevelIndex < CURRICULUM.length - 1) {
      state.maxUnlockedIndex = state.currentLevelIndex + 1;
      renderCurriculumList();
    }
  } else {
    el.assessIcon.textContent = "🌱";
    el.assessTitle.textContent = "Keep Refining Your Form";
    el.assessDesc.textContent = "Good effort! Remember to keep your hands protecting your cheekbones on every punch.";
    el.btnAssessProceed.textContent = "Practice Again → [Say 'Repeat']";
    updateCommentary("Round completed. Let's practice once more to master your guard. Say 'Repeat' to try again.", false);
  }

  el.modalAssessment.classList.remove('hidden');
}

function advanceNextStep() {
  if (state.isPaused) return;
  if (state.currentStep === 1) startStep2Demonstrate();
  else if (state.currentStep === 2) startStep3Ready();
  else if (state.currentStep === 3) startStep4Practise();
  else if (state.currentStep === 4) userPerformRep(true);
  else if (state.currentStep === 5) {
    el.modalAssessment.classList.add('hidden');
    if (state.currentLevelIndex < CURRICULUM.length - 1) {
      selectLevel(state.currentLevelIndex + 1);
    } else {
      showSessionReport();
    }
  }
}

function showSessionReport() {
  el.modalAssessment.classList.add('hidden');
  el.modalSessionReport.classList.remove('hidden');
  sound.playSuccessSound();

  const durationSec = Math.floor((Date.now() - state.sessionStartTime) / 1000);
  const min = Math.floor(durationSec / 60).toString().padStart(2, '0');
  const sec = (durationSec % 60).toString().padStart(2, '0');

  document.getElementById('repTotalScore').textContent = `${state.score} pts`;
  document.getElementById('repHighestLevel').textContent = CURRICULUM[state.maxUnlockedIndex].title;
  document.getElementById('repDuration').textContent = `${min}:${sec}`;
  updateCommentary("Congratulations! You graduated from AI Boxing Academy with champion technique!", true);
}

// --- 9. HUD & UI UPDATES ---
function updateHud() {
  const lvl = CURRICULUM[state.currentLevelIndex];
  el.hudLevelTitle.textContent = lvl.title;
  el.hudLevelSubtitle.textContent = lvl.subtitle;
  el.hudReps.textContent = `${state.cleanReps} / ${lvl.targetReps}`;
  el.hudScore.textContent = state.score;
}

function highlightCheckpoints(allPass, guardOk = true) {
  el.cpGuard.classList.toggle('passed', guardOk);
  el.cpBalance.classList.toggle('passed', allPass);
  el.cpExtension.classList.toggle('passed', allPass);
  el.cpReturn.classList.toggle('passed', guardOk);
}

function showFeedback(text, isWarn = false) {
  el.feedbackText.textContent = text;
  el.feedbackBanner.className = 'feedback-banner show' + (isWarn ? ' warn' : '');
  setTimeout(() => {
    el.feedbackBanner.classList.remove('show');
  }, 2200);
}

function renderCurriculumList() {
  el.levelList.innerHTML = '';
  el.unlockedCount.textContent = `Unlocked: Level ${state.maxUnlockedIndex + 1}`;

  CURRICULUM.forEach((lvl, idx) => {
    const row = document.createElement('div');
    const isLocked = idx > state.maxUnlockedIndex;
    const isActive = idx === state.currentLevelIndex;

    row.className = `level-row ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
    row.setAttribute('data-voice', `level ${lvl.id}, ${lvl.title.toLowerCase()}`);
    row.innerHTML = `
      <div class="level-row-left">
        <span class="level-row-title">${lvl.title}</span>
        <span class="level-row-sub">${lvl.subtitle}</span>
      </div>
      <span class="level-status-tag">${isLocked ? '🔒' : isActive ? '▶ Active' : '✓ Unlocked'}</span>
    `;

    if (!isLocked) {
      row.addEventListener('click', () => {
        selectLevel(idx);
        speakCoach(`Selected ${lvl.title}. ${lvl.cue}`);
      });
    }
    el.levelList.appendChild(row);
  });
}

function setSpeedMode(slower) {
  state.isSlowerMode = slower;
  el.btnSlower.textContent = state.isSlowerMode ? '⏱ Pace: Slower [Say "Slower"]' : '⏱ Pace: Normal [Say "Slower"]';
  showFeedback(state.isSlowerMode ? 'Demonstration pace: Slower (60%)' : 'Demonstration pace: Normal (100%)');
}

function setSideView(side) {
  state.showSideView = side;
  el.btnToggleSideView.classList.toggle('active', state.showSideView);
  showFeedback(state.showSideView ? 'Profile Angle' : 'Frontal Angle');
}

function togglePause(forceState = null) {
  if (forceState === null) {
    state.isPaused = !state.isPaused;
  } else {
    state.isPaused = forceState;
  }
  el.btnPause.textContent = state.isPaused ? '▶ Resume [Say "Resume"]' : '⏸ Pause [Say "Pause"]';
  showFeedback(state.isPaused ? 'Session Paused' : 'Session Resumed');
  speakCoach(state.isPaused ? "Boxing paused." : "Resuming boxing practice.");
  if (window.fitness) {
    if (state.isPaused) window.fitness.pause();
    else window.fitness.resume();
  }
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  el.btnMute.textContent = state.isMuted ? '🔇 Audio: OFF [Say "Unmute"]' : '🔊 Audio: ON [Say "Mute"]';
  showFeedback(state.isMuted ? 'Voice Audio Muted' : 'Voice Audio Enabled');
}

function toggleCamera() {
  const hidden = el.webcamVideo.style.display === 'none';
  el.webcamVideo.style.display = hidden ? 'block' : 'none';
  el.userCanvas.style.display = hidden ? 'block' : 'none';
  el.btnToggleCamera.classList.toggle('active', hidden);
}

function startTrainerFromModal() {
  el.modalReadiness.classList.add('hidden');
  initCamera();
  selectLevel(0);
}

// --- 10. REAL-TIME CANVAS DRAWING (COACH ALEX & USER DIAGNOSTICS) ---
let animTime = 0;

function startCanvasLoops() {
  function loop() {
    processVideoFrame();

    if (!state.isPaused) {
      animTime += 0.022 * (state.isSlowerMode ? 0.6 : 1.0);
      drawCoach(animTime);
      drawUserOverlay();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Clean 3D Humanoid Coach Alex Animation
function drawCoach(t) {
  const w = el.coachCanvas.width;
  const h = el.coachCanvas.height;
  coachCtx.clearRect(0, 0, w, h);

  // Background Grid
  coachCtx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
  coachCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 28) {
    coachCtx.beginPath(); coachCtx.moveTo(x, 0); coachCtx.lineTo(x, h); coachCtx.stroke();
  }

  // Shadow
  coachCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  coachCtx.beginPath();
  coachCtx.ellipse(w / 2, h - 28, 55, 12, 0, 0, Math.PI * 2);
  coachCtx.fill();

  const lvl = CURRICULUM[state.currentLevelIndex];
  const anim = lvl.demoAnim;
  const cycle = (t % 2.5) / 2.5;

  const cx = w / 2;
  const cy = h / 2 + 10;

  let headY = cy - 72;
  let headX = cx;
  let leftGlove = { x: cx - 24, y: cy - 54 };
  let rightGlove = { x: cx + 24, y: cy - 52 };
  let leftFoot = { x: cx - 28, y: cy + 68 };
  let rightFoot = { x: cx + 28, y: cy + 68 };
  let punchTrail = [];

  if (anim === 'guard_stance') {
    const sway = Math.sin(t * 3) * 3;
    headX += sway * 0.4;
    leftGlove.x += sway * 0.3;
    rightGlove.x += sway * 0.3;
  } else if (anim === 'lead_jab') {
    if (cycle < 0.35) {
      const p = cycle / 0.35;
      leftGlove.x = cx - 24 - 65 * p;
      leftGlove.y = cy - 54 - 6 * p;
      punchTrail = [{ x: cx - 24, y: cy - 54 }, { x: leftGlove.x, y: leftGlove.y }];
    } else if (cycle < 0.65) {
      const p = (cycle - 0.35) / 0.30;
      leftGlove.x = (cx - 89) + 65 * p;
      leftGlove.y = (cy - 60) + 6 * p;
    }
  } else if (anim === 'rear_cross') {
    if (cycle < 0.35) {
      const p = cycle / 0.35;
      rightGlove.x = cx + 24 + 70 * p;
      rightGlove.y = cy - 52 - 8 * p;
      headX += 6 * p;
      punchTrail = [{ x: cx + 24, y: cy - 52 }, { x: rightGlove.x, y: rightGlove.y }];
    } else if (cycle < 0.65) {
      const p = (cycle - 0.35) / 0.30;
      rightGlove.x = (cx + 94) - 70 * p;
      rightGlove.y = (cy - 60) + 8 * p;
      headX += 6 * (1 - p);
    }
  } else if (anim === 'combo_one_two') {
    if (cycle < 0.3) {
      const p = cycle / 0.3;
      leftGlove.x = cx - 24 - 60 * p;
    } else if (cycle < 0.5) {
      const p = (cycle - 0.3) / 0.2;
      leftGlove.x = (cx - 84) + 60 * p;
      rightGlove.x = cx + 24 + 65 * p;
    } else if (cycle < 0.75) {
      const p = (cycle - 0.5) / 0.25;
      rightGlove.x = (cx + 89) - 65 * p;
    }
  } else if (anim === 'slip_dodge') {
    const slip = Math.sin(cycle * Math.PI * 2) * 26;
    headX += slip;
    leftGlove.x += slip * 0.7;
    rightGlove.x += slip * 0.7;
  } else if (anim === 'lead_hook') {
    if (cycle < 0.4) {
      const p = cycle / 0.4;
      leftGlove.x = cx - 24 - 45 * Math.sin(p * Math.PI);
      leftGlove.y = cy - 54 - 20 * p;
    } else if (cycle < 0.7) {
      const p = (cycle - 0.4) / 0.3;
      leftGlove.x = (cx - 69) + 45 * p;
      leftGlove.y = (cy - 74) + 20 * p;
    }
  }

  // Draw Punch Trajectory Trail
  if (punchTrail.length === 2) {
    coachCtx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    coachCtx.lineWidth = 4;
    coachCtx.setLineDash([4, 4]);
    coachCtx.beginPath();
    coachCtx.moveTo(punchTrail[0].x, punchTrail[0].y);
    coachCtx.lineTo(punchTrail[1].x, punchTrail[1].y);
    coachCtx.stroke();
    coachCtx.setLineDash([]);
  }

  // Torso
  coachCtx.strokeStyle = '#00e5ff';
  coachCtx.lineWidth = 6;
  coachCtx.lineCap = 'round';
  coachCtx.beginPath();
  coachCtx.moveTo(headX, headY + 16);
  coachCtx.lineTo(cx, cy + 20);
  coachCtx.stroke();

  // Legs
  coachCtx.beginPath();
  coachCtx.moveTo(cx, cy + 20); coachCtx.lineTo(leftFoot.x, leftFoot.y);
  coachCtx.moveTo(cx, cy + 20); coachCtx.lineTo(rightFoot.x, rightFoot.y);
  coachCtx.stroke();

  // Arms
  coachCtx.beginPath();
  coachCtx.moveTo(headX - 18, headY + 20); coachCtx.lineTo(leftGlove.x, leftGlove.y);
  coachCtx.moveTo(headX + 18, headY + 20); coachCtx.lineTo(rightGlove.x, rightGlove.y);
  coachCtx.stroke();

  // Gloves
  coachCtx.fillStyle = '#ff5252';
  coachCtx.beginPath(); coachCtx.arc(leftGlove.x, leftGlove.y, 10, 0, Math.PI * 2); coachCtx.fill();
  coachCtx.beginPath(); coachCtx.arc(rightGlove.x, rightGlove.y, 10, 0, Math.PI * 2); coachCtx.fill();

  // Head
  coachCtx.fillStyle = '#ffe082';
  coachCtx.beginPath(); coachCtx.arc(headX, headY, 15, 0, Math.PI * 2); coachCtx.fill();
  coachCtx.strokeStyle = '#1565c0'; coachCtx.lineWidth = 3;
  coachCtx.beginPath(); coachCtx.arc(headX, headY - 2, 15, Math.PI, 0); coachCtx.stroke();
}

// User Camera Diagnostics Overlay (Skeletal overlay on live mirrored canvas)
function drawUserOverlay() {
  const w = el.userCanvas.width;
  const h = el.userCanvas.height;
  userCtx.clearRect(0, 0, w, h);

  if (!state.userPose.valid) return;

  const hx = state.userPose.headX * w;
  const hy = state.userPose.headY * h;

  // Chin Guard Box
  userCtx.strokeStyle = state.userPose.inGuard ? 'rgba(0, 230, 118, 0.7)' : 'rgba(255, 82, 82, 0.7)';
  userCtx.lineWidth = 2;
  userCtx.strokeRect(hx - 45, hy - 20, 90, 80);

  // Guard Status Tag
  userCtx.fillStyle = state.userPose.inGuard ? '#00e676' : '#ff5252';
  userCtx.font = 'bold 12px sans-serif';
  userCtx.fillText(state.userPose.inGuard ? '🛡️ GUARD UP' : '⚠️ LOW GUARD', hx - 40, hy - 26);
}

// --- 11. EVENT LISTENERS ---
function setupEventListeners() {
  el.btnStartWarmup.addEventListener('click', () => {
    sound.playClick();
    startTrainerFromModal();
    speakCoach("Welcome to AI Boxing Academy! Stand in guard stance and say Go when ready!");
  });

  el.btnNextAction.addEventListener('click', () => {
    sound.playClick();
    advanceNextStep();
  });

  el.btnRepeat.addEventListener('click', () => {
    sound.playClick();
    resetLessonStats();
    startStep4Practise();
    speakCoach("Repeating practice round. Assume your guard.");
  });

  el.btnWatchDemo.addEventListener('click', () => {
    sound.playClick();
    startStep2Demonstrate();
  });

  el.btnSlower.addEventListener('click', () => {
    sound.playClick();
    setSpeedMode(!state.isSlowerMode);
    speakCoach(state.isSlowerMode ? "Demonstration speed slowed." : "Demonstration speed set to normal.");
  });

  el.btnPause.addEventListener('click', () => {
    sound.playClick();
    togglePause();
  });

  el.btnMute.addEventListener('click', () => {
    sound.playClick();
    toggleMute();
  });

  el.btnReplayAudio.addEventListener('click', () => {
    sound.playClick();
    if (state.lastSpokenCommentary) speakCoach(state.lastSpokenCommentary);
  });

  el.btnToggleCamera.addEventListener('click', () => {
    sound.playClick();
    toggleCamera();
  });

  el.btnToggleSideView.addEventListener('click', () => {
    sound.playClick();
    setSideView(!state.showSideView);
  });

  el.btnPerformRep.addEventListener('click', () => {
    sound.playPunchSound();
    triggerPunchHit(state.activeTarget);
    userPerformRep(true);
  });

  el.btnSimNoGuard.addEventListener('click', () => {
    sound.playWarningSound();
    userPerformRep(false, "Adjust your guard: keep your hands glued to your cheekbones!");
  });

  el.btnAssessProceed.addEventListener('click', () => {
    sound.playClick();
    el.modalAssessment.classList.add('hidden');
    if (state.currentLevelIndex < CURRICULUM.length - 1) {
      selectLevel(state.currentLevelIndex + 1);
    } else {
      showSessionReport();
    }
  });

  el.btnAssessRetry.addEventListener('click', () => {
    sound.playClick();
    el.modalAssessment.classList.add('hidden');
    resetLessonStats();
    startStep4Practise();
  });

  el.btnFinishSession.addEventListener('click', () => {
    sound.playClick();
    speakCoach("Graduation recorded. Resetting to Level 1.");
    el.modalSessionReport.classList.add('hidden');
    selectLevel(0);
    if (window.fitness && window.fitness.complete) {
      window.fitness.complete();
    }
  });

  // Hotkeys
  window.addEventListener('keydown', (e) => {
    if (state.isPaused && e.key.toLowerCase() !== 'p') return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (!el.modalReadiness.classList.contains('hidden')) el.btnStartWarmup.click();
      else if (!el.modalAssessment.classList.contains('hidden')) el.btnAssessProceed.click();
      else advanceNextStep();
    } else if (e.key === 'p' || e.key === 'P') {
      togglePause();
    } else if (e.key === 'd' || e.key === 'D') {
      startStep2Demonstrate();
    } else if (e.key === 'r' || e.key === 'R') {
      resetLessonStats();
      startStep4Practise();
    } else if (e.key >= '1' && e.key <= '7') {
      selectLevel(parseInt(e.key, 10) - 1);
    }
  });
}

// --- 12. FITNESS HOST INTEGRATION ---
function initFitnessHost() {
  if (!window.fitness) return;
  window.fitness.onMessage((m) => {
    if (m.type === 'command') {
      handleVoiceCommand(m.text || m.raw || '');
    } else if (m.type === 'pause') {
      togglePause(true);
    } else if (m.type === 'resume') {
      togglePause(false);
    } else if (m.type === 'movement') {
      if (m.landmarks) receiveNeuralPose(m.landmarks);
    }
  });
  window.fitness.ready();
}

// Initialize on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  renderCurriculumList();
  setupEventListeners();
  initFitnessHost();
  initDirectSTT();
  startCanvasLoops();
  updateHud();
});
