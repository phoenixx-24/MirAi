"""
audio/sound_manager.py - Procedural Sound Effects & Asynchronous Windows SAPI Speech Coaching
"""
import math
import struct
import threading
import queue
import time
import pygame

class SoundManager:
    def __init__(self, voice_enabled: bool = True, sfx_enabled: bool = True):
        self.voice_enabled = voice_enabled
        self.sfx_enabled = sfx_enabled
        self.sfx = {}
        self.speech_queue = queue.Queue()
        self.worker_thread = None
        self.is_running = True
        self.last_spoken_text = ""

        # Initialize Pygame Mixer
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
            self._generate_procedural_sounds()
        except Exception as e:
            print(f"[SoundManager] Pygame mixer init note: {e}")

        # Start background TTS thread
        if self.voice_enabled:
            self._start_speech_worker()

    def _generate_procedural_sounds(self):
        """Generates pure synthetic retro/tactile boxing sound effects."""
        sample_rate = 44100

        def make_sound(samples):
            # Convert float samples (-1.0 to 1.0) into 16-bit signed stereo bytes
            buf = bytearray()
            for s in samples:
                s = max(-1.0, min(1.0, s))
                val = int(s * 32767)
                packed = struct.pack("<hh", val, val)
                buf.extend(packed)
            return pygame.mixer.Sound(buffer=bytes(buf))

        # 1. Boxing Bell (Ding! with bell decay)
        dur = 1.0
        n_samples = int(sample_rate * dur)
        bell_samples = []
        for i in range(n_samples):
            t = i / sample_rate
            env = math.exp(-4.5 * t)
            # Bell harmonics
            s = (0.6 * math.sin(2 * math.pi * 880 * t) +
                 0.3 * math.sin(2 * math.pi * 1760 * t) +
                 0.1 * math.sin(2 * math.pi * 2640 * t)) * env
            bell_samples.append(s)
        self.sfx["bell"] = make_sound(bell_samples)

        # 2. Punch Swoosh
        dur = 0.25
        n_samples = int(sample_rate * dur)
        swoosh_samples = []
        for i in range(n_samples):
            t = i / sample_rate
            env = math.sin(math.pi * (t / dur))
            freq = 280 - (t / dur) * 140
            s = 0.5 * math.sin(2 * math.pi * freq * t) * env
            swoosh_samples.append(s)
        self.sfx["whoosh"] = make_sound(swoosh_samples)

        # 3. Checkpoint Success Chime
        dur = 0.35
        n_samples = int(sample_rate * dur)
        chime_samples = []
        for i in range(n_samples):
            t = i / sample_rate
            env = math.exp(-6.0 * t)
            freq = 1046.5 if t < 0.15 else 1318.5  # C6 -> E6
            s = 0.4 * math.sin(2 * math.pi * freq * t) * env
            chime_samples.append(s)
        self.sfx["chime"] = make_sound(chime_samples)

        # 4. Button Click
        dur = 0.05
        n_samples = int(sample_rate * dur)
        click_samples = []
        for i in range(n_samples):
            t = i / sample_rate
            env = math.exp(-50.0 * t)
            s = 0.3 * math.sin(2 * math.pi * 600 * t) * env
            click_samples.append(s)
        self.sfx["click"] = make_sound(click_samples)

    def play_sfx(self, name: str):
        if not self.sfx_enabled:
            return
        snd = self.sfx.get(name)
        if snd:
            try:
                snd.play()
            except Exception:
                pass

    def speak(self, text: str, interrupt: bool = True):
        """Asynchronously cues coach voice speech."""
        if not self.voice_enabled or not text:
            return
        if text == self.last_spoken_text:
            return
        self.last_spoken_text = text

        if interrupt:
            # Clear pending backlog
            while not self.speech_queue.empty():
                try:
                    self.speech_queue.get_nowait()
                except queue.Empty:
                    break

        self.speech_queue.put(text)

    def _start_speech_worker(self):
        def worker():
            sapi_voice = None
            try:
                import win32com.client
                # Initialize COM library for this thread
                import pythoncom
                pythoncom.CoInitialize()
                sapi_voice = win32com.client.Dispatch("SAPI.SpVoice")
                # Slightly adjust rate for coaching enthusiasm
                sapi_voice.Rate = 1
                sapi_voice.Volume = 95
            except Exception as e:
                print(f"[SoundManager] SAPI TTS init note: {e}")

            while self.is_running:
                try:
                    phrase = self.speech_queue.get(timeout=0.2)
                    if phrase and sapi_voice:
                        # 1 = SVSFlagsAsync (non-blocking in COM, or synchronous in worker thread)
                        sapi_voice.Speak(phrase)
                    self.speech_queue.task_done()
                except queue.Empty:
                    continue
                except Exception as ex:
                    print(f"[SoundManager] TTS worker error: {ex}")

        self.worker_thread = threading.Thread(target=worker, daemon=True)
        self.worker_thread.start()

    def stop(self):
        self.is_running = False
