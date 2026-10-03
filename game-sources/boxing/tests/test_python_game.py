"""
tests/test_python_game.py - Automated Unit & Integration Tests for Python Boxing Trainer
"""
import os
import sys

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.lesson_manager import LessonManager, LessonStep, LessonPhase, LEVELS
from core.movement_evaluator import MovementEvaluator
from core.session_tracker import SessionTracker
from vision.pose_tracker import PoseTracker

def test_curriculum_integrity():
    print("TEST 1: Validating 7-Level Curriculum Definition...")
    assert len(LEVELS) == 7, f"Expected 7 levels, found {len(LEVELS)}"
    for idx, lvl in enumerate(LEVELS):
        assert lvl["id"] == idx, f"Level id mismatch at index {idx}"
        assert "title" in lvl and "subtitle" in lvl
        assert "checkpoints" in lvl and len(lvl["checkpoints"]) > 0
        assert "target_reps" in lvl and lvl["target_reps"] >= 4
        assert "pass_ratio" in lvl and 0.5 <= lvl["pass_ratio"] <= 1.0
        assert "cue" in lvl
    print("  -> Passed: All 7 levels properly configured.")

def test_lesson_state_machine():
    print("TEST 2: Validating 7-Step Pedagogical Loop & Advancement...")
    lm = LessonManager()
    assert lm.current_phase == LessonPhase.READINESS_CHECK
    
    # Start Lesson 0
    lm.set_level(0)
    assert lm.current_level_id == 0
    assert lm.current_step == LessonStep.EXPLAIN
    
    # Advance through all 7 steps: EXPLAIN -> DEMO -> READY -> PRACTISE -> CHECK -> REPEAT -> REVIEW
    expected_steps = [
        LessonStep.DEMO, LessonStep.READY, LessonStep.PRACTISE,
        LessonStep.CHECK, LessonStep.REPEAT, LessonStep.REVIEW
    ]
    for step in expected_steps:
        next_s = lm.next_step()
        assert next_s == step, f"Expected step {step}, got {next_s}"

    # Next step from REVIEW enters ASSESSMENT phase
    final_step = lm.next_step()
    assert final_step is None, "Expected step after REVIEW to be None"
    assert lm.current_phase == LessonPhase.ASSESSMENT, "Expected ASSESSMENT phase"
    print("  -> Passed: 7-step lesson progression functioning as expected.")

def test_movement_evaluator_and_guard_returns():
    print("TEST 3: Validating Rule-Based Movement Evaluation & Guard Returns...")
    evaluator = MovementEvaluator()

    # 1. Camera Occlusion Graceful Warning (Non-punitive)
    evaluator.reset_lesson_stats()
    res_occluded = evaluator.evaluate(0, {"visible": False})
    assert res_occluded["visibility_ok"] is False
    assert "step back into view" in res_occluded["feedback"]
    assert evaluator.total_attempts == 0, "Occluded frames should not count as failed attempts"

    # 2. Level 0 Stance & Guard checks
    evaluator.reset_lesson_stats()
    evaluator.evaluate(0, {"visible": True, "in_guard": True, "balanced": True, "chin_tucked": True})
    evaluator.evaluate(0, {"visible": True, "in_guard": True, "balanced": True, "chin_tucked": True})
    evaluator.evaluate(0, {"visible": True, "in_guard": False, "balanced": True, "chin_tucked": True})
    evaluator.evaluate(0, {"visible": True, "in_guard": True, "balanced": True, "chin_tucked": True})

    assert evaluator.total_attempts == 4
    assert evaluator.successful_checkpoints == 3
    assert evaluator.is_passed(target_reps=4, pass_ratio=0.75) is True

    # 3. Level 2 (Jab) Guard Return Requirement
    evaluator.reset_lesson_stats()
    res_punch_no_guard = evaluator.evaluate(2, {"visible": True, "extended": True, "in_guard": False})
    assert res_punch_no_guard["valid"] is False, "Punch without returning to guard must not pass"
    assert "bringing your hand back" in res_punch_no_guard["feedback"]

    res_punch_with_guard = evaluator.evaluate(2, {"visible": True, "extended": True, "in_guard": True})
    assert res_punch_with_guard["valid"] is True, "Punch with return to guard must pass"
    assert res_punch_with_guard["points_awarded"] == 45 # 15 guard + 30 punch

    # 4. Sensor tempo check (penalizes uncontrollable flail)
    res_flail = evaluator.evaluate(2, {"visible": True, "extended": True, "in_guard": True}, sensor_data={"accel_mag": 6.8})
    assert res_flail["valid"] is False, "Erratic acceleration should prompt controlled tempo"

    print("  -> Passed: Movement evaluator rules and guard return enforced.")

def test_session_tracker_and_assessment():
    print("TEST 4: Validating Session Tracker Metrics & Assessment Generation...")
    tracker = SessionTracker(user_name="Suthi")
    evaluator = MovementEvaluator()

    # Complete 4 successful attempts
    for _ in range(4):
        evaluator.evaluate(0, {"visible": True, "in_guard": True, "balanced": True, "chin_tucked": True})
        tracker.record_rep(True, True)

    assessment = tracker.generate_level_assessment(LEVELS[0], evaluator)
    assert assessment["passed"] is True
    assert assessment["successful_reps"] == 4
    assert assessment["accuracy_pct"] == 100.0
    assert assessment["guard_returns"] == 4
    assert assessment["score"] > 0

    summary = tracker.get_overall_session_summary()
    assert summary["total_reps"] == 4
    assert summary["max_streak"] == 4
    print("  -> Passed: Session tracker and assessment reports generated correctly.")

def test_pose_tracker_simulation():
    print("TEST 5: Validating Pose Tracker Fallback & Simulation...")
    pt = PoseTracker()
    assert pt.is_camera_enabled is False, "Camera should start disabled by default"
    
    # Test simulated actions
    pt.trigger_simulated_action("jab")
    pose = pt.get_pose_data()
    assert pose["extended"] is True, "Simulated jab should be extended"

    pt.trigger_simulated_action("guard")
    pose2 = pt.get_pose_data()
    assert pose2["in_guard"] is True, "Simulated guard should be in guard"
    print("  -> Passed: Pose simulation functions as expected.")

def run_all_tests():
    print("=================================================================")
    print("Running Python Boxing Trainer Automated Test Suite")
    print("=================================================================")
    test_curriculum_integrity()
    test_lesson_state_machine()
    test_movement_evaluator_and_guard_returns()
    test_session_tracker_and_assessment()
    test_pose_tracker_simulation()
    print("\nALL 5 PYTHON TEST SUITES PASSED SUCCESSFULLY! (100%)\n")

if __name__ == "__main__":
    run_all_tests()
