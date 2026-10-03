"""
Fitness Platform API Client for Dragon Dodge.

Talks to the AI Fitness Platform's External Game API over HTTP so the
game's physical movements (dodges, jumps, punches) are recorded as a
real workout session with telemetry and calorie estimates.

All network calls run on a background daemon thread so they never stall
the Panda3D render loop, even on a Raspberry Pi 4.

Uses only Python stdlib (urllib) — no extra pip dependency required.

Protocol (see game/game_integration.md):
    POST /api/game/start    -> create session, get safety constraints
    POST /api/game/update   -> stream live telemetry
    POST /api/game/finish   -> submit final metrics, get calories
"""

import json
import os
import threading
import urllib.request
import urllib.error
from datetime import datetime, timezone


class FitnessAPIClient:
    """Thread-safe HTTP client wrapping the platform's Game API."""

    def __init__(self, base_url, api_key, user_id, athlete_name="Athlete",
                 exercise_type="DragonDodge", timeout=5):
        self.base_url = (base_url or "").rstrip("/")
        self.api_key = api_key or ""
        self.user_id = user_id
        self.athlete_name = athlete_name
        self.exercise_type = exercise_type
        self.timeout = timeout

        # Session state populated by start_session()
        self.session_id = None
        self.safety_warnings = []
        self.constraints = []
        self.connected = False
        self.error = None

        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    def _post(self, path, payload):
        """POST JSON to the platform; returns parsed dict or raises."""
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("x-api-key", self.api_key)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            raise RuntimeError(f"HTTP {e.code} from {path}: {err_body[:200]}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"Connection error to {path}: {e.reason}")
        except Exception as e:
            raise RuntimeError(f"Unexpected error calling {path}: {e}")

    def _run_async(self, fn, *args):
        """Run *fn* on a daemon thread; silently swallow exceptions."""
        def _wrapper():
            try:
                fn(*args)
            except Exception as exc:
                with self._lock:
                    self.error = str(exc)
                print(f"[FitnessAPI] {exc}")

        t = threading.Thread(target=_wrapper, daemon=True)
        t.start()
        return t

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def start_session(self, difficulty="medium", target_reps=0):
        """Call POST /api/game/start. Stores session_id on success."""
        if not self.base_url or not self.api_key or not self.user_id:
            print("[FitnessAPI] Not configured (missing url/key/user_id) — running standalone.")
            return False

        payload = {
            "user_id": self.user_id,
            "exercise_type": self.exercise_type,
            "target_reps": target_reps,
            "difficulty": difficulty,
        }
        try:
            result = self._post("/api/game/start", payload)
        except RuntimeError as exc:
            with self._lock:
                self.error = str(exc)
                self.connected = False
            print(f"[FitnessAPI] start_session failed: {exc}")
            return False

        if result.get("success") and result.get("session_id"):
            self.session_id = result["session_id"]
            self.safety_warnings = result.get("safety_warnings", [])
            self.constraints = result.get("constraints", [])
            launch = result.get("game_launch", {})
            self.athlete_name = launch.get("athlete_name", self.athlete_name)
            self.connected = True
            print(f"[FitnessAPI] Session started: {self.session_id} "
                  f"(athlete: {self.athlete_name})")
            if self.safety_warnings:
                print("[FitnessAPI] Safety warnings from platform:")
                for w in self.safety_warnings:
                    print(f"  ! {w}")
            return True

        with self._lock:
            self.error = result.get("error", "Unknown error")
            self.connected = False
        print(f"[FitnessAPI] start_session unsuccessful: {self.error}")
        return False

    def send_telemetry(self, reps, duration, speed, consistency,
                       accuracy, calories):
        """Stream a live telemetry packet (POST /api/game/update)."""
        if not self.session_id:
            return
        payload = {
            "session_id": self.session_id,
            "exercise_name": self.exercise_type,
            "repetitions": reps,
            "duration": duration,
            "movement_speed": speed,
            "movement_consistency": consistency,
            "exercise_accuracy": accuracy,
            "calories": calories,
        }
        self._run_async(self._do_telemetry, payload)

    def _do_telemetry(self, payload):
        try:
            self._post("/api/game/update", payload)
        except RuntimeError as exc:
            print(f"[FitnessAPI] telemetry send failed: {exc}")

    def finish_session(self, duration, total_reps, avg_speed,
                       consistency_score, posture_score, total_score,
                       calories, exercises=None):
        """Submit final metrics (POST /api/game/finish).

        This is synchronous (blocking) because it runs once at game-over
        / victory when the render loop is already paused on the result
        screen, so a brief network round-trip is acceptable.
        """
        if not self.session_id:
            return None

        if exercises is None:
            exercises = [{
                "exercise_name": self.exercise_type,
                "repetitions": total_reps,
                "speed": avg_speed,
                "consistency": consistency_score,
                "performance": posture_score,
                "duration": duration,
                "accuracy": posture_score,
                "calories": calories,
            }]

        payload = {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "duration": duration,
            "calories": calories,
            "exercises": exercises,
            "overall_metrics": {
                "total_reps": total_reps,
                "average_speed": avg_speed,
                "overall_consistency": consistency_score,
                "overall_performance": total_score,
            },
        }
        try:
            result = self._post("/api/game/finish", payload)
            if result.get("success"):
                print(f"[FitnessAPI] Session {self.session_id} finalized. "
                      f"Saved: {result.get('saved', False)}")
                return result
            else:
                print(f"[FitnessAPI] finish error: {result.get('error')}")
                return result
        except RuntimeError as exc:
            print(f"[FitnessAPI] finish_session failed: {exc}")
            return None

    def reset(self):
        """Clear session state so a new run can start fresh."""
        self.session_id = None
        self.safety_warnings = []
        self.constraints = []
        self.connected = False
        self.error = None


def create_from_config(config_path=None):
    """Build a FitnessAPIClient from a JSON config file, or None if
    the file is missing/incomplete (game runs standalone in that case).

    Expected keys: api_url, api_key, user_id, athlete_name
    """
    if config_path is None:
        # Default location: fitness_config.json next to the game package
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "fitness_config.json",
        )

    if not os.path.isfile(config_path):
        return None

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception as exc:
        print(f"[FitnessAPI] Could not read config {config_path}: {exc}")
        return None

    if not cfg.get("api_url") or not cfg.get("api_key") or not cfg.get("user_id"):
        return None

    return FitnessAPIClient(
        base_url=cfg["api_url"],
        api_key=cfg["api_key"],
        user_id=cfg["user_id"],
        athlete_name=cfg.get("athlete_name", "Athlete"),
        exercise_type=cfg.get("exercise_type", "DragonDodge"),
    )
