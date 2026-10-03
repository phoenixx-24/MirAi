# AI Fitness

One React interface for profiles, diagnostics, shared camera/voice, game hosting, workouts, progress, and recovery. Python FastAPI processes local camera frames; PostgreSQL holds user-specific records. The web interface is published separately because the Python camera/AI/hardware services run on your computer, not in the Sites hosting runtime.

**All three supplied games are integrated.** Boxing and Dance run inside the app. Dragon Dodge launches its original Panda3D game in a separate window on the local fitness computer. Start with `GAME_INTEGRATION.md` for the integration details and validation limits.

## What works in the hosted interface

- Boot screen and sign-in choices; guest exploration.
- Dashboard, game library, embedded Boxing and Dance, and the desktop Dragon Dodge launcher.
- Setup center, camera preview (browser permission required), speech commands and speaker test where browser APIs are supported.
- Keyboard/touch alternatives, voice transcript, mirror mode.
- Registration/profile/history/workout forms wired to the local API.
- Visible failures and retry controls; no fake sensor readings or sample workout records.

The hosted page stores only non-sensitive device preferences (service address and mirror setting). It does not store profiles or workouts in browser storage. Auth tokens are in memory; refreshing requires sign-in.

## Run on Windows

Prerequisites: Node.js 22+, Python 3.11, and PostgreSQL 16 (or Docker Desktop for the included database service).

1. Extract the project. Open a terminal in the project folder and run `npm install` (the hosted development environment uses pnpm; locally `corepack pnpm install` can reuse `pnpm-lock.yaml`).
2. Set up Python:

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

3. Create a PostgreSQL database named `fitness` and a dedicated user, then edit `backend/.env` with its URL. For Docker, from the project root:

```powershell
$env:POSTGRES_PASSWORD = 'choose-your-own-long-password'
docker compose up -d db
```

Set `DATABASE_URL=postgresql+psycopg://fitness:YOUR_PASSWORD@localhost:5432/fitness`. URL-encode special password characters. The service creates its tables on startup. Back up the database volume before any future schema changes.

4. The uploaded game’s Pose Landmarker model is included at `backend/models/pose_landmarker.task`. For Dragon Dodge, also run `.venv\Scripts\python -m pip install -r requirements-games.txt` from `backend`. The native game requires a local graphical desktop.
5. Run `start.bat` from the project root. It starts both services and opens the graphical application. It has no game-selection terminal menu. Keep its background process running while using the app.
6. In **Setup center**, connect `http://localhost:8000`. Create a profile. Load the pose model and test camera/speech. The app remains explorable without these dependencies, but it does not save data without PostgreSQL.
7. Open Workouts, choose a game, and start a session. For Dragon Dodge, click **Open Dragon Dodge**, then Start in its new window. Keep the browser tab open.

For macOS/Linux, create the virtual environment with `python3 -m venv backend/.venv`, install the same requirements, then run `python3 launch.py`.

Manual developer processes: `npm run dev:local` for React, and from `backend`, `.venv/Scripts/python -m uvicorn main:app --host 127.0.0.1 --port 8000` for FastAPI. Interactive API documentation: `http://localhost:8000/docs`.

## Face sign-in (optional local setup)

Install `backend/requirements-optional.txt`. dlib/face-recognition may require a C++ build toolchain on Windows. Generate an encryption key:

```powershell
.venv\Scripts\python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Place the result in `FACE_ENCRYPTION_KEY` in `backend/.env`, restart the service, then use **Profile → Enroll face**. Three embeddings are encrypted; raw camera images are processed in memory and not saved. Keep the encryption key private and backed up. Passwords are scrypt-hashed, and only token hashes are stored.

Face matching is a convenience feature for a trusted local fitness device. It is **not liveness detection** and is not suitable as high-assurance biometric authentication. Use password sign-in when recognition is uncertain. No face model is falsely reported as tested before enrollment.

## Shared voice

The default browser Web Speech engine supports live transcription, TTS, and intent routing. Support and offline behavior depend on the browser. It may send speech to the browser vendor's service. There is always a command text box and clickable controls.

For offline voice, install the optional requirements and place an unpacked Vosk model in `backend/models/vosk/`. Enable **Toggle offline voice** after signing in. This opens the fitness computer's microphone through the single backend STT manager and disables browser recognition. Toggle again to stop. Games must never create speech instances. The local output voice uses the browser's available speech synthesis voices.

Safety commands (`pain`, `hurt`, `dizzy`, `stop`) take priority; pauses do not count as exercise. Speech input is suspended while browser TTS speaks to avoid feedback. If speech fails, the error remains visible. Do not rely on voice recognition as an emergency system.

## Data and movement

- PostgreSQL tables: users, fitness_profiles, face_profiles, food_preferences, workout_sessions, game_sessions, sensor_readings, movement_analysis, game_scores, ai_feedback, calorie_records, streaks, discomfort_events, auth_tokens.
- All observation rows have a server-derived user ID, session ID, and timestamp. Every API operation checks ownership.
- One browser camera stream feeds face recognition and pose analysis. Games receive pose messages and the same stream.
- Pose movement uses confidence, normalized joint displacement, and bounded elapsed time. It counts movement only while an active session is unpaused. Thresholds need tuning against real users/camera positions.
- Calories are explicitly a low-confidence gross MET estimate using recorded active time, weight, and an assumed activity MET. They are not a clinical measurement or individual physiological model.
- Streaks require at least 60 active seconds on a calendar day; timezone defaults to Asia/Kolkata.
- Coaching is transparent, rule-based feedback from current movement and saved profile information. There is no hidden LLM or downloaded model pretending to be connected.
- Food/recovery text reflects stored preferences and restrictions, without inventing energy targets or prescribing a diet.

## Deployment and connections

The hosted interface is private by default. Python/PostgreSQL remain local services. To connect the hosted page to a remote fitness service, serve the API over HTTPS and add that exact page origin to `ALLOWED_ORIGINS`. Never expose the PostgreSQL port publicly. Local localhost use is the easiest hardware workflow. The launcher binds the API to loopback; LAN hardware needs a deliberately configured TLS gateway/local bridge.

## Current limits / acceptance status

Integration checks for this package are recorded in `VALIDATION.md`. Live camera, microphone, PostgreSQL, and physical game interaction still require testing on your computer.
