import { useState } from 'react';
import { APP_NAME, APP_VERSION, DANCE_GENRES } from '../constants';

export default function WelcomeCard() {
  const [testCounter, setTestCounter] = useState(0);

  return (
    <div className="welcome-container">
      <div className="card hero-card">
        <div className="badge-wrapper">
          <span className="badge">STEP 1 COMPLETE</span>
          <span className="badge badge-subtle">v{APP_VERSION}</span>
        </div>

        <h2 className="hero-heading">Welcome to {APP_NAME}</h2>
        <p className="hero-desc">
          React.js + Vite environment is configured and running with a modular folder structure.
          Ready for future modules (camera input, MediaPipe pose tracking, score engine, and music sync).
        </p>

        {/* Test interactive counter to prove React state and HMR work properly */}
        <div className="interactive-test-box">
          <div className="test-info">
            <span className="test-label">React State Test:</span>
            <span className="test-count">{testCounter} clicks</span>
          </div>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => setTestCounter(c => c + 1)}
          >
            ⚡ Test Interaction
          </button>
        </div>
      </div>

      <div className="grid-cards">
        <div className="card feature-card">
          <div className="card-icon">📁</div>
          <h3>Modular Architecture</h3>
          <ul className="feature-list">
            <li><code>src/components/</code> — UI components</li>
            <li><code>src/hooks/</code> — Custom React hooks</li>
            <li><code>src/services/</code> — Pose detection & audio</li>
            <li><code>src/utils/</code> — Math & angle calculations</li>
            <li><code>src/constants/</code> — Dance configs & settings</li>
          </ul>
        </div>

        <div className="card feature-card">
          <div className="card-icon">🎶</div>
          <h3>Prepared Dance Modes</h3>
          <div className="genre-tags">
            {DANCE_GENRES.map(genre => (
              <div key={genre.id} className="genre-tag">
                <span className="genre-title">{genre.label}</span>
                <span className="genre-diff">{genre.difficulty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
