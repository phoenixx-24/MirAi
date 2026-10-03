"""
server.py - Multi-Threaded Local HD Web Server & API Launcher for AI Boxing Trainer
Serves the HTML5/JS HD Frontend with full webcam, MediaPipe, STT, and TTS voice commentary.
Uses ThreadingHTTPServer with graceful connection termination handling (suppresses WinError 10053).
"""
import os
import sys
import json
import time
import queue
import threading
import webbrowser
import cv2
import numpy as np
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PORT = 8080
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

# Global Video & Voice State
latest_camera_frame = None
camera_lock = threading.Lock()
voice_command_queue = queue.Queue()
last_recognized_command = ""
last_recognized_time = 0.0

# Camera Capture Worker (runs in background)
def camera_worker():
    global latest_camera_frame
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[Server] Note: Camera 0 could not be opened directly by OpenCV.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            time.sleep(0.03)
            continue

        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        cx, cy = w // 2, h // 2 - 20
        # Draw Guard target zones on feed
        cv2.circle(frame, (cx - 70, cy), 28, (0, 230, 100), 2)
        cv2.putText(frame, "L-GUARD", (cx - 100, cy + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 230, 100), 2)

        cv2.circle(frame, (cx + 70, cy), 28, (0, 230, 100), 2)
        cv2.putText(frame, "R-GUARD", (cx + 40, cy + 45), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 230, 100), 2)

        cv2.rectangle(frame, (cx - 45, cy - 90), (cx + 45, cy + 20), (255, 200, 0), 2)
        cv2.putText(frame, "CHIN", (cx - 20, cy - 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 0), 2)

        # Encode to JPEG
        ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ret:
            with camera_lock:
                latest_camera_frame = jpeg.tobytes()

        time.sleep(0.03)

# Voice STT Worker (sounddevice + speech_recognition)
def voice_worker():
    global last_recognized_command, last_recognized_time
    try:
        from audio.voice_control import VoiceController
        def on_cmd(cmd):
            global last_recognized_command, last_recognized_time
            print(f"[Server STT] Heard Voice Command: '{cmd}'")
            voice_command_queue.put(cmd)
            last_recognized_command = cmd
            last_recognized_time = time.time()

        vc = VoiceController(command_callback=on_cmd)
    except Exception as e:
        print(f"[Server STT] Voice worker init note: {e}")

class BoxingServerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        # Suppress noisy HTTP logs
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
            pass

    def do_GET(self):
        clean_path = self.path.split('?')[0].rstrip('/')

        # 1. MJPEG Video Feed (Threaded Streaming)
        if clean_path == '/video_feed':
            try:
                self.send_response(200)
                self.send_header('Content-type', 'multipart/x-mixed-replace; boundary=frame')
                self.send_header('Cache-Control', 'no-cache, private, no-store, must-revalidate')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
                self.end_headers()

                while True:
                    with camera_lock:
                        frame = latest_camera_frame
                    if frame:
                        self.wfile.write(b'--frame\r\n')
                        self.send_header('Content-type', 'image/jpeg')
                        self.send_header('Content-length', str(len(frame)))
                        self.end_headers()
                        self.wfile.write(frame)
                        self.wfile.write(b'\r\n')
                    time.sleep(0.033)
            except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
                # Client closed browser tab, refreshed, or aborted connection
                pass
            return

        # 2. Polling API for STT Voice Commands
        elif clean_path == '/api/voice_command':
            try:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()

                commands = []
                while not voice_command_queue.empty():
                    try:
                        commands.append(voice_command_queue.get_nowait())
                    except queue.Empty:
                        break

                payload = {
                    "commands": commands,
                    "latest": last_recognized_command,
                    "time": last_recognized_time
                }
                self.wfile.write(json.dumps(payload).encode('utf-8'))
            except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
                pass
            return

        # 3. Standard Static Web Files
        try:
            super().do_GET()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
            pass

class MultiThreadedBoxingServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # Gracefully handle browser disconnects without dumping WinError 10053 tracebacks
        exc_type, _, _ = sys.exc_info()
        if exc_type in (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            return
        super().handle_error(request, client_address)

def run_server(auto_open=True):
    # Start Camera & STT background threads
    t_cam = threading.Thread(target=camera_worker, daemon=True)
    t_cam.start()

    t_voice = threading.Thread(target=voice_worker, daemon=True)
    t_voice.start()

    actual_port = PORT
    httpd = None

    for p in range(PORT, PORT + 10):
        try:
            httpd = MultiThreadedBoxingServer(('', p), BoxingServerHandler)
            actual_port = p
            break
        except OSError:
            continue

    if not httpd:
        print(f"[Error] Could not bind server to ports {PORT}-{PORT+10}")
        sys.exit(1)

    url = f"http://localhost:{actual_port}"
    print("=" * 68)
    print("AI BOXING PERSONAL TRAINER (HD VOICE & POSTURE EDITION)")
    print("=" * 68)
    print(f"Server active at: {url}")
    print("Hands-Free Voice STT: Say 'Go', 'Next', 'Repeat', 'Slower'...")
    print("AI Spoken Commentary TTS: Real-time verbal posture feedback.")
    print("Live Camera Stage: Multi-threaded stream active at /video_feed")
    print("=" * 68)
    print("Opening browser in full HD... Press Ctrl+C to exit.")

    if auto_open:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Boxing Trainer server.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
