/**
 * AI Boxing Trainer · Voice-Controlled HD Posture Coach (Web Edition)
 * Fixed:
 * 1. Hardware Camera Stream via Python /video_feed + Fallback
 * 2. Hardware-Direct STT via /api/voice_command polling + Browser Web Speech
 * 3. NO Auto-Advancing: Paced by the user's actual movements and commands!
 * 4. Spoken Voice Commentary on Every Rep (TTS)
 */

// --- 1. CURRICULUM DEFINITION (LEVELS 0 - 6) ---
const CURRICULUM = [
  {
    id: 0,
    title: "Level 0 · Getting Ready",
    subtitle: "Safety, stance, and guard",
    explainText: "This is your boxing stance and guard. Stand with feet shoulder-width apart, knees soft, hands protecting your cheeks, and chin gently tucked.",
    demoAnim: "guard_stance",
    targetReps: 4,
    passRatio: 0.75,
    cue: "Hold your guard comfortably... balance your weight.",
    successMsg: "Right! Excellent stance and hands in guard.",
    retryMsg: "Adjust your posture: keep hands close to your cheeks and knees soft."
  },
  {
    id: 1,
    title: "Level 1 · Footwork",
    subtitle: "Move and stay balanced",
    explainText: "Boxing footwork requires small, controlled steps. Step smoothly in the direction of the cue without crossing your feet, then return to stance.",
    demoAnim: "footwork",
    targetReps: 4,
    passRatio: 0.75,
    cue: "Step smoothly with the cue... reset to stance.",
    successMsg: "Right! Great footwork control and balance.",
    retryMsg: "Adjust your stance: keep steps small and maintain your base width."
  },
  {
    id: 2,
    title: "Level 2 · First Punch",
    subtitle: "Jab and return to guard",
    explainText: "This is your lead-hand jab. Extend your front hand straight toward the cue, keep your rear hand glued to your cheek, then snap it right back to guard.",
    demoAnim: "lead_jab",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Jab... return to guard.",
    successMsg: "Right! Crisp extension and clean return to guard.",
    retryMsg: "Adjust your guard: as soon as you punch, bring that hand right back home to your cheek."
  },
  {
    id: 3,
    title: "Level 3 · Second Punch",
    subtitle: "Cross and return to guard",
    explainText: "This is your rear-hand cross. Rotate your rear hip and shoulder as your punch extends, keeping your lead hand protecting your face, then reset.",
    demoAnim: "rear_cross",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Cross... rotate hip... return to guard.",
    successMsg: "Right! Smooth hip rotation and steady reset.",
    retryMsg: "Adjust your posture: rotate gently and bring your rear hand back home to your cheek."
  },
  {
    id: 4,
    title: "Level 4 · Combination",
    subtitle: "Jab → Cross (1-2 Rhythm)",
    explainText: "Now we combine both punches in order: Lead Jab, then Rear Cross. Focus on smooth rhythm rather than hitting hard, then reset to guard.",
    demoAnim: "combo_one_two",
    targetReps: 5,
    passRatio: 0.8,
    cue: "One... Two... Jab, Cross... and Reset!",
    successMsg: "Right! Beautiful rhythm and controlled combination.",
    retryMsg: "Adjust your rhythm: extend the jab, then let the cross follow, and return to guard."
  },
  {
    id: 5,
    title: "Level 5 · Defence",
    subtitle: "Simple dodge and reset",
    explainText: "Boxing defence relies on small, efficient movements. Slip your head gently off the center line without bending deep or losing balance.",
    demoAnim: "slip_dodge",
    targetReps: 5,
    passRatio: 0.8,
    cue: "Dodge... slip gently... return to guard.",
    successMsg: "Right! Subtle dodge and quick guard reset.",
    retryMsg: "Adjust your slip: make the movement small. Keep eyes up and guard high."
  },
  {
    id: 6,
    title: "Level 6 · Practice Round",
    subtitle: "Combine learned skills",
    explainText: "This is your practice round! We mix everything: stance, footwork, jabs, crosses, and dodges. Take your time and keep your guard active.",
    demoAnim: "freestyle_flow",
    targetReps: 8,
    passRatio: 0.75,
    cue: "Flow through the cues... stay relaxed and balanced.",
    successMsg: "Right! Outstanding control throughout the practice round.",
    retryMsg: "Adjust your guard: consistency comes with practice. Keep your hands up."
  }
];

// --- 2. TRAINER STATE ---
const state = {
  currentLevelId: 0,
  maxUnlockedLevel: 0,
  currentStep: 1, // 1 to 7
  sessionStartTime: Date.now(),
  user: "Suthi",
  isPaused: false,
  isSlowerMode: false,
  showSideView: false,

  // Repetition & Score Tracking
  attempts: 0,
  checkpointsMet: 0,
  guardReturns: 0,
  score: 0,

  // Live Posture Metrics
  userPose: {
    visible: true,
    inGuard: true,
    leftGuard: true,
    rightGuard: true,
    chinTucked: true,
    balanced: true,
    extended: false,
    dodged: false
  },

  // Voice AI
  voiceActive: false,
  lastSpokenCommentary: ""
};

// --- 3. DOM ELEMENT REFERENCES ---
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
  cameraStream: document.getElementById('cameraStream'),
  userCanvas: document.getElementById('userCanvas'),
  webcamVideo: document.getElementById('webcamVideo'),
  coachCanvas: document.getElementById('coachCanvas'),
  coachSpeechText: document.getElementById('coachSpeechText'),
  viewModeTag: document.getElementById('viewModeTag'),
  userStageTag: document.getElementById('userStageTag'),

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

  // Buttons
  btnNextAction: document.getElementById('btnNextAction'),
  btnRepeat: document.getElementById('btnRepeat'),
  btnWatchDemo: document.getElementById('btnWatchDemo'),
  btnSlower: document.getElementById('btnSlower'),
  btnPause: document.getElementById('btnPause'),
  btnToggleCamera: document.getElementById('btnToggleCamera'),
  btnToggleSideView: document.getElementById('btnToggleSideView'),

  // Movement Trigger Buttons
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

const coachCtx = el.coachCanvas.getContext('2d');

// --- 4. TEXT-TO-SPEECH (TTS) SPOKEN COMMENTARY ---
function speakCoach(text) {
  if (!text) return;
  try { window.fitness.speak(text); } catch {}
  if (!parent || parent === window) {
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    } catch {}
  }
}

function updateCommentary(text, isSuccess = null) {
  el.commentaryText.textContent = `"${text}"`;
  el.commentaryBar.classList.remove('success', 'warn');
  if (isSuccess === true) el.commentaryBar.classList.add('success');
  else if (isSuccess === false) el.commentaryBar.classList.add('warn');

  speakCoach(text);
  state.lastSpokenCommentary = text;
}

// --- 5. DUAL SPEECH-TO-TEXT (STT) ENGINE ---
function handleVoiceCommand(text) {
  if (!text) return;
  const c = text.toLowerCase().trim();
  el.voiceLabel.textContent = `Heard: "${text.toUpperCase()}"`;
  setTimeout(() => {
    el.voiceLabel.textContent = 'Voice: Listening...';
  }, 2200);

  if (/\b(start|go|ready|begin|play|lets move|let's move)\b/i.test(c)) {
    if (!el.modalReadiness.classList.contains('hidden')) {
      startTrainerFromModal();
      speakCoach("Boxing coach active. Stand in guard stance and say Go when ready!");
    } else if (!el.modalAssessment.classList.contains('hidden')) {
      el.btnAssessProceed.click();
    } else if (state.isPaused) {
      togglePause(false);
      speakCoach("Resuming boxing session.");
    } else if (state.currentStep === 3) {
      startStep4Practise();
    } else if (state.currentStep === 4) {
      userPerformRep(true);
    } else {
      advanceNextStep();
    }
  } else if (/\b(next|continue|proceed|forward|advance)\b/i.test(c)) {
    if (!el.modalAssessment.classList.contains('hidden')) {
      el.btnAssessProceed.click();
    } else {
      advanceNextStep();
    }
  } else if (/\b(repeat|again|retry|practice again)\b/i.test(c)) {
    if (!el.modalAssessment.classList.contains('hidden')) {
      el.btnAssessRetry.click();
    } else {
      resetLessonStats();
      startStep4Practise();
    }
  } else if (/\b(slower|slow|half speed)\b/i.test(c)) {
    setSpeedMode(true);
    speakCoach("Demonstration speed slowed.");
  } else if (/\b(normal|faster|fast|full speed|pace)\b/i.test(c)) {
    setSpeedMode(false);
    speakCoach("Demonstration speed set to normal.");
  } else if (/\b(demo|demonstrate|show me|watch demo|watch)\b/i.test(c)) {
    startStep2Demonstrate();
  } else if (/\b(pause|break|wait|hold on|stop for a moment)\b/i.test(c)) {
    togglePause(true);
    speakCoach("Boxing paused. Rest your shoulders.");
  } else if (/\b(resume|unpause|keep going)\b/i.test(c)) {
    togglePause(false);
    speakCoach("Resuming boxing practice.");
  } else if (/\b(punch|jab|cross|hit|rep|strike|check form|perform rep)\b/i.test(c)) {
    userPerformRep(true);
  } else if (/\b(test guard|low guard|warn|warning|sim guard)\b/i.test(c)) {
    el.btnSimNoGuard?.click();
  } else if (/\b(camera|toggle camera|live stream|video)\b/i.test(c)) {
    toggleCamera();
  } else if (/\b(side view|side)\b/i.test(c)) {
    setSideView(true);
    speakCoach("Side view active.");
  } else if (/\b(front view|front|switch view)\b/i.test(c)) {
    setSideView(false);
    speakCoach("Front view active.");
  } else if (/\b(finish|save|complete|stop workout|end workout|back to level 0)\b/i.test(c)) {
    if (!el.modalSessionReport.classList.contains('hidden')) {
      el.btnFinishSession.click();
    } else {
      speakCoach("Boxing session finished. Saving your progress!");
      window.fitness.complete();
    }
  } else if (/\b(level|stance|hook|slip)\b/i.test(c)) {
    for (let i = 0; i < CURRICULUM.length; i++) {
      if (c.includes(CURRICULUM[i].name.toLowerCase()) || c.includes('level ' + (i + 1)) || c.includes('level ' + i)) {
        selectLevel(i);
        break;
      }
    }
  }
}

// Continuous Direct Browser STT for Boxing Trainer
function initDirectSTT() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;
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
  } catch {}
}
initDirectSTT();

// --- 6. INITIALIZATION ---
function initTrainer() {
  renderCurriculumList();
  setupEventListeners();
  initFitnessIntegration();
  startCanvasAnimation();
}

function startTrainerFromModal() {
  el.modalReadiness.classList.add('hidden');
  selectLevel(0);
}

// --- 7. LESSON STEP MANAGEMENT (NO AUTO-ADVANCING!) ---
function setStep(stepNum) {
  state.currentStep = stepNum;
  el.stepNodes.forEach((node) => {
    const s = parseInt(node.dataset.step, 10);
    node.classList.toggle('active', s === stepNum);
    node.classList.toggle('done', s < stepNum);
  });
}

function selectLevel(levelId) {
  if(state.isPaused)return;
  if (levelId > state.maxUnlockedLevel) return;
  state.currentLevelId = levelId;
  resetLessonStats();
  renderCurriculumList();
  startStep1Explain();
}

function resetLessonStats() {
  lessonTimers.length=0;resetPoseSequence();
  state.attempts = 0;
  state.checkpointsMet = 0;
  state.guardReturns = 0;
  highlightCheckpoints(false, false);
  updateHud();
}

// Step 1: Explain
function startStep1Explain() {
  setStep(1);
  const lvl = CURRICULUM[state.currentLevelId];
  el.userStageTag.textContent = `LEVEL ${lvl.id} · EXPLAIN TECHNIQUE`;
  el.coachSpeechText.textContent = `"${lvl.cue}"`;
  updateCommentary(`${lvl.title}. ${lvl.explainText}`);
  el.btnNextAction.textContent = "Watch Demonstration → [Or Say 'Next']";
  el.btnNextAction.disabled = false;
}

// Step 2: Demonstrate
function startStep2Demonstrate() {
  setStep(2);
  const lvl = CURRICULUM[state.currentLevelId];
  el.userStageTag.textContent = "COACH DEMONSTRATION · WATCH FORM";
  el.coachSpeechText.textContent = `"${lvl.cue}"`;
  updateCommentary(`Watch Coach Alex demonstrate. ${lvl.cue}. Notice the clean return to guard.`);
  el.btnNextAction.textContent = "I'm Ready to Practice → [Or Say 'Go']";
  el.btnNextAction.disabled = false;
}

// Step 3: Ready
function startStep3Ready() {
  setStep(3);
  el.userStageTag.textContent = "STEP 3 · ASSUME GUARD & POSTURE";
  updateCommentary("Assume your guard stance. Hands near cheeks, chin gently tucked. Say 'Go' when ready!");
  el.btnNextAction.textContent = "Begin Practice → [Or Say 'Go']";
  el.btnNextAction.disabled = false;
}

// Step 4: Practise (Waits for User Movements / Commands - DOES NOT Auto-advance!)
function startStep4Practise() {
  setStep(4);
  const lvl = CURRICULUM[state.currentLevelId];
  el.userStageTag.textContent = `STEP 4 · PRACTISE WITH CUES (${state.attempts}/${lvl.targetReps} Reps)`;
  updateCommentary(`Practice mode: ${lvl.cue}. Perform your movement or say 'Go' to verify form.`);
  el.btnNextAction.textContent = "Next Step → [Or Say 'Next']";
  el.btnNextAction.disabled = false;
}

// Explicit User Repetition Trigger
function userPerformRep(isCorrect) {
  if(state.isPaused)return;
  if(isCorrect){
    if(!poseState.valid || performance.now()-poseState.at>1500){showFeedback('Full body tracking required. Step back into view.',true);return}
    const level=state.currentLevelId;
    isCorrect=poseState.guard&&poseState.balanced&&(
      level===0 || level===1&&poseState.stepped || level===2&&poseState.left ||
      level===3&&poseState.right || level===4&&poseState.combo ||
      level===5&&poseState.slipped || level===6&&poseState.left&&poseState.right&&poseState.slipped);
  }

  if (state.currentStep !== 4 && state.currentStep !== 6) return;
  const lvl = CURRICULUM[state.currentLevelId];

  if (isCorrect) {
    executePostureCheck(true, lvl.successMsg);
  } else {
    executePostureCheck(false, "Adjust this posture: bring both hands up near your cheeks!");
  }
}

// Step 5: Check Posture
function executePostureCheck(isCorrect, commentary, flags = {}) {
  setStep(5);
  state.attempts++;

  if (isCorrect) {
    state.checkpointsMet++;
    state.guardReturns++;
    state.score += 35;
    highlightCheckpoints(true, true);
    showFeedback("Right! Excellent form!", false);
    // Verbal spoken commentary via TTS: "Right! ..."
    updateCommentary(commentary || "Right! Excellent guard and posture control.", true);
  } else {
    // No points for an unverified repetition.
    highlightCheckpoints(false, flags.guardOk === true);
    showFeedback("Adjust Posture", true);
    // Verbal spoken critique: "Adjust this posture: ..."
    updateCommentary(commentary || "Adjust this posture: bring your hands up to protect your cheeks.", false);
  }

  updateHud();
  window.fitness.score(state.score,state.attempts?100*state.checkpointsMet/state.attempts:0);
  resetPoseSequence();

  const lvl = CURRICULUM[state.currentLevelId];
  if (state.attempts >= lvl.targetReps) {
    // If all target reps are done -> prompt review
    lessonDelay(() => startStep7Review(), 2000);
  } else {
    // Return to practice for next rep
    lessonDelay(() => {
      setStep(4);
      el.userStageTag.textContent = `STEP 4 · PRACTISE (${state.attempts}/${lvl.targetReps} Reps)`;
    }, 1800);
  }
}

// Step 7: Review & Level Assessment
function startStep7Review() {
  setStep(7);
  el.btnNextAction.disabled = false;
  const lvl = CURRICULUM[state.currentLevelId];
  const passRate = state.checkpointsMet / state.attempts;
  const isPassed = passRate >= lvl.passRatio;

  el.assessAttempts.textContent = `${state.attempts} / ${lvl.targetReps}`;
  el.assessCheckpoints.textContent = `${state.checkpointsMet} / ${state.attempts}`;
  el.assessGuards.textContent = `${Math.round((state.guardReturns / state.attempts) * 100)}%`;
  el.assessScore.textContent = `+${state.score} pts`;

  if (isPassed) {
    el.assessIcon.textContent = "🎉";
    el.assessTitle.textContent = "Round Passed! Moving to Next Level";
    el.assessDesc.textContent = "Right! You maintained proper guard, soft knees, and clean returns.";
    el.btnAssessProceed.textContent = state.currentLevelId < CURRICULUM.length - 1 ? "Next Level → [Say 'Next']" : "Finish Session 🏆";
    updateCommentary(`Round passed! Excellent posture control. Say 'Next' to unlock ${CURRICULUM[Math.min(state.currentLevelId + 1, CURRICULUM.length - 1)].title}`, true);

    if (state.currentLevelId >= state.maxUnlockedLevel && state.currentLevelId < CURRICULUM.length - 1) {
      state.maxUnlockedLevel = state.currentLevelId + 1;
      renderCurriculumList();
    }
  } else {
    el.assessIcon.textContent = "🌱";
    el.assessTitle.textContent = "Practice & Refine Your Posture";
    el.assessDesc.textContent = "Good effort! Focus on keeping your hands near your cheeks on every repetition.";
    el.btnAssessProceed.textContent = "Practice Again → [Say 'Repeat']";
    updateCommentary("Round completed. Let's practice and refine your posture. Say 'Repeat' to try again.", false);
  }

  el.modalAssessment.classList.remove('hidden');
}

function advanceNextStep() {
  if(state.isPaused)return;
  if (state.currentStep === 1) startStep2Demonstrate();
  else if (state.currentStep === 2) startStep3Ready();
  else if (state.currentStep === 3) startStep4Practise();
  else if (state.currentStep === 4) userPerformRep(true);
  else if (state.currentStep === 6) startStep4Practise();
  else if (state.currentStep === 7) {
    if(state.checkpointsMet/Math.max(1,state.attempts)<CURRICULUM[state.currentLevelId].passRatio){el.btnAssessRetry.click();return;}
    el.modalAssessment.classList.add('hidden');
    if (state.currentLevelId < CURRICULUM.length - 1) selectLevel(state.currentLevelId + 1);
    else showSessionReport();
  }
}

function showSessionReport() {
  el.modalAssessment.classList.add('hidden');
  el.modalSessionReport.classList.remove('hidden');
  const durationSec = Math.floor((Date.now() - state.sessionStartTime) / 1000);
  const min = Math.floor(durationSec / 60).toString().padStart(2, '0');
  const sec = (durationSec % 60).toString().padStart(2, '0');

  document.getElementById('repTotalScore').textContent = `${state.score} pts`;
  document.getElementById('repHighestLevel').textContent = CURRICULUM[state.maxUnlockedLevel].title;
  document.getElementById('repDuration').textContent = `${min}:${sec}`;
  updateCommentary("Session completed! Congratulations on completing your boxing training.", true);
}

// --- 8. HUD & CHECKPOINTS ---
function updateHud() {
  const lvl = CURRICULUM[state.currentLevelId];
  el.hudLevelTitle.textContent = lvl.title;
  el.hudLevelSubtitle.textContent = lvl.subtitle;
  el.hudReps.textContent = `${state.attempts} / ${lvl.targetReps}`;
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
  el.unlockedCount.textContent = `Unlocked: Level ${state.maxUnlockedLevel}`;

  CURRICULUM.forEach((lvl) => {
    const row = document.createElement('div');
    const isLocked = lvl.id > state.maxUnlockedLevel;
    const isActive = lvl.id === state.currentLevelId;

    row.className = `level-row ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
    row.innerHTML = `
      <div class="level-row-left">
        <span class="level-row-title">${lvl.title}</span>
        <span class="level-row-sub">${lvl.subtitle}</span>
      </div>
      <span class="level-status-tag">${isLocked ? '🔒' : isActive ? '▶ Active' : '✓ Unlocked'}</span>
    `;

    if (!isLocked) {
      row.addEventListener('click', () => {
        selectLevel(lvl.id);
        speakCoach(`Selected ${lvl.title}. ${lvl.cue}`);
      });
    }
    el.levelList.appendChild(row);
  });
}

function setSpeedMode(slower) {
  state.isSlowerMode = slower;
  el.btnSlower.textContent = state.isSlowerMode ? '⏱ Pace: Slower' : '⏱ Pace: Normal';
  showFeedback(state.isSlowerMode ? 'Demo pace: 60%' : 'Demo pace: Normal');
}

function setSideView(side) {
  state.showSideView = side;
  el.btnToggleSideView.classList.toggle('active', state.showSideView);
  showFeedback(state.showSideView ? 'Profile Angle' : 'Frontal Angle');
}

function togglePause(forceState = null) {
  if(forceState===null){state.isPaused?window.fitness.resume():window.fitness.pause();return;}
  state.isPaused = forceState;
  el.btnPause.textContent = state.isPaused ? '▶ Resume' : '⏸ Pause';
  showFeedback(state.isPaused ? 'Session Paused' : 'Session Resumed');
}

function toggleCamera(){el.webcamVideo.hidden=!el.webcamVideo.hidden;}

// --- 9. CLEAN COACH RENDERING (NO GHOST LIMBS!) ---
let animTime = 0;
function startCanvasAnimation() {
  function loop() {
    if (!state.isPaused) {
      animTime += 0.02 * (state.isSlowerMode ? 0.6 : 1.0);
      drawCoach(animTime);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function drawCoach(t) {
  const w = el.coachCanvas.width;
  const h = el.coachCanvas.height;
  coachCtx.clearRect(0, 0, w, h);

  // Background Grid
  coachCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  coachCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 30) {
    coachCtx.beginPath(); coachCtx.moveTo(x, 0); coachCtx.lineTo(x, h); coachCtx.stroke();
  }

  // Shadow
  coachCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  coachCtx.beginPath();
  coachCtx.ellipse(w / 2, h - 30, 60, 12, 0, 0, Math.PI * 2);
  coachCtx.fill();

  const lvl = CURRICULUM[state.currentLevelId];
  const anim = lvl.demoAnim;
  const cycle = (t % 3.0) / 3.0;

  const cx = w / 2;
  const cy = h / 2 + 10;

  let headY = cy - 75;
  let headX = cx;
  let leftGlove = { x: cx - 22, y: cy - 55 };
  let rightGlove = { x: cx + 22, y: cy - 52 };
  let leftFoot = { x: cx - 30, y: cy + 70 };
  let rightFoot = { x: cx + 30, y: cy + 70 };

  if (anim === 'guard_stance') {
    const sway = Math.sin(t * 2.5) * 3;
    headX += sway * 0.4;
    leftGlove.x += sway * 0.3;
    rightGlove.x += sway * 0.3;
  } else if (anim === 'lead_jab') {
    if (cycle < 0.35) {
      const p = cycle / 0.35;
      leftGlove.x = cx - 22 - 60 * p;
      leftGlove.y = cy - 55 - 6 * p;
    } else if (cycle < 0.65) {
      const p = (cycle - 0.35) / 0.30;
      leftGlove.x = (cx - 82) + 60 * p;
      leftGlove.y = (cy - 61) + 6 * p;
    }
  } else if (anim === 'rear_cross') {
    if (cycle < 0.35) {
      const p = cycle / 0.35;
      rightGlove.x = cx + 22 + 65 * p;
      rightGlove.y = cy - 52 - 8 * p;
    } else if (cycle < 0.65) {
      const p = (cycle - 0.35) / 0.30;
      rightGlove.x = (cx + 87) - 65 * p;
      rightGlove.y = (cy - 60) + 8 * p;
    }
  } else if (anim === 'slip_dodge') {
    const slip = Math.sin(cycle * Math.PI * 2) * 25;
    headX += slip;
    leftGlove.x += slip * 0.7;
    rightGlove.x += slip * 0.7;
  }

  // Draw Clean Single Coach Figure (NO extra phantom hands!)
  coachCtx.strokeStyle = '#00e5ff';
  coachCtx.lineWidth = 6;
  coachCtx.lineCap = 'round';

  // Torso
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
  coachCtx.moveTo(headX - 18, headY + 22); coachCtx.lineTo(leftGlove.x, leftGlove.y);
  coachCtx.moveTo(headX + 18, headY + 22); coachCtx.lineTo(rightGlove.x, rightGlove.y);
  coachCtx.stroke();

  // Gloves
  coachCtx.fillStyle = '#ff5252';
  coachCtx.beginPath(); coachCtx.arc(leftGlove.x, leftGlove.y, 9, 0, Math.PI * 2); coachCtx.fill();
  coachCtx.beginPath(); coachCtx.arc(rightGlove.x, rightGlove.y, 9, 0, Math.PI * 2); coachCtx.fill();

  // Head
  coachCtx.fillStyle = '#ffcc80';
  coachCtx.beginPath(); coachCtx.arc(headX, headY, 14, 0, Math.PI * 2); coachCtx.fill();
  coachCtx.strokeStyle = '#1a237e'; coachCtx.lineWidth = 3;
  coachCtx.beginPath(); coachCtx.arc(headX, headY - 2, 14, Math.PI, 0); coachCtx.stroke();
}

// --- 10. EVENT LISTENERS ---
function setupEventListeners() {
  el.btnStartWarmup.addEventListener('click', () => {
    startTrainerFromModal();
    speakCoach("Warm up started. Step into guard stance and say Go when ready!");
  });
  el.btnNextAction.addEventListener('click', () => {
    speakCoach("Advancing to next step.");
    advanceNextStep();
  });
  el.btnRepeat.addEventListener('click', () => {
    speakCoach("Repeating practice step.");
    resetLessonStats();
    startStep4Practise();
  });
  el.btnWatchDemo.addEventListener('click', () => {
    speakCoach("Watching coach demonstration.");
    startStep2Demonstrate();
  });
  el.btnSlower.addEventListener('click', () => {
    const nextMode = !state.isSlowerMode;
    setSpeedMode(nextMode);
    speakCoach(nextMode ? "Demonstration speed slowed." : "Demonstration speed normal.");
  });
  el.btnPause.addEventListener('click', () => {
    togglePause();
    speakCoach(state.isPaused ? "Boxing paused." : "Boxing resumed.");
  });
  el.btnReplayAudio.addEventListener('click', () => {
    if (state.lastSpokenCommentary) speakCoach(state.lastSpokenCommentary);
  });

  el.btnToggleCamera.addEventListener('click', () => {
    toggleCamera();
    speakCoach("Camera display toggled.");
  });
  el.btnToggleSideView.addEventListener('click', () => {
    setSideView(!state.showSideView);
    speakCoach(state.showSideView ? "Side view active." : "Front view active.");
  });

  // Movement Trigger Buttons (User Controls Pacing)
  el.btnPerformRep.addEventListener('click', () => {
    speakCoach("Evaluating movement repetition.");
    userPerformRep(true);
  });
  el.btnSimNoGuard.addEventListener('click', () => {
    speakCoach("Testing low guard. Keep your hands up near your chin!");
    userPerformRep(false);
  });

  // Assessment Modals
  el.btnAssessProceed.addEventListener('click', () => {
    if(state.checkpointsMet/Math.max(1,state.attempts)<CURRICULUM[state.currentLevelId].passRatio){
      speakCoach("Checkpoints not yet met. Retrying round.");
      el.btnAssessRetry.click();
      return;
    }
    el.modalAssessment.classList.add('hidden');
    if (state.currentLevelId < CURRICULUM.length - 1) {
      speakCoach("Proceeding to next level!");
      selectLevel(state.currentLevelId + 1);
    } else {
      speakCoach("All curriculum levels complete! Showing workout report.");
      showSessionReport();
    }
  });

  el.btnAssessRetry.addEventListener('click', () => {
    speakCoach("Retrying assessment round.");
    el.modalAssessment.classList.add('hidden');
    resetLessonStats();
    startStep4Practise();
  });

  document.getElementById('btnFinishSession').addEventListener('click', () => {
    speakCoach("Boxing session finished. Saving your workout.");
    window.fitness.complete();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if(state.isPaused)return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (!el.modalReadiness.classList.contains('hidden')) startTrainerFromModal();
      else if (!el.modalAssessment.classList.contains('hidden')) el.btnAssessProceed.click();
      else advanceNextStep();
    } else if (e.key === 'r' || e.key === 'R') {
      resetLessonStats();
      startStep4Practise();
    } else if (e.key === 's' || e.key === 'S') {
      setSpeedMode(!state.isSlowerMode);
    } else if (e.key === 'd' || e.key === 'D') {
      startStep2Demonstrate();
    } else if (e.key === 'p' || e.key === 'P') {
      togglePause();
    } else if (e.key === '1' || e.key === 'j') {
      userPerformRep(true);
    } else if (e.key >= '2' && e.key <= '7') {
      selectLevel(parseInt(e.key, 10) - 1);
    }
  });
}

window.addEventListener('DOMContentLoaded', initTrainer);

// Shared camera and body-pose adapter. These are simple 2D checkpoints, not
// a clinical assessment or verification of rotation/depth/impact technique.
const poseState={valid:false,at:0};
const lessonTimers=[];
function resetPoseSequence(){Object.assign(poseState,{left:false,right:false,combo:false,stepped:false,slipped:false,baseX:null,baseHead:null})}
function lessonDelay(fn,ms){lessonTimers.push({fn,left:ms})}
let timerAt=performance.now();
setInterval(()=>{const now=performance.now(),dt=Math.min(now-timerAt,100);timerAt=now;if(state.isPaused)return;for(let i=lessonTimers.length-1;i>=0;i--){const t=lessonTimers[i];t.left-=dt;if(t.left<=0){lessonTimers.splice(i,1);t.fn()}}},50);
function receivePose(m){
 const p=m.landmarks||[];poseState.at=performance.now();
 poseState.valid=p.length>=29&&[0,11,12,15,16,23,24,27,28].every(i=>(p[i].visibility??0)>.5);
 if(!poseState.valid)return;
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const shoulder={x:(p[11].x+p[12].x)/2,y:(p[11].y+p[12].y)/2};
 const hip={x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2};
 const torso=Math.max(.1,dist(shoulder,hip));
 poseState.guard=dist(p[15],p[0])<torso*.85&&dist(p[16],p[0])<torso*.85;
 poseState.balanced=Math.abs(p[27].x-p[28].x)>Math.abs(p[11].x-p[12].x)*.5;
 highlightCheckpoints(poseState.balanced,poseState.guard);
 if(![4,6].includes(state.currentStep))return;
 if(poseState.baseX===null){poseState.baseX=hip.x;poseState.baseHead=p[0].x}
 if(dist(p[15],p[11])>torso*1.05)poseState.left=true;
 if(dist(p[16],p[12])>torso*1.05){poseState.right=true;if(poseState.left)poseState.combo=true}
 if(Math.abs(hip.x-poseState.baseX)>torso*.25)poseState.stepped=true;
 if(Math.abs(p[0].x-poseState.baseHead)>torso*.2)poseState.slipped=true;
 // Return to guard completes a movement; stance drills require an explicit check.
 if(state.currentLevelId>0&&poseState.guard&&(poseState.left||poseState.right||poseState.stepped||poseState.slipped))userPerformRep(true);
}

function initFitnessIntegration(){
 resetPoseSequence();state.isPaused=true;
 el.cameraStream.style.display='none';el.webcamVideo.style.display='block';
 el.voiceLabel.textContent='Voice: shared app controls';
 window.fitness.onMessage(async m=>{
  if(m.type==='initialize'){
   togglePause(Boolean(m.paused));
   try{el.webcamVideo.srcObject=await window.fitness.getCamera();await el.webcamVideo.play()}catch(e){showFeedback(e.message,true)}
   speakCoach("Welcome to Boxing Trainer. Say Go or click Start when you are in position.");
  }
  if(m.type==='movement'&&!state.isPaused)receivePose(m);
  if(m.type==='pause'||m.type==='stop')togglePause(true);
  if(m.type==='resume')togglePause(false);
  if(m.type==='command')handleVoiceCommand(m.text.toLowerCase());
  if(m.type==='difficulty')setSpeedMode(m.level<=2);
 });
 window.fitness.ready();
}
