"""DragonDodge (Python/Panda3D port with webcam body-motion controls).

    python main.py                    # default 1280x720, webcam control (cam index 2)
    python main.py --no-camera        # keyboard-only (arrows/space/E)
    python main.py --debug-cam        # shows a webcam window with pose overlay
    python main.py --width 960 --height 540   # lower res for a weaker Pi
    python main.py --quality low              # no shadows/fog, fewer particles

    # Connect to the AI Fitness Platform:
    python main.py --api-url http://localhost:3000 \
                   --api-key game_secure_shared_secret_token_123 \
                   --user-id 1 --athlete-name "Karthikeyan"

    # Or use a fitness_config.json file (auto-detected if present):
    #   {"api_url": "http://localhost:3000",
    #    "api_key": "game_secure_shared_secret_token_123",
    #    "user_id": 1, "athlete_name": "Karthikeyan"}

Controls:
    Move your hips left/right of your calibrated center to dodge - moving
      right moves your character right, moving left moves it left.
    Physically jump to make the player jump.
    E = attack (works mid-jump, i.e. during a real or keyboard jump)
    C = re-calibrate your center position
    ESC = pause / resume
    R = restart after game over / victory
    Arrows/Space also work as a keyboard fallback at any time.
    Start from the main menu; pause any time with ESC for Resume/Restart/Quit.
"""

import argparse
from game.app import DragonDodgeApp


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--width", type=int, default=1280,
                         help="window width (default 1280; try 960 or lower on a Pi 4)")
    parser.add_argument("--height", type=int, default=720,
                         help="window height (default 720)")
    parser.add_argument("--no-camera", action="store_true",
                         help="disable webcam control, use keyboard only")
    parser.add_argument("--debug-cam", action="store_true",
                         help="show a webcam window with the pose skeleton overlay")
    parser.add_argument("--cam-index", type=int, default=2,
                         help="webcam device index (default 2)")
    parser.add_argument("--quality", choices=["high", "low"], default="high",
                         help="'low' turns off shadows/fog and halves particle "
                              "counts - use this on a Raspberry Pi 4 or similar")

    # ---- AI Fitness Platform integration ----
    parser.add_argument("--api-url", default=None,
                         help="AI Fitness Platform base URL (e.g. http://localhost:3000). "
                              "If omitted, the game checks fitness_config.json.")
    parser.add_argument("--api-key", default=None,
                         help="Game API key (must match GAME_API_SECRET in the platform's .env)")
    parser.add_argument("--user-id", type=int, default=None,
                         help="Registered athlete's user_id on the platform")
    parser.add_argument("--athlete-name", default="Athlete",
                         help="Athlete display name (for in-game HUD)")
    parser.add_argument("--fitness-config", default=None,
                         help="Path to a fitness_config.json file (auto-detected if omitted)")
    parser.add_argument("--session-id", type=str, default="",
                         help="AI Fitness session ID")
    parser.add_argument("--return-url", type=str, default="http://localhost:3000/dashboard.html",
                         help="Redirect URL when game ends / user returns to dashboard")
    parser.add_argument("--weight", type=float, default=70.0,
                         help="Athlete weight in kg for energy calculation")
    parser.add_argument("--auto-start", action="store_true", default=False,
                         help="Immediately start the workout run without waiting on menu")
    parser.add_argument("--difficulty", choices=["easy", "medium", "hard"], default="medium",
                         help="Game difficulty setting (default: medium)")
    parser.add_argument("--fitness-state", help="Private shared-camera IPC file from AI Fitness")
    args = parser.parse_args()

    app = DragonDodgeApp(args)
    app.run()


if __name__ == "__main__":
    main()

