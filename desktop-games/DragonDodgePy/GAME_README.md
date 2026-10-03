# Dragon Dodge (Python port)

A first-person dodge + dragon boss fight, controlled by your body via a
webcam (MediaPipe Pose) instead of a keyboard. Built on Panda3D so it runs
on a Raspberry Pi 4.

## Install

```
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

`panda3d-gltf` is what lets the game load your `assets/models/dragon.glb`.
If it fails to install on your platform, the game still runs fine - the
dragon just falls back to a simple placeholder shape.

MediaPipe's official pip wheels cover most 64-bit platforms including
Raspberry Pi OS (64-bit) on a Pi 4, for Python 3.9-3.11. If `pip install
mediapipe` fails on your Pi, check you're on 64-bit Raspberry Pi OS and a
supported Python version - the game still runs with `--no-camera` (keyboard)
in the meantime.

## Run

```
python main.py
```

On a Raspberry Pi 4:

```
python main.py --width 960 --height 540
```

Other flags:

```
python main.py --no-camera        # keyboard only, no webcam/MediaPipe needed
python main.py --debug-cam        # webcam window with pose skeleton, for tuning
python main.py --cam-index 1      # pick a different camera device
python main.py --quality low      # no shadows/fog, fewer particles (weak hardware)
```

The game opens on a **START / QUIT** menu; picking Start begins the run.
Press **ESC** any time during play to pause, with **Resume / Restart / Quit**
options.

## Controls

- **Lean/step left or right** of where you were standing when the round
  started -> dodge left/right (stepping right moves you right on screen,
  stepping left moves you left). The system auto-calibrates to your
  position; press **C** any time to re-center if you've drifted.
- **Physically jump** -> your character jumps (real gravity simulation, not
  a canned animation - height and hang time follow actual physics, with a
  short input buffer so a jump pressed just before landing still fires).
- **E** -> attack. Works while airborne (a real jump or a keyboard jump).
  Landing a hit builds a short combo streak that sharply lowers the
  dragon's dodge chance and raises damage - a fast follow-up punch is
  much more likely to connect than an isolated one.
- **ESC** -> pause / resume.
- **R** -> restart after game over / victory.
- Arrow keys + Space always work too, as a fallback or for testing without
  a webcam.

## Graphics/quality notes

`--quality high` (the default) turns on shadow-casting from the sun light,
scene fog, and a full particle budget for hit/explosion/ember effects -
this looks noticeably better but costs more GPU time. `--quality low`
turns shadows and fog off and halves particle counts, which is closer to
the original Raspberry-Pi-friendly settings; use it on a Pi 4 or similar.

## How the motion control works

`game/pose_tracker.py` runs OpenCV + MediaPipe Pose on its own background
thread so a slow frame never stalls the game's render loop. It tracks your
hip midpoint:

- **Lateral dodge**: your hip X position relative to a calibrated baseline,
  scaled and dead-zoned, mapped directly to your on-screen X position.
- **Jump**: a sudden rise in hip Y (i.e. your hips moved up in the frame)
  past a threshold triggers one jump pulse; it re-arms once you're back
  down, so a single hop is one jump, not a burst of them.

If no webcam/MediaPipe is available, the game automatically falls back to
keyboard control - it never hard-fails on a missing camera.

## Using your own dragon model

Put a rigged or unrigged `.glb` at `assets/models/dragon.glb` (this repo
already ships a cleaned-up, decimated version of the model you provided,
recentered so its feet sit at the model origin). If a fresh model faces
the wrong way in the boss fight, open `game/dragon.py` and adjust
`Dragon.MODEL_YAW_OFFSET` (try 0/90/180/270) - there's no way for us to
verify exact facing without an in-engine render, so this is the one knob
you may need to nudge by eye.

## Raspberry Pi 4 performance notes

Already applied in `game/app.py`:

- Multisampling/anti-aliasing off, no vsync stall, no power-of-two texture
  padding.
- The dragon boss is decimated to ~12k triangles total (from the original
  multi-million vertex sculpt) - happy to re-decimate lower if it still
  chugs on your Pi.
- Everything else (floor, rocks, projectiles) is built from a handful of
  procedural boxes - no textures, no shaders beyond Panda3D's default.
- MediaPipe runs at 320x240 with the "lite" model (`model_complexity=0`)
  and only processes every other camera frame.

If it's still heavy on your specific Pi 4:

- Lower `--width`/`--height` further (e.g. 800x450).
- In `game/pose_tracker.py`, raise `process_every` (e.g. to 3 or 4) to
  skip more camera frames, or lower `cam_width`/`cam_height` further.
- In `game/app.py`, reduce the number of decorative rocks in `_build_arena`.

## Project layout

```
DragonDodgePy/
├── main.py
├── requirements.txt
├── assets/
│   ├── models/dragon.glb
│   └── sfx/              (auto-generated on first run)
└── game/
    ├── app.py             game states, arena, UI, spawning, main loop
    ├── player.py           gravity/jump physics + lateral control
    ├── projectile.py        survival balls & dragon flames
    ├── dragon.py            boss AI, model loading
    ├── pose_tracker.py       webcam + MediaPipe thread
    ├── audio.py              procedurally synthesized sound effects
    └── geometry.py            tiny procedural box-mesh helper
```
