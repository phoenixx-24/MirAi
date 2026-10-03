"""
ui/hud_renderer.py - User-Centric Glassmorphic HUD with STT Voice Indicator & Posture Analysis Cards
"""
import time
import pygame
from config import (
    BG_DARK, BG_SURFACE, BG_SURFACE_LIGHT, BORDER_COLOR, BORDER_HIGHLIGHT,
    ACCENT_CYAN, ACCENT_GREEN, ACCENT_AMBER, ACCENT_RED, ACCENT_PURPLE,
    TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED
)
from core.lesson_manager import LessonStep, LessonPhase
from ui.components import Button, MetricPill, CheckpointItem

class HUDRenderer:
    def __init__(self, screen_width: int = 1280, screen_height: int = 740):
        self.width = screen_width
        self.height = screen_height

        pygame.font.init()
        self.font_xl = pygame.font.SysFont("Outfit", 24, bold=True) or pygame.font.SysFont("Arial", 24, bold=True)
        self.font_lg = pygame.font.SysFont("Outfit", 18, bold=True) or pygame.font.SysFont("Arial", 18, bold=True)
        self.font_md = pygame.font.SysFont("Outfit", 15) or pygame.font.SysFont("Arial", 15)
        self.font_sm = pygame.font.SysFont("Outfit", 12) or pygame.font.SysFont("Arial", 12)
        self.font_mono = pygame.font.SysFont("Consolas", 13) or pygame.font.SysFont("Courier", 13)

        # Header Metric Pills
        self.pill_reps = MetricPill((self.width - 410, 16, 95, 52), "Reps", "0 / 4", self.font_sm, self.font_lg)
        self.pill_score = MetricPill((self.width - 305, 16, 105, 52), "Score", "0", self.font_sm, self.font_lg, highlight=True)
        self.pill_streak = MetricPill((self.width - 190, 16, 90, 52), "Streak", "0 🔥", self.font_sm, self.font_lg, accent_color=ACCENT_AMBER)
        self.pill_voice = MetricPill((self.width - 90, 16, 75, 52), "Voice", "STT", self.font_sm, self.font_lg, accent_color=ACCENT_GREEN)

        # Movement Checkpoints (Positioned below the user's primary camera feed)
        cp_y = 525
        self.cp_guard = CheckpointItem((40, cp_y, 160, 34), "Hands at Cheeks", "🛡️", self.font_sm)
        self.cp_balance = CheckpointItem((210, cp_y, 160, 34), "Balanced Stance", "⚖️", self.font_sm)
        self.cp_extension = CheckpointItem((380, cp_y, 160, 34), "Clean Extension", "🎯", self.font_sm)
        self.cp_return = CheckpointItem((550, cp_y, 160, 34), "Return to Guard", "↩️", self.font_sm)

        # Viewport Toggle Buttons
        self.btn_side = Button((self.width - 340, 92, 95, 30), "🔄 Side View", self.font_sm)
        self.btn_slower = Button((self.width - 235, 92, 105, 30), "🐢 Slower (S)", self.font_sm)
        self.btn_cam = Button((self.width - 120, 92, 95, 30), "📷 Camera", self.font_sm)

        # Bottom Control Bar Buttons
        btn_y = self.height - 66
        self.btn_demo = Button((40, btn_y, 140, 46), "👁 Demo (D)", self.font_md)
        self.btn_repeat = Button((195, btn_y, 140, 46), "↺ Repeat (R)", self.font_md)
        self.btn_pause = Button((350, btn_y, 130, 46), "⏸ Pause (P)", self.font_md)
        self.btn_next = Button((self.width - 240, btn_y, 200, 46), "Next Step → [Say 'Next']", self.font_lg,
                               bg_color=(0, 140, 180), hover_color=(0, 180, 220), border_color=ACCENT_CYAN)

    def draw_hud(self, surface: pygame.Surface, lesson_mgr, evaluator, tracker, pose_tracker, voice_ctrl, sound_mgr):
        level_data = lesson_mgr.get_current_level()

        # 1. Top Header Background
        header_rect = pygame.Rect(0, 0, self.width, 80)
        pygame.draw.rect(surface, BG_SURFACE, header_rect)
        pygame.draw.line(surface, BORDER_COLOR, (0, 80), (self.width, 80), 1)

        # Title & Subtitle
        badge_surf = self.font_sm.render("🥊  AI BOXING PERSONAL TRAINER · VOICE & CAMERA ENABLED", True, ACCENT_CYAN)
        surface.blit(badge_surf, (24, 10))

        title_surf = self.font_xl.render(level_data["title"], True, TEXT_PRIMARY)
        surface.blit(title_surf, (24, 28))
        sub_surf = self.font_sm.render(level_data["subtitle"], True, TEXT_MUTED)
        surface.blit(sub_surf, (24, 56))

        # Metric Pills
        target_reps = level_data.get("target_reps", 4)
        self.pill_reps.set_value(f"{evaluator.successful_checkpoints} / {target_reps}")
        self.pill_score.set_value(f"{evaluator.current_score}")
        self.pill_streak.set_value(f"{tracker.current_streak} 🔥")
        self.pill_voice.set_value("MIC ON" if voice_ctrl.is_listening else "MIC OFF")

        self.pill_reps.draw(surface)
        self.pill_score.draw(surface)
        self.pill_streak.draw(surface)
        self.pill_voice.draw(surface)

        # 2. 7-Step Progress Stepper
        self._draw_stepper(surface, lesson_mgr.current_step)

        # 3. USER PRIMARY CAMERA & POSTURE VIEWPORT (Left/Center Stage)
        self._draw_user_stage(surface, pose_tracker)

        # 4. Movement Checkpoints (Hands at cheeks, balance, etc.)
        pose = pose_tracker.get_pose_data()
        self.cp_guard.status = pose.get("in_guard", False)
        self.cp_balance.status = pose.get("balanced", True)
        self.cp_extension.status = pose.get("extended", False)
        self.cp_return.status = pose.get("in_guard", False)

        self.cp_guard.draw(surface)
        self.cp_balance.draw(surface)
        self.cp_extension.draw(surface)
        self.cp_return.draw(surface)

        # 5. Viewport Toggles (Top-right of arena)
        self.btn_side.draw(surface)
        self.btn_slower.draw(surface)
        self.btn_cam.draw(surface)

        # 6. Real-time Posture Recommendation & Coach Speech
        self._draw_posture_and_speech(surface, lesson_mgr, evaluator, pose)

        # 7. Voice STT Live Status Bar
        self._draw_voice_bar(surface, voice_ctrl)

        # 8. Bottom Action Bar
        bottom_rect = pygame.Rect(0, self.height - 76, self.width, 76)
        pygame.draw.rect(surface, BG_SURFACE, bottom_rect)
        pygame.draw.line(surface, BORDER_COLOR, (0, self.height - 76), (self.width, self.height - 76), 1)

        # Voice command help text
        help_text = '🎙️ Voice Controls: Say "Go", "Next", "Repeat", "Slower", "Demo", "Pause", "Resume", "Camera", "Level 1..6"'
        h_surf = self.font_mono.render(help_text, True, ACCENT_CYAN)
        surface.blit(h_surf, (40, self.height - 72))

        # Dynamic Next button text
        if lesson_mgr.current_step == LessonStep.REVIEW:
            self.btn_next.text = "Assess Round → [Say 'Next']"
        elif lesson_mgr.current_step == LessonStep.READY:
            self.btn_next.text = "Start Practise → [Say 'Go']"
        else:
            self.btn_next.text = "Next Step → [Say 'Next']"

        if lesson_mgr.is_slower:
            self.btn_slower.bg_color = (60, 50, 20)
            self.btn_slower.border_color = ACCENT_AMBER
            self.btn_slower.text = "🐢 Slower [ON]"
        else:
            self.btn_slower.bg_color = BG_SURFACE
            self.btn_slower.border_color = BORDER_COLOR
            self.btn_slower.text = "🐢 Slower (S)"

        self.btn_demo.draw(surface)
        self.btn_repeat.draw(surface)
        self.btn_pause.draw(surface)
        self.btn_next.draw(surface)

    def _draw_user_stage(self, surface: pygame.Surface, pose_tracker):
        user_rect = pygame.Rect(40, 95, 670, 420)
        pygame.draw.rect(surface, (18, 22, 34), user_rect, border_radius=12)
        pygame.draw.rect(surface, BORDER_COLOR, user_rect, width=1, border_radius=12)

        # Stage Header
        pygame.draw.rect(surface, BG_SURFACE_LIGHT, (user_rect.x, user_rect.y, user_rect.width, 34),
                         border_top_left_radius=12, border_top_right_radius=12)
        tag = self.font_sm.render("👤 YOUR LIVE POSTURE & FORM ANALYSIS", True, ACCENT_GREEN)
        surface.blit(tag, (user_rect.x + 14, user_rect.y + 9))

        # Live Webcam Feed if available
        cam_surf = pose_tracker.get_frame_surface(target_size=(670, 386))
        if cam_surf and pose_tracker.is_camera_enabled:
            surface.blit(cam_surf, (user_rect.x, user_rect.y + 34))
        else:
            # Fallback simulator / prompt to turn on camera
            msg1 = self.font_lg.render("📷 Camera is currently in Simulation Mode", True, TEXT_PRIMARY)
            msg2 = self.font_md.render("Say 'Camera' or click Camera (C) to connect your live webcam.", True, TEXT_MUTED)
            msg3 = self.font_mono.render("Simulation hotkeys: [1] Jab  [2] Cross  [3] Slip Dodge  [Space] Guard", True, ACCENT_CYAN)

            m1_rect = msg1.get_rect(center=(user_rect.centerx, user_rect.centery - 25))
            m2_rect = msg2.get_rect(center=(user_rect.centerx, user_rect.centery + 10))
            m3_rect = msg3.get_rect(center=(user_rect.centerx, user_rect.centery + 45))

            surface.blit(msg1, m1_rect)
            surface.blit(msg2, m2_rect)
            surface.blit(msg3, m3_rect)

    def _draw_stepper(self, surface: pygame.Surface, current_step: LessonStep):
        steps = [
            (LessonStep.EXPLAIN, "1. Explain"),
            (LessonStep.DEMO, "2. Demo"),
            (LessonStep.READY, "3. Ready"),
            (LessonStep.PRACTISE, "4. Practise"),
            (LessonStep.CHECK, "5. Check"),
            (LessonStep.REPEAT, "6. Repeat"),
            (LessonStep.REVIEW, "7. Review")
        ]
        start_x = 420
        y = 35
        node_spacing = 95
        curr_idx = list(LessonStep).index(current_step)

        line_w = node_spacing * (len(steps) - 1)
        pygame.draw.line(surface, BORDER_COLOR, (start_x, y), (start_x + line_w, y), 2)

        for i, (step_enum, label) in enumerate(steps):
            x = start_x + i * node_spacing
            is_active = (i == curr_idx)
            is_done = (i < curr_idx)

            if is_active:
                circle_col = ACCENT_CYAN
                txt_col = TEXT_PRIMARY
                r = 11
            elif is_done:
                circle_col = ACCENT_GREEN
                txt_col = TEXT_SECONDARY
                r = 9
            else:
                circle_col = BORDER_COLOR
                txt_col = TEXT_MUTED
                r = 8

            pygame.draw.circle(surface, circle_col, (x, y), r)
            if is_active:
                pygame.draw.circle(surface, BG_DARK, (x, y), r - 3)

            lbl_surf = self.font_sm.render(label, True, txt_col)
            lbl_rect = lbl_surf.get_rect(center=(x, y + 18))
            surface.blit(lbl_surf, lbl_rect)

    def _draw_posture_and_speech(self, surface: pygame.Surface, lesson_mgr, evaluator, pose):
        # Posture Diagnostic Recommendation Card (Right side, below Coach Alex)
        card_rect = pygame.Rect(730, 480, 510, 175)
        pygame.draw.rect(surface, BG_SURFACE, card_rect, border_radius=12)
        pygame.draw.rect(surface, BORDER_COLOR, card_rect, width=1, border_radius=12)

        # Header tag
        tag_bg = pygame.Rect(card_rect.x, card_rect.y, card_rect.width, 32)
        pygame.draw.rect(surface, (28, 34, 52), tag_bg, border_top_left_radius=12, border_top_right_radius=12)
        t_surf = self.font_sm.render("🧠 AI POSTURE DIAGNOSTICS & RECOMMENDATIONS", True, ACCENT_CYAN)
        surface.blit(t_surf, (card_rect.x + 14, card_rect.y + 8))

        # Recommendation Text
        rec = pose.get("posture_recommendation", "Bring hands up to protect cheeks.")
        is_ok = pose.get("in_guard", False)
        icon = "✅ " if is_ok else "⚠️ "
        rec_color = ACCENT_GREEN if is_ok else ACCENT_AMBER

        rec_surf = self.font_lg.render(f"{icon}{rec}", True, rec_color)
        surface.blit(rec_surf, (card_rect.x + 14, card_rect.y + 44))

        # Pedagogical Step Coach Instruction
        level_data = lesson_mgr.get_current_level()
        step = lesson_mgr.current_step
        if step == LessonStep.EXPLAIN:
            speech = level_data["explain_text"]
        elif step == LessonStep.DEMO:
            speech = f"Watch Coach Alex demo. {level_data['cue']}"
        elif step == LessonStep.READY:
            speech = "Assume guard: feet shoulder-width, chin tucked, hands at cheeks. Say 'Go' when ready!"
        elif step == LessonStep.PRACTISE:
            speech = f"Practice reps! {level_data['cue']}"
        elif step == LessonStep.CHECK:
            speech = evaluator.recent_feedback or "Check your guard return after every punch."
        elif step == LessonStep.REPEAT:
            speech = "Keep repeating smoothly to build muscle memory."
        elif step == LessonStep.REVIEW:
            speech = "Round completed! Review your score or say 'Next' to advance."
        else:
            speech = level_data["cue"]

        c_tag = self.font_sm.render("COACH CUE:", True, TEXT_MUTED)
        surface.blit(c_tag, (card_rect.x + 14, card_rect.y + 82))
        self._render_wrapped_text(surface, f'"{speech}"', card_rect.x + 14, card_rect.y + 102, 480, self.font_md)

    def _draw_voice_bar(self, surface: pygame.Surface, voice_ctrl):
        # Small floating pill showing latest voice command
        v_rect = pygame.Rect(40, 570, 670, 36)
        pygame.draw.rect(surface, (20, 26, 42), v_rect, border_radius=8)
        pygame.draw.rect(surface, BORDER_COLOR, v_rect, width=1, border_radius=8)

        now = time.time()
        if voice_ctrl.last_command and (now - voice_ctrl.last_command_time < 3.0):
            cmd_text = f"🎙️ VOICE COMMAND HEARD: \"{voice_ctrl.last_command.upper()}\"  [Executing action]"
            col = ACCENT_GREEN
        else:
            cmd_text = "🎙️ STT VOICE ACTIVE · Say: \"Go\", \"Next\", \"Repeat\", \"Slower\", \"Demo\", \"Pause\""
            col = TEXT_SECONDARY

        txt = self.font_mono.render(cmd_text, True, col)
        rect = txt.get_rect(center=v_rect.center)
        surface.blit(txt, rect)

    def _render_wrapped_text(self, surface, text, x, y, max_width, font):
        words = text.split(' ')
        lines = []
        cur = []
        for w in words:
            test = ' '.join(cur + [w])
            if font.size(test)[0] < max_width:
                cur.append(w)
            else:
                lines.append(' '.join(cur))
                cur = [w]
        if cur:
            lines.append(' '.join(cur))
        line_y = y
        for l in lines[:3]:
            s = font.render(l, True, TEXT_PRIMARY)
            surface.blit(s, (x, line_y))
            line_y += font.get_linesize() + 2

    # --- MODALS ---

    def draw_readiness_modal(self, surface: pygame.Surface, btn_ready: Button):
        overlay = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        overlay.fill((10, 12, 20, 220))
        surface.blit(overlay, (0, 0))

        modal_rect = pygame.Rect(self.width // 2 - 320, self.height // 2 - 200, 640, 400)
        pygame.draw.rect(surface, BG_SURFACE, modal_rect, border_radius=16)
        pygame.draw.rect(surface, BORDER_HIGHLIGHT, modal_rect, width=2, border_radius=16)

        title = self.font_xl.render("Welcome to AI Boxing Trainer!", True, TEXT_PRIMARY)
        surface.blit(title, (modal_rect.x + 40, modal_rect.y + 35))

        items = [
            "🎙️  Voice Enabled (STT): Say \"Go\", \"Next\", or \"Repeat\" anytime to control the game hands-free.",
            "📷  Live Camera Posture: System analyzes your hands, chin, and balance in real-time.",
            "🛡️  Clear a safe practice space and assume your guard with hands near cheeks.",
            "🎯  System corrects your posture and unlocks the next level when form is verified."
        ]
        y = modal_rect.y + 88
        for it in items:
            t = self.font_md.render(it, True, TEXT_SECONDARY)
            surface.blit(t, (modal_rect.x + 40, y))
            y += 36

        btn_ready.text = "I Feel Ready → [Or Say 'Go']"
        btn_ready.rect.center = (self.width // 2, modal_rect.y + 325)
        btn_ready.draw(surface)

    def draw_assessment_modal(self, surface: pygame.Surface, assessment: dict, btn_continue: Button, btn_retry: Button):
        overlay = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        overlay.fill((10, 12, 20, 220))
        surface.blit(overlay, (0, 0))

        modal_rect = pygame.Rect(self.width // 2 - 320, self.height // 2 - 220, 640, 440)
        passed = assessment.get("passed", False)
        border_col = ACCENT_GREEN if passed else ACCENT_AMBER

        pygame.draw.rect(surface, BG_SURFACE, modal_rect, border_radius=16)
        pygame.draw.rect(surface, border_col, modal_rect, width=2, border_radius=16)

        header = "🎉 ROUND PASSED! MOVING TO NEXT LEVEL" if passed else "💡 PRACTICE & REFINE YOUR POSTURE"
        h_color = ACCENT_GREEN if passed else ACCENT_AMBER
        title = self.font_xl.render(header, True, h_color)
        surface.blit(title, (modal_rect.x + 40, modal_rect.y + 30))

        desc = self.font_md.render(assessment.get("title", ""), True, TEXT_PRIMARY)
        surface.blit(desc, (modal_rect.x + 40, modal_rect.y + 68))

        stats = [
            f"• Target Repetitions: {assessment.get('successful_reps', 0)} / {assessment.get('target_reps', 0)}",
            f"• Form Accuracy: {assessment.get('accuracy_pct', 0)}%",
            f"• Guard Returns: {assessment.get('guard_returns', 0)} times returned home",
            f"• Round Score: {assessment.get('score', 0)} points",
            f"• Duration: {assessment.get('duration_sec', 0)} seconds"
        ]
        y = modal_rect.y + 112
        for s in stats:
            t = self.font_md.render(s, True, TEXT_SECONDARY)
            surface.blit(t, (modal_rect.x + 40, y))
            y += 28

        fb_rect = pygame.Rect(modal_rect.x + 40, y + 10, 560, 55)
        pygame.draw.rect(surface, (20, 28, 45), fb_rect, border_radius=8)
        fb_text = self.font_md.render(assessment.get("encouragement", ""), True, TEXT_PRIMARY)
        surface.blit(fb_text, (fb_rect.x + 16, fb_rect.y + 16))

        btn_continue.text = "Next Round → [Say 'Next']" if passed else "Try Again → [Say 'Repeat']"
        btn_continue.rect.center = (modal_rect.x + 440, modal_rect.y + 375)
        btn_retry.rect.center = (modal_rect.x + 200, modal_rect.y + 375)

        btn_retry.draw(surface)
        btn_continue.draw(surface)
