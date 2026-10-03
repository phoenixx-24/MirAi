# External Game Integration Specification

This document details the communication protocol between the **AI Fitness Platform** and any external game engine (e.g., Godot 4, Unity, Unreal, or WebGL/Pygame simulators).

The platform is **not** the game itself; it acts as the centralized biometric, telemetry intake, performance evaluation, and health safety controller.

---

## Architecture Flow

```
┌─────────────────────────┐                     ┌─────────────────────────┐
│      External Game      │                     │  Node.js Backend (Port  │
│   (Godot / Unity / etc) │                     │         3000)           │
└────────────┬────────────┘                     └────────────┬────────────┘
             │                                               │
             │  1. POST /api/game/session/start              │
             ├──────────────────────────────────────────────►│ (Generates session_id,
             │◄──────────────────────────────────────────────┤  returns user limits)
             │  { session_id, status: "READY" }              │
             │                                               │
             │  2. POST /api/game/telemetry (Periodic/Stream)│
             ├──────────────────────────────────────────────►│ (Streams rep counts,
             │◄──────────────────────────────────────────────┤  tempo, form flags)
             │  { acknowledged: true }                       │
             │                                               │
             │  3. POST /api/game/session/complete           │
             ├──────────────────────────────────────────────►│ (Final aggregated stats:
             │◄──────────────────────────────────────────────┤  reps, speed, duration)
             │  { session_id, saved: true }                  │
             │                                               │
```

---

## 1. Authentication & Security

All requests from the game client to the backend should include the application shared secret header:

```http
X-Game-Secret: <GAME_API_SECRET from .env>
Content-Type: application/json
```

---

## 2. API Endpoints

### 2.1 Start Workout Session
Initiates an active workout tracking session for a verified user.

- **URL**: `/api/game/session/start`
- **Method**: `POST`
- **Request Body**:
```json
{
  "user_id": 1,
  "exercise_type": "squat",
  "difficulty": "medium",
  "target_reps": 15
}
```

- **Response (HTTP 200)**:
```json
{
  "success": true,
  "session_id": "sess_98234a10",
  "user_id": 1,
  "exercise_type": "squat",
  "medical_constraints": [
    "Mild knee patellar tendinitis (Right)"
  ],
  "safety_warnings": [
    "Limit squat depth to 90 degrees; avoid sudden ballistic eccentric loading"
  ],
  "status": "IN_PROGRESS"
}
```

---

### 2.2 Live Telemetry Packet (Optional / Batch)
Send real-time or batched exercise metrics as the player performs movements.

- **URL**: `/api/game/telemetry`
- **Method**: `POST`
- **Request Body**:
```json
{
  "session_id": "sess_98234a10",
  "timestamp": "2026-09-09T15:45:00.120Z",
  "current_reps": 8,
  "rep_duration_ms": 1420,
  "posture_score": 92.5,
  "speed_score": 88.0,
  "consistency_score": 94.0,
  "raw_keypoints": {
    "knee_angle_deg": 89.2,
    "hip_angle_deg": 85.0
  }
}
```

- **Response (HTTP 200)**:
```json
{
  "success": true,
  "acknowledged": true
}
```

---

### 2.3 Complete Workout Session
Submits final objective metrics from the completed game workout.

- **URL**: `/api/game/session/complete`
- **Method**: `POST`
- **Request Body**:
```json
{
  "session_id": "sess_98234a10",
  "user_id": 1,
  "exercise_type": "squat",
  "duration_seconds": 185.0,
  "total_reps": 15,
  "avg_speed_reps_per_min": 24.5,
  "posture_score": 91.2,
  "speed_score": 87.5,
  "consistency_score": 93.0,
  "total_score": 90.6,
  "completion_status": "COMPLETED"
}
```

- **Response (HTTP 200)**:
```json
{
  "success": true,
  "session_id": "sess_98234a10",
  "estimated_calories": 32.4,
  "saved": true,
  "redirect_url": "/post-workout.html?session_id=sess_98234a10"
}
```

---

## 3. Objective Metrics Requirements

To adhere to the platform's medical and scientific integrity standards:
- **Duration**: Exact active movement duration in seconds.
- **Rep Count**: Verified completed repetitions based on joint angle inflection thresholds.
- **Speed**: Repetitions per minute calculated strictly from timestamps.
- **Form Scores**: Scored 0–100 based on anatomical alignment baselines.
