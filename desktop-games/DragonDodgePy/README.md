# AI Fitness DragonDodge — Merged Platform

A full-body motion fitness platform that merges an **AI Fitness System** (Node.js + Python AI microservice + web dashboard) with **Dragon Dodge** (a Panda3D 3D game controlled by your body via webcam/MediaPipe).

The physical movements you make to play the game — dodging, jumping, punching — are tracked as real workout repetitions and streamed to the fitness platform, which records them alongside your profile, calculates calorie burn using MET formulas, and feeds them into AI-driven workout and nutrition recommendations.

---

## Architecture

```
┌──────────────────────────────────┐         ┌──────────────────────────────────┐
│   Dragon Dodge (Python/Panda3D) │         │   AI Fitness Platform            │
│   Desktop 3D Game                │         │   (Node.js :3000 + Python :5001) │
│                                  │         │                                  │
│   • MediaPipe Pose (webcam)      │         │   • User registration & face ID  │
│   • Body-motion controls         │         │   • Workout session tracking     │
│   • Dodge / Jump / Punch         │         │   • ML workout classification     │
│   • Workout counters             │         │   • Nutrition recommender        │
│   • fitness_api.py (HTTP client) │         │   • Llama AI recommendations     │
│                                  │         │   • TTS coaching                  │
└──────────────┬───────────────────┘         └──────────────┬───────────────────┘
               │                                            │
               │  1. POST /api/game/start                   │
               ├───────────────────────────────────────────►│  Creates session,
               │◄───────────────────────────────────────────┤  returns safety warnings
               │  { session_id, safety_warnings }           │
               │                                            │
               │  2. POST /api/game/update (every 5s)        │
               ├───────────────────────────────────────────►│  Streams rep counts,
               │◄───────────────────────────────────────────┤  speed, accuracy
               │  { acknowledged: true }                    │
               │                                            │
               │  3. POST /api/game/finish                  │
               ├───────────────────────────────────────────►│  Final metrics, calories,
               │◄───────────────────────────────────────────┤  saves to workout history
               │  { saved: true, calories: X }              │
```

---

## Project Structure

```
AI-Fitness-DragonDodge/
├── backend/                    Node.js Express API gateway
│   ├── server.js               Main server (port 3000)
│   ├── controllers/
│   │   └── gameController.js   Game API: start / update / finish
│   ├── services/
│   │   └── gameService.js      MET calorie calculations (incl. DragonDodge)
│   ├── routes/game.js           Game API routes
│   ├── middleware/authMiddleware.js  Game API key validation
│   └── database/                PostgreSQL schema + connection
├── ai/                         Python AI microservice (Flask, port 5001)
│   ├── app.py                  Main AI service
│   ├── face/                   Face recognition (OpenCV + ONNX)
│   ├── pose/                   Pose detection & exercise analysis
│   ├── ml/                     ML workout classification models
│   ├── nutrition/              Food/nutrition recommendations
│   └── llama/                  LLM-powered coaching recommendations
├── frontend/                   Web dashboard (HTML/CSS/JS)
│   ├── game.html               Game Arena (AeroSquat browser + Dragon Dodge launcher)
│   ├── dashboard.html          Workout history & analytics
│   ├── register.html           7-section athlete registration
│   ├── login.html              Face-recognition login
│   └── js/game_dragon.js       Dragon Dodge launch mode controller
├── game/                       Dragon Dodge 3D game (Python/Panda3D)
│   ├── app.py                  Game states, arena, main loop + fitness hooks
│   ├── fitness_api.py          HTTP client to the platform's Game API
│   ├── player.py               Gravity/jump physics + lateral control
│   ├── dragon.py               Boss AI, model loading
│   ├── pose_tracker.py         Webcam + MediaPipe Pose thread
│   ├── projectile.py           Survival balls & dragon flames
│   ├── audio.py                Procedurally synthesized sound effects
│   ├── particles.py            Hit/explosion/ember effects
│   └── geometry.py             Procedural box-mesh helper
├── assets/
│   ├── models/                 dragon.glb, sun.glb, pose_landmarker_lite.task
│   └── sfx/                    Sound effects
├── main.py                     Dragon Dodge entry point (with fitness API args)
├── fitness_config.json         Game-to-platform connection config
├── game_requirements.txt       Python deps for the game (Panda3D, MediaPipe, etc.)
├── package.json                Node.js deps for the platform
├── .env.example                Environment configuration template
└── INTEGRATION.md              Detailed integration specification
```

---

## Quick Start

### 1. Start the Fitness Platform (Node.js backend + frontend)

```bash
cd AI-Fitness-DragonDodge
npm install                    # install backend deps
cp .env.example .env           # configure environment
npm start                      # starts on http://localhost:3000
```

The platform runs with an in-memory store if PostgreSQL is not available,
so you can test immediately without a database.

### 2. Start the Python AI Microservice (optional, for face/ML features)

```bash
cd ai
pip install -r requirements.txt
python app.py                  # starts on http://127.0.0.1:5001
```

### 3. Register an Athlete

1. Open `http://localhost:3000` in your browser
2. Click Register → complete the 7-section registration form
3. Enroll your face (3 webcam samples)
4. Log in via face recognition

### 4. Play Dragon Dodge

**Option A — From the web dashboard:**
1. Navigate to the Game Arena (`/game.html`)
2. Switch to **"Dragon Dodge 3D (Desktop)"** mode
3. Click **"Create Game Session & Show Launch Command"**
4. Copy the displayed command and run it in your terminal

**Option B — Directly from the terminal:**
```bash
# Install game dependencies
pip install -r game_requirements.txt

# Run with fitness platform connection
python main.py \
  --api-url http://localhost:3000 \
  --api-key game_secure_shared_secret_token_123 \
  --user-id 1 \
  --athlete-name "Your Name"
```

**Option C — Using a config file (auto-detected):**
Edit `fitness_config.json` with your details, then simply:
```bash
python main.py
```

**Without the platform (standalone game):**
```bash
python main.py --no-camera    # keyboard-only, no fitness tracking
```

### 5. View Your Workout Results

After the game ends (game over or dragon defeated), the workout is
automatically saved to your profile. View results at:
- `/post-workout.html?session_id=<your_session>`
- `/dashboard.html` for full history and analytics

---

## How the Game-to-Platform Integration Works

| Game Event | Platform API Call | What Happens |
|---|---|---|
| Player picks a difficulty and starts | `POST /api/game/start` | Creates a workout session, returns safety constraints from the user's medical profile |
| Every 5 seconds during play | `POST /api/game/update` | Streams live telemetry: dodge/jump/punch counts, speed, accuracy |
| Game over or dragon defeated | `POST /api/game/finish` | Submits final metrics with sub-exercises (Dodge, Jump, Punch), platform calculates calories via MET formula |

The game tracks three movement types as workout "reps":
- **Dodge** — leaning/stepping to avoid projectiles (MET 6.0)
- **Jump** — physically jumping (MET 7.0)
- **Punch** — attacking the dragon (MET 5.5)

Calorie estimation uses the standard MET formula:
$$\text{Calories} = \text{MET} \times \text{Body Weight (kg)} \times \text{Duration (hours)}$$

---

## Game Controls (Dragon Dodge)

- **Lean/step left or right** — dodge left/right (auto-calibrated, press C to re-center)
- **Physically jump** — your character jumps (real physics)
- **E** — attack (works mid-jump; combo system increases hit chance)
- **ESC** — pause/resume
- **R** — restart after game over/victory
- Arrow keys + Space — keyboard fallback (no webcam needed)

---

## Raspberry Pi 4 Setup

```bash
# Install Node.js (for the platform)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python game deps
pip install -r game_requirements.txt

# Start the platform
npm install && npm start

# Run the game at lower resolution
python main.py --width 960 --height 540 --quality low
```

See `setup_raspberry_pi.sh` and `start_raspberry_pi.sh` for automated setup.
