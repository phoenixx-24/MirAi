"""
core/movement_evaluator.py - Rule-based Movement Checkpoint & Guard Return Evaluator
"""
import math

class MovementEvaluator:
    def __init__(self):
        # Configurable movement checkpoint thresholds
        self.guard_cheek_dist_thresh = 0.22   # Normalized distance wrist to cheek/nose
        self.chin_tuck_thresh = 0.16          # Normalized nose to sternum offset
        self.foot_stance_min_ratio = 0.75     # Stance width vs shoulder width
        self.punch_extension_thresh = 0.38    # Arm extension threshold (shoulder to wrist)
        self.max_acceptable_accel_g = 4.5     # MPU6050 threshold: avoid reckless, uncontrollable snapping

        # Lesson Rep Tracking Statistics
        self.total_attempts = 0
        self.successful_checkpoints = 0
        self.guard_returns = 0
        self.balance_maintained_count = 0
        self.current_score = 0
        self.recent_feedback = "Welcome! Step into view and assume guard."
        self.is_positive_feedback = True

    def reset_lesson_stats(self):
        self.total_attempts = 0
        self.successful_checkpoints = 0
        self.guard_returns = 0
        self.balance_maintained_count = 0
        self.current_score = 0
        self.recent_feedback = ""
        self.is_positive_feedback = True

    def evaluate(self, level_id: int, pose_data: dict, sensor_data: dict = None) -> dict:
        """
        Evaluates an attempt based on the level's specific checkpoints.
        pose_data: dict with keys {
            "visible": bool,
            "in_guard": bool,
            "balanced": bool,
            "extended": bool,
            "dodged": bool,
            "combo_done": bool,
            "balanced_step": bool,
            "landmarks": dict (optional coordinates)
        }
        sensor_data: dict with keys { "accel_mag": float, "gyro_mag": float }
        """
        if sensor_data is None:
            sensor_data = {}

        result = {
            "valid": False,
            "checkpoints_met": [],
            "returned_to_guard": False,
            "balanced": True,
            "feedback": "",
            "points_awarded": 0,
            "visibility_ok": True
        }

        # 1. Camera visibility check (Non-punitive!)
        if not pose_data.get("visible", True):
            result["visibility_ok"] = False
            result["feedback"] = "I can't see your movement clearly—step back into view."
            self.recent_feedback = result["feedback"]
            self.is_positive_feedback = False
            return result

        self.total_attempts += 1

        # 2. Sensor supporting check (penalizes uncontrolled flailing, supports control)
        accel = sensor_data.get("accel_mag", 1.2)
        controlled_tempo = accel <= self.max_acceptable_accel_g

        # 3. Guard Return Check (Hands near cheeks)
        in_guard = self._check_guard(pose_data)
        result["returned_to_guard"] = in_guard
        if in_guard:
            self.guard_returns += 1
            result["points_awarded"] += 15

        # 4. Level-specific checkpoint logic
        if level_id == 0:  # Level 0 · Stance & Guard
            balanced = pose_data.get("balanced", True)
            chin_tucked = pose_data.get("chin_tucked", True)
            result["balanced"] = balanced

            if in_guard and balanced and chin_tucked:
                result["valid"] = True
                result["checkpoints_met"] = ["balanced_stance", "hands_at_cheeks", "chin_tucked", "return_to_guard"]
                result["feedback"] = "Good reset. Hands up comfortably."
                result["points_awarded"] += 25
            elif not in_guard:
                result["feedback"] = "Bring hands up gently near your cheeks."
            else:
                result["feedback"] = "Keep knees soft and weight evenly balanced."

        elif level_id == 1:  # Level 1 · Footwork
            stepped_and_balanced = pose_data.get("balanced_step", pose_data.get("balanced", True))
            result["balanced"] = stepped_and_balanced

            if stepped_and_balanced and in_guard:
                result["valid"] = True
                result["checkpoints_met"] = ["controlled_step", "balanced_stop", "return_to_guard"]
                result["feedback"] = "Nice control on the step and return!"
                result["points_awarded"] += 25
            elif not stepped_and_balanced:
                result["feedback"] = "Small, controlled step—keep your feet balanced."
            else:
                result["feedback"] = "Good step! Now settle back into your guard."

        elif level_id == 2:  # Level 2 · First Punch (Jab)
            extended = pose_data.get("extended", pose_data.get("lead_extended", True))
            if extended and in_guard and controlled_tempo:
                result["valid"] = True
                result["checkpoints_met"] = ["lead_hand_extension", "rear_hand_glued", "return_to_guard"]
                result["feedback"] = "Great punch and clean return to guard!"
                result["points_awarded"] += 30
            elif not in_guard:
                result["feedback"] = "Good punch! Try bringing your hand back home to guard."
            elif not controlled_tempo:
                result["feedback"] = "Keep your extension controlled and snappy."
            else:
                result["feedback"] = "Extend straight toward target and return to cheek."

        elif level_id == 3:  # Level 3 · Second Punch (Cross)
            extended = pose_data.get("extended", pose_data.get("rear_extended", True))
            hip_rotated = pose_data.get("hip_rotation", True)
            if extended and in_guard and controlled_tempo and hip_rotated:
                result["valid"] = True
                result["checkpoints_met"] = ["rear_hand_extension", "hip_rotation", "return_to_guard"]
                result["feedback"] = "Smooth hip rotation and clean reset!"
                result["points_awarded"] += 30
            elif not in_guard:
                result["feedback"] = "Bring your rear hand back home to your cheek."
            elif not hip_rotated:
                result["feedback"] = "Pivot gently on the rear ball of your foot."
            else:
                result["feedback"] = "Maintain controlled tempo and reset."

        elif level_id == 4:  # Level 4 · Combination (1-2)
            combo_done = pose_data.get("combo_done", True)
            if combo_done and in_guard and controlled_tempo:
                result["valid"] = True
                result["checkpoints_met"] = ["correct_order", "controlled_tempo", "both_returns_to_guard"]
                result["feedback"] = "Nice rhythm: 1, 2, and clean reset!"
                result["points_awarded"] += 40
            elif not in_guard:
                result["feedback"] = "Great sequence! Finish firmly in your guard."
            else:
                result["feedback"] = "Keep punches distinct: Jab then Cross."

        elif level_id == 5:  # Level 5 · Defence (Slip Dodge)
            dodged = pose_data.get("dodged", True)
            if dodged and in_guard:
                result["valid"] = True
                result["checkpoints_met"] = ["lateral_displacement", "eyes_forward", "return_to_guard"]
                result["feedback"] = "Subtle slip and quick guard reset!"
                result["points_awarded"] += 30
            elif not in_guard:
                result["feedback"] = "Good slip! Keep your hands up guarding your face."
            else:
                result["feedback"] = "Gently slip your head off center line."

        elif level_id == 6:  # Level 6 · Practice Round
            balanced = pose_data.get("balanced", True)
            if in_guard and balanced:
                result["valid"] = True
                result["checkpoints_met"] = ["guard_consistency", "controlled_cadence", "overall_balance"]
                result["feedback"] = "Flowing nicely! Good balance and reset."
                result["points_awarded"] += 35
            elif not in_guard:
                result["feedback"] = "Hands up comfortably—keep your guard active."
            else:
                result["feedback"] = "Stay light on your feet and balanced."

        if result["valid"]:
            self.successful_checkpoints += 1
            self.is_positive_feedback = True
        else:
            self.is_positive_feedback = False

        self.current_score += result["points_awarded"]
        self.recent_feedback = result["feedback"]
        return result

    def _check_guard(self, pose_data: dict) -> bool:
        if "in_guard" in pose_data:
            return bool(pose_data["in_guard"])
        landmarks = pose_data.get("landmarks")
        if landmarks:
            # Check normalized wrist to nose / cheek distance
            nose = landmarks.get("nose")
            lw = landmarks.get("left_wrist")
            rw = landmarks.get("right_wrist")
            if nose and lw and rw:
                dist_l = math.hypot(lw[0] - nose[0], lw[1] - nose[1])
                dist_r = math.hypot(rw[0] - nose[0], rw[1] - nose[1])
                return dist_l < self.guard_cheek_dist_thresh and dist_r < self.guard_cheek_dist_thresh
        return True

    def is_passed(self, target_reps: int, pass_ratio: float) -> bool:
        if self.total_attempts < target_reps:
            return False
        return (self.successful_checkpoints / self.total_attempts) >= pass_ratio
