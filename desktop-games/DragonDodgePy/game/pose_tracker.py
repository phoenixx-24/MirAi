"""Reliable webcam pose tracking for DragonDodge.

Public interface used by the game:
    get_lateral()       -> float [-1, 1]
    consume_jump()      -> one-shot jump event
    consume_punch()     -> one-shot punch event
    is_crouching()      -> bool
    is_connected        -> bool
    get_debug_state()   -> dict

The tracker deliberately uses both shoulders + both hips for the torso
signal, and knees/ankles as an independent squat signal. It supports the
modern MediaPipe Tasks API and the legacy MediaPipe Solutions API.
"""

import math
import os
import sys
import threading
import time
import urllib.request
from collections import deque

try:
    import cv2
    import mediapipe as mp
    HAVE_CV = True
except ImportError:
    HAVE_CV = False

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)
MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets", "models", "pose_landmarker_lite.task"
)

# MediaPipe Pose landmark indices.
LM_L_SHOULDER, LM_R_SHOULDER = 11, 12
LM_L_ELBOW, LM_R_ELBOW = 13, 14
LM_L_WRIST, LM_R_WRIST = 15, 16
LM_L_HIP, LM_R_HIP = 23, 24
LM_L_KNEE, LM_R_KNEE = 25, 26
LM_L_ANKLE, LM_R_ANKLE = 27, 28

DEFAULT_CONFIG = dict(
    TRACKING_ALPHA=0.58,
    JUMP_THRESHOLD=0.09,
    JUMP_REARM_THRESHOLD=0.030,
    MIN_JUMP_DURATION=0.035,
    SQUAT_THRESHOLD=0.070,
    SQUAT_REARM_THRESHOLD=0.025,
    SQUAT_CONFIRM_FRAMES=2,
    KNEE_BEND_THRESHOLD=155.0,
    MOVEMENT_THRESHOLD=0.018,
    MIN_VISIBILITY=0.20,
    MISSING_LANDMARK_GRACE=0.40,
    LANDED_REFRACTORY=0.10,
)

JUMP_IDLE, JUMP_RISING, JUMP_AIRBORNE, JUMP_FALLING, JUMP_LANDED = range(5)
SQUAT_STANDING, SQUAT_LOWERING, SQUAT_SQUATTING, SQUAT_RISING = range(4)

_JUMP_STATE_NAMES = {
    JUMP_IDLE: "IDLE", JUMP_RISING: "RISING", JUMP_AIRBORNE: "AIRBORNE",
    JUMP_FALLING: "FALLING", JUMP_LANDED: "LANDED",
}
_SQUAT_STATE_NAMES = {
    SQUAT_STANDING: "STANDING", SQUAT_LOWERING: "LOWERING",
    SQUAT_SQUATTING: "SQUATTING", SQUAT_RISING: "RISING",
}


def _ensure_task_model():
    if os.path.isfile(MODEL_PATH) and os.path.getsize(MODEL_PATH) > 10000:
        return MODEL_PATH
    try:
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        print("PoseTracker: downloading pose model...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        if os.path.getsize(MODEL_PATH) > 10000:
            return MODEL_PATH
    except Exception as exc:
        print("PoseTracker: model download failed:", exc)
    return None


class _History:
    def __init__(self, maxlen=8):
        self.values = deque(maxlen=maxlen)
        self.times = deque(maxlen=maxlen)

    def push(self, value, now):
        self.values.append(float(value))
        self.times.append(float(now))

    def clear(self):
        self.values.clear()
        self.times.clear()

    def velocity(self):
        if len(self.values) < 2:
            return 0.0
        dt = self.times[-1] - self.times[0]
        return (self.values[-1] - self.values[0]) / dt if dt > 1e-5 else 0.0


class PoseTracker:
    def __init__(
        self, cam_index=2, cam_width=640, cam_height=480,
        process_every=1, debug_window=False,
        jump_rise_frac=DEFAULT_CONFIG["JUMP_THRESHOLD"],
        jump_rearm_frac=DEFAULT_CONFIG["JUMP_REARM_THRESHOLD"],
        squat_drop_frac=DEFAULT_CONFIG["SQUAT_THRESHOLD"],
        squat_rearm_frac=DEFAULT_CONFIG["SQUAT_REARM_THRESHOLD"],
        punch_extend_frac=0.95, punch_rearm_frac=0.62,
        lateral_deadzone=DEFAULT_CONFIG["MOVEMENT_THRESHOLD"],
        lateral_gain=3.5, min_torso_frac=0.08,
        tracking_alpha=DEFAULT_CONFIG["TRACKING_ALPHA"],
        min_jump_duration=DEFAULT_CONFIG["MIN_JUMP_DURATION"],
        squat_confirm_frames=DEFAULT_CONFIG["SQUAT_CONFIRM_FRAMES"],
        min_visibility=DEFAULT_CONFIG["MIN_VISIBILITY"],
        missing_landmark_grace=DEFAULT_CONFIG["MISSING_LANDMARK_GRACE"],
        landed_refractory=DEFAULT_CONFIG["LANDED_REFRACTORY"],
        knee_bend_threshold=DEFAULT_CONFIG["KNEE_BEND_THRESHOLD"],
    ):
        self.cam_index = cam_index
        self.cam_width = cam_width
        self.cam_height = cam_height
        self.process_every = max(1, int(process_every))
        self.debug_window = debug_window

        self.jump_rise_frac = jump_rise_frac
        self.jump_rearm_frac = jump_rearm_frac
        self.squat_drop_frac = squat_drop_frac
        self.squat_rearm_frac = squat_rearm_frac
        self.punch_extend_frac = punch_extend_frac
        self.punch_rearm_frac = punch_rearm_frac
        self.min_torso_frac = min_torso_frac
        self.lateral_deadzone = lateral_deadzone
        self.lateral_gain = lateral_gain
        self.tracking_alpha = tracking_alpha
        self.min_jump_duration = min_jump_duration
        self.squat_confirm_frames = max(2, int(squat_confirm_frames))
        self.min_visibility = min_visibility
        self.missing_landmark_grace = missing_landmark_grace
        self.landed_refractory = landed_refractory
        self.knee_bend_threshold = knee_bend_threshold

        self._lock = threading.Lock()
        self._lateral = 0.0
        self._jump_pulse = False
        self._punch_pulse = False
        self._crouching = False
        self._connected = False
        self._running = False
        self._thread = None
        self._debug_state = {}

        self._lateral_baseline = None
        self._vertical_baseline = None
        self._baseline_torso = None
        self._smoothed_x = None
        self._smoothed_y = None
        self._vertical_history = _History(8)
        self._last_valid_t = None
        self._recalibrate_request = False

        self._jump_state = JUMP_IDLE
        self._squat_state = SQUAT_STANDING
        self._rise_start_t = None
        self._squat_confirm_counter = 0
        self._landed_at = None
        self._punch_armed = True
        self._confidence = 0.0

    @property
    def is_available(self):
        return HAVE_CV

    @property
    def is_connected(self):
        with self._lock:
            return self._connected

    def start(self):
        if not HAVE_CV or self._running:
            return False
        self._running = True
        self._thread = threading.Thread(
            target=self._run, name="DragonDodgePose", daemon=True
        )
        self._thread.start()
        return True

    def stop(self):
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.5)
        self._thread = None

    def recalibrate(self):
        self._recalibrate_request = True

    def get_lateral(self):
        with self._lock:
            return self._lateral

    def consume_jump(self):
        with self._lock:
            value = self._jump_pulse
            self._jump_pulse = False
            return value

    def consume_punch(self):
        with self._lock:
            value = self._punch_pulse
            self._punch_pulse = False
            return value

    def is_crouching(self):
        with self._lock:
            return self._crouching

    def get_debug_state(self):
        with self._lock:
            return dict(self._debug_state)

    @staticmethod
    def _visible(point, threshold):
        if point is None:
            return False
        visibility = getattr(point, "visibility", 1.0)
        presence = getattr(point, "presence", 1.0)
        try:
            return float(visibility) >= threshold and float(presence) >= threshold * 0.75
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _dist(ax, ay, bx, by):
        return math.hypot(ax - bx, ay - by)

    @staticmethod
    def _angle(a, b, c):
        abx, aby = a.x - b.x, a.y - b.y
        cbx, cby = c.x - b.x, c.y - b.y
        ma = math.hypot(abx, aby)
        mc = math.hypot(cbx, cby)
        if ma < 1e-6 or mc < 1e-6:
            return 180.0
        cosv = (abx * cbx + aby * cby) / (ma * mc)
        return math.degrees(math.acos(max(-1.0, min(1.0, cosv))))

    def _init_pose_backend(self):
        # Modern MediaPipe Tasks API.
        try:
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision

            model_file = _ensure_task_model()
            if model_file:
                base = mp_python.BaseOptions(model_asset_path=model_file)
                options = vision.PoseLandmarkerOptions(
                    base_options=base,
                    running_mode=vision.RunningMode.IMAGE,
                    num_poses=1,
                    min_pose_detection_confidence=0.25,
                    min_pose_presence_confidence=0.20,
                    min_tracking_confidence=0.20,
                )
                detector = vision.PoseLandmarker.create_from_options(options)
                print("PoseTracker: MediaPipe Tasks backend active.")
                return "tasks", detector
        except Exception as exc:
            print("PoseTracker: Tasks backend unavailable:", exc)

        # Legacy API for older MediaPipe installations.
        try:
            if hasattr(mp, "solutions") and hasattr(mp.solutions, "pose"):
                detector = mp.solutions.pose.Pose(
                    static_image_mode=False,
                    model_complexity=1,
                    smooth_landmarks=True,
                    enable_segmentation=False,
                    min_detection_confidence=0.25,
                    min_tracking_confidence=0.20,
                )
                print("PoseTracker: legacy MediaPipe Solutions backend active.")
                return "solutions", detector
        except Exception as exc:
            print("PoseTracker: legacy backend unavailable:", exc)

        return None, None

    def _open_camera(self):
        print(f"PoseTracker: opening camera index {self.cam_index}...")
        if sys.platform.startswith("win"):
            # MSMF first — it handles USB webcams far better than DirectShow
            # on modern Windows. CAP_DSHOW often grabs a phantom device or
            # produces corrupted frames on external webcams.
            backends = [cv2.CAP_MSMF, cv2.CAP_DSHOW, cv2.CAP_ANY]
        elif sys.platform == "darwin":
            backends = [cv2.CAP_AVFOUNDATION, cv2.CAP_ANY]
        else:
            backends = [cv2.CAP_V4L2, cv2.CAP_ANY]

        for backend in backends:
            backend_name = {
                cv2.CAP_MSMF: "MSMF",
                cv2.CAP_DSHOW: "DSHOW",
                cv2.CAP_AVFOUNDATION: "AVFOUNDATION",
                cv2.CAP_V4L2: "V4L2",
                cv2.CAP_ANY: "ANY",
            }.get(backend, str(backend))

            cap = None
            try:
                cap = cv2.VideoCapture(self.cam_index, backend)
                if not cap.isOpened():
                    cap.release()
                    continue

                cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.cam_width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cam_height)
                try:
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                except Exception:
                    pass

                # Do not accept a camera just because isOpened() returned true.
                # Also validate frame quality — reject static/garbage frames.
                for _ in range(30):
                    ok, frame = cap.read()
                    if not ok or frame is None or not frame.size:
                        time.sleep(0.05)
                        continue

                    # Reject garbage frames: a real camera frame has reasonable
                    # pixel variance. Pure static has extreme variance; a dead
                    # device has zero variance. Both are unusable.
                    import numpy as _np
                    gray = _np.mean(frame, axis=2) if frame.ndim == 3 else frame
                    std = float(_np.std(gray))
                    if std < 5.0 or std > 180.0:
                        print(f"PoseTracker: {backend_name} backend gave bad frame (std={std:.1f}), trying next...")
                        break  # this backend is producing garbage, skip it

                    print(f"PoseTracker: camera streaming via {backend_name} (frame std={std:.1f}).")
                    return cap
                    time.sleep(0.05)
            except Exception as exc:
                print(f"PoseTracker: {backend_name} backend error:", exc)
            if cap is not None:
                cap.release()

        # Last resort: try other camera indices with MSMF
        print(f"PoseTracker: index {self.cam_index} failed on all backends. Scanning indices 0-5...")
        for idx in range(6):
            if idx == self.cam_index:
                continue
            try:
                cap = cv2.VideoCapture(idx, cv2.CAP_MSMF)
                if not cap.isOpened():
                    cap.release()
                    continue
                for _ in range(10):
                    ok, frame = cap.read()
                    if not ok or frame is None or not frame.size:
                        time.sleep(0.05)
                        continue
                    import numpy as _np
                    gray = _np.mean(frame, axis=2) if frame.ndim == 3 else frame
                    std = float(_np.std(gray))
                    if 5.0 < std < 180.0:
                        print(f"PoseTracker: found working camera at index {idx} via MSMF (std={std:.1f}).")
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.cam_width)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cam_height)
                        return cap
                cap.release()
            except Exception:
                pass
        return None

    def _extract_body_geometry(self, lm):
        if lm is None or len(lm) < 29:
            return None

        ls, rs = lm[LM_L_SHOULDER], lm[LM_R_SHOULDER]
        lh, rh = lm[LM_L_HIP], lm[LM_R_HIP]

        shoulders = [p for p in (ls, rs) if self._visible(p, self.min_visibility)]
        hips = [p for p in (lh, rh) if self._visible(p, self.min_visibility)]

        # Require at least one shoulder and one hip. If one side is occluded,
        # the visible side remains usable instead of dropping the whole pose.
        if not shoulders or not hips:
            return None

        sx = sum(p.x for p in shoulders) / len(shoulders)
        sy = sum(p.y for p in shoulders) / len(shoulders)
        hx = sum(p.x for p in hips) / len(hips)
        hy = sum(p.y for p in hips) / len(hips)

        torso = max(self._dist(sx, sy, hx, hy), self.min_torso_frac)

        # 50/50 shoulder+hip center. This is much more stable than using one hip.
        body_x = (sx + hx) * 0.5
        body_y = (sy + hy) * 0.5

        extra_names = [
            ("left_elbow", LM_L_ELBOW), ("right_elbow", LM_R_ELBOW),
            ("left_wrist", LM_L_WRIST), ("right_wrist", LM_R_WRIST),
            ("left_knee", LM_L_KNEE), ("right_knee", LM_R_KNEE),
            ("left_ankle", LM_L_ANKLE), ("right_ankle", LM_R_ANKLE),
        ]
        limbs = {}
        extra_visible = 0
        for name, idx in extra_names:
            p = lm[idx]
            if self._visible(p, self.min_visibility):
                limbs[name] = (p.x, p.y)
                extra_visible += 1
            else:
                limbs[name] = None

        core_conf = (len(shoulders) + len(hips)) / 4.0
        confidence = min(1.0, core_conf + 0.10 * extra_visible / 8.0)

        # Use the best available leg. A straight leg is ~180 degrees;
        # a squat normally drops this angle substantially.
        leg_angle = 180.0
        leg_count = 0
        for hip, knee, ankle in (
            (lh, lm[LM_L_KNEE], lm[LM_L_ANKLE]),
            (rh, lm[LM_R_KNEE], lm[LM_R_ANKLE]),
        ):
            if (
                self._visible(hip, self.min_visibility)
                and self._visible(knee, self.min_visibility)
                and self._visible(ankle, self.min_visibility)
            ):
                leg_angle = min(leg_angle, self._angle(hip, knee, ankle))
                leg_count += 1

        return {
            "body_x": body_x,
            "body_y": body_y,
            "hip_x": hx,
            "shoulder_x": sx,
            "torso": torso,
            "confidence": confidence,
            "leg_bend_deg": leg_angle,
            "leg_count": leg_count,
            "limbs": limbs,
            "shoulders": [(p.x, p.y) for p in shoulders],
            "hips": [(p.x, p.y) for p in hips],
        }

    def _reset_motion_state(self):
        self._smoothed_x = None
        self._smoothed_y = None
        self._vertical_history.clear()
        self._lateral_baseline = None
        self._vertical_baseline = None
        self._baseline_torso = None
        self._jump_state = JUMP_IDLE
        self._squat_state = SQUAT_STANDING
        self._rise_start_t = None
        self._squat_confirm_counter = 0
        self._landed_at = None
        self._punch_armed = True
        with self._lock:
            self._lateral = 0.0
            self._crouching = False

    def _update_jump(self, now):
        if self._vertical_baseline is None or self._baseline_torso is None:
            return

        scale = max(self._baseline_torso, 0.08)
        rise = (self._vertical_baseline - self._smoothed_y) / scale
        velocity = self._vertical_history.velocity()

        if self._jump_state == JUMP_IDLE:
            # Rising must be both spatially meaningful and actually moving up.
            if rise > self.jump_rise_frac * 0.45 and velocity < -0.10:
                if self._rise_start_t is None:
                    self._rise_start_t = now
                if (
                    now - self._rise_start_t >= self.min_jump_duration
                    and rise >= self.jump_rise_frac
                ):
                    self._jump_state = JUMP_AIRBORNE
                    self._rise_start_t = None
                    with self._lock:
                        self._jump_pulse = True

        elif self._jump_state == JUMP_AIRBORNE:
            # A jump can remain airborne even while the signal briefly pauses.
            if rise < self.jump_rearm_frac or velocity > 0.10:
                self._jump_state = JUMP_FALLING

        elif self._jump_state == JUMP_FALLING:
            if rise <= self.jump_rearm_frac:
                self._jump_state = JUMP_LANDED
                self._landed_at = now

        elif self._jump_state == JUMP_LANDED:
            self._jump_state = JUMP_IDLE

    def _update_squat(self, now, leg_bend_deg, leg_count):
        if self._landed_at is not None and now - self._landed_at < self.landed_refractory:
            return

        scale = max(self._baseline_torso or 0.08, 0.08)
        drop = (self._smoothed_y - self._vertical_baseline) / scale
        knees_bent = leg_count > 0 and leg_bend_deg <= self.knee_bend_threshold

        # Require either a clear torso drop or persistent knee bend.
        crouch_candidate = drop >= self.squat_drop_frac or knees_bent

        if crouch_candidate:
            self._squat_confirm_counter += 1
            if self._squat_confirm_counter >= self.squat_confirm_frames:
                self._squat_state = SQUAT_SQUATTING
                with self._lock:
                    self._crouching = True
        else:
            self._squat_confirm_counter = 0
            if drop <= self.squat_rearm_frac and not knees_bent:
                self._squat_state = SQUAT_STANDING
                with self._lock:
                    self._crouching = False

    def _update_punch(self, lm, torso):
        lw, rw = lm[LM_L_WRIST], lm[LM_R_WRIST]
        ls, rs = lm[LM_L_SHOULDER], lm[LM_R_SHOULDER]

        extensions = []
        if self._visible(lw, self.min_visibility) and self._visible(ls, self.min_visibility):
            extensions.append(self._dist(lw.x, lw.y, ls.x, ls.y) / torso)
        if self._visible(rw, self.min_visibility) and self._visible(rs, self.min_visibility):
            extensions.append(self._dist(rw.x, rw.y, rs.x, rs.y) / torso)

        if not extensions:
            return

        extension = max(extensions)
        if extension >= self.punch_extend_frac and self._punch_armed:
            with self._lock:
                self._punch_pulse = True
            self._punch_armed = False
        elif extension <= self.punch_rearm_frac:
            self._punch_armed = True

    def _process_landmarks(self, lm, now):
        geometry = self._extract_body_geometry(lm)
        if geometry is None:
            return False

        x = geometry["body_x"]
        y = geometry["body_y"]
        torso = geometry["torso"]

        if self._smoothed_x is None:
            self._smoothed_x = x
            self._smoothed_y = y
        else:
            a = self.tracking_alpha
            self._smoothed_x = a * x + (1 - a) * self._smoothed_x
            self._smoothed_y = a * y + (1 - a) * self._smoothed_y

        self._vertical_history.push(self._smoothed_y, now)

        # First valid frame is calibration. Recalibration also clears all
        # motion state, preventing a previous jump/squat from leaking through.
        if self._vertical_baseline is None or self._recalibrate_request:
            self._lateral_baseline = self._smoothed_x
            self._vertical_baseline = self._smoothed_y
            self._baseline_torso = torso
            self._recalibrate_request = False
            self._jump_state = JUMP_IDLE
            self._squat_state = SQUAT_STANDING
            self._rise_start_t = None
            self._squat_confirm_counter = 0
            self._vertical_history.clear()
            self._vertical_history.push(self._smoothed_y, now)

        # Slowly compensate for camera/player drift only while essentially
        # stationary. Never move the vertical baseline during active motion.
        vertical_offset = (self._vertical_baseline - self._smoothed_y) / max(self._baseline_torso, 0.08)
        lateral_delta = self._smoothed_x - self._lateral_baseline
        if abs(vertical_offset) < 0.025 and abs(lateral_delta) < 0.025:
            self._lateral_baseline += (self._smoothed_x - self._lateral_baseline) * 0.004

        lateral = lateral_delta
        if abs(lateral) < self.lateral_deadzone:
            lateral = 0.0
        lateral = max(-1.0, min(1.0, lateral * self.lateral_gain))

        self._update_jump(now)
        self._update_squat(now, geometry["leg_bend_deg"], geometry["leg_count"])
        self._update_punch(lm, torso)

        self._last_valid_t = now
        self._confidence = geometry["confidence"]

        movement = "LEFT" if lateral < -0.06 else ("RIGHT" if lateral > 0.06 else "CENTER")
        if self._jump_state in (JUMP_AIRBORNE, JUMP_FALLING):
            vertical_state = _JUMP_STATE_NAMES[self._jump_state]
        elif self._crouching:
            vertical_state = "SQUATTING"
        else:
            vertical_state = "STANDING"

        with self._lock:
            self._connected = True
            self._lateral = lateral
            self._debug_state = {
                "left_shoulder": (lm[LM_L_SHOULDER].x, lm[LM_L_SHOULDER].y),
                "right_shoulder": (lm[LM_R_SHOULDER].x, lm[LM_R_SHOULDER].y),
                "left_hip": (lm[LM_L_HIP].x, lm[LM_L_HIP].y),
                "right_hip": (lm[LM_R_HIP].x, lm[LM_R_HIP].y),
                "body_center": (self._smoothed_x, self._smoothed_y),
                "movement": movement,
                "vertical_state": vertical_state,
                "confidence": self._confidence,
                "vertical_velocity": self._vertical_history.velocity(),
                "jump_rise": vertical_offset,
                "squat_drop": (self._smoothed_y - self._vertical_baseline) / max(self._baseline_torso, 0.08),
                "knee_angle": geometry["leg_bend_deg"],
                **geometry["limbs"],
            }
        return True

    def _run(self):
        cap = None
        detector = None
        backend = None
        frame_count = 0
        last_error = 0.0
        was_connected = False

        try:
            cap = self._open_camera()
            if cap is None:
                print("PoseTracker: no usable webcam; keyboard controls remain available.")
                return

            backend, detector = self._init_pose_backend()
            if detector is None:
                print("PoseTracker: no compatible MediaPipe pose backend.")
                return

            while self._running:
                ok, frame = cap.read()
                if not ok or frame is None:
                    time.sleep(0.01)
                    continue

                frame_count += 1
                if frame_count % self.process_every:
                    continue

                now = time.monotonic()
                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                try:
                    lm = None
                    if backend == "tasks":
                        mp_image = mp.Image(
                            image_format=mp.ImageFormat.SRGB,
                            data=rgb,
                        )
                        result = detector.detect(mp_image)
                        if result.pose_landmarks:
                            lm = result.pose_landmarks[0]
                    else:
                        result = detector.process(rgb)
                        if result.pose_landmarks:
                            lm = result.pose_landmarks.landmark

                    good = self._process_landmarks(lm, now)

                    if not good:
                        stale = (
                            now - self._last_valid_t
                            if self._last_valid_t is not None else float("inf")
                        )
                        if stale > self.missing_landmark_grace:
                            with self._lock:
                                self._connected = False
                                self._lateral = 0.0
                                self._crouching = False
                            self._vertical_history.clear()
                            self._jump_state = JUMP_IDLE
                            self._squat_state = SQUAT_STANDING
                            self._rise_start_t = None
                            self._squat_confirm_counter = 0
                            if was_connected and now - last_error > 2.0:
                                last_error = now
                                print("PoseTracker: pose lost - keep your full body in frame.")
                    else:
                        was_connected = True

                    if self.debug_window:
                        self._draw_debug_window(frame, good)

                except Exception as exc:
                    if now - last_error > 2.0:
                        last_error = now
                        print("PoseTracker: frame processing error:", exc)

        except Exception as exc:
            print("PoseTracker: tracker thread stopped:", exc)
        finally:
            if cap is not None:
                cap.release()
            if detector is not None:
                try:
                    detector.close()
                except Exception:
                    pass
            if self.debug_window:
                try:
                    cv2.destroyAllWindows()
                except Exception:
                    pass
            with self._lock:
                self._connected = False

    def _draw_debug_window(self, frame, has_pose):
        h, w = frame.shape[:2]
        state = self.get_debug_state()

        if not has_pose or not state:
            cv2.putText(
                frame, "NO POSE - show full body",
                (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2
            )
        else:
            points = [
                ("left_shoulder", (0, 200, 255)),
                ("right_shoulder", (0, 200, 255)),
                ("left_hip", (255, 200, 0)),
                ("right_hip", (255, 200, 0)),
                ("left_elbow", (0, 150, 255)),
                ("right_elbow", (0, 150, 255)),
                ("left_wrist", (0, 100, 255)),
                ("right_wrist", (0, 100, 255)),
                ("left_knee", (255, 150, 0)),
                ("right_knee", (255, 150, 0)),
                ("left_ankle", (255, 100, 0)),
                ("right_ankle", (255, 100, 0)),
            ]
            for key, color in points:
                p = state.get(key)
                if p is not None:
                    cv2.circle(frame, (int(p[0] * w), int(p[1] * h)), 4, color, -1)

            bx, by = state["body_center"]
            cv2.circle(frame, (int(bx * w), int(by * h)), 7, (0, 255, 0), -1)

            lines = [
                f"Movement: {state['movement']}",
                f"Vertical: {state['vertical_state']}",
                f"Confidence: {int(state['confidence'] * 100)}%",
                f"VVel: {state['vertical_velocity']:.2f}",
                f"Jump rise: {state['jump_rise']:.3f}",
                f"Squat drop: {state['squat_drop']:.3f}",
                f"Knee: {state['knee_angle']:.1f}",
            ]
            for i, text in enumerate(lines):
                cv2.putText(
                    frame, text, (10, 24 + i * 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 0), 2
                )

        cv2.imshow("DragonDodge pose debug (q to close)", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            self.debug_window = False
            cv2.destroyWindow("DragonDodge pose debug (q to close)")
