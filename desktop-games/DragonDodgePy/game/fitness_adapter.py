"""Private IPC adapter: consumes host landmarks and voice commands, produces scores and TTS cues."""
import json, math, os, time, threading, subprocess
from pathlib import Path

class FitnessTracker:
    def __init__(self):
        self.points = []
        self.stamp = 0
        self.baseline = None
        self.jump = False
        self.punch = False
        self.jump_armed = True
        self.punch_armed = True
        self.lateral = 0.0
        self.crouch = False

    @property
    def is_connected(self):
        return len(self.points) >= 29 and time.time() - self.stamp < 1.5

    def feed(self, data):
        stamp = data.get('pose_at', 0)
        if stamp == self.stamp:
            return
        self.stamp = stamp
        p = data.get('landmarks', [])
        self.points = p if len(p) >= 29 and all(p[i].get('visibility', 0) > .5 for i in [11, 12, 23, 24]) else []
        if not self.points:
            return
        x = sum(p[i]['x'] for i in [11, 12, 23, 24]) / 4
        y = sum(p[i]['y'] for i in [11, 12, 23, 24]) / 4
        torso = max(.1, abs((p[23]['y'] + p[24]['y'] - p[11]['y'] - p[12]['y']) / 2))
        if self.baseline is None:
            self.baseline = (x, y)
        self.lateral = max(-1, min(1, -(x - self.baseline[0]) * 2.5))
        rise = (self.baseline[1] - y) / torso
        if rise > .22 and self.jump_armed:
            self.jump = True
            self.jump_armed = False
        if rise < .08:
            self.jump_armed = True
        self.crouch = rise < -.16
        extension = max(
            math.hypot(p[w]['x'] - p[s]['x'], p[w]['y'] - p[s]['y']) / torso
            if p[w].get('visibility', 0) > .5 else 0
            for w, s in [(15, 11), (16, 12)]
        )
        if extension > 1.05 and self.punch_armed:
            self.punch = True
            self.punch_armed = False
        if extension < .65:
            self.punch_armed = True

    def recalibrate(self):
        self.baseline = None

    def get_lateral(self):
        return self.lateral if self.is_connected else 0

    def consume_jump(self):
        value = self.jump and self.is_connected
        self.jump = False
        return value

    def consume_punch(self):
        value = self.punch and self.is_connected
        self.punch = False
        return value

    def is_crouching(self):
        return self.is_connected and self.crouch

    def get_debug_state(self):
        return {'confidence': min((p.get('visibility', 0) for p in self.points), default=0)}

    def stop(self):
        pass


class FitnessAdapter:
    def __init__(self, path):
        self.path = Path(path)
        self.tracker = FitnessTracker()
        self.data = {'paused': True}
        self.last_output = 0
        self.host_paused = True
        self.pending_speech = None
        self.last_command = ""
        self.last_command_time = 0

    def speak(self, text):
        """Queue spoken feedback for host TTS and standalone Windows SAPI."""
        if not text:
            return
        self.pending_speech = text
        # If running standalone, trigger Windows speech
        if not self.path or not self.path.exists():
            self._speak_direct(text)

    def _speak_direct(self, text):
        def _say():
            try:
                clean = text.replace("'", "").replace('"', '')
                subprocess.Popen(
                    ["powershell", "-NoProfile", "-Command", f"(New-Object -ComObject SAPI.SpVoice).Speak('{clean}')"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                pass
        threading.Thread(target=_say, daemon=True).start()

    def handle_voice_command(self, app, cmd):
        c = (cmd or "").lower().strip()
        if not c:
            return
        if any(w in c for w in ["jump", "leap", "hop"]):
            self.tracker.jump = True
        elif any(w in c for w in ["punch", "strike", "hit", "attack"]):
            self.tracker.punch = True
        elif any(w in c for w in ["left", "dodge left"]):
            self.tracker.lateral = -1.0
        elif any(w in c for w in ["right", "dodge right"]):
            self.tracker.lateral = 1.0
        elif any(w in c for w in ["center", "recenter", "calibrate"]):
            self.tracker.recalibrate()
            self.speak("Neutral center position calibrated.")
        elif any(w in c for w in ["pause", "hold"]):
            if app.state != 6:
                app._toggle_pause()
                self.speak("Dragon Dodge paused.")
        elif any(w in c for w in ["resume", "unpause", "continue"]):
            if app.state == 6:
                app._toggle_pause()
                self.speak("Resuming Dragon Dodge.")
        elif any(w in c for w in ["restart", "retry", "play again"]):
            if app.state in (4, 5):
                app._reset_game()
                app.state = 1
                self.speak("Restarting Dragon Dodge. Let's move!")

    def poll(self, app):
        try:
            self.data = json.loads(self.path.read_text())
        except (OSError, ValueError):
            pass

        # Check for incoming voice commands (STT)
        cmd = self.data.get('command')
        if cmd and cmd != self.last_command:
            self.last_command = cmd
            self.handle_voice_command(app, cmd)

        # Pause on lost browser/service, close after a minute without a heartbeat.
        age = time.time() - self.data.get('heartbeat', 0)
        was_paused = self.host_paused
        self.host_paused = bool(self.data.get('paused', True)) or age > 4
        if age > 60:
            app.userExit()
        if was_paused and not self.host_paused and app.state == 6:
            app._toggle_pause()
        if self.host_paused:
            self.tracker.jump = False
            self.tracker.punch = False
            self.tracker.recalibrate()
        else:
            self.tracker.feed(self.data)

        app.difficulty = 'easy' if self.data.get('difficulty', 1) <= 2 else 'medium' if self.data.get('difficulty', 1) == 3 else 'hard'

        if time.monotonic() - self.last_output > .2:
            self.last_output = time.monotonic()
            dest = self.path.with_name('output.json')
            tmp = dest.with_suffix('.tmp')
            speech_to_send = self.pending_speech
            self.pending_speech = None
            out_data = {
                'score': app.score,
                'state': app.state,
                'paused': app.state == 6,
                'speech': speech_to_send
            }
            tmp.write_text(json.dumps(out_data))
            os.replace(tmp, dest)

        return self.host_paused
