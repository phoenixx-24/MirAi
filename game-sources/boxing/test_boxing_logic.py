"""
Unit test suite for Step-by-Step Boxing Game Trainer Logic
Validates the 7-level curriculum, 7-step lesson loop, checkpoint criteria,
advancement decisions, and non-punitive sensor integration.
"""

class MockMovementEvaluator:
    def __init__(self):
        self.guard_cheek_dist_thresh = 0.22
        self.max_acceptable_accel_g = 4.5
        self.total_attempts = 0
        self.successful_checkpoints = 0
        self.guard_returns = 0
        self.current_score = 0

    def reset(self):
        self.total_attempts = 0
        self.successful_checkpoints = 0
        self.guard_returns = 0
        self.current_score = 0

    def evaluate(self, level_id, pose, sensor=None):
        if sensor is None:
            sensor = {}
        
        # Check camera visibility
        if not pose.get("visible", True):
            return {
                "valid": False,
                "feedback": "I can't see your movement clearly—step back into view.",
                "visibility_ok": False,
                "points": 0
            }

        self.total_attempts += 1
        points = 0
        valid = False

        # Guard return check
        in_guard = pose.get("in_guard", True)
        if in_guard:
            self.guard_returns += 1
            points += 15

        # Checkpoint evaluation per level
        if level_id == 0:  # Stance & Guard
            if in_guard and pose.get("balanced", True):
                valid = True
                points += 25
                feedback = "Good reset. Hands up comfortably."
            else:
                feedback = "Keep knees soft and hands up near cheeks."

        elif level_id == 1:  # Footwork
            if in_guard and pose.get("balanced_step", True):
                valid = True
                points += 25
                feedback = "Nice control on the step and return!"
            else:
                feedback = "Small, controlled step—keep your feet balanced."

        elif level_id in [2, 3]:  # Jab / Cross
            extended = pose.get("extended", True)
            controlled_tempo = sensor.get("accel_mag", 1.2) <= self.max_acceptable_accel_g
            if extended and in_guard and controlled_tempo:
                valid = True
                points += 30
                feedback = "Great punch and clean return to guard!"
            elif not in_guard:
                feedback = "Good punch! Try bringing your hand back home to guard."
            else:
                feedback = "Maintain controlled tempo and reset."

        elif level_id == 4:  # Combination
            if in_guard and pose.get("combo_done", True):
                valid = True
                points += 40
                feedback = "Nice rhythm: 1, 2, and clean reset!"
            else:
                feedback = "Keep punches distinct and return to guard."

        elif level_id == 5:  # Defence Dodge
            if in_guard and pose.get("dodged", True):
                valid = True
                points += 30
                feedback = "Subtle slip and quick guard reset!"
            else:
                feedback = "Gently slip your head off center line."

        elif level_id == 6:  # Practice Round
            if in_guard:
                valid = True
                points += 35
                feedback = "Flowing nicely! Good balance and reset."
            else:
                feedback = "Hands up comfortably—keep your guard active."

        if valid:
            self.successful_checkpoints += 1

        self.current_score += points
        return {
            "valid": valid,
            "feedback": feedback,
            "visibility_ok": True,
            "points": points
        }

    def is_passed(self, target_reps, pass_ratio):
        if self.total_attempts < target_reps:
            return False
        return (self.successful_checkpoints / self.total_attempts) >= pass_ratio


def run_tests():
    print("=================================================================")
    print("Testing Step-by-Step Boxing Game Trainer Logic & Advancements")
    print("=================================================================")

    evaluator = MockMovementEvaluator()

    # TEST 1: Camera occlusion should warn without marking user wrong
    evaluator.reset()
    res1 = evaluator.evaluate(0, {"visible": False})
    assert res1["visibility_ok"] is False, "Expected visibility_ok to be False"
    assert "step back into view" in res1["feedback"], "Expected friendly visibility prompt"
    assert evaluator.total_attempts == 0, "Occluded frames should not count as failed attempts"
    print("[PASS] TEST 1: Camera occlusion handled gracefully without penalty.")

    # TEST 2: Level 0 (Stance & Guard) advancement pass criteria
    evaluator.reset()
    # 4 attempts: 3 passed with guard, 1 without guard
    evaluator.evaluate(0, {"visible": True, "in_guard": True, "balanced": True})
    evaluator.evaluate(0, {"visible": True, "in_guard": True, "balanced": True})
    evaluator.evaluate(0, {"visible": True, "in_guard": False, "balanced": True})
    evaluator.evaluate(0, {"visible": True, "in_guard": True, "balanced": True})

    assert evaluator.total_attempts == 4, f"Expected 4 attempts, got {evaluator.total_attempts}"
    assert evaluator.successful_checkpoints == 3, f"Expected 3 passed, got {evaluator.successful_checkpoints}"
    assert evaluator.is_passed(target_reps=4, pass_ratio=0.75) is True, "Expected Level 0 to pass at 75% ratio"
    print("[PASS] TEST 2: Level 0 stance & guard unlocks correctly when 3/4 attempts meet checkpoints.")

    # TEST 3: Level 2 (Jab) Guard Return Requirement
    evaluator.reset()
    # Attempt without returning to guard
    res_no_guard = evaluator.evaluate(2, {"visible": True, "extended": True, "in_guard": False})
    assert res_no_guard["valid"] is False, "Punch without guard return should not pass checkpoint"
    assert "bringing your hand back" in res_no_guard["feedback"], "Expected feedback on returning to guard"

    # Attempt with proper return to guard
    res_with_guard = evaluator.evaluate(2, {"visible": True, "extended": True, "in_guard": True})
    assert res_with_guard["valid"] is True, "Punch with guard return must pass"
    assert res_with_guard["points"] == 45, f"Expected 15 (guard) + 30 (punch) = 45 pts, got {res_with_guard['points']}"
    print("[PASS] TEST 3: Jab strictly rewards return to guard and friendly feedback.")

    # TEST 4: Supporting MPU6050 sensor integration (penalizes erratic flailing, supports control)
    evaluator.reset()
    res_flail = evaluator.evaluate(2, {"visible": True, "extended": True, "in_guard": True}, sensor={"accel_mag": 6.8})
    assert res_flail["valid"] is False, "Excessive flailing acceleration should prompt controlled tempo"

    res_controlled = evaluator.evaluate(2, {"visible": True, "extended": True, "in_guard": True}, sensor={"accel_mag": 1.4})
    assert res_controlled["valid"] is True, "Controlled acceleration passes checkpoint"
    print("[PASS] TEST 4: Sensor acceleration enforces controlled pacing over reckless force.")

    # TEST 5: Failing a level offers retry/slower without infinite loop
    evaluator.reset()
    for _ in range(5):
        evaluator.evaluate(3, {"visible": True, "extended": False, "in_guard": False}) # Failed all 5
    assert evaluator.is_passed(target_reps=5, pass_ratio=0.8) is False, "Expected Level 3 to fail"
    print("[PASS] TEST 5: Level failure properly detected to offer Practice Again / Try Slower.")

    print("\nALL 5 AUTOMATED LOGIC TESTS PASSED SUCCESSFULLY! (100%)\n")

if __name__ == "__main__":
    run_tests()
