"""
main.py - Main Entry Point for AI Boxing Trainer
Launches the HD Web-Based Voice & Posture Boxing Trainer (HTML/JS/Python).
"""
import sys
import os

if __name__ == "__main__":
    # If user explicitly specifies --desktop, run pygame fallback
    if "--desktop" in sys.argv:
        print("[Launcher] Starting desktop Pygame fallback...")
        # Import only on demand
        from core.lesson_manager import LessonManager
        import pygame
        # Desktop runner logic
        os.system("python main_desktop.py")
    else:
        # Launch HD Web AI Trainer by default
        from server import run_server
        run_server()
