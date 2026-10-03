# 🥊 AI Boxing Trainer · Voice-Controlled HD Posture Coach

A state-of-the-art AI boxing personal trainer powered by **Python Backend**, an **HD HTML5/JS Frontend**, **MediaPipe Pose AI**, **Continuous Speech-to-Text (STT)**, and **Active Spoken Voice Commentary (TTS)**.

---

## 🚀 How to Launch

Simply run:

```bash
python main.py
```
*(or `python server.py`)*

This starts the Python server at `http://localhost:8080` and automatically opens the full HD trainer interface in your default browser!

---

## 🌟 Key Features

### 1. 🗣️ Real-Time Voice Commentary (TTS) · No Silent Blinking!
- **When you are doing right**: Coach Alex speaks aloud:
  > *"Right! Excellent stance and hands in guard."*
  and immediately unlocks your checkpoints and advances you to the next step!
- **When your posture needs correction**: Coach Alex immediately speaks the exact adjustment aloud:
  > *"Adjust your posture: bring your hands up to your cheeks!"*
  > *"Adjust your guard: keep your rear hand glued to your cheek."*
  > *"Adjust your posture: tuck your chin down gently."*
  > *"Adjust your guard: snap that punch right back home to your cheek!"*
- The spoken commentary also appears in the live HD commentary card with an animated voice wave.

---

### 2. 🎙️ 100% Hands-Free Voice Controls (STT)
You can speak directly into your microphone to control every action:

| Say | Action |
|---|---|
| **"Go"** / **"Ready"** / **"Start"** | Confirm readiness, begin practice, or start round |
| **"Next"** | Advance to next lesson step or proceed to next level |
| **"Repeat"** / **"Again"** / **"Retry"** | Re-do practice reps or retry round |
| **"Slower"** / **"Normal"** | Switch coach demonstration speed (60% pace vs normal) |
| **"Demo"** | Jump to Coach Alex demonstration |
| **"Pause"** / **"Resume"** | Pause or resume session |
| **"Camera"** | Toggle live webcam stream |
| **"Side view"** / **"Front view"** | Change perspective angle |
| **"Level 0" … "Level 6"** | Jump directly to any curriculum level |

---

### 3. 👤 Live HD Webcam Posture Stage (Center Focus)
- Full HD video feed with real-time boxing target indicators:
  - **Green Target Rings** on your hands when gloves protect your cheeks.
  - **Glowing Red `LIFT!` Rings** when your hands drop below guard level.
  - **Chin Alignment Indicator**: Green shield when chin is tucked; Amber alert when exposed.
  - **Punch Extension & Return**: Tracks straight punch trajectory and enforces immediate snapback to cheek.

---

### 4. 🥋 Clean Single Instructor (Coach Alex)
- Rendered in a dedicated reference demonstration card on the right side.
- **All duplicate ghost hands and floating phantom limbs have been completely removed** for clean, crisp technique display.

---

## 🧪 Testing

To run unit tests:
```bash
python tests/test_python_game.py
```
*(All 5 test suites pass 100%).*
