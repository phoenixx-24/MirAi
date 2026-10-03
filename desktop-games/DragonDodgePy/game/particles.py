"""A deliberately tiny particle system.

No GPU particle shaders, no Panda3D ParticleSystem/Physics manager (that
pulls in extra subsystems that are overkill on a Raspberry Pi 4) - just a
flat Python list of small boxes with a velocity, gravity and a fade-out,
updated once a frame. Cheap enough to spawn a handful of bursts per second
even on modest hardware; the `quality` flag on ParticleSystem lets the
caller cut particle counts further for low-spec machines.
"""

import random

from panda3d.core import TransparencyAttrib, Vec3

from .geometry import make_box

MAX_PARTICLES = 220  # hard ceiling so a chain of bursts can't runaway


class _Particle:
    __slots__ = ("node", "vel", "gravity", "life", "max_life", "spin")

    def __init__(self, node, vel, gravity, life, spin=0.0):
        self.node = node
        self.vel = vel
        self.gravity = gravity
        self.life = life
        self.max_life = life
        self.spin = spin


class ParticleSystem:
    def __init__(self, render, quality="high"):
        self.render = render
        self.particles = []
        # "low" halves particle counts for weaker machines (e.g. a Pi 4)
        self.scale = 1.0 if quality == "high" else 0.5

    def _count(self, n):
        return max(1, int(n * self.scale))

    def _spawn_one(self, pos, color, speed, size, life, gravity, spread, upward_bias):
        if len(self.particles) >= MAX_PARTICLES:
            return
        node = make_box(size, size, size, color)
        node.reparentTo(self.render)
        node.setPos(pos)
        node.setTransparency(TransparencyAttrib.MAlpha)
        node.setColor(*color)

        dir_x = random.uniform(-1, 1) * spread
        dir_y = random.uniform(-1, 1) * spread
        dir_z = random.uniform(0.1, 1.0) * upward_bias + random.uniform(-0.2, 0.2)
        vel = Vec3(dir_x, dir_y, dir_z)
        if vel.length() > 0.0001:
            vel.normalize()
        vel *= speed * random.uniform(0.6, 1.15)

        self.particles.append(_Particle(node, vel, gravity, life,
                                         spin=random.uniform(-260, 260)))

    def spawn_burst(self, pos, color=(1.0, 0.6, 0.1, 1), count=14, speed=4.0,
                     life=0.5, size=0.12, gravity=-9.0, spread=1.0, upward_bias=1.0):
        """A radial explosion-style burst - hits, impacts, deaths."""
        for _ in range(self._count(count)):
            self._spawn_one(pos, color, speed, size, life, gravity, spread, upward_bias)

    def spawn_dust(self, pos, color=(0.55, 0.5, 0.45, 0.8), count=6):
        """A small, low, slow puff - footsteps / landings."""
        for _ in range(self._count(count)):
            self._spawn_one(pos, color, speed=1.4, size=0.09, life=0.35,
                             gravity=-4.0, spread=1.4, upward_bias=0.3)

    def spawn_embers(self, pos, color=(1.0, 0.45, 0.05, 1), count=1):
        """Slow rising embers - ambient volcano atmosphere."""
        for _ in range(self._count(count)):
            self._spawn_one(pos, color, speed=0.7, size=0.07, life=2.2,
                             gravity=1.6, spread=0.5, upward_bias=1.0)

    def spawn_smoke(self, pos, color=(0.55, 0.55, 0.58, 0.35), count=1):
        """A slow, soft, fading puff - thin daytime smoke drifting off the
        crater. Visual-only, same as spawn_embers (no gravity pulling it
        down - smoke rises and dissipates rather than falling)."""
        for _ in range(self._count(count)):
            self._spawn_one(pos, color, speed=0.35, size=0.5, life=4.0,
                             gravity=0.15, spread=0.35, upward_bias=1.0)

    def update(self, dt):
        alive = []
        for p in self.particles:
            p.life -= dt
            if p.life <= 0 or p.node.isEmpty():
                if not p.node.isEmpty():
                    p.node.removeNode()
                continue
            p.vel += Vec3(0, 0, p.gravity) * dt
            p.node.setPos(p.node.getPos() + p.vel * dt)
            p.node.setH(p.node.getH() + p.spin * dt)
            t = p.life / p.max_life
            p.node.setColorScale(1.0, 1.0, 1.0, max(0.0, t))
            alive.append(p)
        self.particles = alive

    def clear(self):
        for p in self.particles:
            if not p.node.isEmpty():
                p.node.removeNode()
        self.particles = []
