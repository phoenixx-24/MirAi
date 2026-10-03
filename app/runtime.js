// One owner for camera, microphone audio meter, speech-to-text, and speech-synthesis.
class Runtime {
  stream = null;            // Video stream
  audioStream = null;       // Audio stream for mic / level metering
  audioContext = null;
  audioAnalyser = null;
  audioLevel = 0;           // 0 to 100
  onAudioLevel = () => {};  // UI audio volume level callback
  
  recognition = null;
  wanted = false;           // User wants voice recognition active
  active = false;           // Recognition engine is currently listening
  starting = false;         // Start operation in progress
  stopping = false;         // Stop operation in progress
  speaking = false;         // System TTS is speaking
  lastSpokeTime = 0;        // Timestamp when TTS ended (echo prevention)
  
  onText = () => {};        // (transcript, isFinal) => {}
  onStatus = () => {};      // (statusText) => {}
  
  currentUtterance = null;
  restartTimer = null;
  speakingWatchdog = null;
  retryCount = 0;

  async camera() {
    if (this.stream?.active) return this.stream;
    if (!navigator.mediaDevices?.getUserMedia) throw Error('Camera requires a secure browser connection.');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });
    return this.stream;
  }

  stopCamera() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  async frame() {
    const stream = await this.camera();
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth) await new Promise(r => video.onloadeddata = r);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);
    video.srcObject = null;
    return canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
  }

  async captureFrames(count = 3, delayMs = 600, onProgress = null) {
    const stream = await this.camera();
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth) await new Promise(r => video.onloadeddata = r);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const frames = [];
    for (let i = 0; i < count; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, delayMs));
      ctx.drawImage(video, 0, 0, 640, 480);
      const b64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
      frames.push(b64);
      if (onProgress) onProgress(i + 1, count);
    }
    video.srcObject = null;
    return frames;
  }

  async initAudio() {
    if (this.audioStream?.active) return this.audioStream;
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.audioStream = stream;
      
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new AudioCtx();
          }
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(() => {});
          }
          const source = this.audioContext.createMediaStreamSource(stream);
          const analyser = this.audioContext.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);
          this.audioAnalyser = analyser;
          
          const pcmData = new Uint8Array(analyser.frequencyBinCount);
          const meterLoop = () => {
            if (!this.wanted || !this.audioStream?.active) {
              this.audioLevel = 0;
              this.onAudioLevel(0);
              return;
            }
            analyser.getByteFrequencyData(pcmData);
            let sum = 0;
            for (let i = 0; i < pcmData.length; i++) {
              sum += pcmData[i];
            }
            const avg = sum / pcmData.length;
            const lvl = Math.min(100, Math.round((avg / 128) * 100));
            this.audioLevel = lvl;
            this.onAudioLevel(lvl);
            requestAnimationFrame(meterLoop);
          };
          requestAnimationFrame(meterLoop);
        }
      } catch (err) {
        console.warn('AudioAnalyser visualizer setup error:', err);
      }
      return stream;
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err);
      this.onStatus('Mic blocked - click to enable');
      throw err;
    }
  }

  _createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.maxAlternatives = 1;

    r.onstart = () => {
      this.starting = false;
      this.active = true;
      this.retryCount = 0;
      if (this.wanted) {
        this.onStatus(this.speaking ? 'Speaking' : 'Listening');
      }
    };

    r.onresult = (e) => {
      if (!e.results) return;
      // Echo cancellation: only ignore if assistant is actively speaking or within brief 200ms audio cutoff
      if (this.speaking || (Date.now() - this.lastSpokeTime < 200)) {
        return;
      }
      
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const item = e.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          finalTranscript += text + ' ';
        } else {
          interimTranscript += text;
        }
      }

      const cleanText = (finalTranscript || interimTranscript).trim();
      if (!cleanText) return;

      const lower = cleanText.toLowerCase();
      if (this.speaking) return;
      // Only discard as echo if it is a long exact repetition of what the assistant just spoke
      if (this.lastSpokenText && (Date.now() - this.lastSpokeTime < 2000) && lower.length > 15) {
        const cleanLast = this.lastSpokenText.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const cleanRec = lower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanRec && cleanLast && cleanRec === cleanLast) {
          return;
        }
      }

      this.onText(cleanText, Boolean(finalTranscript));
    };

    r.onerror = (e) => {
      const err = e.error || 'unknown';
      if (err === 'no-speech' || err === 'aborted') {
        // Normal silence or expected stop - do not drop wanted state
        return;
      }
      console.warn('SpeechRecognition error:', err);
      
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        this.wanted = false;
        this.active = false;
        this.starting = false;
        this.onStatus('Mic blocked - click to enable');
        return;
      }
      
      if (err === 'network') {
        this.onStatus('Speech network reconnecting…');
        // Back off to prevent network storm
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (this.wanted && !this.active && !this.starting) {
            this._startRecognition();
          }
        }, 2000);
        return;
      }

      if (err === 'audio-capture') {
        this.onStatus('No microphone detected');
        return;
      }
    };

    r.onend = () => {
      this.active = false;
      this.starting = false;
      if (this.wanted && !this.stopping) {
        clearTimeout(this.restartTimer);
        const delay = this.speaking ? 600 : 250;
        this.restartTimer = setTimeout(() => {
          if (this.wanted && !this.active && !this.starting) {
            this._startRecognition();
          }
        }, delay);
      } else {
        this.onStatus('Voice off');
      }
    };

    return r;
  }

  _startRecognition() {
    if (!this.wanted || this.active || this.starting) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.onStatus('Speech unavailable in this browser');
      return;
    }
    
    this.starting = true;
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }

    try {
      this.recognition = this._createRecognition();
      if (!this.recognition) {
        this.starting = false;
        return;
      }
      this.recognition.start();
    } catch (err) {
      this.starting = false;
      this.retryCount++;
      const backoff = Math.min(3000, 300 * Math.pow(1.5, this.retryCount));
      clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        if (this.wanted && !this.active && !this.starting) {
          this._startRecognition();
        }
      }, backoff);
    }
  }

  async listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) throw Error('Speech recognition is unavailable in this browser. Please use Google Chrome or Microsoft Edge.');
    this.wanted = true;
    this.stopping = false;
    // Request microphone permission and initialize volume meter
    try {
      await this.initAudio();
    } catch (e) {
      console.warn('initAudio error in listen():', e);
    }
    this._startRecognition();
  }

  stopVoice() {
    this.wanted = false;
    this.stopping = true;
    this.starting = false;
    this.active = false;
    clearTimeout(this.restartTimer);
    clearTimeout(this.speakingWatchdog);
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
    this.stopping = false;
    this.audioLevel = 0;
    this.onAudioLevel(0);
    this.onStatus('Voice off');
  }

  speak(text) {
    if (!window.speechSynthesis) return;
    if (!text || typeof text !== 'string') return;
    const clean = text.trim();
    if (!clean) return;

    const lower = clean.toLowerCase();
    const now = Date.now();
    // Deduplication: prevent the exact same sentence from repeating within 5 seconds
    if (this.lastSpokenText === lower && (now - (this.lastSpokeTime || 0) < 5000)) {
      return;
    }

    window.speechSynthesis.cancel();
    clearTimeout(this.speakingWatchdog);

    this.speaking = true;
    this.lastSpokenText = lower;

    // Abort active recognition while TTS is speaking to prevent microphone from hearing assistant audio
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.active = false;
      this.starting = false;
    }

    const u = new SpeechSynthesisUtterance(text);
    this.currentUtterance = u;
    window._activeUtterance = u;
    u.rate = 1.0;
    u.pitch = 1.0;
    u.lang = 'en-US';

    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) {
        const pref = ['Google US English', 'Microsoft Jenny Online', 'Microsoft Guy Online', 'Microsoft Aria Online', 'Microsoft Zira', 'Microsoft David'];
        let matched = null;
        for (const p of pref) {
          matched = voices.find(v => v.name.includes(p));
          if (matched) break;
        }
        if (!matched) matched = voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en'));
        if (matched) u.voice = matched;
      }
    } catch {}

    this.onStatus('Speaking');

    const finish = () => {
      clearTimeout(this.speakingWatchdog);
      this.speaking = false;
      this.lastSpokeTime = Date.now();
      this.currentUtterance = null;
      window._activeUtterance = null;
      if (this.wanted) {
        clearTimeout(this.restartTimer);
        // Brief 150ms cooldown after speech completes before listening for user commands
        this.restartTimer = setTimeout(() => {
          if (this.wanted && !this.active && !this.starting && !this.speaking) {
            this.onStatus('Listening');
            this._startRecognition();
          }
        }, 150);
      } else {
        this.onStatus('Voice off');
      }
    };

    u.onend = finish;
    u.onerror = finish;

    const estimatedDuration = Math.max(1200, text.length * 80 + 800);
    this.speakingWatchdog = setTimeout(() => {
      if (this.speaking) finish();
    }, estimatedDuration);

    window.speechSynthesis.speak(u);
  }

  cancel() {
    window.speechSynthesis?.cancel();
    clearTimeout(this.speakingWatchdog);
    this.speaking = false;
    this.lastSpokeTime = Date.now();
    this.currentUtterance = null;
    window._activeUtterance = null;
    if (this.wanted) {
      this.onStatus('Listening');
    }
  }
}

export const runtime = new Runtime();

export function intent(text) {
  if (!text) return 'UNKNOWN';
  const s = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"“”]/g, ' ').replace(/\s+/g, ' ');
  if (/\b(register|registration|sign up|signup|create profile|create account|new profile|new user|enroll|i want to register|please register|go for register|go to register)\b/.test(s)) return 'REGISTER';
  if (/\b(log out|logout|sign out|signout|switch user)\b/.test(s)) return 'LOGOUT';
  if (/\b(complete all workout|complete all workouts|finish all workouts|all workouts complete|done with workouts)\b/.test(s)) return 'COMPLETE_ALL';
  if (/\b(try again|retry|scan again|attempt again|one more time|again|can we try again|let's try again|try)\b/.test(s)) return 'RETRY';
  if (/\b(recognize|recognise|recogniz\w*|who am i|identify|scan.*face|face.*scan|scan|look at me|detect me|face login|face sign|check face|check my face)\b/.test(s)) return 'RECOGNIZE';
  if (/\b(next|continue|proceed|advance|forward)\b/.test(s)) return 'NEXT';
  if (/\b(back|previous|go back|prev)\b/.test(s)) return 'BACK';
  if (/\b(save|submit|done|finish registration|complete)\b/.test(s)) return 'SAVE';
  if (/\b(explore|guest|without sign|without login|skip login|skip sign|athlete)\b/.test(s)) return 'EXPLORE';
  if (/\b(pain|hurt|dizzy|emergency|uncomfortable)\b/.test(s)) return 'SAFETY';
  if (/\b(stop|end|finish|quit|exit)\b/.test(s)) return 'STOP';
  if (/\b(pause|break|rest|hold on|wait)\b/.test(s)) return 'PAUSE';
  if (/\b(resume|continue|unpause)\b/.test(s)) return 'RESUME';
  if (/\b(dodge|dragon)\b/.test(s)) return 'DragonDodge';
  if (/\b(dance|dancing)\b/.test(s)) return 'DanceTrainer';
  if (/\b(boxing|box|punch)\b/.test(s)) return 'BoxingTrainer';
  if (/\b(camera|webcam)\b/.test(s)) return 'CAMERA';
  if (/\b(mirror)\b/.test(s)) return 'MIRROR';
  if (/\b(harder|increase)\b/.test(s)) return 'HARDER';
  if (/\b(easier|reduce|decrease)\b/.test(s)) return 'EASIER';
  if (/\b(dashboard|home)\b/.test(s)) return 'Dashboard';
  if (/\b(profile|account)\b/.test(s)) return 'Profile';
  if (/\b(history|progress|stats)\b/.test(s)) return 'Progress';
  if (/\b(setup|settings|system)\b/.test(s)) return 'Setup center';
  if (/\b(start workout|begin workout|start training|shall we start)\b/.test(s)) return 'WORKOUT';
  return 'UNKNOWN';
}
