# Integrated games

| App card | Runtime and entry | Supplied game code |
| --- | --- | --- |
| Boxing Trainer | Browser: `public/games/BoxingTrainer/index.html` | Adapted supplied web trainer; original Python/web source in `game-sources/boxing` |
| Dance Trainer | Browser: `public/games/DanceTrainer/index.html` | Adapted React source in `frontend/src/games/DanceTrainer/src` |
| Dragon Dodge | Local Panda3D window; browser launch/control page | `desktop-games/DragonDodgePy` retains original 3D models, sounds, gameplay and keyboard controls |

## First run on Windows

Follow README.md to install the app and Python backend, and configure PostgreSQL.
From `backend`, install `.venv\Scripts\python -m pip install -r requirements-games.txt` for Dragon Dodge. A pose model from the uploaded game is already included. Run `start.bat` from the root, connect `http://localhost:8000` in Setup center, sign in, and load the pose model. Select any game from Workouts.

Boxing and Dance open inside the workout panel. Dragon Dodge requires **Open Dragon Dodge**, followed by Start in the desktop game window. It opens on the computer running FastAPI, not a remote browser computer. `launch.py` enables the fixed native launcher through `FITNESS_DESKTOP_GAMES=1`; manual service runs must set that variable explicitly. Use one backend worker for the native process manager.

Use the fitness app’s Pause, Resume, Finish & save, and discomfort controls. Game score is separate from active exercise time; active time always comes from the backend’s camera movement analysis. No game can manufacture active minutes by awarding points. Keep the fitness browser tab open and visible where possible: browser background throttling can reduce pose updates. Native control pauses after 4 seconds without its browser heartbeat and closes after 60 seconds. Close the game window before stopping the local service normally; service shutdown also closes it.

## Shared resources and control

The browser app alone acquires the physical camera and microphone. Embedded games use `fitness.getCamera()` without stopping its tracks. The backend processes frames, and games consume the same pose landmarks. Games route spoken coaching and user commands through the host. Voice controls depend on the browser/local voice service configured in Setup center.

The bridge validates both origin and sending window. Native start/status endpoints require the session owner's Bearer token and a live Dragon Dodge workout. They launch only the fixed bundled Python entry point, with no user-provided executable or path. Native IPC uses a private temporary folder; no credentials or raw camera images are written there. Native score is captured on status polling and again on finish. Scores posted by browser games are queued before finish so the summary does not race the last score update.

The app frame loop requests up to 10 pose updates per second, with one request in flight. Actual tracking speed depends on your computer. A stale pose is ignored after 1.5 seconds.

## Game-specific behavior

- **Boxing:** Redesigned AI technique coach featuring a pedagogical flow: **Demonstrate First** (Coach Alex demonstrates exact punch paths, elbow angles, and guard positions with animated trajectory lines and TTS cues), **Live Movement Analysis & Correction** (real-time camera tracking evaluating guard height, full arm extension, opposite cheek defense, and snap return, with immediate verbal TTS feedback), and **Level-by-Level Progression** (7 structured levels requiring 5 clean repetitions to unlock the next level). Features interactive target mitts, a Web Audio impact synthesizer, and universal Speech-to-Text (STT) and Text-to-Speech (TTS) integration controlling every button and action hands-free.
- **Dance:** keeps the supplied choreography, music and three rounds. Pose input and speech use host services. Scores are saved after each completed step and at round completion. Difficulty 1–5 sets the learning match threshold to 75/80/85/90/95 percent; each round retains its original tempo. Finish & save returns to the host summary. Source fixes also keep ScoreModal hooks consistent when it opens/closes. Host pause prevents state transitions, pose scoring, and music playback.
- **Dragon Dodge:** remains the supplied native game, not a browser remake. It starts with `--no-camera --fitness-state ...`; a shared-pose adapter maps body motion to the original player controls. Difficulty 1–2 maps to easy, 3 to medium, 4–5 to hard. Existing boss health scales at boss spawn. Keyboard controls remain available. A native ESC pause also pauses the host; resume with the host control. Reopening or restarting a game resets its game progress; the existing fitness session still retains measured activity time.

## Editing / rebuilding

Boxing JS/CSS and Dragon Python files are directly editable. Dance's browser bundle is already included, so no extra game build is needed for first run. To rebuild after editing its source:

```
cd frontend/src/games/DanceTrainer
npm install
npm run build
```

This uses esbuild to write `public/games/DanceTrainer/dance.js` and `dance.css`. Repackage the full project with `python scripts/package-source.py`. Do not ship node_modules, virtual environments, private .env files or temporary IPC data.

The standalone original Boxing server remains source-only; do not run it alongside an app workout because it owns a separate webcam/microphone. The original Dragon command without `--fitness-state` retains standalone camera behavior, intended only when the fitness app is not using the webcam.

## Limitations

Live camera accuracy, microphone recognition, graphical desktop startup, and real PostgreSQL deployment must be checked on the target computer. Game progress within an iframe is not persisted across navigation or refresh; the app recovers the workout record paused, not the internal game level/step. Native Dragon requires a graphical desktop and cannot execute inside hosted browser-only infrastructure. No website was deployed by this source integration.
