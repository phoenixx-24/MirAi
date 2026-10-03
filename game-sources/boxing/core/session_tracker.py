"""
core/session_tracker.py - Session Metrics, Accuracy, and Level Assessment Logic
"""
import time

class SessionTracker:
    def __init__(self, user_name: str = "Suthi"):
        self.user_name = user_name
        self.session_start_time = time.time()
        self.level_start_time = time.time()
        self.level_history = {} # level_id -> summary dict
        self.current_streak = 0
        self.max_streak = 0
        self.total_reps_completed = 0
        self.total_guard_returns = 0

    def start_level(self, level_id: int):
        self.level_start_time = time.time()

    def record_rep(self, passed: bool, guard_returned: bool):
        self.total_reps_completed += 1
        if guard_returned:
            self.total_guard_returns += 1
        if passed:
            self.current_streak += 1
            self.max_streak = max(self.max_streak, self.current_streak)
        else:
            self.current_streak = 0

    def generate_level_assessment(self, level_data: dict, evaluator) -> dict:
        duration = time.time() - self.level_start_time
        target_reps = level_data.get("target_reps", 4)
        pass_ratio = level_data.get("pass_ratio", 0.75)
        passed = evaluator.is_passed(target_reps, pass_ratio)
        accuracy = (evaluator.successful_checkpoints / max(1, evaluator.total_attempts)) * 100.0

        summary = {
            "level_id": level_data["id"],
            "title": level_data["title"],
            "passed": passed,
            "attempts": evaluator.total_attempts,
            "successful_reps": evaluator.successful_checkpoints,
            "target_reps": target_reps,
            "accuracy_pct": round(accuracy, 1),
            "guard_returns": evaluator.guard_returns,
            "score": evaluator.current_score,
            "duration_sec": round(duration, 1),
            "encouragement": (
                level_data["feedback_success"] if passed else level_data["feedback_retry"]
            )
        }
        self.level_history[level_data["id"]] = summary
        return summary

    def get_overall_session_summary(self) -> dict:
        total_time = time.time() - self.session_start_time
        total_score = sum(lvl.get("score", 0) for lvl in self.level_history.values())
        completed_levels = sum(1 for lvl in self.level_history.values() if lvl.get("passed", False))

        return {
            "user_name": self.user_name,
            "total_time_min": round(total_time / 60.0, 1),
            "completed_levels": completed_levels,
            "total_reps": self.total_reps_completed,
            "guard_return_ratio": round(self.total_guard_returns / max(1, self.total_reps_completed) * 100, 1),
            "total_score": total_score,
            "max_streak": self.max_streak
        }
