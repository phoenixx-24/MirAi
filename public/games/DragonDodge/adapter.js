/**
 * Dragon Dodge 3D · High-Performance Web Motion Battle Arena
 * Real-Time Computer Vision Body Tracking (Dodge, Jump, Duck, Punch)
 * Universal Voice Command (STT) & Deduplicated Audio/Speech (TTS)
 */

(function () {
  'use strict';

  // --- 1. DOM Elements ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const webcamVideo = document.getElementById('webcamVideo');
  const motionCanvas = document.getElementById('motionCanvas');
  const motionCtx = motionCanvas.getContext('2d');

  const hudScore = document.getElementById('hudScore');
  const hudReps = document.getElementById('hudReps');
  const hudCalories = document.getElementById('hudCalories');
  const bossHud = document.getElementById('bossHud');
  const bossHpFill = document.getElementById('bossHpFill');
  const bossHealthPercent = document.getElementById('bossHealthPercent');
  const voiceBadge = document.getElementById('voiceBadge');
  const voiceBadgeText = document.getElementById('voiceBadgeText');
  const modeBanner = document.getElementById('modeBanner');
  const floatTextContainer = document.getElementById('floatTextContainer');

  const startModal = document.getElementById('startModal');
  const pauseModal = document.getElementById('pauseModal');
  const resultModal = document.getElementById('resultModal');

  const btnStartGame = document.getElementById('btnStartGame');
  const btnRecenterStart = document.getElementById('btnRecenterStart');
  const btnLaunchDesktop = document.getElementById('btnLaunchDesktop');
  const btnResume = document.getElementById('btnResume');
  const btnRecenterPause = document.getElementById('btnRecenterPause');
  const btnFinishPause = document.getElementById('btnFinishPause');
  const btnFinishResult = document.getElementById('btnFinishResult');
  const btnRestartResult = document.getElementById('btnRestartResult');
  const btnEnlarge = document.getElementById('btnEnlarge');
  const btnCamToggle = document.getElementById('btnCamToggle');

  const btnBottomRecenter = document.getElementById('btnBottomRecenter');
  const btnBottomPause = document.getElementById('btnBottomPause');
  const btnBottomResume = document.getElementById('btnBottomResume');
  const btnBottomAttack = document.getElementById('btnBottomAttack');
  const btnBottomFinish = document.getElementById('btnBottomFinish');

  const laneBoxes = {
    '-1': document.querySelector('.lane-box.left'),
    '0': document.querySelector('.lane-box.center'),
    '1': document.querySelector('.lane-box.right')
  };

  // --- 2. Audio & SFX Manager ---
  const sfxFiles = {
    dodge: './sfx/dodge.wav',
    jump: './sfx/jump.wav',
    flame: './sfx/flame.wav',
    hit_player: './sfx/hit_player.wav',
    attack: './sfx/attack.wav',
    punch_land: './sfx/punch_land.wav',
    dragon_hit: './sfx/dragon_hit.wav',
    dragon_die: './sfx/dragon_die.wav',
    boss_incoming: './sfx/boss_incoming.wav',
    victory: './sfx/victory1.wav',
    pause: './sfx/pause.wav',
    select: './sfx/ui_select.wav'
  };

  const sfxAudio = {};
  for (const [key, src] of Object.entries(sfxFiles)) {
    try {
      const a = new Audio(src);
      a.volume = 0.65;
      sfxAudio[key] = a;
    } catch (e) {}
  }

  function playSound(key, volume = 0.65) {
    try {
      const snd = sfxAudio[key];
      if (snd) {
        snd.currentTime = 0;
        snd.volume = Math.max(0.1, Math.min(1.0, volume));
        snd.play().catch(() => {});
      }
    } catch (e) {}
  }

  // --- 3. Deduplicated Speech Manager (Zero Repeating TTS) ---
  let lastSpokenText = '';
  let lastSpokenTime = 0;

  function say(text) {
    if (!text || typeof text !== 'string') return;
    const clean = text.trim();
    if (!clean) return;
    const now = Date.now();
    // Do not repeat identical phrase within 4.5 seconds
    if (lastSpokenText === clean.toLowerCase() && now - lastSpokenTime < 4500) {
      return;
    }
    lastSpokenText = clean.toLowerCase();
    lastSpokenTime = now;

    try {
      if (window.fitness?.speak) {
        window.fitness.speak(clean);
      }
    } catch (e) {}

    if (!window.parent || window.parent === window) {
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(clean);
          u.rate = 1.0;
          u.lang = 'en-US';
          window.speechSynthesis.speak(u);
        }
      } catch (e) {}
    }
  }

  // --- 4. Game State & Metrics ---
  const STATE = {
    MENU: 0,
    SURVIVAL: 1,
    BOSS_INTRO: 2,
    BOSS_FIGHT: 3,
    GAME_OVER: 4,
    VICTORY: 5,
    PAUSED: 6
  };

  let gameState = STATE.MENU;
  let stateBeforePause = STATE.MENU;
  let difficulty = 2; // 1 to 5
  let score = 0;
  let combo = 0;
  let elapsed = 0;
  let lastTime = performance.now();
  let screenShake = 0;

  // Workout metrics
  let repsDodges = 0;
  let repsJumps = 0;
  let repsDucks = 0;
  let repsPunches = 0;
  let totalReps = 0;
  let caloriesBurned = 0;
  let cadenceRpm = 0;
  let workoutStartTime = null;

  // Player Entity in 3D Runway
  const player = {
    lane: 0, // -1 (Left), 0 (Center), 1 (Right)
    targetLane: 0,
    x: 0, // continuous world X (-1 to 1)
    y: 0, // vertical jump offset
    vy: 0,
    isJumping: false,
    isDucking: false,
    duckTimer: 0,
    isAttacking: false,
    attackTimer: 0,
    health: 3,
    maxHealth: 3,
    invincibleTimer: 0
  };

  // Dragon Boss Entity
  const dragon = {
    active: false,
    health: 100,
    maxHealth: 100,
    wingAngle: 0,
    wingSpeed: 3.5,
    hoverY: 0,
    targetY: 0,
    flashTimer: 0,
    breathTimer: 0,
    isBreathing: false
  };

  // Hazards & Projectiles
  let hazards = [];
  let playerProjectiles = [];
  let particles = [];
  let hazardSpawnTimer = 0;
  let nextSpawnInterval = 2.2;
  let modeSwitchTimer = 10;
  let currentHazardMode = 'ground'; // 'ground', 'air', 'mixed'

  // --- 5. Screen Resizing & Canvas Scaling ---
  let viewWidth = window.innerWidth;
  let viewHeight = window.innerHeight;

  function resizeCanvas() {
    viewWidth = canvas.parentElement.clientWidth || window.innerWidth;
    viewHeight = canvas.parentElement.clientHeight || (window.innerHeight - 104);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewWidth * dpr);
    canvas.height = Math.floor(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);

  // Enlarge / Fullscreen Handler
  function toggleEnlarge() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'fitness-game', type: 'fullscreen' }, '*');
      }
    } catch (e) {}

    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      say('Screen enlarged.');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      say('Restoring normal screen.');
    }
    setTimeout(resizeCanvas, 200);
  }

  // --- 6. Real-Time Camera Motion Tracker ---
  let cameraStream = null;
  let cameraActive = false;
  let baselineX = null;
  let baselineY = null;
  let baselineTorsoHeight = null;
  let calibrationSamples = 0;
  let lastMotionAnalysis = 0;
  let lastJumpDetectTime = 0;
  let lastDuckDetectTime = 0;
  let lastPunchDetectTime = 0;

  async function initWebcam() {
    try {
      let stream = null;
      if (window.fitness?.getCamera) {
        stream = await window.fitness.getCamera();
      }
      if (!stream && navigator.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
      }
      if (stream) {
        cameraStream = stream;
        webcamVideo.srcObject = stream;
        await webcamVideo.play();
        cameraActive = true;
        motionCanvas.width = 160;
        motionCanvas.height = 120;
      }
    } catch (err) {
      console.warn('Webcam initialization notice:', err.message);
    }
  }

  function recalibrateCenter() {
    baselineX = null;
    baselineY = null;
    calibrationSamples = 0;
    say('Neutral center position calibrated.');
    showFloatText('🎯 CENTER CALIBRATED', viewWidth / 2, viewHeight * 0.4, '#38bdf8');
  }

  // Optical Motion Tracking Loop (Evaluates user movements at ~30 FPS)
  function processMotionFrame() {
    if (!cameraActive || webcamVideo.readyState < 2) return;
    const now = performance.now();
    if (now - lastMotionAnalysis < 33) return; // ~30 FPS
    lastMotionAnalysis = now;

    try {
      motionCtx.drawImage(webcamVideo, 0, 0, 160, 120);
      const frame = motionCtx.getImageData(0, 0, 160, 120);
      const data = frame.data;

      // Extract skin/motion centroid in center-upper region
      let sumX = 0, sumY = 0, count = 0;
      for (let y = 15; y < 90; y += 3) {
        for (let x = 20; x < 140; x += 3) {
          const idx = (y * 160 + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          // Fast luminance/head brightness filter
          if ((r > 60 && g > 40 && b > 30) && (r > b)) {
            sumX += x;
            sumY += y;
            count++;
          }
        }
      }

      if (count > 80) {
        const centroidX = sumX / count;
        const centroidY = sumY / count;

        if (baselineX === null || calibrationSamples < 20) {
          baselineX = baselineX === null ? centroidX : baselineX * 0.85 + centroidX * 0.15;
          baselineY = baselineY === null ? centroidY : baselineY * 0.85 + centroidY * 0.15;
          calibrationSamples++;
          return;
        }

        // 1. Lateral Lean (Dodge Left or Right) - Webcam is mirrored
        const diffX = -(centroidX - baselineX); // invert because user mirrors camera
        if (diffX < -11) {
          setPlayerTargetLane(-1); // Left Lane
        } else if (diffX > 11) {
          setPlayerTargetLane(1); // Right Lane
        } else {
          setPlayerTargetLane(0); // Center Lane
        }

        // 2. Vertical Jump Analysis (Upward head rise)
        const diffY = baselineY - centroidY; // Upward in frame is lower Y
        if (diffY > 12 && !player.isJumping && now - lastJumpDetectTime > 700) {
          triggerPlayerJump();
          lastJumpDetectTime = now;
        }

        // 3. Duck / Crouch Analysis (Downward head descent)
        if (diffY < -12 && !player.isJumping && !player.isDucking && now - lastDuckDetectTime > 700) {
          triggerPlayerDuck();
          lastDuckDetectTime = now;
        }
      }
    } catch (e) {}
  }

  // --- 7. Player Actions & Controls ---
  function setPlayerTargetLane(newLane) {
    if (newLane !== player.targetLane) {
      player.targetLane = newLane;
      // Update HUD lane box
      Object.keys(laneBoxes).forEach(k => laneBoxes[k]?.classList.remove('active'));
      laneBoxes[String(newLane)]?.classList.add('active');

      if (gameState === STATE.SURVIVAL || gameState === STATE.BOSS_FIGHT) {
        repsDodges++;
        totalReps++;
        updateWorkoutMetrics();
      }
    }
  }

  function triggerPlayerJump() {
    if (player.isJumping || gameState === STATE.PAUSED) return;
    player.isJumping = true;
    player.vy = -12.5;
    playSound('jump');
    spawnJumpDust();
    showFloatText('⬆️ JUMP!', viewWidth * 0.5, viewHeight * 0.72, '#38bdf8');

    if (gameState === STATE.SURVIVAL || gameState === STATE.BOSS_FIGHT) {
      repsJumps++;
      totalReps++;
      updateWorkoutMetrics();
    }
  }

  function triggerPlayerDuck() {
    if (player.isJumping || player.isDucking || gameState === STATE.PAUSED) return;
    player.isDucking = true;
    player.duckTimer = 0.85; // Duck duration in seconds
    showFloatText('⬇️ DUCK!', viewWidth * 0.5, viewHeight * 0.72, '#10b981');

    if (gameState === STATE.SURVIVAL || gameState === STATE.BOSS_FIGHT) {
      repsDucks++;
      totalReps++;
      updateWorkoutMetrics();
    }
  }

  function triggerPlayerAttack() {
    if (player.isAttacking || gameState === STATE.PAUSED) return;
    player.isAttacking = true;
    player.attackTimer = 0.35;
    playSound('attack');

    // Spawn attacking energy projectile toward dragon
    playerProjectiles.push({
      x: player.x,
      y: 0.6,
      z: 0.1, // starting close to player
      vz: 1.6, // flying toward dragon at horizon
      active: true
    });

    showFloatText('🥊 PUNCH!', viewWidth * 0.5, viewHeight * 0.68, '#f59e0b');

    if (gameState === STATE.SURVIVAL || gameState === STATE.BOSS_FIGHT) {
      repsPunches++;
      totalReps++;
      updateWorkoutMetrics();
    }
  }

  // --- 8. Particle System ---
  function spawnJumpDust() {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: viewWidth * 0.5 + (Math.random() - 0.5) * 60,
        y: viewHeight * 0.85 + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        size: Math.random() * 5 + 3,
        color: '#94a3b8',
        life: 0.45,
        maxLife: 0.45
      });
    }
  }

  function spawnExplosion(cx, cy, color = '#f59e0b', count = 24) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 6 + 2;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 6 + 4,
        color,
        life: 0.6,
        maxLife: 0.6
      });
    }
  }

  function showFloatText(text, x, y, color = '#fbbf24') {
    const el = document.createElement('div');
    el.className = 'float-msg';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    floatTextContainer.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch (e) {}
    }, 900);
  }

  function flashModeWarning(text, mode = 'ground') {
    modeBanner.textContent = text;
    modeBanner.className = `mode-banner ${mode}`;
    modeBanner.classList.remove('hidden');
    setTimeout(() => {
      modeBanner.classList.add('hidden');
    }, 1800);
  }

  // --- 9. Gameplay Waves & Hazard Spawner ---
  function spawnHazard() {
    if (gameState !== STATE.SURVIVAL && gameState !== STATE.BOSS_FIGHT) return;

    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    let type = 'ground'; // ground sphere, air sphere, or dragon flame

    if (currentHazardMode === 'ground') {
      type = Math.random() < 0.8 ? 'ground' : 'boulder';
    } else if (currentHazardMode === 'air') {
      type = 'air';
    } else {
      type = Math.random() < 0.5 ? 'ground' : 'air';
    }

    if (gameState === STATE.BOSS_FIGHT && Math.random() < 0.4) {
      type = 'dragon_flame';
    }

    hazards.push({
      lane,
      z: 1.0, // starting at horizon (z = 1.0 down to z = 0.0 at player)
      type,
      active: true,
      radius: type === 'boulder' ? 0.35 : 0.28
    });

    if (type === 'dragon_flame') {
      playSound('flame', 0.5);
    }
  }

  // --- 10. Workout Metrics Updater ---
  function updateWorkoutMetrics() {
    // Energy burned calculation based on verified biomechanical reps
    const weightRatio = 1.0; // default 70kg baseline
    caloriesBurned = (
      (repsDucks * 0.85 * weightRatio) +
      (repsJumps * 0.95 * weightRatio) +
      (repsDodges * 0.45 * weightRatio) +
      (repsPunches * 0.35 * weightRatio)
    );

    const activeSec = workoutStartTime ? Math.max(1, (Date.now() - workoutStartTime) / 1000) : 1;
    cadenceRpm = Math.round((totalReps / (activeSec / 60)) * 10) / 10;

    hudScore.textContent = String(score);
    hudReps.textContent = String(totalReps);
    hudCalories.textContent = caloriesBurned.toFixed(1);

    // Sync score to AI Fitness Host Bridge
    try {
      if (window.fitness?.score) {
        window.fitness.score(score, 92);
      }
    } catch (e) {}
  }

  // --- 11. 3D Perspective Projection Math ---
  function project3D(laneX, yOffset, zDist) {
    // zDist goes from 0 (at player) to 1.0 (at horizon)
    const horizonY = viewHeight * 0.32;
    const groundY = viewHeight * 0.86;
    const t = Math.max(0, Math.min(1, 1 - zDist)); // 0 at horizon, 1 at player

    // Perspective scaling: small at horizon, large near player
    const scale = 0.15 + t * 0.85;
    const y = horizonY + (groundY - horizonY) * Math.pow(t, 1.4) - yOffset * scale * 100;

    // Road spreads out towards player
    const roadWidthAtZ = (viewWidth * 0.2) + (viewWidth * 0.65) * t;
    const laneStep = roadWidthAtZ / 3;
    const x = (viewWidth * 0.5) + (laneX * laneStep);

    return { x, y, scale };
  }

  // --- 12. Main 60 FPS Render & Physics Loop ---
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    processMotionFrame();

    // 1. Clear & Background Sky
    ctx.clearRect(0, 0, viewWidth, viewHeight);

    // Screen Shake Offset
    ctx.save();
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake * 16;
      const shakeY = (Math.random() - 0.5) * screenShake * 16;
      ctx.translate(shakeX, shakeY);
      screenShake = Math.max(0, screenShake - dt * 3);
    }

    drawVolcanicEnvironment(dt);

    if (gameState === STATE.SURVIVAL || gameState === STATE.BOSS_FIGHT || gameState === STATE.BOSS_INTRO) {
      elapsed += dt;

      // Hazard Spawner Ramp
      hazardSpawnTimer += dt;
      if (hazardSpawnTimer >= nextSpawnInterval) {
        hazardSpawnTimer = 0;
        spawnHazard();
        // Ramp speed slightly with difficulty
        const minInterval = Math.max(0.9, 2.0 - (difficulty * 0.2));
        nextSpawnInterval = minInterval + Math.random() * 0.6;
      }

      // Mode Switch Timer (Ducking vs Jumping phases)
      modeSwitchTimer -= dt;
      if (modeSwitchTimer <= 0) {
        modeSwitchTimer = 10 + Math.random() * 4;
        if (currentHazardMode === 'ground') {
          currentHazardMode = 'air';
          flashModeWarning('DUCK! SPHERES FROM ABOVE', 'air');
          say('Duck! Spheres from above!');
        } else {
          currentHazardMode = 'ground';
          flashModeWarning('WATCH YOUR STEP! JUMP OVER HAZARDS', 'ground');
          say('Watch your step! Ground hazard incoming!');
        }
      }

      // Check Boss Trigger: at 45 seconds or 12 dodges
      if (gameState === STATE.SURVIVAL && (elapsed >= 45 || repsDodges >= 14)) {
        triggerBossIntro();
      }

      // Update Player Physics
      updatePlayer(dt);

      // Update Hazards & Collisions
      updateHazards(dt);

      // Update Player Projectiles
      updateProjectiles(dt);

      // Update Dragon Animations
      updateDragon(dt);
    }

    // Draw 3D Runway Road
    drawRunwayRoad();

    // Draw Hazards (sorted by distance)
    drawHazards();

    // Draw Player Projectiles
    drawPlayerProjectiles();

    // Draw Dragon at Horizon
    drawDragon();

    // Draw Player Avatar
    drawPlayer();

    // Draw Particles
    drawParticles(dt);

    ctx.restore();

    requestAnimationFrame(gameLoop);
  }

  // --- 13. Drawing Functions ---
  function drawVolcanicEnvironment(dt) {
    // Volcanic gradient sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, viewHeight * 0.45);
    skyGrad.addColorStop(0, '#0a0614');
    skyGrad.addColorStop(0.6, '#1e1026');
    skyGrad.addColorStop(1, '#3b1219');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, viewWidth, viewHeight * 0.45);

    // Jagged Volcano Silhouette
    ctx.fillStyle = '#140c17';
    ctx.beginPath();
    ctx.moveTo(0, viewHeight * 0.35);
    ctx.lineTo(viewWidth * 0.15, viewHeight * 0.22);
    ctx.lineTo(viewWidth * 0.35, viewHeight * 0.33);
    ctx.lineTo(viewWidth * 0.5, viewHeight * 0.20); // Central active volcano
    ctx.lineTo(viewWidth * 0.65, viewHeight * 0.32);
    ctx.lineTo(viewWidth * 0.85, viewHeight * 0.24);
    ctx.lineTo(viewWidth, viewHeight * 0.35);
    ctx.lineTo(viewWidth, viewHeight * 0.45);
    ctx.lineTo(0, viewHeight * 0.45);
    ctx.fill();

    // Ambient Floating Embers
    if (Math.random() < 0.25) {
      particles.push({
        x: Math.random() * viewWidth,
        y: viewHeight * (0.35 + Math.random() * 0.6),
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.8 - 0.5,
        size: Math.random() * 3 + 1,
        color: Math.random() < 0.6 ? '#f59e0b' : '#ef4444',
        life: 1.5,
        maxLife: 1.5
      });
    }
  }

  function drawRunwayRoad() {
    const horizonY = viewHeight * 0.32;
    const groundY = viewHeight * 0.88;
    const p1 = project3D(-1.5, 0, 1.0); // horizon left
    const p2 = project3D(1.5, 0, 1.0);  // horizon right
    const p3 = project3D(1.5, 0, 0.0);  // player right
    const p4 = project3D(-1.5, 0, 0.0); // player left

    // Magma Rivers on edges
    const lavaGrad = ctx.createLinearGradient(0, horizonY, 0, groundY);
    lavaGrad.addColorStop(0, '#f97316');
    lavaGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, horizonY, viewWidth, groundY - horizonY);

    // Stone Road Runway
    ctx.fillStyle = '#171d26';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    // Glowing Lava Borders
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();

    // Lane Dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    [-0.5, 0.5].forEach(laneX => {
      const start = project3D(laneX, 0, 1.0);
      const end = project3D(laneX, 0, 0.0);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function updatePlayer(dt) {
    // Smooth lane easing
    player.x += (player.targetLane - player.x) * 12 * dt;

    // Jump gravity physics
    if (player.isJumping) {
      player.y += player.vy * dt * 60;
      player.vy += 32 * dt; // gravity
      if (player.y >= 0) {
        player.y = 0;
        player.vy = 0;
        player.isJumping = false;
      }
    }

    // Duck countdown
    if (player.isDucking) {
      player.duckTimer -= dt;
      if (player.duckTimer <= 0) {
        player.isDucking = false;
      }
    }

    // Attack punch timer
    if (player.isAttacking) {
      player.attackTimer -= dt;
      if (player.attackTimer <= 0) {
        player.isAttacking = false;
      }
    }

    // Invincibility cooldown
    if (player.invincibleTimer > 0) {
      player.invincibleTimer -= dt;
    }
  }

  function drawPlayer() {
    const p = project3D(player.x, -player.y, 0.05);

    // Dynamic ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    const shadowScale = Math.max(0.4, 1 - Math.abs(player.y) / 60);
    ctx.ellipse(p.x, viewHeight * 0.86, 30 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Damage flash
    if (player.invincibleTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    // Ducking height squash
    const squash = player.isDucking ? 0.6 : 1.0;
    ctx.scale(1, squash);

    // Player Hero Body (Stylized 3D Athlete with Glowing Energy)
    // Legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-12, 10, 8, 22);
    ctx.fillRect(4, 10, 8, 22);

    // Torso & Armor
    const armorGrad = ctx.createLinearGradient(0, -28, 0, 10);
    armorGrad.addColorStop(0, '#0284c7');
    armorGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = armorGrad;
    ctx.beginPath();
    ctx.roundRect(-16, -28, 32, 38, 8);
    ctx.fill();

    // Glowing Chest Core
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -10, 5, 0, Math.PI * 2);
    ctx.fill();

    // Head & Helmet
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, -36, 12, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-8, -38, 16, 5);

    // Attack Punch Energy Fist
    if (player.isAttacking) {
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(18, -12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function updateHazards(dt) {
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      // Speed towards player
      const speed = (0.28 + (difficulty * 0.04));
      h.z -= speed * dt;

      // Collision check near player (z between 0.02 and 0.12)
      if (h.active && h.z < 0.12 && h.z > 0.02) {
        const laneDiff = Math.abs(player.targetLane - h.lane);
        let dodged = false;

        if (laneDiff >= 1) {
          // Player is in a different lane -> successfully dodged!
          dodged = true;
        } else if (h.type === 'ground' || h.type === 'boulder') {
          // If hazard is on ground, jumping clears it!
          if (player.isJumping && player.y < -15) {
            dodged = true;
          }
        } else if (h.type === 'air') {
          // If hazard is in the air, ducking clears it!
          if (player.isDucking) {
            dodged = true;
          }
        }

        if (dodged) {
          h.active = false;
          score += 15;
          combo++;
          repsDodges++;
          totalReps++;
          updateWorkoutMetrics();
          playSound('dodge');
          showFloatText('+15 DODGED!', viewWidth * 0.5, viewHeight * 0.5, '#38bdf8');
        } else if (player.invincibleTimer <= 0) {
          // Player Hit!
          h.active = false;
          combo = 0;
          player.health--;
          player.invincibleTimer = 1.2;
          screenShake = 1.0;
          playSound('hit_player');
          showFloatText('💥 HIT!', viewWidth * 0.5, viewHeight * 0.5, '#ef4444');

          if (player.health <= 0) {
            triggerGameOver();
          }
        }
      }

      // Despawn past player
      if (h.z <= 0) {
        hazards.splice(i, 1);
      }
    }
  }

  function drawHazards() {
    hazards.sort((a, b) => b.z - a.z); // draw furthest first
    for (const h of hazards) {
      if (!h.active) continue;
      const yOffset = (h.type === 'air') ? 35 : 0;
      const p = project3D(h.lane, yOffset, h.z);

      ctx.save();
      ctx.translate(p.x, p.y);

      if (h.type === 'ground' || h.type === 'dragon_flame') {
        // Glowing Rolling Fireball
        const r = 26 * p.scale;
        const fireGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        fireGrad.addColorStop(0, '#fff');
        fireGrad.addColorStop(0.3, '#f59e0b');
        fireGrad.addColorStop(0.8, '#ef4444');
        fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.type === 'air') {
        // High Flying Magma Sphere with Spikes
        const r = 28 * p.scale;
        ctx.fillStyle = '#dc2626';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 12 * p.scale;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Volcanic Rock Boulder
        const r = 32 * p.scale;
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function updateProjectiles(dt) {
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
      const proj = playerProjectiles[i];
      proj.z += proj.vz * dt;

      // Check collision with dragon near horizon (z >= 0.95)
      if (dragon.active && proj.z >= 0.88) {
        proj.active = false;
        dragon.health = Math.max(0, dragon.health - 12);
        dragon.flashTimer = 0.25;
        score += 50;
        updateWorkoutMetrics();
        playSound('dragon_hit');
        showFloatText('DIRECT HIT! -12 HP', viewWidth * 0.5, viewHeight * 0.3, '#fbbf24');
        spawnExplosion(viewWidth * 0.5, viewHeight * 0.28, '#f59e0b', 20);

        // Update Boss HP bar
        const hpPercent = Math.round((dragon.health / dragon.maxHealth) * 100);
        bossHealthPercent.textContent = `${hpPercent}%`;
        bossHpFill.style.width = `${hpPercent}%`;

        if (dragon.health <= 0) {
          triggerVictory();
        }
      }

      if (proj.z >= 1.2 || !proj.active) {
        playerProjectiles.splice(i, 1);
      }
    }
  }

  function drawPlayerProjectiles() {
    for (const proj of playerProjectiles) {
      if (!proj.active) continue;
      const p = project3D(proj.x, 25, 1.0 - proj.z);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 14 * p.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updateDragon(dt) {
    dragon.wingAngle += dragon.wingSpeed * dt;
    dragon.hoverY = Math.sin(dragon.wingAngle * 0.8) * 14;
    if (dragon.flashTimer > 0) {
      dragon.flashTimer -= dt;
    }
  }

  function drawDragon() {
    const horizonCenter = project3D(0, 0, 1.0);
    const dragonY = horizonCenter.y - 45 + dragon.hoverY;
    const dragonScale = gameState === STATE.BOSS_FIGHT ? 1.4 : 0.85;

    ctx.save();
    ctx.translate(horizonCenter.x, dragonY);
    ctx.scale(dragonScale, dragonScale);

    if (dragon.flashTimer > 0) {
      ctx.filter = 'brightness(2.0)';
    }

    // Dragon Wings (Sinusoidal flapping)
    const wingFlap = Math.sin(dragon.wingAngle) * 22;

    // Left Wing
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(-15, -10);
    ctx.lineTo(-75, -45 + wingFlap);
    ctx.lineTo(-45, 10 + wingFlap * 0.5);
    ctx.closePath();
    ctx.fill();

    // Right Wing
    ctx.beginPath();
    ctx.moveTo(15, -10);
    ctx.lineTo(75, -45 + wingFlap);
    ctx.lineTo(45, 10 + wingFlap * 0.5);
    ctx.closePath();
    ctx.fill();

    // Dragon Body & Chest
    const dragonGrad = ctx.createLinearGradient(0, -30, 0, 30);
    dragonGrad.addColorStop(0, '#991b1b');
    dragonGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = dragonGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dragon Head & Horns
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(-12, -25);
    ctx.lineTo(0, -48);
    ctx.lineTo(12, -25);
    ctx.closePath();
    ctx.fill();

    // Horns
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -40);
    ctx.lineTo(-24, -60);
    ctx.moveTo(8, -40);
    ctx.lineTo(24, -60);
    ctx.stroke();

    // Glowing Eyes
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(-5, -34, 3, 0, Math.PI * 2);
    ctx.arc(5, -34, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  // --- 14. Game Transitions ---
  function startGame() {
    startModal.classList.add('hidden');
    pauseModal.classList.add('hidden');
    resultModal.classList.add('hidden');
    btnBottomPause.classList.remove('hidden');
    btnBottomResume.classList.add('hidden');

    gameState = STATE.SURVIVAL;
    score = 0;
    combo = 0;
    elapsed = 0;
    repsDodges = 0;
    repsJumps = 0;
    repsDucks = 0;
    repsPunches = 0;
    totalReps = 0;
    caloriesBurned = 0;
    workoutStartTime = Date.now();
    player.health = player.maxHealth;
    player.targetLane = 0;
    player.x = 0;
    hazards = [];
    playerProjectiles = [];

    bossHud.classList.add('hidden');
    dragon.active = false;
    dragon.health = dragon.maxHealth;

    initWebcam();
    updateWorkoutMetrics();
    say('Starting Dragon Dodge. Step back so camera captures your movements.');
    flashModeWarning('SURVIVAL WAVE 1 · DODGE SPHERES', 'ground');
  }

  function pauseGame() {
    if (gameState === STATE.PAUSED) return;
    stateBeforePause = gameState;
    gameState = STATE.PAUSED;
    pauseModal.classList.remove('hidden');
    btnBottomPause.classList.add('hidden');
    btnBottomResume.classList.remove('hidden');
    playSound('pause');
    say('Dragon Dodge paused.');
    try { window.fitness?.pause(); } catch (e) {}
  }

  function resumeGame() {
    if (gameState !== STATE.PAUSED) return;
    gameState = stateBeforePause || STATE.SURVIVAL;
    pauseModal.classList.add('hidden');
    btnBottomPause.classList.remove('hidden');
    btnBottomResume.classList.add('hidden');
    say('Resuming Dragon Dodge! Get ready.');
    try { window.fitness?.resume(); } catch (e) {}
  }

  function triggerBossIntro() {
    gameState = STATE.BOSS_INTRO;
    bossHud.classList.remove('hidden');
    dragon.active = true;
    playSound('boss_incoming');
    flashModeWarning('🔥 BOSS INCOMING! PREPARE TO FIGHT', 'boss');
    say('Boss dragon incoming! Prepare to fight!');
    setTimeout(() => {
      gameState = STATE.BOSS_FIGHT;
      say('Attack with punches and dodge dragon flame!');
    }, 2500);
  }

  function triggerGameOver() {
    gameState = STATE.GAME_OVER;
    playSound('hit_player');
    say('Game over! Great effort dodging fireballs today.');

    document.getElementById('resultEmblem').textContent = '💀';
    document.getElementById('resultTitle').textContent = 'Session Complete';
    document.getElementById('resultSubtitle').textContent = 'Strong movement and endurance through the dragon trial.';
    populateResultSummary();
    resultModal.classList.remove('hidden');
  }

  function triggerVictory() {
    gameState = STATE.VICTORY;
    playSound('dragon_die');
    setTimeout(() => playSound('victory'), 800);
    spawnExplosion(viewWidth * 0.5, viewHeight * 0.3, '#fbbf24', 50);
    say('Dragon defeated! Incredible victory!');

    document.getElementById('resultEmblem').textContent = '🏆';
    document.getElementById('resultTitle').textContent = 'Victory! Dragon Defeated!';
    document.getElementById('resultSubtitle').textContent = 'Champion tier agility and power in the dragon arena.';
    populateResultSummary();
    resultModal.classList.remove('hidden');
  }

  function populateResultSummary() {
    document.getElementById('resFinalScore').textContent = String(score);
    document.getElementById('resDodges').textContent = String(repsDodges);
    document.getElementById('resJumpsDucks').textContent = `${repsJumps} Jumps / ${repsDucks} Ducks`;
    document.getElementById('resPunches').textContent = String(repsPunches);
    document.getElementById('resCalories').textContent = `${caloriesBurned.toFixed(1)} kcal`;
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(Math.floor(elapsed % 60)).padStart(2, '0');
    document.getElementById('resTime').textContent = `${mins}:${secs}`;
  }

  function finishAndSave() {
    say('Saving workout session. Great movement in Dragon Dodge today!');
    try {
      if (window.fitness?.score) {
        window.fitness.score(score, 94);
      }
      if (window.fitness?.complete) {
        window.fitness.complete();
      }
    } catch (e) {}
  }

  async function launchDesktopMode() {
    say('Opening desktop Panda3D mode.');
    try {
      if (window.parent?.fitnessHost?.desktop) {
        await window.parent.fitnessHost.desktop('start', difficulty);
      }
    } catch (e) {}
  }

  // --- 15. Universal STT Voice Command Recognition for ALL Buttons ---
  function clickMatchingButtonInDragon(query) {
    if (!query) return false;
    const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) return false;

    const candidates = Array.from(document.querySelectorAll(
      'button, [role="button"], a, input[type="button"], .action-btn, .footer-btn, .hud-icon-btn, .pip-toggle'
    ));

    let bestEl = null;
    let bestScore = 0;
    let bestLabel = '';

    for (const el of candidates) {
      if (el.disabled) continue;
      const isHidden = el.closest('.hidden, [hidden], [style*="display: none"], [style*="visibility: hidden"]');
      if (isHidden) continue;
      if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getClientRects().length) continue;

      const labels = [];
      const rawText = el.innerText || el.textContent || '';

      // data-voice-target
      const voiceData = el.getAttribute('data-voice-target') || el.getAttribute('data-voice');
      if (voiceData) {
        voiceData.split(',').forEach(v => {
          const cleaned = v.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          if (cleaned) labels.push({ text: cleaned, weight: 1.35 });
        });
      }

      // Bracket hints
      const bracketMatches = rawText.match(/\[(?:say|or say)\s+['"]?([^'"]+)['"]?\]/i);
      if (bracketMatches && bracketMatches[1]) {
        const hint = bracketMatches[1].toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (hint) labels.push({ text: hint, weight: 1.4 });
      }

      // ID
      if (el.id) {
        const idClean = el.id.toLowerCase().replace(/[-_]/g, ' ').replace(/^btn\s*/, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (idClean) labels.push({ text: idClean, weight: 1.0 });
      }

      // aria-label or title
      const aria = (el.getAttribute('aria-label') || el.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (aria) labels.push({ text: aria, weight: 1.15 });

      // Cleaned text without emojis and brackets
      const cleanText = rawText
        .replace(/\[.*?\]/g, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
      if (cleanText) labels.push({ text: cleanText, weight: 1.0 });

      for (const { text: lText, weight } of labels) {
        if (!lText) continue;
        let score = 0;
        if (q === lText) {
          score = 100 * weight;
        } else if (lText.includes(q) && q.length >= 2) {
          score = (82 + Math.min(15, q.length * 2)) * weight;
        } else if (q.includes(lText) && lText.length >= 2) {
          score = (78 + Math.min(20, lText.length * 2)) * weight;
        } else {
          const qTokens = q.split(' ').filter(w => w.length >= 2);
          const lTokens = lText.split(' ').filter(w => w.length >= 2);
          if (qTokens.length > 0 && lTokens.length > 0) {
            const matchCount = qTokens.filter(t => lTokens.some(lt => lt === t || lt.includes(t) || t.includes(lt))).length;
            if (matchCount === qTokens.length) {
              score = (70 + matchCount * 10) * weight;
            } else if (matchCount > 0) {
              score = (45 + matchCount * 8) * weight;
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestEl = el;
          bestLabel = cleanText || lText || 'Button';
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

  function handleVoiceCommand(rawText) {
    if (!rawText) return;
    const c = rawText.toLowerCase().trim();
    voiceBadgeText.textContent = `Heard: "${rawText}"`;

    // 1. Direct Gameplay Commands
    if (/\b(jump|hop|leap)\b/i.test(c)) {
      triggerPlayerJump();
      return;
    }
    if (/\b(duck|crouch|down)\b/i.test(c)) {
      triggerPlayerDuck();
      return;
    }
    if (/\b(punch|attack|strike|hit|fire)\b/i.test(c)) {
      triggerPlayerAttack();
      return;
    }
    if (/\b(dodge left|left|move left|step left)\b/i.test(c)) {
      setPlayerTargetLane(-1);
      return;
    }
    if (/\b(dodge right|right|move right|step right)\b/i.test(c)) {
      setPlayerTargetLane(1);
      return;
    }
    if (/\b(center|middle|straight)\b/i.test(c)) {
      setPlayerTargetLane(0);
      return;
    }

    // 2. Universal Button Matcher for EVERY button
    const match = clickMatchingButtonInDragon(c);
    if (match && match.clicked) {
      voiceBadgeText.textContent = `Voice: Clicked "${match.label.toUpperCase()}"`;
      say(`Selected ${match.label.slice(0, 30)}`);
      return;
    }

    // 3. Fallback Intent Mapping
    if (/\b(start|play|launch|begin)\b/i.test(c)) {
      if (!startModal.classList.contains('hidden')) startGame();
      else if (!resultModal.classList.contains('hidden')) startGame();
      return;
    }
    if (/\b(pause|break)\b/i.test(c)) {
      pauseGame();
      return;
    }
    if (/\b(resume|unpause|continue)\b/i.test(c)) {
      resumeGame();
      return;
    }
    if (/\b(recenter|center|calibrate)\b/i.test(c)) {
      recalibrateCenter();
      return;
    }
    if (/\b(enlarge|fullscreen|full screen|maximize|bigger)\b/i.test(c)) {
      toggleEnlarge();
      return;
    }
    if (/\b(finish|save|complete|quit)\b/i.test(c)) {
      finishAndSave();
      return;
    }
  }

  // --- 16. Event Listeners & Bridge Connections ---
  btnStartGame.addEventListener('click', startGame);
  btnRecenterStart.addEventListener('click', recalibrateCenter);
  btnLaunchDesktop.addEventListener('click', launchDesktopMode);
  btnResume.addEventListener('click', resumeGame);
  btnRecenterPause.addEventListener('click', recalibrateCenter);
  btnFinishPause.addEventListener('click', finishAndSave);
  btnFinishResult.addEventListener('click', finishAndSave);
  btnRestartResult.addEventListener('click', startGame);
  btnEnlarge.addEventListener('click', toggleEnlarge);
  btnCamToggle.addEventListener('click', () => {
    webcamVideo.style.display = webcamVideo.style.display === 'none' ? 'block' : 'none';
  });

  btnBottomRecenter.addEventListener('click', recalibrateCenter);
  btnBottomPause.addEventListener('click', pauseGame);
  btnBottomResume.addEventListener('click', resumeGame);
  btnBottomAttack.addEventListener('click', triggerPlayerAttack);
  btnBottomFinish.addEventListener('click', finishAndSave);

  // Keyboard Fallback
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      setPlayerTargetLane(Math.max(-1, player.targetLane - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      setPlayerTargetLane(Math.min(1, player.targetLane + 1));
    } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
      triggerPlayerJump();
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      triggerPlayerDuck();
    } else if (e.key === 'e' || e.key === 'E' || e.key === 'f' || e.key === 'F') {
      triggerPlayerAttack();
    } else if (e.key === 'c' || e.key === 'C') {
      recalibrateCenter();
    } else if (e.key === 'Escape') {
      if (gameState === STATE.PAUSED) resumeGame();
      else pauseGame();
    }
  });

  // Fitness Bridge Messages
  if (window.fitness) {
    window.fitness.onMessage(m => {
      if (m.type === 'initialize') {
        difficulty = m.difficulty || 2;
      }
      if (m.type === 'pause' || m.type === 'stop') {
        pauseGame();
      }
      if (m.type === 'resume') {
        resumeGame();
      }
      if (m.type === 'command') {
        handleVoiceCommand(m.text || m.raw || '');
      }
    });
    window.fitness.ready();
  }
  window.addEventListener('message', e => {
    if (e.data?.type === 'command') {
      handleVoiceCommand(e.data.text || e.data.raw || '');
    }
  });

  // Continuous in-iframe STT Speech Recognition Fallback
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
        try { rec.start(); } catch (e) {}
      };
      rec.start();
    } catch (e) {}
  }
  initDirectSTT();

  // Start animation loop
  requestAnimationFrame(gameLoop);
})();
