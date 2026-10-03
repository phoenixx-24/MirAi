# Integration Specification: Dragon Dodge ↔ AI Fitness Platform

This document specifies how the Dragon Dodge 3D game connects to the AI Fitness Platform's Game API, and what data flows between them.

---

## 1. Connection Methods

The Dragon Dodge game can connect to the platform in three ways, checked in order:

### A. CLI Arguments (highest priority)
```bash
python main.py \
  --api-url http://localhost:3000 \
  --api-key game_secure_shared_secret_token_123 \
  --user-id 1 \
  --athlete-name "Karthikeyan"
```

### B. Config File (auto-detected)
Place `fitness_config.json` in the project root:
```json
{
  "api_url": "http://localhost:3000",
  "api_key": "game_secure_shared_secret_token_123",
  "user_id": 1,
  "athlete_name": "Karthikeyan",
  "exercise_type": "DragonDodge"
}
```

### C. Web Dashboard Launch
The Game Arena page (`/game.html` → "Dragon Dodge 3D" tab) creates a session
and displays the exact CLI command to run.

If none of these are configured, the game runs standalone with no workout
tracking — it still plays normally.

---

## 2. API Protocol

All requests use the `x-api-key` header with the shared secret
(`GAME_API_SECRET` from the platform's `.env`, default:
`game_secure_shared_secret_token_123`).

### 2.1 Start Session — `POST /api/game/start`

Called when the player picks a difficulty and the run begins.

**Request:**
```json
{
  "user_id": 1,
  "exercise_type": "DragonDodge",
  "target_reps": 0,
  "difficulty": "medium"
}
```

**Response (200):**
```json
{
  "success": true,
  "session_id": "sess_a1b2c3d4e5f6",
  "game_launch": {
    "protocol": "fitness-game-v1",
    "session_id": "sess_a1b2c3d4e5f6",
    "user_id": 1,
    "athlete_name": "Karthikeyan",
    "target_exercise": "DragonDodge",
    "endpoint_update": "/api/game/update",
    "endpoint_finish": "/api/game/finish"
  },
  "constraints": ["Injury Flag: Knee"],
  "safety_warnings": ["Protect joint: Knee. Game should moderate range-of-motion and speed."],
  "status": "READY"
}
```

The game displays the first safety warning on-screen as a flash banner.

### 2.2 Live Telemetry — `POST /api/game/update`

Sent every 5 seconds during active gameplay (survival + boss phases).

**Request:**
```json
{
  "session_id": "sess_a1b2c3d4e5f6",
  "exercise_name": "DragonDodge",
  "repetitions": 42,
  "duration": 35.2,
  "movement_speed": 71.6,
  "movement_consistency": 85.0,
  "exercise_accuracy": 75.0,
  "calories": 0
}
```

**Response (200):**
```json
{
  "success": true,
  "session_id": "sess_a1b2c3d4e5f6",
  "acknowledged": true
}
```

Telemetry calls run on a background daemon thread so they never stall
the Panda3D render loop.

### 2.3 Finish Session — `POST /api/game/finish`

Called once on game over or dragon defeated (victory).

**Request:**
```json
{
  "session_id": "sess_a1b2c3d4e5f6",
  "user_id": 1,
  "duration": 87.5,
  "calories": null,
  "exercises": [
    { "exercise_name": "Dodge", "repetitions": 15, "speed": 10.3, ... },
    { "exercise_name": "Jump",  "repetitions": 8,  "speed": 10.3, ... },
    { "exercise_name": "Punch", "repetitions": 12, "speed": 10.3, ... }
  ],
  "overall_metrics": {
    "total_reps": 35,
    "average_speed": 10.3,
    "overall_consistency": 85.0,
    "overall_performance": 80.0
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "session_id": "sess_a1b2c3d4e5f6",
  "saved": true,
  "session": {
    "estimated_calories": 12.5,
    "duration_seconds": 87,
    "rep_count": 35,
    "status": "COMPLETED"
  }
}
```

When `calories` is `null`, the platform calculates it using the MET formula:
`Calories = MET × Body Weight (kg) × Duration (hours)`, using the user's
registered weight from their profile.

---

## 3. Workout Metrics Mapping

| Game Counter | Exercise Name | MET Value | Description |
|---|---|---|---|
| `fit_dodges` | Dodge | 6.0 | Projectiles dodged (leaned/stepped away) |
| `fit_jumps` | Jump | 7.0 | Physical jumps detected via MediaPipe or keyboard |
| `fit_attacks` | Punch | 5.5 | Attack inputs (E key or MediaPipe punch) |
| `fit_hits_landed` | — | — | Successful hits on the dragon (bonus metric, not a separate exercise) |

Total reps = dodges + jumps + attacks. The game sends this aggregate
as `repetitions` in telemetry and as `total_reps` in the finish payload.

---

## 4. Safety Integration

When a session starts, the platform reads the user's registered medical
profile and sends back safety warnings. For example:

- If the user has a **knee injury**: "Protect joint: Knee. Game should
  moderate range-of-motion and speed."
- If the user has **asthma**: "Medical alert: Asthma. Maintain safe
  exertion boundaries."

The game displays the first warning as a yellow flash banner at the
start of the run. All warnings are also logged to the console.

---

## 5. Graceful Degradation

- **No config/args**: Game runs standalone, no fitness tracking. A HUD
  line reads "FIT: standalone (no platform)".
- **Platform offline**: `start_session()` fails silently, the game
  continues without tracking. HUD reads "FIT: connection error".
- **Telemetry fails**: Runs on a daemon thread, failures are logged but
  never interrupt gameplay.
- **Finish fails**: The game still shows game-over/victory screen;
  the error is logged. The workout may not be saved but the game
  experience is unaffected.

---

## 6. Files Modified/Created for the Merge

### New files:
- `game/fitness_api.py` — HTTP client (stdlib urllib, threaded)
- `frontend/js/game_dragon.js` — Dragon Dodge launch mode UI controller
- `fitness_config.json` — Default connection config
- `INTEGRATION.md` — This document

### Modified files:
- `game/app.py` — Wired fitness API into game lifecycle (start, telemetry, finish), added workout counters and HUD
- `main.py` — Added `--api-url`, `--api-key`, `--user-id`, `--athlete-name`, `--fitness-config` CLI args
- `backend/services/gameService.js` — Added DragonDodge, Dodge, Jump, Punch to MET values table
- `frontend/game.html` — Added game mode selector and Dragon Dodge desktop launch panel
- `.env.example` — Documented DragonDodge exercise type
- `README.md` — Comprehensive merged project documentation

### Unchanged files (from original systems):
- All other backend controllers, routes, services, middleware
- All AI microservice files (face, pose, ml, nutrition, llama)
- All other frontend pages (dashboard, register, login, history, etc.)
- All other game modules (player.py, dragon.py, projectile.py, etc.)
- All assets (models, sound effects)
