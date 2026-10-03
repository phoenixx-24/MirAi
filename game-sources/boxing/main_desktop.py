"""
main_desktop.py - Pygame Desktop Fallback Runner
"""
import sys
import time
import pygame

from config import (
    WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_TITLE, FPS,
    BG_DARK, ACCENT_GREEN, ACCENT_CYAN, TEXT_PRIMARY
)
from core.lesson_manager import LessonManager, LessonStep, LessonPhase
from core.movement_evaluator import MovementEvaluator
from core.session_tracker import SessionTracker
from vision.pose_tracker import PoseTracker
from ui.coach_renderer import CoachRenderer
from ui.hud_renderer import HUDRenderer
from ui.components import Button
from audio.sound_manager import SoundManager
from audio.voice_control import VoiceController

class BoxingTrainerGame:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption(WINDOW_TITLE)
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        self.clock = pygame.time.Clock()
        self.is_running = True

        self.lesson_mgr = LessonManager()
        self.evaluator = MovementEvaluator()
        self.tracker = SessionTracker(user_name="Suthi")
        self.pose_tracker = PoseTracker(camera_index=0, autostart=True)
        self.coach = CoachRenderer(origin_x=860, origin_y=280)
        self.hud = HUDRenderer(WINDOW_WIDTH, WINDOW_HEIGHT)
        self.sound = SoundManager(voice_enabled=True, sfx_enabled=True)
        self.voice_ctrl = VoiceController(command_callback=self._on_voice_command)

        self.btn_modal_ready = Button((0, 0, 280, 52), "I Feel Ready → [Or Say 'Go']", self.hud.font_lg,
                                      bg_color=(0, 150, 120), hover_color=(0, 190, 150), border_color=ACCENT_GREEN)
        self.btn_modal_continue = Button((0, 0, 220, 48), "Next Round → [Say 'Next']", self.hud.font_lg,
                                         bg_color=(0, 140, 180), hover_color=(0, 180, 220), border_color=ACCENT_CYAN)
        self.btn_modal_retry = Button((0, 0, 200, 48), "↺ Try Again [Say 'Repeat']", self.hud.font_lg)

        self.last_eval_time = 0.0
        self.last_voice_correction_time = 0.0
        self.current_assessment = {}
        self.sound.speak("Welcome to Boxing Training! Position your camera and say 'Go' when you're set.")

    def _on_voice_command(self, cmd: str):
        if cmd == "go":
            if self.lesson_mgr.current_phase == LessonPhase.READINESS_CHECK:
                self._start_first_lesson()
            elif self.lesson_mgr.current_phase == LessonPhase.ASSESSMENT:
                self._advance_or_repeat_round()
            elif self.lesson_mgr.current_step == LessonStep.READY:
                self._on_next_pressed()
        elif cmd == "next":
            if self.lesson_mgr.current_phase == LessonPhase.READINESS_CHECK:
                self._start_first_lesson()
            elif self.lesson_mgr.current_phase == LessonPhase.ASSESSMENT:
                self._advance_or_repeat_round()
            else:
                self._on_next_pressed()
        elif cmd == "repeat":
            if self.lesson_mgr.current_phase == LessonPhase.ASSESSMENT:
                self._repeat_current_round()
            else:
                self._on_repeat_pressed()
        elif cmd == "slower":
            if not self.lesson_mgr.is_slower:
                self._on_slower_pressed()
        elif cmd == "normal":
            if self.lesson_mgr.is_slower:
                self._on_slower_pressed()
        elif cmd == "demo":
            self._on_demo_pressed()
        elif cmd == "pause":
            self.lesson_mgr.is_paused = True
        elif cmd == "resume":
            self.lesson_mgr.is_paused = False
        elif cmd == "camera":
            self.pose_tracker.toggle_camera()

    def run(self):
        while self.is_running:
            dt = self.clock.tick(FPS) / 1000.0
            self._handle_events()
            self._update(dt)
            self._render()
        self._shutdown()

    def _handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.is_running = False
                return
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.is_running = False
                elif event.key == pygame.K_SPACE:
                    self._on_next_pressed()
                elif event.key == pygame.K_r:
                    self._on_repeat_pressed()
            if self.btn_modal_ready.handle_event(event):
                self._start_first_lesson()
            if self.hud.btn_next.handle_event(event):
                self._on_next_pressed()

    def _start_first_lesson(self):
        self.lesson_mgr.current_phase = LessonPhase.LESSON
        self.lesson_mgr.current_step = LessonStep.EXPLAIN
        self.evaluator.reset_lesson_stats()
        self.tracker.start_level(0)
        self._sync_level_and_step()
        self.sound.play_sfx("bell")

    def _on_next_pressed(self):
        next_step = self.lesson_mgr.next_step()
        if next_step is None:
            level_data = self.lesson_mgr.get_current_level()
            self.current_assessment = self.tracker.generate_level_assessment(level_data, self.evaluator)
            self.sound.play_sfx("bell")
            if self.current_assessment.get("passed", False):
                self.sound.speak("Right! Round passed! Excellent posture control.")
            else:
                self.sound.speak("Adjust this posture and let's try again.")
        else:
            self._sync_level_and_step()

    def _on_repeat_pressed(self):
        self.lesson_mgr.repeat_step()
        self._sync_level_and_step()

    def _on_slower_pressed(self):
        slower = self.lesson_mgr.toggle_slower()
        level_data = self.lesson_mgr.get_current_level()
        self.coach.set_animation(level_data.get("demo_anim", "guard_stance"), slower=slower)

    def _on_demo_pressed(self):
        self.lesson_mgr.current_step = LessonStep.DEMO
        self._sync_level_and_step()

    def _advance_or_repeat_round(self):
        if self.current_assessment.get("passed", False):
            self.lesson_mgr.unlock_next_level()
            self.evaluator.reset_lesson_stats()
            self.tracker.start_level(self.lesson_mgr.current_level_id)
            self._sync_level_and_step()
            self.sound.play_sfx("bell")
        else:
            self.lesson_mgr.current_phase = LessonPhase.LESSON
            self.lesson_mgr.current_step = LessonStep.EXPLAIN
            self.evaluator.reset_lesson_stats()
            self._sync_level_and_step()

    def _sync_level_and_step(self):
        level_data = self.lesson_mgr.get_current_level()
        anim = level_data.get("demo_anim", "guard_stance")
        self.coach.set_animation(anim, slower=self.lesson_mgr.is_slower)
        step = self.lesson_mgr.current_step
        if step == LessonStep.EXPLAIN:
            self.sound.speak(f"{level_data['title']}. {level_data['explain_text']}")
        elif step == LessonStep.READY:
            self.sound.speak("Assume your guard stance. Hands up near your cheeks.")
        elif step == LessonStep.PRACTISE:
            self.sound.speak(f"Begin practice. {level_data['cue']}")

    def _update(self, dt: float):
        if self.lesson_mgr.is_paused:
            return
        self.coach.update(dt)

    def _render(self):
        self.screen.fill(BG_DARK)
        self.coach.draw(self.screen)
        self.hud.draw_hud(
            self.screen, self.lesson_mgr, self.evaluator,
            self.tracker, self.pose_tracker, self.voice_ctrl, self.sound
        )
        if self.lesson_mgr.current_phase == LessonPhase.READINESS_CHECK:
            self.hud.draw_readiness_modal(self.screen, self.btn_modal_ready)
        elif self.lesson_mgr.current_phase == LessonPhase.ASSESSMENT:
            self.hud.draw_assessment_modal(
                self.screen, self.current_assessment,
                self.btn_modal_continue, self.btn_modal_retry
            )
        pygame.display.flip()

    def _shutdown(self):
        self.pose_tracker.stop_camera()
        self.voice_ctrl.stop()
        self.sound.stop()
        pygame.quit()
        sys.exit(0)

if __name__ == "__main__":
    game = BoxingTrainerGame()
    game.run()
