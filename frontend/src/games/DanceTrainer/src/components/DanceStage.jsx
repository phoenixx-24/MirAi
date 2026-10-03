import React from 'react';
import StickMan from './StickMan';
import { REST_POSE } from '../utils/stickManPoses';
import './DanceStage.css';

/**
 * DanceStage Component
 * Polished black concert stage with white spotlight, overhead small white stage lights,
 * bright stick-man instructor, and minimal futuristic HUD per Step 20 specification:
 * - Top: ROUND 1 / ROUND 2 / ROUND 3
 * - Center: AI stick man
 * - Side or bottom: Player camera view (arranged in App layout)
 * - Bottom: Current step, BPM, Accuracy, TTS feedback
 */
export default function DanceStage({
  pose = REST_POSE,
  round = 1,
  _roundTitle = 'ROUND 1 - LEARN',
  round1Phase = 'demonstrating', // 'demonstrating' | 'user_turn' | 'step_passed'
  userHoldProgress = 0,
  stepNumber = '01',
  totalSteps = 16,
  stepName = 'Rest Pose (Standby)',
  bpm = 80,
  targetBpm = 80,
  userMovementSpeed = 100,
  accuracy = null,
  ttsFeedback = 'Assume starting rest stance. Keep shoulders relaxed and feet shoulder-width apart.',
  isPlaying = true,
  phaseLabel = 'Starting Rest Stance',
  stepProgress = 0,
  onPlayPause,
  onNextStep,
  onPrevStep,
  onPassStepManually,
  onReplayStep,
  onSelectRound,
  onOpenPause,
  isMuted = false,
  onToggleMute,
  isMusicMuted = false,
  onToggleMusicMute,
  musicTrackName,
}) {
  const roundThemeClass =
    round === 1
      ? 'round-theme-learn'
      : round === 2
      ? 'round-theme-practice'
      : 'round-theme-performance';

  return (
    <div className={`dance-stage-container ${roundThemeClass}`} aria-label="Concert Dance Stage">
      {/* 1. TOP: ROUND 1 / ROUND 2 / ROUND 3 Switcher & Pause Bar */}
      <header className="stage-top-bar">
        <div className="round-navigation-cluster">
          <button
            type="button"
            id="btn-dance-round-1"
            data-voice-target="round 1, learn, round one, round 1 learn"
            className={`round-nav-tab ${round === 1 ? 'tab-selected tab-round-1' : ''}`}
            onClick={() => onSelectRound && onSelectRound(1)}
            title="Say 'Round 1'"
          >
            <span className="round-tag">R1</span>
            <span className="round-name">ROUND 1: LEARN</span>
          </button>

          <button
            type="button"
            id="btn-dance-round-2"
            data-voice-target="round 2, practice, round two, round 2 practice"
            className={`round-nav-tab ${round === 2 ? 'tab-selected tab-round-2' : ''}`}
            onClick={() => onSelectRound && onSelectRound(2)}
            title="Say 'Round 2'"
          >
            <span className="round-tag">R2</span>
            <span className="round-name">ROUND 2: PRACTICE</span>
          </button>

          <button
            type="button"
            id="btn-dance-round-3"
            data-voice-target="round 3, final performance, performance, round three, round 3 performance"
            className={`round-nav-tab ${round === 3 ? 'tab-selected tab-round-3' : ''}`}
            onClick={() => onSelectRound && onSelectRound(3)}
            title="Say 'Round 3'"
          >
            <span className="round-tag">R3</span>
            <span className="round-name">ROUND 3: FINAL PERFORMANCE</span>
          </button>
        </div>

        {/* Quick controls: Play/Pause/Nav & Audio Mutes */}
        <div className="stage-header-actions">
          {onPrevStep && (
            <button
              type="button"
              id="btn-dance-prev-step"
              data-voice-target="previous step, previous, back step, step back"
              className="btn-header-icon"
              onClick={onPrevStep}
              title="Previous Step (Say 'Previous step')"
            >
              ⏮
            </button>
          )}

          {onPlayPause && (
            <button
              type="button"
              id="btn-dance-play-pause"
              data-voice-target="play, pause, toggle dance, play dance, pause dance"
              className="btn-header-icon"
              onClick={onPlayPause}
              title={isPlaying ? 'Pause Dance (Say \'Pause\')' : 'Play Dance (Say \'Play\')'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          )}

          {onNextStep && (
            <button
              type="button"
              id="btn-dance-next-step"
              data-voice-target="next step, next, forward"
              className="btn-header-icon"
              onClick={onNextStep}
              title="Next Step (Say 'Next step')"
            >
              ⏭
            </button>
          )}

          {onOpenPause && (
            <button
              type="button"
              id="btn-dance-open-pause"
              data-voice-target="pause, take a break, wait, hold"
              className="btn-header-pause"
              onClick={onOpenPause}
              title="Pause Dance Routine (Say 'Pause')"
            >
              ⏸ Pause
            </button>
          )}

          {onToggleMusicMute && (
            <button
              type="button"
              id="btn-dance-music-toggle"
              data-voice-target="music, audio, mute, unmute, mute music, unmute music"
              className={`btn-header-icon ${isMusicMuted ? 'icon-muted' : ''}`}
              onClick={onToggleMusicMute}
              title={isMusicMuted ? 'Unmute Dance Music (Say \'Music\')' : 'Mute Dance Music (Say \'Music\')'}
              style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}
            >
              {isMusicMuted ? 'MUTED' : 'AUDIO'}
            </button>
          )}

          {onToggleMute && (
            <button
              type="button"
              id="btn-dance-voice-coach-toggle"
              data-voice-target="voice coach, coach voice, mute coach, unmute coach"
              className={`btn-header-icon ${isMuted ? 'icon-muted' : ''}`}
              onClick={onToggleMute}
              title={isMuted ? 'Unmute Voice Coach' : 'Mute Voice Coach'}
              style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}
            >
              {isMuted ? 'VOICE OFF' : 'VOICE ON'}
            </button>
          )}
        </div>
      </header>

      {/* 2. CENTER: AI Stick Man Concert Stage Arena */}
      <main className="stage-center-arena">
        {/* Overhead Stage Truss with Small White Stage Lights */}
        <div className="stage-lights-truss" aria-hidden="true">
          {[...Array(8)].map((_, idx) => (
            <div key={idx} className="stage-light-fixture">
              <div className="light-housing"></div>
              <div className="light-white-beam"></div>
            </div>
          ))}
        </div>

        {/* White Stage Spotlight Cone on Floor */}
        <div className="white-spotlight-floor" aria-hidden="true"></div>

        {/* Active Phase Pill Overhead */}
        <div className="instructor-status-badge">
          <span className="instructor-dot"></span>
          <span className="instructor-title">AI INSTRUCTOR</span>
          <span className="status-separator">&bull;</span>
          <span className="instructor-phase-text">{phaseLabel}</span>
        </div>

        {/* Round 1 Special Learning Cue Banner */}
        {round === 1 && (
          <div className={`round1-teaching-bar phase-${round1Phase}`}>
            {round1Phase === 'demonstrating' && (
              <div className="cue-box">
                <span className="cue-text">
                  <strong>DEMONSTRATION:</strong> Watch the stick man demonstrate Step {stepNumber}.
                </span>
              </div>
            )}

            {round1Phase === 'user_turn' && (
              <div className="cue-box turn-live">
                <div className="cue-content-group">
                  <span className="cue-text">
                    <strong>YOUR TURN:</strong> Copy the step until you get it right (70% match needed).
                  </span>
                  <div className="hold-gauge-track" title="Hold pose at >=70% accuracy to pass">
                    <div
                      className="hold-gauge-fill"
                      style={{ width: `${Math.round(userHoldProgress * 100)}%` }}
                    />
                  </div>
                  <span className="hold-gauge-status-subtext" style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                    {userHoldProgress > 0
                      ? `Holding 70%+ match: ${Math.round(userHoldProgress * 100)}%`
                      : 'Waiting for 70%+ match to advance'}
                  </span>
                </div>
                <div className="cue-actions-group" style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  {onReplayStep && (
                    <button
                      type="button"
                      id="btn-dance-replay-demo"
                      data-voice-target="replay demo, watch demo, replay, watch again"
                      className="btn-pass-move"
                      style={{
                        background: 'rgba(255, 255, 255, 0.12)',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        color: '#ffffff',
                      }}
                      onClick={onReplayStep}
                      title="Watch instructor demonstrate this move again (Say 'Replay demo')"
                    >
                      Replay Demo
                    </button>
                  )}
                  {onPassStepManually && (
                    <button
                      type="button"
                      id="btn-dance-pass-step"
                      data-voice-target="pass step, pass move, pass, advance, next step"
                      className="btn-pass-move"
                      onClick={onPassStepManually}
                      title="Advance to next step (Say 'Pass step')"
                    >
                      Pass Step →
                    </button>
                  )}
                </div>
              </div>
            )}

            {round1Phase === 'step_passed' && (
              <div className="cue-box passed-cue">
                <span className="cue-text">
                  <strong className="good-comment-inline-tag">{Number(stepNumber) % 2 === 1 ? 'GOOD!' : 'GREAT!'}</strong> Step {stepNumber} Matched &bull; Preparing next step...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Stick Man Canvas (Center Focal Point) */}
        <div className="stickman-viewport">
          <StickMan pose={pose} width={540} height={600} />

          {/* On-Screen "GOOD!" / "GREAT!" Comment for Round 1 when step is matched */}
          {round === 1 && round1Phase === 'step_passed' && (
            <div className="on-screen-good-modal" role="alert" aria-live="assertive">
              <div className="good-modal-badge">
                <span className="good-modal-icon">✓</span>
                <span className="good-modal-text">
                  {Number(stepNumber) % 2 === 1 ? 'GOOD!' : 'GREAT!'}
                </span>
              </div>
              <div className="good-modal-sub">
                Step {stepNumber} Matched &bull; Pose Correct
              </div>
            </div>
          )}
          {!isPlaying && (
            <div
              className="viewport-paused-indicator"
              onClick={onPlayPause}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(5, 8, 18, 0.85)',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                borderRadius: '999px',
                padding: '0.65rem 1.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 25px rgba(0, 240, 255, 0.25)',
                zIndex: 10,
              }}
              title="Click to begin dance demonstration"
            >
              <span style={{ fontSize: '1.2rem', color: '#00f0ff' }}>▶</span>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}>
                CLICK TO START DANCING
              </span>
            </div>
          )}
        </div>

        {/* Movement Step Timing Progress Bar */}
        <div className="step-progress-track-wrapper" title={`Step Progress: ${Math.round(stepProgress * 100)}%`}>
          <div
            className="step-progress-bar-fill"
            style={{ width: `${Math.round(stepProgress * 100)}%` }}
          />
        </div>
      </main>

      {/* 3. BOTTOM: Minimal Futuristic Unified HUD Bar (Current Step, BPM, Accuracy, TTS Feedback) */}
      <footer className="stage-bottom-hud">
        {/* Metric 1: Current Step */}
        <div className="bottom-hud-metric step-metric-box">
          <div className="metric-eyebrow">STEP {stepNumber} / {totalSteps}</div>
          <div className="metric-main-value step-title-text" title={stepName}>
            {stepName}
          </div>
        </div>

        {/* Metric 2: BPM & Adaptive Speed */}
        <div className="bottom-hud-metric bpm-metric-box">
          <div className="metric-eyebrow">
            TEMPO &bull; <span className="target-bpm-hint">Target {targetBpm}</span>
          </div>
          <div className="bpm-row-display">
            <span
              className="bpm-metronome-dot"
              style={{ animationDuration: `${60 / (bpm || 80)}s` }}
            ></span>
            <span className="metric-main-value font-mono">
              {bpm} <span className="sub-unit">BPM</span>
            </span>
            {userMovementSpeed !== undefined && userMovementSpeed !== null && (
              <span
                className={`speed-tag ${
                  userMovementSpeed > 105
                    ? 'speed-faster'
                    : userMovementSpeed < 95
                    ? 'speed-slower'
                    : 'speed-matched'
                }`}
                title={`User movement speed: ${userMovementSpeed}%`}
              >
                {userMovementSpeed}% Speed
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Live Pose Accuracy */}
        <div className="bottom-hud-metric accuracy-metric-box">
          <div className="metric-eyebrow">FORM MATCH</div>
          <div className={`metric-main-value font-mono ${accuracy !== null ? 'accuracy-live' : 'accuracy-standby'}`}>
            {accuracy !== null ? `${accuracy}%` : '--'}
          </div>
        </div>

        {/* Metric 4: Real-Time TTS Voice Coach Feedback */}
        <div className="bottom-hud-metric tts-feedback-metric-box">
          <div className="metric-eyebrow">
            <span>COACH VOICE</span>
            {musicTrackName && <span className="track-sub-tag">Track: {musicTrackName}</span>}
          </div>
          <div className="tts-feedback-quote" title={ttsFeedback}>
            "{ttsFeedback}"
          </div>
        </div>
      </footer>
    </div>
  );
}
