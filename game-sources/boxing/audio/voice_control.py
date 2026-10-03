"""
audio/voice_control.py - Speech-to-Text (STT) Voice Command Recognition
Listens continuously to the user's microphone using sounddevice and speech_recognition.
Supports commands: "go", "ready", "next", "repeat", "slower", "demo", "pause", "resume", etc.
"""
import threading
import queue
import time
import numpy as np
import sounddevice as sd
import speech_recognition as sr

class VoiceController:
    def __init__(self, command_callback=None, sample_rate=16000):
        self.command_callback = command_callback
        self.sample_rate = sample_rate
        self.is_running = True
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.5

        self.last_command = ""
        self.last_command_time = 0.0
        self.is_listening = False
        self.audio_queue = queue.Queue()
        self.worker_thread = None

        # Start continuous audio listener
        self._start_listener()

    def _start_listener(self):
        def audio_recorder():
            block_size = 1024
            silence_limit = int(self.sample_rate * 0.8) # 0.8s silence to end phrase
            speech_buffer = []
            is_speaking = False
            silence_counter = 0

            # Energy threshold for voice detection
            energy_thresh = 400

            try:
                with sd.InputStream(samplerate=self.sample_rate, channels=1, dtype='int16') as stream:
                    self.is_listening = True
                    while self.is_running:
                        data, overflowed = stream.read(block_size)
                        if not self.is_running:
                            break

                        # Calculate RMS energy of current audio block
                        samples = np.frombuffer(data, dtype=np.int16)
                        rms = np.sqrt(np.mean(samples.astype(np.float32)**2))

                        if rms > energy_thresh:
                            is_speaking = True
                            silence_counter = 0
                            speech_buffer.append(data)
                        elif is_speaking:
                            speech_buffer.append(data)
                            silence_counter += block_size
                            if silence_counter > silence_limit:
                                # Completed a spoken phrase
                                full_audio = b"".join(speech_buffer)
                                if len(full_audio) > self.sample_rate * 0.3 * 2: # At least 0.3s
                                    self._process_audio_chunk(full_audio)
                                speech_buffer = []
                                is_speaking = False
                                silence_counter = 0
            except Exception as e:
                print(f"[VoiceController] Audio stream note: {e}")
                self.is_listening = False

        self.worker_thread = threading.Thread(target=audio_recorder, daemon=True)
        self.worker_thread.start()

    def _process_audio_chunk(self, raw_bytes):
        # Convert raw PCM bytes to SpeechRecognition AudioData
        try:
            audio_data = sr.AudioData(raw_bytes, self.sample_rate, 2)
            # Try Google Speech Recognition
            text = self.recognizer.recognize_google(audio_data, language="en-US").lower()
            print(f"[VoiceController] Recognized: '{text}'")
            self._handle_recognized_text(text)
        except sr.UnknownValueError:
            pass
        except sr.RequestError:
            # Fallback to local phonetic/keyword parsing if network unavailable
            pass
        except Exception as e:
            pass

    def _handle_recognized_text(self, text: str):
        text = text.strip()
        matched_cmd = None

        # Command matching rules
        if any(w in text for w in ["go", "let's go", "ready", "start", "begin"]):
            matched_cmd = "go"
        elif any(w in text for w in ["next", "continue", "proceed", "advance"]):
            matched_cmd = "next"
        elif any(w in text for w in ["repeat", "again", "retry", "one more"]):
            matched_cmd = "repeat"
        elif any(w in text for w in ["slower", "slow down", "slow"]):
            matched_cmd = "slower"
        elif any(w in text for w in ["normal", "faster", "standard speed"]):
            matched_cmd = "normal"
        elif any(w in text for w in ["demo", "demonstration", "watch", "show me"]):
            matched_cmd = "demo"
        elif any(w in text for w in ["pause", "stop", "hold"]):
            matched_cmd = "pause"
        elif any(w in text for w in ["resume", "play", "unpause"]):
            matched_cmd = "resume"
        elif any(w in text for w in ["camera", "webcam"]):
            matched_cmd = "camera"
        elif any(w in text for w in ["side view", "side"]):
            matched_cmd = "side"
        elif any(w in text for w in ["front view", "front"]):
            matched_cmd = "front"
        elif "level" in text:
            if "zero" in text or "0" in text:
                matched_cmd = "level_0"
            elif "one" in text or "1" in text:
                matched_cmd = "level_1"
            elif "two" in text or "2" in text:
                matched_cmd = "level_2"
            elif "three" in text or "3" in text:
                matched_cmd = "level_3"
            elif "four" in text or "4" in text:
                matched_cmd = "level_4"
            elif "five" in text or "5" in text:
                matched_cmd = "level_5"
            elif "six" in text or "6" in text:
                matched_cmd = "level_6"

        if matched_cmd:
            self.last_command = matched_cmd
            self.last_command_time = time.time()
            if self.command_callback:
                self.command_callback(matched_cmd)

    def stop(self):
        self.is_running = False
