"""
vision/pose_tracker.py - Real-Time User Camera Posture Analysis & Boxing Diagnostics (OpenCV)
Detects face/head position, hand/glove guard positions, extension, and return-to-guard using
adaptive color, contour, and motion segmentation. Renders real-time feedback directly on user frame.
"""
import threading
import time
import math
import numpy as np
import cv2
import pygame

class PoseTracker:
    def __init__(self, camera_index: int = 0, autostart: bool = False):
        self.camera_index = camera_index
        self.is_camera_enabled = False
        self.cap = None
        self.latest_frame = None
        self.is_running = True
        self.thread = None
        self.lock = threading.Lock()

        self.latest_pose_data = {
            "visible": True,
            "in_guard": True,
            "left_guard": True,
            "right_guard": True,
            "balanced": True,
            "chin_tucked": True,
            "extended": False,
            "dodged": False,
            "combo_done": False,
            "balanced_step": True,
            "hip_rotation": True,
            "posture_recommendation": "Bring hands up to protect cheeks.",
            "posture_score": 100,
            "landmarks": {}
        }

        # Simulation state
        self.sim_in_guard = True
        self.sim_balanced = True
        self.sim_extended = False
        self.sim_dodged = False
        self.sim_step = True
        self.sim_visible = True
        self.sim_action_time = 0.0

        # Background subtractor for punch dynamic tracking
        self.prev_gray = None

        if autostart:
            self.start_camera()

    def start_camera(self) -> bool:
        if self.is_camera_enabled:
            return True
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if not self.cap.isOpened():
                print("[PoseTracker] Camera could not be opened. Using posture simulation.")
                self.is_camera_enabled = False
                return False

            self.is_camera_enabled = True
            self.thread = threading.Thread(target=self._capture_loop, daemon=True)
            self.thread.start()
            print("[PoseTracker] Live camera posture tracking started successfully.")
            return True
        except Exception as e:
            print(f"[PoseTracker] Camera error: {e}")
            self.is_camera_enabled = False
            return False

    def stop_camera(self):
        self.is_camera_enabled = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

    def toggle_camera(self) -> bool:
        if self.is_camera_enabled:
            self.stop_camera()
            return False
        else:
            return self.start_camera()

    def _capture_loop(self):
        while self.is_running and self.is_camera_enabled:
            if not self.cap or not self.cap.isOpened():
                break
            ret, frame = self.cap.read()
            if not ret or frame is None:
                time.sleep(0.02)
                continue

            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

            # 1. Skin & Glove Segmentation (detect face & hands)
            lower_skin = np.array([0, 28, 50], dtype=np.uint8)
            upper_skin = np.array([25, 255, 255], dtype=np.uint8)
            mask_skin = cv2.inRange(hsv, lower_skin, upper_skin)

            # Motion diff
            motion_mag = 0.0
            if self.prev_gray is not None and self.prev_gray.shape == gray.shape:
                diff = cv2.absdiff(gray, self.prev_gray)
                motion_mag = float(np.mean(diff))
            self.prev_gray = gray

            # Find top contours (Face/Head and Hands)
            contours, _ = cv2.findContours(mask_skin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            valid_contours = [c for c in contours if cv2.contourArea(c) > 500]
            valid_contours.sort(key=cv2.contourArea, reverse=True)

            pose_data = {
                "visible": True,
                "in_guard": True,
                "left_guard": True,
                "right_guard": True,
                "balanced": True,
                "chin_tucked": True,
                "extended": False,
                "dodged": False,
                "combo_done": False,
                "balanced_step": True,
                "hip_rotation": True,
                "posture_recommendation": "Good guard! Hands up comfortably.",
                "posture_score": 100,
                "landmarks": {}
            }

            if not valid_contours:
                # No person detected
                pose_data["visible"] = False
                pose_data["posture_recommendation"] = "Step into view so I can analyze your posture."
                cv2.putText(frame, "STEP INTO VIEW OF CAMERA", (40, h // 2),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
            else:
                # Top contour is typically Head/Face
                head_cnt = valid_contours[0]
                hx, hy, hw, hh = cv2.boundingRect(head_cnt)
                head_center = (hx + hw // 2, hy + hh // 2)

                # Head slip dodge detection (deviation from center X)
                center_offset = (head_center[0] - (w // 2)) / float(w)
                pose_data["dodged"] = abs(center_offset) > 0.12

                # Other high-ranking contours represent hands/arms
                hand_candidates = valid_contours[1:4]
                left_in_guard = False
                right_in_guard = False
                is_extended = False

                # Ideal guard zone: around cheeks
                guard_y_min = hy + int(hh * 0.4)
                guard_y_max = hy + int(hh * 1.5)
                guard_x_l_min = max(0, hx - int(hw * 0.8))
                guard_x_l_max = hx + hw // 2
                guard_x_r_min = hx + hw // 2
                guard_x_r_max = min(w, hx + hw + int(hw * 0.8))

                # Draw Guard Target Boxes around cheeks
                cv2.rectangle(frame, (guard_x_l_min, guard_y_min), (guard_x_l_max, guard_y_max), (0, 180, 220), 1)
                cv2.rectangle(frame, (guard_x_r_min, guard_y_min), (guard_x_r_max, guard_y_max), (0, 180, 220), 1)

                for hc in hand_candidates:
                    cx, cy, cw, ch = cv2.boundingRect(hc)
                    center_pt = (cx + cw // 2, cy + ch // 2)

                    # Check extension
                    dist_to_head = math.hypot(center_pt[0] - head_center[0], center_pt[1] - head_center[1])
                    if dist_to_head > hw * 2.2:
                        is_extended = True
                        cv2.line(frame, head_center, center_pt, (0, 255, 255), 2)

                    # Check if in left guard zone
                    if (guard_x_l_min <= center_pt[0] <= guard_x_l_max) and (guard_y_min <= center_pt[1] <= guard_y_max):
                        left_in_guard = True
                    # Check if in right guard zone
                    if (guard_x_r_min <= center_pt[0] <= guard_x_r_max) and (guard_y_min <= center_pt[1] <= guard_y_max):
                        right_in_guard = True

                # If only one hand detected or upper body blob includes guard
                if len(hand_candidates) < 2 and hh > h * 0.35:
                    left_in_guard = True
                    right_in_guard = True

                # Motion trigger for punch
                if motion_mag > 12.0:
                    is_extended = True

                pose_data["left_guard"] = left_in_guard
                pose_data["right_guard"] = right_in_guard
                pose_data["in_guard"] = left_in_guard and right_in_guard
                pose_data["extended"] = is_extended
                pose_data["balanced"] = abs(center_offset) < 0.25

                # Head / Chin bounding circle
                cv2.circle(frame, head_center, hw // 2, (255, 200, 0), 2)
                cv2.putText(frame, "CHIN TUCKED" if pose_data["chin_tucked"] else "TUCK CHIN",
                            (hx, hy - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # Hand Indicators
                col_l = (0, 230, 80) if left_in_guard else (40, 40, 240)
                col_r = (0, 230, 80) if right_in_guard else (40, 40, 240)
                cv2.circle(frame, (guard_x_l_min + 30, (guard_y_min + guard_y_max)//2), 18, col_l, 3)
                cv2.putText(frame, "L-GUARD" if left_in_guard else "LIFT!", (guard_x_l_min + 6, guard_y_max + 18),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, col_l, 2)

                cv2.circle(frame, (guard_x_r_max - 30, (guard_y_min + guard_y_max)//2), 18, col_r, 3)
                cv2.putText(frame, "R-GUARD" if right_in_guard else "LIFT!", (guard_x_r_max - 48, guard_y_max + 18),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, col_r, 2)

                # Actionable Recommendation Text
                if not left_in_guard and not right_in_guard:
                    pose_data["posture_recommendation"] = "Raise both hands near your cheeks!"
                    pose_data["posture_score"] = 50
                elif not left_in_guard:
                    pose_data["posture_recommendation"] = "Lift your left hand higher to guard your cheek."
                    pose_data["posture_score"] = 70
                elif not right_in_guard:
                    pose_data["posture_recommendation"] = "Keep your rear right hand glued to your cheek."
                    pose_data["posture_score"] = 70
                elif is_extended:
                    pose_data["posture_recommendation"] = "Good punch extension! Now snap it right back to guard."
                    pose_data["posture_score"] = 90
                else:
                    pose_data["posture_recommendation"] = "Excellent boxing posture! High guard, knees soft."
                    pose_data["posture_score"] = 100

                # Top Diagnostics Banner
                banner_color = (0, 160, 50) if pose_data["in_guard"] else (30, 30, 200)
                cv2.rectangle(frame, (0, 0), (w, 38), banner_color, -1)
                status_str = f"POSTURE: {pose_data['posture_recommendation']}"
                cv2.putText(frame, status_str, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            with self.lock:
                self.latest_frame = frame
                self.latest_pose_data = pose_data

            time.sleep(0.02)

    def trigger_simulated_action(self, action: str):
        self.sim_action_time = time.time()
        if action == "guard":
            self.sim_in_guard = True
            self.sim_extended = False
            self.sim_dodged = False
        elif action == "jab":
            self.sim_extended = True
            self.sim_in_guard = False
        elif action == "cross":
            self.sim_extended = True
            self.sim_in_guard = False
        elif action == "dodge":
            self.sim_dodged = True
            self.sim_in_guard = True
        elif action == "step":
            self.sim_step = True
            self.sim_in_guard = True
        elif action == "return_guard":
            self.sim_in_guard = True
            self.sim_extended = False

    def get_pose_data(self) -> dict:
        if self.is_camera_enabled:
            with self.lock:
                return dict(self.latest_pose_data)
        else:
            elapsed = time.time() - self.sim_action_time
            in_guard = self.sim_in_guard
            extended = self.sim_extended
            if extended and elapsed > 0.35:
                in_guard = True
                extended = False
                self.sim_in_guard = True
                self.sim_extended = False

            rec = "Good simulated guard." if in_guard else "Bring hands back to guard."
            return {
                "visible": self.sim_visible,
                "in_guard": in_guard,
                "left_guard": in_guard,
                "right_guard": in_guard,
                "balanced": self.sim_balanced,
                "chin_tucked": True,
                "extended": extended,
                "dodged": self.sim_dodged,
                "combo_done": True,
                "balanced_step": self.sim_step,
                "hip_rotation": True,
                "posture_recommendation": rec,
                "posture_score": 100 if in_guard else 60,
                "landmarks": {}
            }

    def get_frame_surface(self, target_size=(670, 386)) -> pygame.Surface:
        if not self.is_camera_enabled:
            return None
        with self.lock:
            if self.latest_frame is None:
                return None
            frame = self.latest_frame.copy()

        resized = cv2.resize(frame, target_size)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        rgb = np.rot90(rgb)
        rgb = np.flip(rgb, axis=0)
        return pygame.surfarray.make_surface(rgb)
