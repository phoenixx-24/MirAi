"""Dragon boss.

Loads assets/models/dragon.glb if present (requires panda3d-gltf); falls
back to a lightweight procedural placeholder made of boxes so the game
still runs without it.

State machine: IDLE, ATTACK, DODGE, HIT, DEAD - deliberately simple.

Combat feel:
  - Every attack has a baseline chance to be dodged, so the dragon never
    feels like a punching bag.
  - Landing a hit builds a short-lived "pressure" streak. While that
    streak is up, the dragon's dodge chance drops sharply, so a fast
    follow-up combo reliably connects - a single lucky opening punch
    isn't enough, but committing to a combo is rewarded instead of being
    randomly ignored.
  - A streak expires if you wait too long between hits, so turtling
    doesn't get the discount forever.
  - Damage scales up slightly with streak, and max health is tuned down
    from the original so an average fight (dodges included) resolves in
    well under a minute instead of feeling like a slog.
"""

import random
from panda3d.core import Vec3, Filename
from direct.interval.LerpInterval import LerpPosInterval

from .geometry import make_box


class Dragon:
    IDLE, ATTACK, DODGE, HIT, DEAD = range(5)

    # If your model faces the wrong way once it's imported, this is the
    # first thing to tweak (try 0/90/180/270).
    MODEL_YAW_OFFSET = 180

    BASE_DODGE_CHANCE = 0.55       # chance to dodge a "cold" (non-combo) hit
    STREAK_DODGE_STEP = 0.28       # dodge chance reduction per streak level
    MIN_DODGE_CHANCE = 0.05
    STREAK_WINDOW = 1.1            # seconds allowed between hits to keep a streak
    BASE_DAMAGE = 16.0
    STREAK_DAMAGE_BONUS = 4.0
    MAX_STREAK_FOR_BONUS = 4

    def __init__(self, render, loader, model_path, spawn_flame_cb, on_death_cb, sfx,
                 hit_effect_cb=None, dodge_chance_delta=0.0):
        self.render = render
        self.node = render.attachNewNode("Dragon")
        self.health = 80.0
        self.max_health = 80.0
        # Difficulty knob: shifts dodge_chance() up (easier) or down
        # (harder) around the base curve without touching the streak/combo
        # math itself.
        self.dodge_chance_delta = dodge_chance_delta
        self.state = Dragon.IDLE
        self.action_timer = random.uniform(1.5, 2.5)
        self.side_dir = 1.0
        self.base_x = 0.0
        self.spawn_flame_cb = spawn_flame_cb
        self.on_death_cb = on_death_cb
        self.hit_effect_cb = hit_effect_cb
        self.sfx = sfx

        # combo/streak tracking
        self.hit_streak = 0
        self.time_since_last_hit = 999.0

        self.model = None
        try:
            fn = Filename.fromOsSpecific(model_path)
            self.model = loader.loadModel(fn)
        except Exception as e:
            print("Could not load dragon model, using placeholder:", e)
            self.model = None

        if self.model and not self.model.isEmpty():
            self.model.reparentTo(self.node)
            self.model.setH(self.MODEL_YAW_OFFSET)
        else:
            self._build_placeholder()

    def destroy(self):
        if self.node is not None and not self.node.isEmpty():
            self.node.removeNode()

    def _build_placeholder(self):
        color = (0.15, 0.35, 0.15, 1)
        body = make_box(1.6, 3.0, 1.6, color)
        body.reparentTo(self.node)
        body.setZ(1.2)
        body.setColor(*color)

        head = make_box(1.0, 1.0, 0.9, color)
        head.reparentTo(self.node)
        head.setPos(0, -1.8, 1.6)
        head.setColor(*color)

        for side in (-1, 1):
            wing = make_box(2.2, 0.1, 1.3, color)
            wing.reparentTo(self.node)
            wing.setPos(side * 1.5, 0, 1.9)
            wing.setColor(*color)

        self._placeholder_body = body

    def set_position(self, x, y, z):
        if self.node and not self.node.isEmpty():
            self.node.setPos(x, y, z)
        self.base_x = x

    def dodge_chance(self):
        """Current dodge chance, given the active hit streak and the
        difficulty-driven dodge_chance_delta."""
        chance = (self.BASE_DODGE_CHANCE - self.hit_streak * self.STREAK_DODGE_STEP
                  + self.dodge_chance_delta)
        return max(self.MIN_DODGE_CHANCE, min(0.85, chance))

    def update(self, dt, player_node):
        if self.state == Dragon.DEAD:
            return
        if not self.node or self.node.isEmpty():
            return
        if not player_node or player_node.isEmpty():
            return

        self.time_since_last_hit += dt
        if self.time_since_last_hit > self.STREAK_WINDOW:
            self.hit_streak = 0

        # face the player horizontally
        target = Vec3(player_node.getX(), player_node.getY(), self.node.getZ())
        if (target - self.node.getPos()).length() > 0.05:
            self.node.headsUp(target)

        if self.state == Dragon.HIT:
            self.action_timer -= dt
            if self.action_timer <= 0:
                self.state = Dragon.IDLE
                self.action_timer = random.uniform(1.0, 2.0)
            return

        self.action_timer -= dt
        if self.action_timer <= 0:
            self._choose_action()

    def _choose_action(self):
        speed_mult = 1.0
        if self.health <= 28:
            speed_mult = 0.55
        elif self.health <= 56:
            speed_mult = 0.75

        if random.random() < 0.6:
            self.spawn_flame_cb(self.node.getPos())
            self.action_timer = random.uniform(1.8, 2.8) * speed_mult
        else:
            self.side_dir *= -1
            target_x = max(-3.0, min(3.0, self.base_x + self.side_dir * 2.0))
            LerpPosInterval(self.node, 0.6,
                             Vec3(target_x, self.node.getY(), self.node.getZ())).start()
            self.action_timer = random.uniform(1.2, 2.0) * speed_mult

    def receive_attack(self, damage_ignored=None):
        """Resolve one punch. Damage is derived from the current streak
        rather than taken from the caller, since streak strength lives here.
        """
        if self.state == Dragon.DEAD:
            return False

        if random.random() < self.dodge_chance():
            # telegraphed dodge - a quick sidestep/lean away from the punch
            self.state = Dragon.DODGE
            offset = 1.6 if random.random() < 0.5 else -1.6
            target_x = max(-3.0, min(3.0, self.node.getX() + offset))
            LerpPosInterval(self.node, 0.18,
                             Vec3(target_x, self.node.getY(), self.node.getZ())).start()
            self.state = Dragon.IDLE
            self.hit_streak = 0
            self.time_since_last_hit = 0.0
            return False

        streak_level = min(self.hit_streak, self.MAX_STREAK_FOR_BONUS)
        damage = self.BASE_DAMAGE + streak_level * self.STREAK_DAMAGE_BONUS
        self.health -= damage
        self.state = Dragon.HIT
        self.action_timer = 0.35
        self.hit_streak += 1
        self.time_since_last_hit = 0.0
        self.sfx.play("dragon_hit")

        # a little knockback/flinch so a landed hit reads clearly
        LerpPosInterval(self.node, 0.12,
                         Vec3(self.node.getX(), self.node.getY() + 0.25, self.node.getZ())).start()

        if self.hit_effect_cb:
            self.hit_effect_cb(self.node.getPos(), streak_level)

        if self.health <= 0:
            self._die()
        return True

    def _die(self):
        self.state = Dragon.DEAD
        self.health = 0
        self.sfx.play("dragon_die")
        self.node.setP(self.node.getP() + 80)
        self.on_death_cb()

    def health_ratio(self):
        return max(0.0, min(1.0, self.health / self.max_health))
