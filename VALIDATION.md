# Validation of the game integration

- Dance bundle builds from the adapted source with esbuild; supplied React runtime used.
- Host JSX and game scripts pass syntax/transformation checks.
- Backend tests: authentication/isolation, workout accounting, score validation, discomfort pause, idempotent finish, sensor validation, native launch ownership, disabled native launch, recovery pause, native score at finish, and stale native pose rejection.
- Python source compiles successfully.
- Headless Chromium checks passed for Boxing and Dance: pages render without JavaScript errors; missing pose cannot score; valid synthetic stance scores 35; pause blocks scoring; host pause/resume works; Dance attaches and reattaches to the host camera without stopping its tracks. Synthetic camera input was used, not a real webcam.

Runtime checks use stubbed vision and an isolated SQLite test database. They do not certify real MediaPipe accuracy or PostgreSQL operation. Native graphical startup and physical camera/microphone behavior require the target computer. The complete original host framework production build has not been rerun in this environment.
