"""
core/lesson_manager.py - 7-Level Boxing Curriculum & 7-Step Pedagogical Loop
"""
from enum import Enum, auto

class LessonStep(Enum):
    EXPLAIN = 1
    DEMO = 2
    READY = 3
    PRACTISE = 4
    CHECK = 5
    REPEAT = 6
    REVIEW = 7

class LessonPhase(Enum):
    READINESS_CHECK = auto()
    WARMUP = auto()
    LESSON = auto()
    ASSESSMENT = auto()
    COOLDOWN_REPORT = auto()

LEVELS = [
    {
        "id": 0,
        "title": "Level 0 · Getting Ready",
        "subtitle": "Safety, stance, and guard",
        "description": "Stand comfortably with a balanced stance, keep hands near cheeks, and keep chin gently tucked.",
        "explain_text": "This is your boxing stance and guard. Keep feet shoulder-width apart, knees soft, hands up protecting cheeks, and chin gently tucked.",
        "demo_anim": "guard_stance",
        "checkpoints": ["balanced_stance", "hands_at_cheeks", "chin_tucked", "return_to_guard"],
        "target_reps": 4,
        "pass_ratio": 0.75,
        "cue": "Hold your guard comfortably... balance your weight.",
        "feedback_success": "Excellent stance and guard position!",
        "feedback_retry": "Remember to keep hands near your cheeks and chin tucked."
    },
    {
        "id": 1,
        "title": "Level 1 · Footwork",
        "subtitle": "Move and stay balanced",
        "description": "Take small, controlled forward, backward, and lateral steps, then return to stance without crossing your feet.",
        "explain_text": "Good boxing starts from the ground up. Take small controlled steps in the direction of the cue, keeping feet shoulder-width apart.",
        "demo_anim": "step_forward_back",
        "checkpoints": ["controlled_step", "no_foot_crossing", "balanced_stop", "return_to_guard"],
        "target_reps": 4,
        "pass_ratio": 0.75,
        "cue": "Step smoothly with the cue... reset to stance.",
        "feedback_success": "Great footwork control and balance!",
        "feedback_retry": "Keep steps small and maintain your base width."
    },
    {
        "id": 2,
        "title": "Level 2 · First Punch",
        "subtitle": "Jab and return to guard",
        "description": "Extend your lead hand straight towards the target with controlled form, then immediately return to guard.",
        "explain_text": "This is your lead-hand jab. Extend your front hand straight out toward the target, keep rear hand on your cheek, then snap it right back to guard.",
        "demo_anim": "lead_jab",
        "checkpoints": ["lead_hand_extension", "rear_hand_glued_to_guard", "controlled_speed", "return_to_guard"],
        "target_reps": 5,
        "pass_ratio": 0.8,
        "cue": "Jab... return to guard.",
        "feedback_success": "Crisp extension and great return to guard!",
        "feedback_retry": "Remember: as soon as you punch, bring that hand right back to your cheek."
    },
    {
        "id": 3,
        "title": "Level 3 · Second Punch",
        "subtitle": "Cross and return to guard",
        "description": "Deliver a controlled rear-hand straight punch with gentle hip rotation, then smoothly regain your stable guard.",
        "explain_text": "This is your rear-hand cross. Rotate your rear hip and shoulder as your punch extends, keeping your lead hand protecting your face, then reset.",
        "demo_anim": "rear_cross",
        "checkpoints": ["rear_hand_extension", "hip_rotation", "lead_hand_in_guard", "return_to_guard"],
        "target_reps": 5,
        "pass_ratio": 0.8,
        "cue": "Cross... rotate hip... return to guard.",
        "feedback_success": "Smooth hip rotation and clean reset!",
        "feedback_retry": "Rotate your torso gently and bring your rear hand back home to your cheek."
    },
    {
        "id": 4,
        "title": "Level 4 · Combination",
        "subtitle": "Jab → Cross (1-2 Rhythm)",
        "description": "Combine the lead jab and rear cross in a rhythmic 1-2 sequence, followed by a complete guard reset.",
        "explain_text": "Now we combine both punches in order: Lead Jab, then Rear Cross. Focus on smooth rhythm rather than hitting hard.",
        "demo_anim": "combo_one_two",
        "checkpoints": ["correct_order", "controlled_tempo", "both_returns_to_guard", "balanced_posture"],
        "target_reps": 5,
        "pass_ratio": 0.8,
        "cue": "One... Two... Jab, Cross... and Reset!",
        "feedback_success": "Beautiful rhythm and controlled combo!",
        "feedback_retry": "Keep punches distinct: extend the jab, then let the cross flow naturally."
    },
    {
        "id": 5,
        "title": "Level 5 · Defence",
        "subtitle": "Simple dodge and reset",
        "description": "Perform a subtle upper-body slip or small bob to avoid the incoming cue, then return to upright guard.",
        "explain_text": "Boxing defence relies on small, efficient movements. Slip your head gently off the center line without bending deep or losing balance.",
        "demo_anim": "slip_dodge",
        "checkpoints": ["lateral_displacement", "no_deep_bend", "eyes_forward", "return_to_guard"],
        "target_reps": 5,
        "pass_ratio": 0.8,
        "cue": "Dodge... slip gently... return to guard.",
        "feedback_success": "Smooth dodge without losing balance!",
        "feedback_retry": "Make movement small and subtle. Keep eyes up and guard high."
    },
    {
        "id": 6,
        "title": "Level 6 · Practice Round",
        "subtitle": "Combine learned skills",
        "description": "A short, non-contact practice round mixing stance, footwork, jabs, crosses, and dodges at a comfortable pace.",
        "explain_text": "This is your practice round! We will mix everything you learned: footwork, jabs, crosses, and dodges. Take your time and keep your guard active.",
        "demo_anim": "freestyle_flow",
        "checkpoints": ["versatile_execution", "guard_consistency", "controlled_cadence", "overall_balance"],
        "target_reps": 8,
        "pass_ratio": 0.75,
        "cue": "Flow through the cues... stay relaxed and balanced.",
        "feedback_success": "Outstanding session! You completed the practice round with great control.",
        "feedback_retry": "Great effort! Consistency comes with practice. Keep hands up and stay balanced."
    }
]

class LessonManager:
    def __init__(self):
        self.current_level_id = 0
        self.max_unlocked_level = 0
        self.current_step = LessonStep.EXPLAIN
        self.current_phase = LessonPhase.READINESS_CHECK
        self.is_slower = False
        self.is_paused = False

    def get_current_level(self):
        if 0 <= self.current_level_id < len(LEVELS):
            return LEVELS[self.current_level_id]
        return LEVELS[0]

    def set_level(self, level_id: int):
        if 0 <= level_id < len(LEVELS):
            self.current_level_id = level_id
            self.current_step = LessonStep.EXPLAIN
            self.current_phase = LessonPhase.LESSON

    def next_step(self):
        """Advances through the 7-step lesson loop."""
        steps = list(LessonStep)
        idx = steps.index(self.current_step)
        if idx < len(steps) - 1:
            self.current_step = steps[idx + 1]
            return self.current_step
        else:
            # End of step 7 (REVIEW) -> trigger assessment phase
            self.current_phase = LessonPhase.ASSESSMENT
            return None

    def repeat_step(self):
        """Re-plays the current or practise step."""
        self.current_step = LessonStep.PRACTISE

    def toggle_slower(self):
        self.is_slower = not self.is_slower
        return self.is_slower

    def unlock_next_level(self):
        if self.current_level_id + 1 < len(LEVELS):
            self.max_unlocked_level = max(self.max_unlocked_level, self.current_level_id + 1)
            self.current_level_id += 1
            self.current_step = LessonStep.EXPLAIN
            self.current_phase = LessonPhase.LESSON
            return True
        else:
            self.current_phase = LessonPhase.COOLDOWN_REPORT
            return False

    def get_step_display_name(self, step: LessonStep = None):
        step = step or self.current_step
        names = {
            LessonStep.EXPLAIN: "1 · Explain",
            LessonStep.DEMO: "2 · Demo",
            LessonStep.READY: "3 · Ready",
            LessonStep.PRACTISE: "4 · Practise",
            LessonStep.CHECK: "5 · Check",
            LessonStep.REPEAT: "6 · Repeat",
            LessonStep.REVIEW: "7 · Review"
        }
        return names.get(step, "")
