"""
tests/smoke_test_gui.py - Headless / Mocked Smoke Test verifying Pygame UI rendering loop & Voice STT
"""
import os
import sys
import pygame

os.environ["SDL_VIDEODRIVER"] = "dummy"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import BoxingTrainerGame
from core.lesson_manager import LessonStep

def test_gui_loop():
    print("Initializing BoxingTrainerGame in headless/smoke mode...")
    game = BoxingTrainerGame()
    print("Game initialized successfully.")

    # Test Voice Command "go" from Readiness modal
    game._on_voice_command("go")
    assert game.lesson_mgr.current_step == LessonStep.EXPLAIN
    print("Voice command 'go' successfully started lesson 0.")

    # Run update and render ticks
    for frame in range(10):
        game._update(0.016)
        game._render()

    print("Rendered 10 frames cleanly without error.")

    # Test Voice Command "next" -> advances to DEMO
    game._on_voice_command("next")
    assert game.lesson_mgr.current_step == LessonStep.DEMO
    game._render()
    print("Voice command 'next' advanced to DEMO.")

    # Test Voice Command "next" -> advances to READY
    game._on_voice_command("next")
    assert game.lesson_mgr.current_step == LessonStep.READY
    game._render()

    # Test Voice Command "go" -> advances from READY to PRACTISE
    game._on_voice_command("go")
    assert game.lesson_mgr.current_step == LessonStep.PRACTISE
    game._render()
    print("Voice command 'go' advanced from READY to PRACTISE.")

    # Trigger simulated punch and guard
    game.pose_tracker.trigger_simulated_action("jab")
    game._update(0.016)
    game._render()

    game.pose_tracker.trigger_simulated_action("return_guard")
    game._update(0.016)
    game._render()

    # Toggle side view
    game.coach.toggle_side_view()
    game._render()

    # Test Voice Command "slower"
    game._on_voice_command("slower")
    assert game.lesson_mgr.is_slower is True
    game._render()
    print("Voice command 'slower' activated slower demonstration mode.")

    # Clean shutdown
    game._shutdown = lambda: None
    game.pose_tracker.stop_camera()
    game.voice_ctrl.stop()
    game.sound.stop()
    pygame.quit()
    print("Headless GUI Smoke Test passed 100%!")

if __name__ == "__main__":
    test_gui_loop()
