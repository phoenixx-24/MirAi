"""DragonDodge - Panda3D port with webcam/MediaPipe body-motion controls.

Run via ../main.py. See ../README.md for setup and Raspberry Pi 4 notes.
"""

import sys
import os
import random
import math

from direct.showbase.ShowBase import ShowBase
from direct.gui.OnscreenText import OnscreenText
from direct.gui.DirectGui import DirectFrame, DirectButton, DirectLabel
from direct.task import Task
from direct.interval.IntervalGlobal import Sequence, Func
from direct.interval.LerpInterval import LerpPosInterval
from panda3d.core import (
    loadPrcFileData, AmbientLight, DirectionalLight, Vec3, Vec4,
    TextNode, WindowProperties, Filename, Fog, TransparencyAttrib,
)

# Support running either `python main.py` or `python game/app.py`
if __package__ is None or __package__ == "":
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from game.geometry import (
        make_box, make_cone, make_disc, make_sphere,
        make_volcano, make_sky_dome, make_ridge,
    )
    from game.player import Player
    from game.projectile import Projectile
    from game.dragon import Dragon
    from game.pose_tracker import PoseTracker
    from game.audio import ensure_sfx_cached
    from game.particles import ParticleSystem
    from game.fitness_api import FitnessAPIClient, create_from_config
else:
    from .geometry import (
        make_box, make_cone, make_disc, make_sphere,
        make_volcano, make_sky_dome, make_ridge,
    )
    from .player import Player
    from .projectile import Projectile
    from .dragon import Dragon
    from .pose_tracker import PoseTracker
    from .audio import ensure_sfx_cached
    from .particles import ParticleSystem
    from .fitness_api import FitnessAPIClient, create_from_config

ASSET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

SURVIVAL_DURATION = 60.0
ARENA_HALF_WIDTH = 4.2

(STATE_MENU, STATE_SURVIVAL, STATE_BOSS_INTRO, STATE_BOSS,
 STATE_GAME_OVER, STATE_VICTORY, STATE_PAUSED) = range(7)

# ---------------------------------------------------------------------------
# Difficulty presets. speed_mult/spawn_mult scale the incoming spheres,
# flame_speed_mult scales the boss's fireballs the same way, and
# dragon_health_mult / dragon_dodge_delta make the boss fight itself a
# little tougher or more forgiving to match. "medium" reproduces the
# original tuning; "easy"/"hard" scale evenly around it.
# ---------------------------------------------------------------------------
DEFAULT_DIFFICULTY = "medium"
DIFFICULTY_SETTINGS = {
    "easy": dict(
        label="EASY", speed_mult=0.75, spawn_mult=1.25,
        dragon_health_mult=0.8, dragon_dodge_delta=0.10, flame_speed_mult=0.8,
    ),
    "medium": dict(
        label="MEDIUM", speed_mult=1.0, spawn_mult=1.0,
        dragon_health_mult=1.0, dragon_dodge_delta=0.0, flame_speed_mult=1.0,
    ),
    "hard": dict(
        label="HARD", speed_mult=1.35, spawn_mult=0.8,
        dragon_health_mult=1.25, dragon_dodge_delta=-0.10, flame_speed_mult=1.2,
    ),
}

BUTTON_STYLE = dict(
    frameColor=(0.35, 0.12, 0.08, 0.9),
    frameSize=(-4.4, 4.4, -0.9, 0.9),
    text_fg=(1, 0.92, 0.85, 1),
    text_scale=0.9,
    relief="raised",
    borderWidth=(0.15, 0.15),
    scale=0.09,
)


class AudioManager:
    def __init__(self, loader, sfx_paths):
        self.sounds = {}
        for name, path in sfx_paths.items():
            try:
                fn = Filename.fromOsSpecific(path)
                self.sounds[name] = loader.loadSfx(fn)
            except Exception as e:
                print(f"Could not load sfx '{name}':", e)

    def play(self, name, volume=1.0):
        s = self.sounds.get(name)
        if s:
            s.setVolume(volume)
            s.play()


class DragonDodgeApp(ShowBase):
    def __init__(self, args):
        # ---- Raspberry Pi 4 friendly render settings ----
        loadPrcFileData("", f"win-size {args.width} {args.height}")
        loadPrcFileData("", "framebuffer-multisample 0")
        loadPrcFileData("", "multisamples 0")
        loadPrcFileData("", "sync-video 0")
        loadPrcFileData("", "textures-power-2 none")
        loadPrcFileData("", "model-cache-dir")  # disable model bam-caching to a stray dir

        ShowBase.__init__(self)
        self.args = args
        self.quality = getattr(args, "quality", "high")

        self.disableMouse()
        # Pale sky-blue fallback clear color (matches the sky dome's
        # horizon band) in case the dome doesn't cover some sliver of the
        # view; was a dark maroon for the old night palette.
        self.setBackgroundColor(0.76, 0.84, 0.90)

        props = WindowProperties()
        props.setTitle("Dragon Dodge")
        self.win.requestProperties(props)

        try:
            import gltf
            if hasattr(gltf, "patch_loader"):
                gltf.patch_loader(self.loader)
            elif hasattr(gltf, "patch"):
                gltf.patch(self.loader)
        except Exception as e:
            print("panda3d-gltf loader notice:", e)

        sfx_paths = ensure_sfx_cached(os.path.join(ASSET_DIR, "sfx"))
        self.sfx = AudioManager(self.loader, sfx_paths)
        self.particles = ParticleSystem(self.render, quality=self.quality)

        self.state = STATE_MENU
        self._state_before_pause = None
        self.difficulty = DEFAULT_DIFFICULTY
        self.score = 0
        self.elapsed = 0.0
        self.spawn_timer = 0.0
        self.ember_timer = 0.0
        self.smoke_timer = 0.0
        self.projectiles = []
        self.dragon = None

        # ground/air spawn-mode toggle for the survival phase (see
        # _update_survival) - only one type of sphere spawns at a time,
        # switching every so often.
        self.spawn_mode = "ground"
        self.mode_timer = 0.0

        self.shake_time = 0.0
        self.shake_duration = 0.0
        self.shake_strength = 0.0
        self._bob_phase = 0.0

        # ---- Fitness platform integration ----
        # Workout counters: every physical movement in the game is a rep.
        self.fit_dodges = 0
        self.fit_jumps = 0
        self.fit_attacks = 0
        self.fit_hits_landed = 0
        self._telemetry_timer = 0.0
        self._fitness_finished = False

        # Build the API client from CLI args or fitness_config.json.
        fit_cfg = getattr(args, "fitness_config", None)
        self.fitness_api = create_from_config(fit_cfg)
        if self.fitness_api is None and getattr(args, "api_url", None) \
                and getattr(args, "api_key", None) \
                and getattr(args, "user_id", None):
            self.fitness_api = FitnessAPIClient(
                base_url=args.api_url,
                api_key=args.api_key,
                user_id=args.user_id,
                athlete_name=getattr(args, "athlete_name", "Athlete"),
            )
        if self.fitness_api is not None:
            print("[FitnessAPI] Configured — will connect on game start.")
        else:
            print("[FitnessAPI] Not configured — running standalone (no workout tracking).")

        self._build_lighting()
        self._build_arena()

        self.player = Player(self.render)

        # Camera is decoupled from the player node and eased toward it every
        # frame (see _update_camera) instead of being rigidly parented, so
        # its motion can be smoothed, bobbed and shaken independently of the
        # raw, possibly-jittery input signal.
        self.cam_rig = self.render.attachNewNode("CamRig")
        self.cam_rig.setPos(self.player.node.getPos() + Vec3(0, 0, 0.7))
        self.camera.reparentTo(self.cam_rig)
        self.camera.setPos(0, 0, 0)

        self._build_ui()
        self._build_menu()
        self._build_pause_overlay()
        self._setup_keyboard()

        self.fitness_adapter = None
        if getattr(args, 'fitness_state', None):
            try:
                from game.fitness_adapter import FitnessAdapter
                self.fitness_adapter = FitnessAdapter(args.fitness_state)
            except Exception as e:
                print(f"[DragonDodge] Fitness adapter initialization error: {e}")

        self.pose_tracker = self.fitness_adapter.tracker if self.fitness_adapter else None
        if not args.no_camera and not self.fitness_adapter:
            self.pose_tracker = PoseTracker(cam_index=args.cam_index, debug_window=args.debug_cam)
            started = self.pose_tracker.is_available and self.pose_tracker.start()
            if not started:
                print("Webcam/MediaPipe unavailable - using keyboard controls "
                      "(Left/Right arrows, Space to jump, E to attack).")
                self.pose_tracker = None
            else:
                print("Pose tracking thread started - attempting to open the "
                      "camera (see console for backend/status messages). "
                      "Stand back so your whole body is visible, then move to "
                      "calibrate. Press C any time to re-center. Keyboard "
                      "controls also work at any time as a fallback.")

        self.taskMgr.add(self._game_loop, "game_loop")

        if getattr(args, "auto_start", False) or getattr(args, "session_id", ""):
            diff = getattr(args, "difficulty", "medium") or "medium"
            print(f"[DragonDodge] Auto-starting workout run with difficulty: {diff}")
            self._start_game(diff)

    # ------------------------------------------------------------------
    # setup helpers
    # ------------------------------------------------------------------

    def _build_lighting(self):
        # ---- daylight lighting rig ----
        # Cool sky-bounce ambient (was a dim reddish-purple night ambient).
        amb = AmbientLight("amb")
        amb.setColor(Vec4(0.42, 0.46, 0.53, 1))
        self.render.setLight(self.render.attachNewNode(amb))

        # Primary "sun" DirectionalLight - the actual illumination source.
        # Direction is unchanged from the original rig (only its color got
        # warmer/brighter for daylight) so existing shadow placement on the
        # arena/decor doesn't shift. The visible 3D sun model built in
        # _build_sky_and_sun() reads this same node's facing direction, so
        # the two always stay pointed the same way (see that method).
        sun = DirectionalLight("sun")
        sun.setColor(Vec4(1.05, 0.98, 0.88, 1))
        sun_np = self.render.attachNewNode(sun)
        sun_np.setHpr(30, -55, 0)
        if self.quality == "high":
            sun.setShadowCaster(True, 1024, 1024)
            lens = sun.getLens()
            lens.setFilmSize(34, 34)
            lens.setNearFar(1, 70)
        self.render.setLight(sun_np)
        self.sun_light_np = sun_np

        # Cool sky-fill from the opposite side, softening shadow cores -
        # brightened a bit for daylight (was a dim night-time fill).
        fill = DirectionalLight("fill")
        fill.setColor(Vec4(0.32, 0.38, 0.48, 1))
        fill_np = self.render.attachNewNode(fill)
        fill_np.setHpr(-150, -18, 0)
        self.render.setLight(fill_np)

        # The old rig also had a warm "volcano_rim" light standing in for a
        # lava glow, which read fine at night but would be a second,
        # unexplained light source under clear daylight (see requirement
        # that the visible sun and the lighting stay physically
        # consistent) - dropped rather than re-colored. The crater's own
        # small emissive glow (kept in _build_volcano) covers the "hot
        # rock" accent instead.

        if self.quality == "high":
            self.render.setShaderAuto()
            # Light hazy-blue daytime haze (was a dark reddish night fog),
            # and slightly less dense for clear-day visibility.
            fog = Fog("arena-fog")
            fog.setColor(0.75, 0.81, 0.87)
            fog.setExpDensity(0.010)
            self.render.setFog(fog)

        self._build_sky_and_sun()

    def _build_sky_and_sun(self):
        """Daytime sky dome + a visible 3D sun, positioned so it's on the
        same side of the sky that _build_lighting()'s DirectionalLight
        actually shines from (requirement: sun and shadows must agree).
        """
        zenith_color = (0.25, 0.47, 0.79, 1.0)
        horizon_color = (0.80, 0.87, 0.92, 1.0)

        sky = make_sky_dome(220.0, zenith_color, horizon_color,
                             lat_segments=14, lon_segments=20)
        sky.reparentTo(self.render)
        sky.setLightOff()
        sky.setFogOff()
        sky.setTwoSided(True)
        sky.setDepthWrite(False)
        sky.setBin("background", 0)
        self.sky_dome = sky

        # A couple of cheap, hazy distant-mountain silhouette layers for
        # depth (item: environmental depth / atmospheric perspective).
        # Flat "fins" facing the arena, not full 3D geometry.
        far_ridge = make_ridge(300, -1.0, 10, 26, segments=16, seed=7,
                                color=(0.55, 0.62, 0.72, 1.0))
        far_ridge.reparentTo(self.render)
        far_ridge.setPos(0, 150, 0)
        far_ridge.setLightOff()
        far_ridge.setTwoSided(True)

        near_ridge = make_ridge(220, -1.0, 6, 16, segments=14, seed=11,
                                 color=(0.42, 0.50, 0.55, 1.0))
        near_ridge.reparentTo(self.render)
        near_ridge.setPos(10, 95, 0)
        near_ridge.setLightOff()
        near_ridge.setTwoSided(True)

        # A handful of soft, flattened, unlit spheres for simple clouds -
        # static (no drift animation) to keep this cheap.
        cloud_rng = random.Random(5)
        cloud_positions = [(-40, 130, 46), (25, 150, 58), (60, 110, 40),
                            (-70, 160, 52)]
        for cx, cy, cz in cloud_positions:
            for _ in range(3):
                puff = make_sphere(cloud_rng.uniform(5.0, 9.0),
                                    color=(1.0, 1.0, 1.0, 0.85))
                puff.reparentTo(self.render)
                puff.setPos(cx + cloud_rng.uniform(-6, 6),
                            cy + cloud_rng.uniform(-6, 6),
                            cz + cloud_rng.uniform(-2, 2))
                puff.setScale(1.0, 1.0, 0.55)
                puff.setColor(1.0, 1.0, 1.0, 0.85)
                puff.setTransparency(TransparencyAttrib.MAlpha)
                puff.setLightOff()
                puff.setFogOff()

        # ---- visible 3D sun, placed opposite the DirectionalLight's own
        # facing direction so it visually matches where the light (and
        # therefore the shadows) are actually coming from. ----
        light_dir = self.render.getRelativeVector(self.sun_light_np, Vec3(0, 1, 0))
        if light_dir.length() < 1e-6:
            light_dir = Vec3(0.4, 0.6, -0.6)
        light_dir.normalize()
        sun_distance = 170.0
        sun_pos = light_dir * -sun_distance

        sun_visual = None
        sun_model_path = os.path.join(ASSET_DIR, "models", "sun.glb")
        try:
            fn = Filename.fromOsSpecific(sun_model_path)
            model = self.loader.loadModel(fn)
            if model and not model.isEmpty():
                sun_visual = model
        except Exception as e:
            print("Could not load sun model, using placeholder sphere:", e)
            sun_visual = None

        holder = self.render.attachNewNode("Sun")
        holder.setPos(sun_pos)
        if sun_visual is not None:
            sun_visual.reparentTo(holder)
            # The source asset is a ~1-unit sphere with its own baked-in
            # node scale; this extra scale just tunes on-screen size.
            sun_visual.setScale(4.5)
        else:
            placeholder = make_sphere(18.0, color=(1.0, 0.92, 0.7, 1))
            placeholder.reparentTo(holder)
            placeholder.setColor(1.0, 0.92, 0.7, 1)
        holder.setLightOff()   # the sun is a light source, not a lit object
        holder.setFogOff()     # stays bright regardless of ground haze
        self.sun_visual = holder

    def _build_arena(self):
        floor = make_box(ARENA_HALF_WIDTH * 2 + 2, 44, 0.5, (0.16, 0.11, 0.1, 1))
        floor.reparentTo(self.render)
        floor.setPos(0, 18, -0.25)

        # A couple of subtly-tinted floor bands add depth cues without
        # needing any texture assets.
        band_colors = [(0.19, 0.12, 0.10, 1), (0.13, 0.09, 0.08, 1)]
        for i in range(4):
            band = make_box(ARENA_HALF_WIDTH * 2 + 2, 6, 0.02, band_colors[i % 2])
            band.reparentTo(self.render)
            band.setPos(0, 4 + i * 9, 0.01)

        for i in range(6):
            side = -1 if i % 2 == 0 else 1
            rock = make_box(1.0, 1.0, 0.3, (0.8, 0.2, 0.02, 1))
            rock.reparentTo(self.render)
            rock.setPos(side * (ARENA_HALF_WIDTH + 1.0), 4.0 * i, 0.0)
            rock.setColor(1.0, 0.3, 0.05, 1)

        self._build_volcano()
        self._build_side_decor()

    def _build_side_decor(self):
        """Purely decorative dressing down both sides of the arena - crystal
        spires and torch-lit pillars - so the run has more to look at while
        dodging. Nothing here is collidable, so it never touches gameplay.
        """
        for i in range(10):
            y = 3.0 + i * 5.5
            for side in (-1, 1):
                x = side * (ARENA_HALF_WIDTH + 2.0 + (i % 3) * 0.5)
                if i % 2 == 0:
                    height = 1.6 + (i % 3) * 0.4
                    spire = make_cone(0.35, 0.05, height,
                                       color=(0.22, 0.08, 0.32, 1), segments=8)
                    spire.reparentTo(self.render)
                    spire.setPos(x, y, 0.0)
                    spire.setColor(0.22, 0.08, 0.32, 1)

                    glow = make_sphere(0.14, color=(0.55, 0.35, 0.95, 1))
                    glow.reparentTo(self.render)
                    glow.setPos(x, y, height)
                    glow.setLightOff()
                    glow.setColorOff()
                    glow.setColor(0.55, 0.35, 0.95, 1)
                else:
                    pillar = make_box(0.4, 0.4, 1.8, color=(0.18, 0.13, 0.11, 1))
                    pillar.reparentTo(self.render)
                    pillar.setPos(x, y, 0.9)
                    pillar.setColor(0.18, 0.13, 0.11, 1)

                    torch = make_sphere(0.12, color=(1.0, 0.55, 0.1, 1))
                    torch.reparentTo(self.render)
                    torch.setPos(x, y, 1.95)
                    torch.setLightOff()
                    torch.setColorOff()
                    torch.setColor(1.0, 0.55, 0.1, 1)

    def _build_volcano(self):
        """A volcano off to the side of the arena, rather than dead ahead
        blocking the view of the boss. Same side/position/scale as
        before; only the look of the mountain itself changed (a single
        smooth cone -> an irregular, ridged volcanic peak), plus a couple
        of smaller background peaks for a natural range instead of one
        isolated cone.
        """
        self.volcano_root = self.render.attachNewNode("Volcano")
        side = 1  # to the player's right; flip to -1 for the other side
        vx = side * (ARENA_HALF_WIDTH + 16.0)
        vy = 26.0
        self.volcano_root.setPos(vx, vy, -0.25)

        main_height = 15.0
        main_crater_r = 1.6
        main = make_volcano(6.5, main_height, main_crater_r,
                             segments=22, rings=7, jitter=0.24, seed=101)
        main.reparentTo(self.volcano_root)

        # A warm, subtle emissive glow inside the crater mouth (visual
        # only - no light is cast, no damage/hazard - purely the "small
        # internal emissive glow" atmospheric touch).
        crater_glow = make_disc(main_crater_r * 0.6,
                                 color=(0.95, 0.35, 0.05, 1), segments=14)
        crater_glow.reparentTo(self.volcano_root)
        crater_glow.setZ(main_height - main_crater_r * 0.75)
        crater_glow.setColorOff()
        crater_glow.setColor(0.95, 0.35, 0.05, 1)
        crater_glow.setLightOff()

        # A couple of smaller, differently-shaped companion peaks nearby,
        # for a natural-looking volcanic range instead of one repeated
        # cone (varied height/width/rotation/distance/seed so none of
        # them match each other or the main peak).
        companions = [
            dict(base=3.6, height=8.5, crater=0.7, seed=202,
                 offset=Vec3(-7.5, 4.0, 0), h=18),
            dict(base=2.6, height=6.0, crater=0.5, seed=303,
                 offset=Vec3(6.0, 7.5, 0), h=-24),
        ]
        for c in companions:
            peak = make_volcano(c["base"], c["height"], c["crater"],
                                 segments=16, rings=5, jitter=0.26,
                                 seed=c["seed"])
            peak.reparentTo(self.volcano_root)
            peak.setPos(c["offset"])
            peak.setH(c["h"])

        # The ambient ember emitter (see _spawn_ambient_embers) still
        # spawns from this point at the main crater's mouth.
        self._crater_pos = self.volcano_root.getPos() + Vec3(0, 0, main_height)

    def _build_ui(self):
        self.score_text = OnscreenText(text="SCORE: 0", pos=(-1.28, 0.9), scale=0.06,
                                        align=TextNode.ALeft, fg=(1, 1, 1, 1), mayChange=True)
        self.time_text = OnscreenText(text="TIME: 00:00", pos=(-1.28, 0.82), scale=0.06,
                                       align=TextNode.ALeft, fg=(1, 1, 1, 1), mayChange=True)
        self.status_text = OnscreenText(text="SURVIVAL", pos=(-1.28, 0.74), scale=0.05,
                                         align=TextNode.ALeft, fg=(1, 0.8, 0.6, 1), mayChange=True)
        self.difficulty_text = OnscreenText(text="", pos=(-1.28, 0.67), scale=0.042,
                                             align=TextNode.ALeft, fg=(0.8, 0.8, 0.85, 0.85),
                                             mayChange=True)
        self.cam_status_text = OnscreenText(text="", pos=(1.28, 0.82), scale=0.042,
                                             align=TextNode.ARight, fg=(0.8, 1.0, 0.8, 0.9),
                                             mayChange=True)
        self.fit_status_text = OnscreenText(text="", pos=(1.28, 0.74), scale=0.038,
                                             align=TextNode.ARight, fg=(0.7, 0.85, 1.0, 0.85),
                                             mayChange=True)
        self.center_text = OnscreenText(text="", pos=(0, 0.1), scale=0.09,
                                         align=TextNode.ACenter, fg=(1, 1, 1, 1), mayChange=True)
        self.center_text.hide()

        self.hud_nodes = [self.score_text, self.time_text, self.status_text,
                           self.difficulty_text, self.cam_status_text, self.fit_status_text]
        for n in self.hud_nodes:
            n.hide()

        self.health_bg = DirectFrame(frameColor=(0.2, 0.05, 0.05, 0.9),
                                      frameSize=(-0.5, 0.5, -0.03, 0.03), pos=(0, 0, 0.85))
        self.health_bg.hide()
        self.health_fg = DirectFrame(frameColor=(0.9, 0.15, 0.1, 1),
                                      frameSize=(-0.5, 0.5, -0.03, 0.03), pos=(0, 0, 0),
                                      parent=self.health_bg)

        self.pause_hint = OnscreenText(text="ESC - pause", pos=(1.28, 0.9), scale=0.045,
                                        align=TextNode.ARight, fg=(1, 1, 1, 0.6), mayChange=False)
        self.pause_hint.hide()

        self.mode_warning_text = OnscreenText(text="", pos=(0, 0.6), scale=0.07,
                                               align=TextNode.ACenter, fg=(0.4, 0.7, 1.0, 1),
                                               mayChange=True)
        self.mode_warning_text.hide()

    def _build_menu(self):
        click = self.sfx.sounds.get("ui_select")
        hover = self.sfx.sounds.get("ui_move")

        self.menu_frame = DirectFrame(frameColor=(0.05, 0.015, 0.03, 0.92),
                                       frameSize=(-1.8, 1.8, -1.35, 1.1), pos=(0, 0, 0))
        DirectLabel(text="DRAGON DODGE", parent=self.menu_frame, scale=0.14,
                    pos=(0, 0, 0.62), text_fg=(1.0, 0.55, 0.15, 1),
                    relief=None)
        DirectLabel(text="dodge, jump and punch your way past the dragon",
                    parent=self.menu_frame, scale=0.05, pos=(0, 0, 0.44),
                    text_fg=(1, 1, 1, 0.75), relief=None)
        DirectLabel(text="choose your difficulty", parent=self.menu_frame, scale=0.045,
                    pos=(0, 0, 0.26), text_fg=(1, 1, 1, 0.6), relief=None)

        DirectButton(text="EASY", parent=self.menu_frame, command=self._start_game,
                     extraArgs=["easy"], pos=(0, 0, 0.04),
                     clickSound=click, rolloverSound=hover, **BUTTON_STYLE)
        DirectButton(text="MEDIUM", parent=self.menu_frame, command=self._start_game,
                     extraArgs=["medium"], pos=(0, 0, -0.20),
                     clickSound=click, rolloverSound=hover, **BUTTON_STYLE)
        DirectButton(text="HARD", parent=self.menu_frame, command=self._start_game,
                     extraArgs=["hard"], pos=(0, 0, -0.44),
                     clickSound=click, rolloverSound=hover, **BUTTON_STYLE)
        DirectButton(text="QUIT", parent=self.menu_frame, command=self.userExit,
                     pos=(0, 0, -0.68), clickSound=click, rolloverSound=hover, **BUTTON_STYLE)

    def _build_pause_overlay(self):
        click = self.sfx.sounds.get("ui_select")
        hover = self.sfx.sounds.get("ui_move")

        self.pause_frame = DirectFrame(frameColor=(0.05, 0.015, 0.03, 0.85),
                                        frameSize=(-1.4, 1.4, -0.9, 0.9), pos=(0, 0, 0))
        DirectLabel(text="PAUSED", parent=self.pause_frame, scale=0.12,
                    pos=(0, 0, 0.42), text_fg=(1, 1, 1, 1), relief=None)
        DirectButton(text="RESUME", parent=self.pause_frame, command=self._toggle_pause,
                     pos=(0, 0, 0.12), clickSound=click, rolloverSound=hover, **BUTTON_STYLE)
        DirectButton(text="RESTART", parent=self.pause_frame, command=self._restart_from_pause,
                     pos=(0, 0, -0.12), clickSound=click, rolloverSound=hover, **BUTTON_STYLE)
        DirectButton(text="QUIT", parent=self.pause_frame, command=self.userExit,
                     pos=(0, 0, -0.36), clickSound=click, rolloverSound=hover, **BUTTON_STYLE)
        self.pause_frame.hide()

    def _setup_keyboard(self):
        self.keys = {"left": False, "right": False, "jump": False, "crouch": False,
                     "restart": False, "recalibrate": False}
        bindings = [("arrow_left", "left"), ("arrow_right", "right"), ("space", "jump"),
                    ("arrow_down", "crouch"), ("s", "crouch"),
                    ("r", "restart"), ("c", "recalibrate")]
        for key, name in bindings:
            self.accept(key, self._set_key, [name, True])
            self.accept(key + "-up", self._set_key, [name, False])

        # Attack is edge-triggered (fires once per press) rather than a held
        # boolean, so holding E in mid-air can't spam multiple hits/effects
        # in a single jump.
        self._attack_pulse = False
        self.accept("e", self._on_attack_press)
        self.accept("escape", self._toggle_pause)

    def _set_key(self, name, val):
        self.keys[name] = val

    def _on_attack_press(self):
        self._attack_pulse = True

    def _consume_attack(self):
        p = self._attack_pulse
        self._attack_pulse = False
        return p

    # ------------------------------------------------------------------
    # menu / pause
    # ------------------------------------------------------------------

    def _start_game(self, difficulty=None):
        if difficulty in DIFFICULTY_SETTINGS:
            self.difficulty = difficulty
        self.menu_frame.hide()
        for n in self.hud_nodes:
            n.show()
        self.pause_hint.show()
        self._reset_game()
        self.state = STATE_SURVIVAL

        # ---- Connect to the fitness platform ----
        self._fitness_finished = False
        if self.fitness_api is not None:
            ok = self.fitness_api.start_session(
                difficulty=self.difficulty, target_reps=0)
            if ok and self.fitness_api.safety_warnings:
                # Show the first safety warning briefly on screen.
                warning = self.fitness_api.safety_warnings[0]
                self._flash_mode_warning(f"SAFETY: {warning[:40]}", (1.0, 0.85, 0.3, 1))

    def _toggle_pause(self):
        if self.state == STATE_PAUSED:
            self.state = self._state_before_pause or STATE_SURVIVAL
            self.pause_frame.hide()
        elif self.state in (STATE_SURVIVAL, STATE_BOSS_INTRO, STATE_BOSS):
            self._state_before_pause = self.state
            self.state = STATE_PAUSED
            self.pause_frame.show()
            self.sfx.play("pause")

    def _restart_from_pause(self):
        self.pause_frame.hide()
        self._reset_game()
        self.state = STATE_SURVIVAL

    # ------------------------------------------------------------------
    # main loop
    # ------------------------------------------------------------------

    def _game_loop(self, task):
        if hasattr(self, "fitness_adapter") and self.fitness_adapter and self.fitness_adapter.poll(self):
            return Task.cont

        dt = min(globalClock.getDt(), 0.05)  # clamp spikes (e.g. a busy Pi 4 moment)

        # particles keep decaying no matter what state we're in
        self.particles.update(dt)
        self._spawn_ambient_embers(dt)

        if self.state == STATE_MENU:
            self.cam_rig.setH(math.sin(self.elapsed * 0.12) * 6.0)
            self.elapsed += dt
            return Task.cont

        if self.state == STATE_PAUSED or (hasattr(self, "fitness_adapter") and self.fitness_adapter and self.fitness_adapter.host_paused):
            return Task.cont

        if self.state in (STATE_GAME_OVER, STATE_VICTORY):
            if self.keys["restart"]:
                self._reset_game()
                self.state = STATE_SURVIVAL
            return Task.cont

        self.elapsed += dt
        self._update_ui()

        if self.keys["recalibrate"] and self.pose_tracker:
            self.pose_tracker.recalibrate()

        lateral_active = self.pose_tracker is not None and self.pose_tracker.is_connected
        self._update_cam_status(lateral_active)
        if lateral_active:
            lateral_signal = self.pose_tracker.get_lateral()
            jump_pressed = self.pose_tracker.consume_jump() or self.keys["jump"]
            punch_pulse = self.pose_tracker.consume_punch()
            crouch_signal = self.pose_tracker.is_crouching() or self.keys["crouch"]
        else:
            lateral_signal = (1.0 if self.keys["right"] else 0.0) - (1.0 if self.keys["left"] else 0.0)
            jump_pressed = self.keys["jump"]
            punch_pulse = False
            crouch_signal = self.keys["crouch"]

        attack_edge = self._consume_attack()
        # Track fitness movements (jumps, attacks) for workout telemetry.
        if jump_pressed:
            self.fit_jumps += 1
        if attack_edge or punch_pulse:
            self.fit_attacks += 1
        attack_triggered = self.player.update(
            dt, lateral_signal, lateral_active, jump_pressed, attack_edge, crouch_signal, self.sfx)

        if self.player.just_landed and self.player.on_floor:
            self.particles.spawn_dust(self.player.node.getPos())

        dragon_ready = (self.state == STATE_BOSS and self.dragon
                         and self.dragon.node and not self.dragon.node.isEmpty())
        if dragon_ready and attack_triggered:
            self._resolve_punch(ray=False)
        if dragon_ready and punch_pulse:
            self._resolve_punch(ray=True)

        if self.state == STATE_SURVIVAL:
            self._update_survival(dt)
        elif self.state == STATE_BOSS and self.dragon:
            self.dragon.update(dt, self.player.node)
            ratio = self.dragon.health_ratio()
            self.health_fg["frameSize"] = (-0.5, -0.5 + ratio, -0.03, 0.03)

        self._update_projectiles(dt)
        self._update_camera(dt)

        # ---- Fitness telemetry streaming ----
        self._telemetry_timer += dt
        if self._telemetry_timer >= 5.0 and self.fitness_api is not None \
                and self.fitness_api.session_id:
            self._telemetry_timer = 0.0
            total_reps = self.fit_dodges + self.fit_jumps + self.fit_attacks
            speed = total_reps / max(1.0, self.elapsed / 60.0) if self.elapsed > 0 else 0.0
            self.fitness_api.send_telemetry(
                reps=total_reps,
                duration=self.elapsed,
                speed=round(speed, 1),
                consistency=round(min(100.0, total_reps * 2.5), 1) if total_reps else 0.0,
                accuracy=round(min(100.0, 40.0 + self.score * 0.1), 1) if self.score else 0.0,
                calories=0,  # final calories computed on finish
            )
        self._update_fit_status()

        return Task.cont

    # ------------------------------------------------------------------
    # camera
    # ------------------------------------------------------------------

    def _update_camera(self, dt):
        # Lower the first-person view while ducking, so squatting to dodge
        # a head-height sphere actually reads as lowering your head.
        base = self.player.node.getPos() + Vec3(0, 0, 0.7 - self.player.duck_amount)

        moving = abs(getattr(self.player, "vx", 0.0)) > 0.4 and self.player.on_floor
        self._bob_phase += dt * (9.0 if moving else 2.0)
        bob = math.sin(self._bob_phase) * (0.018 if moving else 0.006)

        target = base + Vec3(0, 0, bob)
        current = self.cam_rig.getPos()
        smoothed = current + (target - current) * min(1.0, dt * 9.0)

        if self.shake_time > 0.0:
            self.shake_time -= dt
            falloff = max(0.0, self.shake_time / self.shake_duration) if self.shake_duration > 0 else 0.0
            s = self.shake_strength * falloff
            smoothed += Vec3(random.uniform(-s, s), random.uniform(-s, s) * 0.4, random.uniform(-s, s))

        self.cam_rig.setPos(smoothed)

    def _trigger_screen_shake(self, strength, duration):
        self.shake_strength = strength
        self.shake_duration = duration
        self.shake_time = duration

    # ------------------------------------------------------------------
    # ambient particles
    # ------------------------------------------------------------------

    def _spawn_ambient_embers(self, dt):
        self.ember_timer -= dt
        if self.ember_timer <= 0.0:
            self.ember_timer = random.uniform(0.12, 0.3)
            pos = self._crater_pos + Vec3(random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6), 0)
            self.particles.spawn_embers(pos)

        # Optional subtle daytime touch (see requirement: thin smoke, no
        # gameplay effect) - much rarer than the embers above, purely
        # visual, cheap.
        self.smoke_timer -= dt
        if self.smoke_timer <= 0.0:
            self.smoke_timer = random.uniform(1.4, 2.6)
            pos = self._crater_pos + Vec3(random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), 0.3)
            self.particles.spawn_smoke(pos)

    # ------------------------------------------------------------------
    # survival phase
    # ------------------------------------------------------------------

    def _update_survival(self, dt):
        if self.elapsed >= SURVIVAL_DURATION:
            self._start_boss_transition()
            return

        self.mode_timer -= dt
        if self.mode_timer <= 0.0:
            self._toggle_spawn_mode()

        self.spawn_timer -= dt
        if self.spawn_timer <= 0:
            self._spawn_projectile()
            self.spawn_timer = self._current_spawn_interval()

    def _toggle_spawn_mode(self):
        """Switch between a ground-sphere phase (dodge by jumping/side-
        stepping) and a head-height air-sphere phase (dodge by ducking/
        side-stepping) - only one type is ever spawning at a time, and each
        phase lasts a while before the other one takes over."""
        if self.spawn_mode == "ground":
            self.spawn_mode = "air"
            self._flash_mode_warning("DUCK! SPHERES FROM ABOVE", (0.4, 0.7, 1.0, 1))
            if hasattr(self, "fitness_adapter") and self.fitness_adapter:
                self.fitness_adapter.speak("Duck! Spheres from above!")
        else:
            self.spawn_mode = "ground"
            self._flash_mode_warning("WATCH YOUR STEP", (1.0, 0.65, 0.3, 1))
            if hasattr(self, "fitness_adapter") and self.fitness_adapter:
                self.fitness_adapter.speak("Watch your step! Ground hazard incoming!")
        self.mode_timer = random.uniform(7.0, 11.0)

    def _flash_mode_warning(self, text, color):
        self.mode_warning_text.setText(text)
        self.mode_warning_text.setFg(color)
        self.mode_warning_text.show()
        self.taskMgr.remove("mode-warning-hide")
        self.taskMgr.doMethodLater(1.4, self._hide_mode_warning, "mode-warning-hide")

    def _hide_mode_warning(self, task):
        self.mode_warning_text.hide()
        return Task.done

    def _current_spawn_interval(self):
        # SURVIVAL_DURATION is 60s, so this ramps smoothly across the
        # whole survival phase (the old fixed brackets past 60s were dead
        # code, since survival always hands off to the boss at 60s) and is
        # scaled by the chosen difficulty - a bigger interval means more
        # breathing room between spheres.
        progress = min(1.0, self.elapsed / SURVIVAL_DURATION)
        lo = 1.9 - progress * 0.5   # 1.9s -> 1.4s
        hi = 2.4 - progress * 0.6   # 2.4s -> 1.8s
        mult = DIFFICULTY_SETTINGS[self.difficulty]["spawn_mult"]
        return random.uniform(lo, hi) * mult

    def _current_speed(self):
        # Reduced from the original 8-17 range so a dodge always has real
        # reaction time, with a gentle ramp across the survival phase
        # instead of jumping straight to a fixed speed. Difficulty then
        # scales this up/down around the "medium" baseline.
        progress = min(1.0, self.elapsed / SURVIVAL_DURATION)
        base = 5.5 + progress * 2.5   # 5.5 -> 8.0 across the 60s survival phase
        mult = DIFFICULTY_SETTINGS[self.difficulty]["speed_mult"]
        return base * mult

    def _spawn_projectile(self):
        if self.spawn_mode == "air":
            self._spawn_air_projectile()
        else:
            self._spawn_ground_projectile()

    def _spawn_ground_projectile(self):
        x = random.uniform(-ARENA_HALF_WIDTH + 0.6, ARENA_HALF_WIDTH - 0.6)
        pos = Vec3(x, 32.0, 1.1)
        vel = Vec3(0, -self._current_speed(), 0)
        # jump-dodgeable, in addition to side-stepping out of its lane;
        # target_x_fn lets it continuously steer toward the player's
        # latest position instead of only aiming once at spawn (see
        # Projectile._steer_toward_target).
        proj = Projectile(self.render, pos, vel, (1.0, 0.5, 0.1, 1), is_low=True,
                           target_x_fn=lambda: self.player.node.getX())
        self.projectiles.append(proj)

    def _spawn_air_projectile(self):
        x = random.uniform(-ARENA_HALF_WIDTH + 0.6, ARENA_HALF_WIDTH - 0.6)
        pos = Vec3(x, 32.0, 1.75)  # head height
        vel = Vec3(0, -self._current_speed(), 0)
        # duck-dodgeable (jumping doesn't help against a head-height sphere),
        # in addition to side-stepping out of its lane
        proj = Projectile(self.render, pos, vel, (0.3, 0.6, 1.0, 1),
                           radius=0.38, is_high=True,
                           target_x_fn=lambda: self.player.node.getX())
        self.projectiles.append(proj)

    # ------------------------------------------------------------------
    # punches / boss combat
    # ------------------------------------------------------------------

    def _resolve_punch(self, ray=False):
        """Resolve one punch against the dragon. `ray` just picks which
        visual effect plays (the yellow thrown bolt for the jump-attack, a
        blue instant ray for a mediapipe-detected punch) - the hit/dodge/
        combo resolution in Dragon.receive_attack is identical either way,
        so the combo mechanic is unchanged regardless of input source.
        """
        dragon_pos = self.dragon.node.getPos()
        if ray:
            self._spawn_punch_ray(dragon_pos)
        else:
            self._spawn_punch_effect(dragon_pos)

        dx = abs(dragon_pos.getX() - self.player.node.getX())
        if dx < 3.5:
            hit = self.dragon.receive_attack()
            if hit:
                self.fit_hits_landed += 1
            else:
                self.particles.spawn_dust(dragon_pos + Vec3(0, 0, 1.2),
                                           color=(0.85, 0.85, 0.9, 0.7), count=5)

    def _spawn_punch_ray(self, target_pos):
        """A near-instant blue energy ray, fired the moment a real-world
        punch is detected by the pose tracker - visually distinct from the
        thrown yellow jump-attack bolt below."""
        start_pos = self.player.node.getPos() + Vec3(0, 0.6, 1.0)
        end_pos = target_pos + Vec3(0, 0, 1.2)

        beam = make_box(0.08, 1.0, 0.08, (0.25, 0.55, 1.0, 1))
        beam.reparentTo(self.render)
        beam.setColor(0.25, 0.55, 1.0, 1)
        beam.setTransparency(TransparencyAttrib.MAlpha)

        mid = (start_pos + end_pos) * 0.5
        length = (end_pos - start_pos).length()
        beam.setPos(mid)
        beam.setScale(1.0, max(0.05, length), 1.0)
        beam.lookAt(end_pos)

        self.particles.spawn_burst(end_pos, color=(0.35, 0.65, 1.0, 1),
                                    count=10, speed=3.2, life=0.25, size=0.08)
        self.sfx.play("punch_land", volume=0.7)

        def _fade(task):
            if beam.isEmpty():
                return Task.done
            t = task.time / 0.16
            if t >= 1.0:
                beam.removeNode()
                return Task.done
            beam.setColorScale(1.0, 1.0, 1.0, max(0.0, 1.0 - t))
            return Task.cont

        self.taskMgr.add(_fade, "punch-ray-fade")

    def _spawn_punch_effect(self, target_pos):
        start_pos = self.player.node.getPos() + Vec3(0, 0.6, 1.0)
        end_pos = target_pos + Vec3(0, 0, 1.2)

        bolt = make_box(0.16, 0.55, 0.16, (1.0, 0.85, 0.3, 1))
        bolt.reparentTo(self.render)
        bolt.setPos(start_pos)
        bolt.setColor(1.0, 0.85, 0.3, 1)
        bolt.setTransparency(TransparencyAttrib.MAlpha)
        bolt.lookAt(end_pos)

        def _impact():
            if not bolt.isEmpty():
                bolt.removeNode()
            self.particles.spawn_burst(end_pos, color=(1.0, 0.75, 0.25, 1),
                                        count=8, speed=3.0, life=0.25, size=0.08)
            self.sfx.play("punch_land", volume=0.6)

        Sequence(
            LerpPosInterval(bolt, 0.12, end_pos, startPos=start_pos),
            Func(_impact),
        ).start()

    def _on_dragon_hit_effect(self, pos, streak_level):
        color = (1.0, 0.65 - min(streak_level, 3) * 0.1, 0.15, 1)
        self.particles.spawn_burst(pos + Vec3(0, 0, 1.2), color=color, count=14 + streak_level * 3,
                                    speed=4.0, life=0.4, size=0.1)
        self._trigger_screen_shake(0.08 + streak_level * 0.02, 0.15)

    # ------------------------------------------------------------------
    # projectile / hit resolution
    # ------------------------------------------------------------------

    def _update_projectiles(self, dt):
        still_alive = []
        for proj in self.projectiles:
            if not proj.is_alive():
                continue

            result = proj.update(dt)

            if result == "dodged":
                self.score += 10
                self.fit_dodges += 1
                self.sfx.play("dodge")
                self.particles.spawn_burst(proj.node.getPos(), color=(1.0, 1.0, 0.6, 1),
                                            count=4, speed=1.5, life=0.2, size=0.05)
                proj.destroy()
                continue

            if not proj.is_alive():
                continue

            to_player = proj.node.getPos() - self.player.node.getPos()
            if to_player.length() < (proj.radius + self.player.radius):
                if proj.clears_via_jump(self.player.height_above_ground()):
                    pass  # cleanly jumped over it
                elif proj.clears_via_duck(self.player.duck_amount):
                    pass  # cleanly ducked under it
                else:
                    hit_pos = proj.node.getPos()
                    proj.destroy()
                    self.sfx.play("hit_player")
                    self.sfx.play("explosion", volume=0.75)
                    self.particles.spawn_burst(hit_pos + Vec3(0, 0, 0.8), color=(1.0, 0.5, 0.1, 1),
                                                count=20, speed=5.0, life=0.6, size=0.14)
                    self._trigger_screen_shake(0.3, 0.4)
                    if self.state != STATE_GAME_OVER:
                        self._trigger_game_over()
                    return

            if not proj.is_alive():
                continue

            if proj.node.getY() < -8.0:
                proj.destroy()
                continue

            still_alive.append(proj)
        self.projectiles = still_alive

    def _trigger_game_over(self):
        self.state = STATE_GAME_OVER
        for p in self.projectiles:
            p.destroy()
        self.projectiles = []
        self.mode_warning_text.hide()
        self.taskMgr.remove("mode-warning-hide")
        minutes, seconds = int(self.elapsed) // 60, int(self.elapsed) % 60
        if hasattr(self, "fitness_adapter") and self.fitness_adapter:
            self.fitness_adapter.speak("Game over! Great effort dodging fireballs today.")
        self.center_text.setText(
            f"GAME OVER\n\nSCORE: {self.score}\nTIME: {minutes:02d}:{seconds:02d}\n\nPRESS R TO RESTART")
        self.center_text.show()
        self._finish_fitness_session(victory=False)

    # ------------------------------------------------------------------
    # boss transition / fight
    # ------------------------------------------------------------------

    def _start_boss_transition(self):
        self.state = STATE_BOSS_INTRO
        for p in self.projectiles:
            p.destroy()
        self.projectiles = []
        self.mode_warning_text.hide()
        self.taskMgr.remove("mode-warning-hide")
        self.status_text.setText("BOSS INCOMING")
        self.center_text.setText("BOSS INCOMING")
        self.center_text.show()
        self.sfx.play("boss_incoming")
        if hasattr(self, "fitness_adapter") and self.fitness_adapter:
            self.fitness_adapter.speak("Boss dragon incoming! Prepare to fight!")
        self.taskMgr.doMethodLater(2.0, self._spawn_dragon_task, "spawn-dragon")

    def _spawn_dragon_task(self, task):
        self.center_text.hide()
        self._spawn_dragon()
        return Task.done

    def _spawn_dragon(self):
        model_path = os.path.join(ASSET_DIR, "models", "dragon.glb")
        settings = DIFFICULTY_SETTINGS[self.difficulty]
        self.dragon = Dragon(self.render, self.loader, model_path,
                              spawn_flame_cb=self._spawn_dragon_flame,
                              on_death_cb=self._on_dragon_died,
                              sfx=self.sfx,
                              hit_effect_cb=self._on_dragon_hit_effect,
                              dodge_chance_delta=settings["dragon_dodge_delta"])
        self.dragon.max_health *= settings["dragon_health_mult"]
        self.dragon.health = self.dragon.max_health
        self.dragon.set_position(0, 28, 18)
        self._dragon_fall_start = 18.0
        self._dragon_fall_t = 0.0
        self.taskMgr.add(self._dragon_fall_task, "dragon-fall")

    def _dragon_fall_task(self, task):
        if not self.dragon or not self.dragon.node or self.dragon.node.isEmpty():
            return Task.done
        self._dragon_fall_t += globalClock.getDt()
        duration = 1.0
        t = min(1.0, self._dragon_fall_t / duration)
        eased = 1 - (1 - t) * (1 - t)  # ease-out
        z = self._dragon_fall_start + (1.5 - self._dragon_fall_start) * eased
        self.dragon.node.setZ(z)
        if t >= 1.0:
            self.state = STATE_BOSS
            self.health_bg.show()
            self.particles.spawn_burst(self.dragon.node.getPos(), color=(0.6, 0.5, 0.4, 1),
                                        count=16, speed=3.0, life=0.5, size=0.12, upward_bias=0.4)
            self._trigger_screen_shake(0.25, 0.3)
            return Task.done
        return Task.cont

    def _spawn_dragon_flame(self, dragon_pos):
        origin = Vec3(dragon_pos.getX(), dragon_pos.getY() - 2.0, 1.1)
        target_x = self.player.node.getX()
        dx = target_x - origin.getX()
        dy = 0.0 - origin.getY()
        dist = math.hypot(dx, dy)
        if dist < 0.01:
            dist = 0.01

        speed = 7.0
        if self.dragon.health <= 28:
            speed = 10.0
        elif self.dragon.health <= 56:
            speed = 8.5
        speed *= DIFFICULTY_SETTINGS[self.difficulty]["flame_speed_mult"]

        vel = Vec3(dx / dist * speed, dy / dist * speed, 0)
        proj = Projectile(self.render, origin, vel, (1.0, 0.3, 0.05, 1),
                           radius=0.45, is_low=True,
                           target_x_fn=lambda: self.player.node.getX())
        self.projectiles.append(proj)
        self.sfx.play("flame")

    def _on_dragon_died(self):
        self.state = STATE_VICTORY
        self.health_bg.hide()
        if hasattr(self, "fitness_adapter") and self.fitness_adapter:
            self.fitness_adapter.speak("Dragon defeated! Incredible victory!")
        self.center_text.setText(
            f"DRAGON DEFEATED\n\nFINAL SCORE: {self.score}\n\nPRESS R TO PLAY AGAIN")
        self.center_text.show()
        if self.dragon and self.dragon.node and not self.dragon.node.isEmpty():
            self.particles.spawn_burst(self.dragon.node.getPos(), color=(1.0, 0.5, 0.05, 1),
                                        count=45, speed=6.5, life=0.9, size=0.22)
        self.sfx.play("explosion", volume=1.0)
        self._trigger_screen_shake(0.5, 0.6)
        self._play_victory_fanfare()
        self._finish_fitness_session(victory=True)

    def _play_victory_fanfare(self):
        self.sfx.play("victory1")

        def _v2(task):
            self.sfx.play("victory2")
            return Task.done

        def _v3(task):
            self.sfx.play("victory3")
            return Task.done

        self.taskMgr.doMethodLater(0.16, _v2, "victory-2")
        self.taskMgr.doMethodLater(0.32, _v3, "victory-3")

    # ------------------------------------------------------------------
    # restart / UI
    # ------------------------------------------------------------------

    def _reset_game(self):
        self.state = STATE_SURVIVAL
        self.score = 0
        self.elapsed = 0.0
        self.spawn_timer = 0.0
        self.spawn_mode = "ground"
        self.mode_timer = random.uniform(7.0, 11.0)
        self.mode_warning_text.hide()
        # Reset fitness workout counters for a fresh run.
        self.fit_dodges = 0
        self.fit_jumps = 0
        self.fit_attacks = 0
        self.fit_hits_landed = 0
        self._telemetry_timer = 0.0
        self._fitness_finished = False

        for task_name in ("spawn-dragon", "dragon-fall", "victory-2", "victory-3", "mode-warning-hide"):
            self.taskMgr.remove(task_name)

        for p in self.projectiles:
            p.destroy()
        self.projectiles = []
        self.particles.clear()

        if self.dragon:
            self.dragon.destroy()
            self.dragon = None

        self.player.node.setPos(0, 0, Player.STAND_Z)
        self.player.node.setScale(1, 1, 1)
        self.player.vz = 0.0
        self.player.vx = 0.0
        self.player.on_floor = True
        self.player.duck_amount = 0.0
        self.cam_rig.setPos(self.player.node.getPos() + Vec3(0, 0, 0.7))
        self.cam_rig.setH(0)

        self.center_text.hide()
        self.health_bg.hide()

    def _update_ui(self):
        self.score_text.setText(f"SCORE: {self.score}")
        t = min(self.elapsed, SURVIVAL_DURATION)
        self.time_text.setText(f"TIME: {int(t) // 60:02d}:{int(t) % 60:02d}")
        self.difficulty_text.setText(f"DIFFICULTY: {DIFFICULTY_SETTINGS[self.difficulty]['label']}")

    def _update_cam_status(self, lateral_active):
        """Always-visible camera/tracking status line, so tracking state
        is visible in-game without needing a terminal or --debug-cam."""
        if self.pose_tracker is None:
            self.cam_status_text.setText("CAM: OFF (keyboard controls)")
            self.cam_status_text.setFg((0.8, 0.8, 0.8, 0.8))
        elif lateral_active:
            conf = self.pose_tracker.get_debug_state().get("confidence", 0.0)
            self.cam_status_text.setText(f"CAM: TRACKING ({int(conf * 100)}%)")
            self.cam_status_text.setFg((0.6, 1.0, 0.6, 0.9))
        else:
            self.cam_status_text.setText("CAM: NO PERSON DETECTED - step into view")
            self.cam_status_text.setFg((1.0, 0.75, 0.4, 0.9))
        status = {
            STATE_SURVIVAL: "SURVIVAL",
            STATE_BOSS_INTRO: "BOSS INCOMING",
            STATE_BOSS: "BOSS FIGHT",
            STATE_GAME_OVER: "",
            STATE_VICTORY: "",
        }[self.state]
        self.status_text.setText(status)

    def _update_fit_status(self):
        """Update the fitness platform connection / workout HUD line."""
        if self.fitness_api is None:
            self.fit_status_text.setText("FIT: standalone (no platform)")
            self.fit_status_text.setFg((0.6, 0.6, 0.6, 0.7))
            return
        if self.fitness_api.session_id:
            total = self.fit_dodges + self.fit_jumps + self.fit_attacks
            self.fit_status_text.setText(
                f"FIT: {self.fitness_api.athlete_name} | "
                f"D{self.fit_dodges} J{self.fit_jumps} "
                f"A{self.fit_attacks} H{self.fit_hits_landed} "
                f"({total} reps)")
            self.fit_status_text.setFg((0.6, 1.0, 0.6, 0.9))
        elif self.fitness_api.error:
            self.fit_status_text.setText("FIT: connection error")
            self.fit_status_text.setFg((1.0, 0.5, 0.4, 0.8))
        else:
            self.fit_status_text.setText("FIT: connecting...")
            self.fit_status_text.setFg((1.0, 0.85, 0.4, 0.8))

    def _finish_fitness_session(self, victory=False):
        """Submit final workout metrics to the fitness platform.

        Called once on game-over or victory. Runs synchronously since the
        render loop is already on the result screen — the brief network
        round-trip is acceptable there.  Guarded by ``_fitness_finished``
        so a restart never double-submits.
        """
        if self._fitness_finished:
            return
        self._fitness_finished = True

        if self.fitness_api is None or not self.fitness_api.session_id:
            return

        total_reps = self.fit_dodges + self.fit_jumps + self.fit_attacks
        duration = max(1.0, self.elapsed)
        avg_speed = round(total_reps / (duration / 60.0), 1) if total_reps else 0.0
        consistency = round(min(100.0, total_reps * 2.5), 1) if total_reps else 0.0
        posture = round(min(100.0, 40.0 + self.score * 0.1), 1) if self.score else 0.0
        total_score = round((posture + consistency) / 2.0, 1) if total_reps else 0.0

        # Break down the workout into sub-exercises for the platform's
        # hierarchical exercise data model.
        exercises = [
            {"exercise_name": "Dodge", "repetitions": self.fit_dodges,
             "speed": avg_speed, "consistency": consistency,
             "performance": posture, "duration": duration,
             "accuracy": posture, "calories": 0},
            {"exercise_name": "Jump", "repetitions": self.fit_jumps,
             "speed": avg_speed, "consistency": consistency,
             "performance": posture, "duration": duration,
             "accuracy": posture, "calories": 0},
            {"exercise_name": "Punch", "repetitions": self.fit_attacks,
             "speed": avg_speed, "consistency": consistency,
             "performance": posture, "duration": duration,
             "accuracy": posture, "calories": 0},
        ]

        result = self.fitness_api.finish_session(
            duration=duration,
            total_reps=total_reps,
            avg_speed=avg_speed,
            consistency_score=consistency,
            posture_score=posture,
            total_score=total_score,
            calories=None,  # let the platform compute via MET formula
            exercises=exercises,
        )

        if result and result.get("success"):
            session = result.get("session", {})
            cals = session.get("estimated_calories") or session.get("calories_burned", 0)
            print(f"[FitnessAPI] Workout saved! Calories: {cals} kcal, "
                  f"Reps: {total_reps}, Duration: {duration:.0f}s")
        # Reset session state so the next run can start fresh.
        self.fitness_api.reset()

    def userExit(self):
        if hasattr(self, "fitness_adapter") and self.fitness_adapter:
            try:
                self.fitness_adapter.close()
            except Exception:
                pass
        super().userExit()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="DragonDodge")
    parser.add_argument("--width", type=int, default=1280, help="window width")
    parser.add_argument("--height", type=int, default=720, help="window height")
    parser.add_argument("--no-camera", action="store_true", help="disable webcam control")
    parser.add_argument("--debug-cam", action="store_true", help="show webcam pose debug window")
    parser.add_argument("--cam-index", type=int, default=0, help="webcam device index")
    parser.add_argument("--quality", choices=["high", "low"], default="high",
                         help="'low' disables shadows/fog and halves particle counts for weak hardware")
    args = parser.parse_args()

    app = DragonDodgeApp(args)
    app.run()
