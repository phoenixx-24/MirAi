import React from 'react';
import './ScoreModal.css';

/**
 * ScoreModal Component
 * Celebratory results dialog for AI Dance Trainer rounds.
 * Displays Movement, Timing, Rhythm, Final Score (0-100), and choreography insights.
 */
export default function ScoreModal({
  isOpen,
  round = 1,
  scoreData,
  onNextRound,
  onReplayRound,
  onClose,
}) {
  // 5-second auto-advance countdown so user prepares hands-free for next round
  const [autoAdvanceTimer, setAutoAdvanceTimer] = React.useState(5);
  const isFinalPerformance = round === 3;

  React.useEffect(() => {
    if (!isOpen || isFinalPerformance) return;

    setAutoAdvanceTimer(5);

    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && window.fitness?.state?.paused) return;
      setAutoAdvanceTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onNextRound) {
            onNextRound();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, round, isFinalPerformance, onNextRound]);

  if (!isOpen || !scoreData) return null;

  const {
    movementAccuracy = 0,
    timingAccuracy = 0,
    rhythmAccuracy = 0,
    overallScore = 0,
    correctMovementsCount = 0,
    totalSteps = 16,
    correctionsCount = 0,
    bestStep = { name: 'N/A', score: 0 },
    weakestStep = { name: 'N/A', score: 0 },
  } = scoreData;

  const isPassed = scoreData?.passed !== false; // true unless explicitly marked false

  return (
    <div className="score-modal-backdrop" role="dialog" aria-modal="true">
      <div className="score-modal-card">
        {/* Glow backdrop orbs */}
        <div className="modal-glow-orb orb-cyan"></div>
        <div className="modal-glow-orb orb-purple"></div>

        {/* Modal Header */}
        <div className="score-modal-header">
          <div className="celebration-badge">
            {isFinalPerformance
              ? 'CHOREOGRAPHY COMPLETE'
              : !isPassed
              ? 'PRACTICE REQUIRED'
              : `ROUND ${round} MASTERED`}
          </div>
          <h2 className="score-modal-title">
            {isFinalPerformance
              ? 'PERFORMANCE RESULT'
              : !isPassed
              ? `ROUND ${round}: TRY AGAIN`
              : `ROUND ${round} RESULTS`}
          </h2>
          <p className="score-modal-subtitle">
            {isFinalPerformance
              ? (overallScore >= 85 ? 'Arabic Kuthu Hook — Outstanding execution!' : overallScore >= 70 ? 'Arabic Kuthu Hook — Great rhythm & coordination!' : 'Arabic Kuthu Hook — Keep practicing to master the choreography.')
              : round === 1
              ? 'All 16 steps completed! Ready for Round 2 Practice.'
              : 'Continuous practice complete! Ready for Final Performance.'}
          </p>
        </div>

        {/* Auto-Advance Notification Strip */}
        {round === 1 && isPassed && (
          <div className="auto-advance-strip">
            <span className="auto-advance-text">
              Transitioning to <strong>Round 2: Practice</strong> in <strong>{autoAdvanceTimer}s</strong>...
            </span>
            <button
              type="button"
              className="btn-auto-advance-now"
              onClick={() => onNextRound && onNextRound()}
            >
              Start Now →
            </button>
          </div>
        )}

        {round === 1 && !isPassed && (
          <div className="auto-advance-strip strip-failed">
            <span className="auto-advance-text">
              Repeating <strong>Round 1: Learn</strong> in <strong>{autoAdvanceTimer}s</strong>...
            </span>
            <button
              type="button"
              className="btn-auto-advance-now"
              onClick={() => onReplayRound && onReplayRound()}
            >
              Repeat Now →
            </button>
          </div>
        )}

        {round === 2 && (
          <div className="auto-advance-strip">
            <span className="auto-advance-text">
              Transitioning to <strong>Round 3: Final Performance</strong> in <strong>{autoAdvanceTimer}s</strong>...
            </span>
            <button
              type="button"
              className="btn-auto-advance-now"
              onClick={() => onNextRound && onNextRound()}
            >
              Start Now →
            </button>
          </div>
        )}

        {/* Round Pass / Fail Alert Banner */}
        {round === 1 && !isPassed && (
          <div className="round-status-banner banner-failed">
            <div className="banner-content">
              <strong className="banner-heading">ROUND 1 NOT PASSED ({overallScore}/100)</strong>
              <span className="banner-subtext">
                Passing requires a minimum score of 70%. You mastered {scoreData.masteredCount || 0} of {scoreData.totalRequired || totalSteps} movements.
                Round 1 will repeat to unlock Round 2 Practice.
              </span>
            </div>
          </div>
        )}

        {round === 1 && isPassed && (
          <div className="round-status-banner banner-success">
            <div className="banner-content">
              <strong className="banner-heading">ROUND 1 MASTERED ({overallScore}/100)</strong>
              <span className="banner-subtext">
                Demonstrated required form. Proceeding to Round 2 Practice mode.
              </span>
            </div>
          </div>
        )}

        {/* Huge Hero Score Banner */}
        <div className="hero-score-box">
          <span className="hero-score-label">FINAL SCORE</span>
          <div className="hero-score-display">
            <span className="score-big-num">{overallScore}</span>
            <span className="score-denom">/ 100</span>
          </div>
          <div className="score-rank-badge">
            {overallScore >= 85
              ? 'Excellent'
              : overallScore >= 70
              ? 'Great Job'
              : 'Keep Practicing'}
          </div>
        </div>

        {/* 3 Core Metric Sliders (Movement 50%, Timing 25%, Rhythm 25%) */}
        <div className="score-breakdown-grid">
          {/* 1. Movement Accuracy */}
          <div className="metric-score-card">
            <div className="metric-card-top">
              <span className="metric-name">Movement Accuracy</span>
              <span className="metric-pct">{movementAccuracy}%</span>
            </div>
            <div className="metric-bar-bg">
              <div
                className="metric-bar-fill fill-movement"
                style={{ width: `${movementAccuracy}%` }}
              />
            </div>
            <span className="metric-weight-tag">50% Score Weight (Form & Angles)</span>
          </div>

          {/* 2. Timing Accuracy */}
          <div className="metric-score-card">
            <div className="metric-card-top">
              <span className="metric-name">Timing Accuracy</span>
              <span className="metric-pct">{timingAccuracy}%</span>
            </div>
            <div className="metric-bar-bg">
              <div
                className="metric-bar-fill fill-timing"
                style={{ width: `${timingAccuracy}%` }}
              />
            </div>
            <span className="metric-weight-tag">25% Score Weight (Beat Sync)</span>
          </div>

          {/* 3. Rhythm Accuracy */}
          <div className="metric-score-card">
            <div className="metric-card-top">
              <span className="metric-name">Rhythm Accuracy</span>
              <span className="metric-pct">{rhythmAccuracy}%</span>
            </div>
            <div className="metric-bar-bg">
              <div
                className="metric-bar-fill fill-rhythm"
                style={{ width: `${rhythmAccuracy}%` }}
              />
            </div>
            <span className="metric-weight-tag">25% Score Weight (Tempo Flow)</span>
          </div>
        </div>

        {/* Detailed Insights: Correct Moves, Corrections, Best/Weakest Steps */}
        <div className="routine-insights-grid">
          <div className="insight-card">
            <div className="insight-info">
              <span className="insight-value">{correctMovementsCount} / {totalSteps}</span>
              <span className="insight-label">Correct Movements</span>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-info">
              <span className="insight-value">{correctionsCount}</span>
              <span className="insight-label">Corrections Guided</span>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-info">
              <span className="insight-value text-ellipsis" title={bestStep.name}>
                {bestStep.name}
              </span>
              <span className="insight-label">Highest Score ({bestStep.score}%)</span>
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-info">
              <span className="insight-value text-ellipsis" title={weakestStep.name}>
                {weakestStep.name}
              </span>
              <span className="insight-label">Area to Refine ({weakestStep.score}%)</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="score-modal-actions">
          {onReplayRound && (
            <button
              type="button"
              id="btn-dance-score-replay"
              data-voice-target="repeat, replay, replay round, try again"
              className={`btn-modal-action ${!isPassed && round === 1 ? 'btn-next-round' : 'btn-replay'}`}
              onClick={onReplayRound}
              title="Say 'Replay' or 'Repeat'"
            >
              {!isPassed && round === 1 ? 'Repeat Round 1 (Required)' : `Replay ${isFinalPerformance ? 'Performance' : `Round ${round}`}`}
            </button>
          )}

          {onNextRound && isPassed && (
            <button
              type="button"
              id="btn-dance-score-next"
              data-voice-target="proceed, next round, continue, next"
              className="btn-modal-action btn-next-round"
              onClick={onNextRound}
              title="Say 'Next round' or 'Proceed'"
            >
              {isFinalPerformance ? 'Practice Again (Round 1)' : `Proceed to Round ${round + 1} Practice (${autoAdvanceTimer}s) →`}
            </button>
          )}

          {onNextRound && !isPassed && round === 1 && (
            <button
              type="button"
              className="btn-modal-action btn-disabled"
              disabled
              style={{
                opacity: 0.5,
                cursor: 'not-allowed',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#64748b',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
              }}
              title="You must achieve a passing score in Round 1 to unlock Round 2"
            >
              Round 2 Locked (Need 70+)
            </button>
          )}

          {onClose && (
            <button
              type="button"
              id="btn-dance-score-close"
              data-voice-target="close, finish, done, exit"
              className="btn-modal-close"
              onClick={onClose}
              title="Close Score Card (Say 'Close')"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
