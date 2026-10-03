// Dance Trainer Voice Adapter (STT & TTS + Full Voice Controls for ALL buttons)
(function() {
  function say(text) {
    if (!text) return;
    try { window.fitness?.speak(text); } catch {}
    if (!parent || parent === window) {
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
        }
      } catch {}
    }
  }

  function clickMatchingButtonInDance(query) {
    if (!query) return false;
    const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) return false;

    const candidates = Array.from(document.querySelectorAll(
      'button, [role="button"], a, input[type="button"], ' +
      '.dance-card, .btn-pause-primary, .btn-pause-secondary, .btn-pause-text, ' +
      '.btn-start-practice-hero, .btn-header-pause, .btn-header-icon, .round-nav-tab, ' +
      '.btn-pass-move, .btn-auto-advance-now, .btn-skip-rest, .btn-nav-back, ' +
      '.btn-setup-back, .btn-setup-next, .btn-error-primary, .btn-error-secondary, ' +
      '.btn-replay, .btn-next-round, .btn-modal-close, .btn-pill, .btn-start-camera, ' +
      '.btn-retry, .btn-dismiss, .btn-control, .full-routine-card'
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

      // Bracket hints like [Say '...']
      const bracketMatches = rawText.match(/\[(?:say|or say)\s+['"]?([^'"]+)['"]?\]/i);
      if (bracketMatches && bracketMatches[1]) {
        const hint = bracketMatches[1].toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (hint) labels.push({ text: hint, weight: 1.4 });
      }

      // data-voice-target
      const voiceData = el.getAttribute('data-voice-target') || el.getAttribute('data-voice');
      if (voiceData) {
        voiceData.split(',').forEach(v => {
          const cleaned = v.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          if (cleaned) labels.push({ text: cleaned, weight: 1.3 });
        });
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

      // Dance card name
      const cardTitle = el.querySelector('.dance-card-name, .full-routine-title');
      if (cardTitle) {
        const ct = (cardTitle.innerText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (ct) labels.push({ text: ct, weight: 1.25 });
      }

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
    updateVoiceBadge(`Heard: "${rawText}"`);

    // 1. Try Universal DOM Button Clicker for EVERY button
    const match = clickMatchingButtonInDance(c);
    if (match && match.clicked) {
      updateVoiceBadge(`Voice: Clicked "${match.label.toUpperCase()}"`);
      say(`Selected ${match.label.slice(0, 30)}`);
      return;
    }

    // 2. High-Priority Dance Intent Fallbacks
    if (/\b(start|dance|begin|play|go|lets dance|let's dance|click to start)\b/i.test(c)) {
      const hero = document.querySelector('.btn-start-practice-hero, .btn-pause-primary, .btn-start-full-routine');
      if (hero) {
        hero.click();
        say("Let's dance! Match your rhythm with the coach.");
        return;
      }
    }

    if (/\b(pause|break|take a break|wait|hold)\b/i.test(c)) {
      const p = document.querySelector('.btn-header-pause');
      if (p) {
        p.click();
        say("Dance paused. Take a breath, say resume to jump back in.");
        return;
      }
    }

    if (/\b(resume|unpause|continue|keep going|ready)\b/i.test(c)) {
      const r = document.querySelector('.btn-pause-primary, .btn-header-pause');
      if (r) {
        r.click();
        say("Resuming dance! Catch the beat.");
        return;
      }
    }

    if (/\b(restart|repeat|retry|again|start over|from beginning)\b/i.test(c)) {
      const r = Array.from(document.querySelectorAll('button, .btn-pause-primary')).find(b => /restart/i.test(b.innerText || ''));
      if (r) {
        r.click();
        say("Restarting dance from the beginning.");
        return;
      }
    }

    if (/\b(select routine|another routine|different routine|select dance|change dance|routines|menu)\b/i.test(c)) {
      const s = document.querySelector('.btn-pause-secondary');
      if (s) {
        s.click();
        say("Opening dance routine selection.");
        return;
      }
    }

    // Dance card selection (Dance 1 to 16)
    const danceNumMatch = c.match(/\b(?:dance|routine|song|track)\s*(\d+)\b/i);
    if (danceNumMatch) {
      const num = parseInt(danceNumMatch[1], 10);
      const cards = Array.from(document.querySelectorAll('.dance-card'));
      if (cards.length > 0) {
        const target = cards[num - 1] || cards.find(card => (card.innerText || '').toLowerCase().includes(`dance 0${num}`) || (card.innerText || '').toLowerCase().includes(`dance ${num}`));
        if (target) {
          target.click();
          say(`Selected Dance ${num}. Get ready!`);
          return;
        }
      }
    }

    if (/\b(log out|logout|sign out|signout)\b/i.test(c)) {
      try { window.parent?.postMessage({ source: 'fitness-game', type: 'logout' }, '*'); } catch(e){}
      return;
    }

    if (/\b(finish|save|complete|stop|end session|quit|exit)\b/i.test(c)) {
      const fin = document.querySelector('.btn-pause-text, .btn-finish-host');
      if (fin) fin.click();
      say("Dance workout complete. Saving your score!");
      try { window.fitness?.complete(); } catch {}
      try { window.parent?.postMessage({ source: 'fitness-game', type: 'complete' }, '*'); } catch(e){}
      return;
    }
  }

  // Visual voice badge
  let badgeEl = null;
  function updateVoiceBadge(text) {
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.id = 'dance-voice-badge';
      badgeEl.style.cssText = 'position:fixed;bottom:12px;left:14px;background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);border:1px solid rgba(139,92,246,0.4);border-radius:20px;padding:6px 14px;font:13px system-ui;color:#c4b5fd;z-index:99999;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);pointer-events:none;transition:all .3s ease;';
      badgeEl.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#a855f7;box-shadow:0 0 8px #a855f7"></span><span id="dance-voice-text">🎙️ Voice: Say any button name</span>';
      document.body.appendChild(badgeEl);
    }
    const t = badgeEl.querySelector('#dance-voice-text');
    if (t) t.textContent = text;
    setTimeout(() => {
      if (t) t.textContent = '🎙️ Voice & STT Active: Say any button name, "Start", "Pause", "Resume"';
    }, 2500);
  }

  // Direct Continuous STT in Dance Trainer (runs ONLY in standalone mode)
  function initDirectSTT() {
    // When embedded in host application, defer STT to host to prevent audio hardware collision!
    if (window.parent && window.parent !== window) {
      return;
    }
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

  // Integration with fitness-bridge & direct window message
  window.addEventListener('DOMContentLoaded', () => {
    updateVoiceBadge('🎙️ Voice & STT Active');
    initDirectSTT();

    if (window.fitness) {
      window.fitness.onMessage(m => {
        if (m.type === 'command') {
          handleVoiceCommand(m.text || m.raw || '');
        }
        if (m.type === 'pause') {
          document.querySelector('.btn-header-pause')?.click();
        }
        if (m.type === 'resume') {
          document.querySelector('.btn-pause-primary')?.click();
        }
      });
      window.fitness.ready();
    }
    window.addEventListener('message', e => {
      if (e.data?.type === 'command') {
        handleVoiceCommand(e.data.text || e.data.raw || '');
      }
    });
    // In standalone mode announce welcome
    if (!window.parent || window.parent === window) {
      say("Dance Trainer loaded. Say start or click any button!");
    }
  });
})();
